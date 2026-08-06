use base64::{engine::general_purpose::STANDARD, Engine};
use fs2::available_space;
use futures_util::StreamExt;
use minisign_verify::{PublicKey, Signature};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, State, WindowEvent, RESTART_EXIT_CODE,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;
use uuid::Uuid;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const GITHUB_UPDATE_ENDPOINT: &str =
    "https://raw.githubusercontent.com/Fleetglow/Cat-Canvas/desktop-updates/latest-github.json";
const GITEE_UPDATE_ENDPOINT: &str =
    "https://gitee.com/hnz4796/Cat-Canvas/raw/desktop-updates/latest-gitee.json";
const UPDATER_PUBLIC_KEY: &str = "RWTQHQVhO41rHdw+VdoEuKr250hBZgKWj28KFES/csCm6FYK1sqkFh7h";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendSnapshot {
    status: String,
    url: String,
    error: String,
    migration_pending: bool,
    user_root: String,
    version: String,
}

struct PendingUpdate {
    version: String,
    source: String,
    bytes: Vec<u8>,
}

struct DesktopState {
    child: Mutex<Option<Child>>,
    snapshot: Mutex<BackendSnapshot>,
    pending_update: Mutex<Option<PendingUpdate>>,
    user_root: PathBuf,
    local_root: PathBuf,
    migration_marker: PathBuf,
    exit_allowed: Mutex<bool>,
    close_pending: Mutex<bool>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    available: bool,
    current_version: String,
    version: String,
    notes: String,
    date: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSourceStatus {
    source: String,
    ok: bool,
    version: String,
    error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadResult {
    version: String,
    sha256: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationReport {
    copied_files: usize,
    skipped_files: usize,
    source: String,
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn update_log(app: &AppHandle, message: &str) {
    let path = app
        .state::<DesktopState>()
        .local_root
        .join("Logs/updater.log");
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {message}", unix_timestamp());
    }
}

fn ensure_desktop_dirs(user_root: &Path, local_root: &Path) -> Result<(), String> {
    for path in [
        user_root.join("Projects"),
        user_root.join("Assets"),
        user_root.join("Config"),
        user_root.join("Exports"),
        user_root.join("Backups/Updates"),
        user_root.join("Backups/Installers"),
        local_root.join("Cache"),
        local_root.join("Logs"),
        local_root.join("Temp"),
    ] {
        fs::create_dir_all(&path)
            .map_err(|error| format!("无法创建 {}：{error}", path_text(&path)))?;
    }
    prune_old_entries(&user_root.join("Backups/Installers"), 2)?;
    Ok(())
}

fn has_meaningful_user_data(user_root: &Path) -> bool {
    ["Projects", "Assets", "Config"]
        .iter()
        .map(|name| user_root.join(name))
        .any(|path| {
            fs::read_dir(path)
                .ok()
                .and_then(|mut entries| entries.next())
                .is_some()
        })
}

fn write_migration_marker(state: &DesktopState, source: &str) -> Result<(), String> {
    if let Some(parent) = state.migration_marker.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::json!({
        "completedAt": unix_timestamp(),
        "source": source,
    });
    fs::write(
        &state.migration_marker,
        serde_json::to_vec_pretty(&payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("无法写入迁移标记：{error}"))
}

fn directory_size(path: &Path) -> u64 {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return 0;
    };
    if metadata.file_type().is_symlink() {
        return 0;
    }
    if metadata.is_file() {
        return metadata.len();
    }
    fs::read_dir(path)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| directory_size(&entry.path()))
        .sum()
}

fn copy_without_overwrite(source: &Path, target: &Path) -> Result<(usize, usize), String> {
    let metadata = fs::symlink_metadata(source).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Ok((0, 1));
    }
    if metadata.is_file() {
        if target.exists() {
            return Ok((0, 1));
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(source, target).map_err(|error| {
            format!(
                "复制 {} 到 {} 失败：{error}",
                path_text(source),
                path_text(target)
            )
        })?;
        return Ok((1, 0));
    }
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    let mut copied = 0;
    let mut skipped = 0;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let (next_copied, next_skipped) =
            copy_without_overwrite(&entry.path(), &target.join(entry.file_name()))?;
        copied += next_copied;
        skipped += next_skipped;
    }
    Ok((copied, skipped))
}

fn copy_replace(source: &Path, target: &Path) -> Result<usize, String> {
    let metadata = fs::symlink_metadata(source).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Ok(0);
    }
    if metadata.is_file() {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(source, target).map_err(|error| error.to_string())?;
        return Ok(1);
    }
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    let mut copied = 0;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        copied += copy_replace(&entry.path(), &target.join(entry.file_name()))?;
    }
    Ok(copied)
}

