const invoke = window.__TAURI__.core.invoke;
const statusText = document.getElementById('status');
const progress = document.getElementById('progress');
const migration = document.getElementById('migration');
const errorPanel = document.getElementById('error');
const errorText = document.getElementById('errorText');
const importButton = document.getElementById('import');
const skipButton = document.getElementById('skip');
let navigating = false;

function setBusy(busy, text = '') {
  importButton.disabled = busy;
  skipButton.disabled = busy;
  if (text) statusText.textContent = text;
}

async function poll() {
  if (navigating) return;
  try {
    const state = await invoke('backend_status');
    migration.hidden = !state.migrationPending;
    errorPanel.hidden = state.status !== 'error';
    progress.hidden = state.status === 'migration' || state.status === 'error';
    if (state.status === 'migration') {
      statusText.textContent = `数据将保存在：${state.userRoot}`;
    } else if (state.status === 'starting') {
      statusText.textContent = '正在启动本地服务…';
    } else if (state.status === 'ready' && state.url) {
      navigating = true;
      statusText.textContent = '启动完成';
      location.replace(state.url);
      return;
    } else if (state.status === 'error') {
      statusText.textContent = '启动失败';
      errorText.textContent = state.error || '未知错误';
    }
  } catch (error) {
    statusText.textContent = `桌面外壳异常：${error}`;
  }
  setTimeout(poll, 250);
}

importButton.addEventListener('click', async () => {
  try {
    const source = await invoke('pick_legacy_folder');
    if (!source) return;
    setBusy(true, '正在检查并复制旧版数据…');
    const result = await invoke('import_legacy_data', { source });
    statusText.textContent = `已导入 ${result.copiedFiles} 个文件，正在启动…`;
    migration.hidden = true;
  } catch (error) {
    statusText.textContent = '导入失败';
    errorPanel.hidden = false;
    errorText.textContent = String(error);
  } finally {
    setBusy(false);
  }
});

skipButton.addEventListener('click', async () => {
  try {
    setBusy(true, '正在启动…');
    await invoke('skip_legacy_import');
    migration.hidden = true;
  } catch (error) {
    errorPanel.hidden = false;
    errorText.textContent = String(error);
  } finally {
    setBusy(false);
  }
});

document.getElementById('retry').addEventListener('click', () => location.reload());
document.getElementById('backups').addEventListener('click', () => invoke('open_backup_folder'));
poll();
