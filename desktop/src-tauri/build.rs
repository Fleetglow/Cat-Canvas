fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "backend_status",
            "pick_legacy_folder",
            "skip_legacy_import",
            "import_legacy_data",
            "check_desktop_update",
            "probe_update_source",
            "download_desktop_update",
            "install_desktop_update",
            "open_backup_folder",
        ]),
    ))
    .unwrap();
}