fn prune_old_entries(root: &Path, keep: usize) -> Result<(), String> {
    if !root.is_dir() {
        return Ok(());
    }
    let mut entries: Vec<_> = fs::read_dir(root)
        .map_err(|error| error.to_string())?
        .flatten()
        .collect();
    entries.sort_by_key(|entry| entry.file_name());
    let remove_count = entries.len().saturating_sub(keep);
    for entry in entries.into_iter().take(remove_count) {
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
        } else {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

// 固定桌面端口：随机端口会换 origin，WebView localStorage 全丢
const DESKTOP_PORT: u16 = 47960;

fn pick_free_port() -> Result<u16, String> {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| format!("无法分配本地端口：{error}"))
}

fn pick_desktop_port() -> Result<u16, String> {
    match TcpListener::bind(("127.0.0.1", DESKTOP_PORT)) {
        Ok(listener) => listener
            .local_addr()
            .map(|address| address.port())
            .map_err(|error| format!("无法读取本地端口：{error}")),
        Err(_) => pick_free_port(),
    }
}

fn append_log<R: Read + Send + 'static>(reader: R, path: PathBuf, prefix: &'static str) {
    thread::spawn(move || {
        let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) else {
            return;
        };
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let _ = writeln!(file, "[{prefix}] {line}");
        }
    });
}

fn backend_command(app: &AppHandle) -> Result<(Command, PathBuf), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;
    let bundled = resource_dir.join("backend/cat-canvas-backend.exe");
    if bundled.is_file() {
        let mut command = Command::new(&bundled);
        command.current_dir(bundled.parent().unwrap_or(&resource_dir));
        return Ok((command, bundled));
    }

    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let bundled_python = project_root.join("python/python.exe");
    let mut command = if bundled_python.is_file() {
        Command::new(bundled_python)
    } else {
        Command::new("python")
    };
    command
        .arg(project_root.join("main.py"))
        .current_dir(&project_root);
    Ok((command, project_root.join("main.py")))
}

fn start_backend(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopState>();
    if state
        .child
        .lock()
        .map_err(|_| "后端状态锁已损坏")?
        .is_some()
    {
        return Ok(());
    }

    let port = pick_desktop_port()?;
    let token = Uuid::new_v4().simple().to_string();
    let session_url = format!("http://127.0.0.1:{port}/desktop-session?token={token}");
    let (mut command, executable) = backend_command(app)?;
    command
        .env("CAT_CANVAS_DESKTOP", "1")
        .env("CAT_CANVAS_PORT", port.to_string())
        .env("CAT_CANVAS_TOKEN", &token)
        .env("CAT_CANVAS_PARENT_PID", std::process::id().to_string())
        .env("CAT_CANVAS_USER_ROOT", &state.user_root)
        .env("CAT_CANVAS_LOCAL_ROOT", &state.local_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动后端 {}：{error}", path_text(&executable)))?;
    let log_path = state.local_root.join("Logs/backend.log");
    if let Some(stdout) = child.stdout.take() {
        append_log(stdout, log_path.clone(), "stdout");
    }
    if let Some(stderr) = child.stderr.take() {
        append_log(stderr, log_path, "stderr");
    }
    *state.child.lock().map_err(|_| "后端状态锁已损坏")? = Some(child);
    {
        let mut snapshot = state.snapshot.lock().map_err(|_| "后端状态锁已损坏")?;
        snapshot.status = "starting".into();
        snapshot.url = session_url.clone();
        snapshot.error.clear();
        snapshot.migration_pending = false;
    }

    let app_handle = app.clone();
    thread::spawn(move || {
        for _ in 0..300 {
            if TcpStream::connect_timeout(
                &format!("127.0.0.1:{port}")
                    .parse()
                    .expect("valid loopback address"),
                Duration::from_millis(100),
            )
            .is_ok()
            {
                if let Ok(mut snapshot) = app_handle.state::<DesktopState>().snapshot.lock() {
                    snapshot.status = "ready".into();
                }
                let _ = app_handle.emit("backend-ready", ());
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
        if let Ok(mut snapshot) = app_handle.state::<DesktopState>().snapshot.lock() {
            snapshot.status = "error".into();
            snapshot.error = "后端启动超过 30 秒，请查看 Logs/backend.log".into();
        }
    });
    Ok(())
}

fn stop_backend(app: &AppHandle) {
    let Some(state) = app.try_state::<DesktopState>() else {
        return;
    };
    let Ok(mut guard) = state.child.lock() else {
        return;
    };
    let Some(mut child) = guard.take() else {
        return;
    };
    #[cfg(windows)]
    {
        let mut command = Command::new("taskkill");
        command
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW);
        let _ = command.status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[tauri::command]
fn backend_status(state: State<'_, DesktopState>) -> Result<BackendSnapshot, String> {
    if let Some(child) = state.child.lock().map_err(|_| "后端状态锁已损坏")?.as_mut() {
        if let Some(exit) = child.try_wait().map_err(|error| error.to_string())? {
            let mut snapshot = state.snapshot.lock().map_err(|_| "后端状态锁已损坏")?;
            snapshot.status = "error".into();
            snapshot.error = format!("后端已退出：{exit}");
        }
    }
    state
        .snapshot
        .lock()
        .map(|snapshot| snapshot.clone())
        .map_err(|_| "后端状态锁已损坏".into())
}

#[tauri::command]
async fn pick_legacy_folder(app: AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| {
            path.into_path()
                .map(|path| path_text(&path))
                .map_err(|error| error.to_string())
        })
        .transpose()
}

#[tauri::command]
fn skip_legacy_import(app: AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopState>();
    write_migration_marker(&state, "skipped")?;
    state
        .snapshot
        .lock()
        .map_err(|_| "后端状态锁已损坏")?
        .migration_pending = false;
    start_backend(&app)
}

#[tauri::command]
async fn import_legacy_data(app: AppHandle, source: String) -> Result<MigrationReport, String> {
    let source = fs::canonicalize(&source).map_err(|error| format!("旧版目录不可用：{error}"))?;
    if !source.join("main.py").is_file()
        && !source.join("data").is_dir()
        && !source.join("assets").is_dir()
    {
        return Err("所选目录不是有效的 Cat Canvas 便携版目录".into());
    }
    let state = app.state::<DesktopState>();
    if state.user_root.starts_with(&source) || source.starts_with(&state.user_root) {
        return Err("旧版目录不能与新的用户数据目录互相包含".into());
    }

    let mappings = [
        (source.join("data"), state.user_root.join("Projects")),
        (source.join("assets"), state.user_root.join("Assets")),
        (
            source.join("output"),
            state.user_root.join("Assets/generated"),
        ),
        (source.join("API/.env"), state.user_root.join("Config/.env")),
        (
            source.join("global_config.json"),
            state.user_root.join("Config/global_config.json"),
        ),
        (
            source.join("history.json"),
            state.user_root.join("Projects/history.json"),
        ),
        (
            source.join("data/asset_library.json"),
            state.user_root.join("Config/asset_library.json"),
        ),
        (
            source.join("data/api_providers.json"),
            state.user_root.join("Config/api_providers.json"),
        ),
        (
            source.join("workflows/custom"),
            state.user_root.join("Config/workflows/custom"),
        ),
        (
            source.join("workflows/自定义"),
            state.user_root.join("Config/workflows/自定义"),
        ),
    ];
    let required: u64 = mappings
        .iter()
        .filter(|(path, _)| path.exists())
        .map(|(path, _)| directory_size(path))
        .sum();
    let free = available_space(&state.user_root).map_err(|error| error.to_string())?;
    if free < required.saturating_add(128 * 1024 * 1024) {
        return Err(format!(
            "磁盘空间不足：需要约 {} MB",
            required / 1024 / 1024
        ));
    }

    let mut copied_files = 0;
    let mut skipped_files = 0;
    for (from, to) in mappings {
        if !from.exists() {
            continue;
        }
        let (copied, skipped) = copy_without_overwrite(&from, &to)?;
        copied_files += copied;
        skipped_files += skipped;
    }
    write_migration_marker(&state, &path_text(&source))?;
    state
        .snapshot
        .lock()
        .map_err(|_| "后端状态锁已损坏")?
        .migration_pending = false;
    start_backend(&app)?;
    Ok(MigrationReport {
        copied_files,
        skipped_files,
        source: path_text(&source),
    })
}

fn create_update_backup(app: &AppHandle) -> Result<PathBuf, String> {
    let state = app.state::<DesktopState>();
    let version = app.package_info().version.to_string();
    let root = state.user_root.join("Backups/Updates");
    let target = root.join(format!("{}-{}", version, unix_timestamp()));
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;
    for name in ["Projects", "Config"] {
        let source = state.user_root.join(name);
        if source.exists() {
            copy_replace(&source, &target.join(name))?;
        }
    }
    prune_old_entries(&root, 3)?;
    Ok(target)
}

fn manifest_platform(update: &tauri_plugin_updater::Update) -> Option<&serde_json::Value> {
    update
        .raw_json
        .get("platforms")?
        .as_object()?
        .values()
        .find(|platform| {
            platform.get("url").and_then(|value| value.as_str())
                == Some(update.download_url.as_str())
        })
}

fn manifest_sha256(update: &tauri_plugin_updater::Update) -> Option<String> {
    manifest_platform(update)
        .and_then(|platform| platform.get("sha256"))
        .or_else(|| update.raw_json.get("sha256"))
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_ascii_lowercase())
}

fn manifest_parts(update: &tauri_plugin_updater::Update) -> Option<Vec<String>> {
    Some(
        manifest_platform(update)?
            .get("parts")?
            .as_array()?
            .iter()
            .map(|value| value.as_str().map(str::to_owned))
            .collect::<Option<_>>()?,
    )
}

fn manifest_size(update: &tauri_plugin_updater::Update) -> Option<u64> {
    manifest_platform(update)?.get("size")?.as_u64()
}

fn update_endpoint(source: &str) -> Result<url::Url, String> {
    let endpoint = match source {
        "github" => GITHUB_UPDATE_ENDPOINT,
        "gitee" => GITEE_UPDATE_ENDPOINT,
        _ => return Err("未知更新源".into()),
    };
    endpoint
        .parse()
        .map_err(|error| format!("更新源地址无效：{error}"))
}

fn source_updater(
    app: &AppHandle,
    source: &str,
    timeout: Duration,
) -> Result<tauri_plugin_updater::Updater, String> {
    app.updater_builder()
        .endpoints(vec![update_endpoint(source)?])
        .map_err(|error| error.to_string())?
        .timeout(timeout)
        .build()
        .map_err(|error| error.to_string())
}

fn verify_update_signature(bytes: &[u8], encoded_signature: &str) -> Result<(), String> {
    let signature_text = String::from_utf8(
        STANDARD
            .decode(encoded_signature)
            .map_err(|error| format!("更新签名编码无效：{error}"))?,
    )
    .map_err(|error| format!("更新签名文本无效：{error}"))?;
    let public_key = PublicKey::from_base64(UPDATER_PUBLIC_KEY)
        .map_err(|error| format!("更新公钥无效：{error}"))?;
    let signature =
        Signature::decode(&signature_text).map_err(|error| format!("更新签名无效：{error}"))?;
    public_key
        .verify(bytes, &signature, true)
        .map_err(|error| format!("更新包 minisign 校验失败：{error}"))
}

async fn probe_update_download(
    source: &str,
    update: &tauri_plugin_updater::Update,
) -> Result<(), String> {
    let url = if source == "gitee" {
        manifest_parts(update)
            .and_then(|parts| parts.into_iter().next())
            .ok_or_else(|| "Gitee 更新清单缺少分块地址".to_string())?
    } else {
        update.download_url.to_string()
    };
    let response = reqwest::Client::builder()
        .user_agent("Cat-Canvas-Updater")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let mut stream = response.bytes_stream();
    match stream.next().await {
        Some(Ok(chunk)) if !chunk.is_empty() => Ok(()),
        Some(Err(error)) => Err(error.to_string()),
        _ => Err("更新包下载端点未返回数据".into()),
    }
}

async fn download_gitee_installer(
    app: &AppHandle,
    update: &tauri_plugin_updater::Update,
) -> Result<Vec<u8>, String> {
    let parts = manifest_parts(update).ok_or_else(|| "Gitee 更新清单缺少分块地址".to_string())?;
    let total = manifest_size(update).ok_or_else(|| "Gitee 更新清单缺少文件大小".to_string())?;
    let client = reqwest::Client::builder()
        .user_agent("Cat-Canvas-Updater")
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|error| error.to_string())?;
    let mut downloaded = 0u64;
    let mut bytes = Vec::with_capacity(total as usize);
    for url in parts {
        let response = client
            .get(url)
            .send()
            .await
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| error.to_string())?;
            downloaded += chunk.len() as u64;
            bytes.extend_from_slice(&chunk);
            let _ = app.emit(
                "desktop-update-progress",
                UpdateProgress {
                    downloaded,
                    total: Some(total),
                },
            );
        }
    }
    if downloaded != total {
        return Err(format!(
            "Gitee 更新分块不完整：应为 {total} 字节，实际 {downloaded} 字节"
        ));
    }
    verify_update_signature(&bytes, &update.signature)?;
    Ok(bytes)
}

#[tauri::command]
async fn check_desktop_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    update_log(&app, &format!("checking from {current_version}"));
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    let update = match updater.check().await {
        Ok(update) => update,
        Err(error) => {
            update_log(&app, &format!("check failed: {error}"));
            return Err(error.to_string());
        }
    };
    update_log(
        &app,
        update
            .as_ref()
            .map(|item| format!("update available: {}", item.version))
            .as_deref()
            .unwrap_or("no update"),
    );
    Ok(match update {
        Some(update) => UpdateInfo {
            available: true,
            current_version,
            version: update.version,
            notes: update.body.unwrap_or_default(),
            date: update.date.map(|date| date.to_string()).unwrap_or_default(),
        },
        None => UpdateInfo {
            available: false,
            current_version: current_version.clone(),
            version: current_version,
            notes: String::new(),
            date: String::new(),
        },
    })
}

#[tauri::command]
async fn probe_update_source(app: AppHandle, source: String) -> UpdateSourceStatus {
    let result = async {
        let update = source_updater(&app, &source, Duration::from_secs(20))?
            .check()
            .await
            .map_err(|error| error.to_string())?;
        Ok::<_, String>(match update {
            Some(item) => {
                probe_update_download(&source, &item).await?;
                item.version
            }
            None => app.package_info().version.to_string(),
        })
    }
    .await;
    match result {
        Ok(version) => UpdateSourceStatus {
            source,
            ok: true,
            version,
            error: String::new(),
        },
        Err(error) => UpdateSourceStatus {
            source,
            ok: false,
            version: String::new(),
            error,
        },
    }
}

#[tauri::command]
async fn download_desktop_update(app: AppHandle, source: String) -> Result<DownloadResult, String> {
    update_log(&app, &format!("download requested from {source}"));
    *app.state::<DesktopState>()
        .pending_update
        .lock()
        .map_err(|_| "更新状态锁已损坏")? = None;
    let update = source_updater(&app, &source, Duration::from_secs(600))?
        .check()
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "当前已是最新版本".to_string())?;
    let expected_sha256 =
        manifest_sha256(&update).ok_or_else(|| "更新清单缺少 SHA-256".to_string())?;
    let version = update.version.clone();
    let bytes = match if source == "gitee" {
        download_gitee_installer(&app, &update).await
    } else {
        let progress_app = app.clone();
        let mut downloaded = 0u64;
        update
            .download(
                move |chunk, total| {
                    downloaded += chunk as u64;
                    let _ = progress_app.emit(
                        "desktop-update-progress",
                        UpdateProgress { downloaded, total },
                    );
                },
                || {},
            )
            .await
            .map_err(|error| error.to_string())
    } {
        Ok(bytes) => bytes,
        Err(error) => {
            update_log(&app, &format!("download failed from {source}: {error}"));
            return Err(error);
        }
    };
    let actual_sha256 = format!("{:x}", Sha256::digest(&bytes));
    if actual_sha256 != expected_sha256 {
        return Err("更新包 SHA-256 校验失败".into());
    }
    update_log(
        &app,
        &format!("download verified from {source}: {version} {actual_sha256}"),
    );
    *app.state::<DesktopState>()
        .pending_update
        .lock()
        .map_err(|_| "更新状态锁已损坏")? = Some(PendingUpdate {
        version: version.clone(),
        source,
        bytes,
    });
    Ok(DownloadResult {
        version,
        sha256: actual_sha256,
    })
}

#[tauri::command]
async fn install_desktop_update(app: AppHandle) -> Result<(), String> {
    let pending = app
        .state::<DesktopState>()
        .pending_update
        .lock()
        .map_err(|_| "更新状态锁已损坏")?
        .take()
        .ok_or_else(|| "尚未下载更新包".to_string())?;
    let result = async {
        create_update_backup(&app)?;
        let cleanup_app = app.clone();
        let updater = app
            .updater_builder()
            .endpoints(vec![update_endpoint(&pending.source)?])
            .map_err(|error| error.to_string())?
            .timeout(Duration::from_secs(20))
            .on_before_exit(move || {
                stop_backend(&cleanup_app);
                cleanup_app.cleanup_before_exit();
            })
            .build()
            .map_err(|error| error.to_string())?;
        let update = updater
            .check()
            .await
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "更新版本已不可用".to_string())?;
        if update.version != pending.version {
            return Err("远端版本已变化，请重新下载".into());
        }
        update
            .install(&pending.bytes)
            .map_err(|error| error.to_string())
    }
    .await;
    if result.is_err() {
        *app.state::<DesktopState>()
            .pending_update
            .lock()
            .map_err(|_| "更新状态锁已损坏")? = Some(pending);
    }
    result
}

#[tauri::command]
fn finish_desktop_close(app: AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopState>();
    *state.exit_allowed.lock().map_err(|_| "退出状态锁已损坏")? = true;
    *state.close_pending.lock().map_err(|_| "退出状态锁已损坏")? = false;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn cancel_desktop_close(app: AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopState>();
    *state.close_pending.lock().map_err(|_| "退出状态锁已损坏")? = false;
    Ok(())
}

fn request_desktop_close(app: &AppHandle) {
    let _ = app.emit("desktop-close-requested", ());
}

#[tauri::command]
fn save_output_file(app: AppHandle, url: String, filename: String) -> Result<(), String> {
    let filename = Path::new(&filename)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("download")
        .to_string();
    let callback_app = app.clone();
    app.dialog()
        .file()
        .set_file_name(&filename)
        .save_file(move |path| {
            let Some(path) = path.and_then(|path| path.into_path().ok()) else {
                return;
            };
            tauri::async_runtime::spawn(async move {
                let result = async {
                    let session_url = callback_app
                        .state::<DesktopState>()
                        .snapshot
                        .lock()
                        .map_err(|_| "后端状态锁已损坏".to_string())?
                        .url
                        .clone();
                    let mut endpoint =
                        reqwest::Url::parse(&session_url).map_err(|error| error.to_string())?;
                    let token = endpoint
                        .query_pairs()
                        .find_map(|(key, value)| (key == "token").then(|| value.into_owned()))
                        .ok_or_else(|| "桌面会话令牌不存在".to_string())?;
                    endpoint.set_path("/api/download-output");
                    endpoint.set_query(None);
                    endpoint
                        .query_pairs_mut()
                        .append_pair("url", &url)
                        .append_pair("name", &filename);
                    let bytes = reqwest::Client::new()
                        .get(endpoint)
                        .header(
                            reqwest::header::COOKIE,
                            format!("cat_canvas_session={token}"),
                        )
                        .send()
                        .await
                        .map_err(|error| error.to_string())?
                        .error_for_status()
                        .map_err(|error| error.to_string())?
                        .bytes()
                        .await
                        .map_err(|error| error.to_string())?;
                    fs::write(path, bytes).map_err(|error| error.to_string())
                }
                .await;
                if let Err(error) = result {
                    callback_app
                        .dialog()
                        .message(format!("下载失败：{error}"))
                        .title("下载失败")
                        .show(|_| {});
                }
            });
        });
    Ok(())
}

#[tauri::command]
fn open_backup_folder(state: State<'_, DesktopState>) -> Result<(), String> {
    let path = state.user_root.join("Backups");
    let mut command = Command::new("explorer.exe");
    command.arg(&path);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let user_root = app.path().document_dir()?.join("Cat Canvas");
            let local_root = app.path().app_local_data_dir()?;
            let migration_marker = user_root.join("Config/.desktop-migrated.json");
            let migration_pending =
                !migration_marker.exists() && !has_meaningful_user_data(&user_root);
            ensure_desktop_dirs(&user_root, &local_root).map_err(std::io::Error::other)?;
            let snapshot = BackendSnapshot {
                status: if migration_pending {
                    "migration"
                } else {
                    "starting"
                }
                .into(),
                url: String::new(),
                error: String::new(),
                migration_pending,
                user_root: path_text(&user_root),
                version: app.package_info().version.to_string(),
            };
            app.manage(DesktopState {
                child: Mutex::new(None),
                snapshot: Mutex::new(snapshot),
                pending_update: Mutex::new(None),
                user_root,
                local_root,
                migration_marker,
                exit_allowed: Mutex::new(false),
                close_pending: Mutex::new(false),
            });
            if !migration_pending {
                start_backend(app.handle()).map_err(std::io::Error::other)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_status,
            pick_legacy_folder,
            skip_legacy_import,
            import_legacy_data,
            check_desktop_update,
            probe_update_source,
            download_desktop_update,
            install_desktop_update,
            save_output_file,
            open_backup_folder,
            finish_desktop_close,
            cancel_desktop_close,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("failed to build Cat Canvas desktop app");
    app.run(|app, event| {
        match event {
            RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } => {
                let state = app.state::<DesktopState>();
                let allowed = state.exit_allowed.lock().map(|value| *value).unwrap_or(false);
                if allowed {
                    stop_backend(app);
                } else if let Ok(mut pending) = state.close_pending.lock() {
                    api.prevent_close();
                    if !*pending {
                        *pending = true;
                        request_desktop_close(app);
                    }
                } else {
                    api.prevent_close();
                }
            }
            RunEvent::ExitRequested { api, code, .. } => {
                let state = app.state::<DesktopState>();
                if code == Some(RESTART_EXIT_CODE) {
                    stop_backend(app);
                    return;
                }
                let allowed = state.exit_allowed.lock().map(|value| *value).unwrap_or(false);
                if allowed {
                    stop_backend(app);
                } else if let Ok(mut pending) = state.close_pending.lock() {
                    if !*pending {
                        *pending = true;
                        api.prevent_exit();
                        request_desktop_close(app);
                    } else {
                        api.prevent_exit();
                    }
                } else {
                    api.prevent_exit();
                }
            }
            RunEvent::Exit => stop_backend(app),
            _ => {}
        }
    });
}
