param(
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$buildRoot = Join-Path $root "desktop/.backend-build"
$target = Join-Path $root "desktop/backend-dist"

Remove-Item $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $target -Force -ErrorAction SilentlyContinue | Where-Object Name -ne ".gitkeep" | Remove-Item -Recurse -Force

Push-Location $root
try {
    & $Python -m PyInstaller --noconfirm --clean --distpath $buildRoot --workpath "desktop/.pyinstaller" "desktop/backend.spec"
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller build failed" }
    Copy-Item (Join-Path $buildRoot "cat-canvas-backend/*") $target -Recurse -Force
    foreach ($resourceTarget in @(
        (Join-Path $root "desktop/src-tauri/target/release/backend"),
        (Join-Path $root "desktop/src-tauri/target/x86_64-pc-windows-msvc/release/backend")
    )) {
        if (Test-Path $resourceTarget) {
            Remove-Item $resourceTarget -Recurse -Force
            if (Test-Path $resourceTarget) { throw "Failed to clean stale Tauri backend: $resourceTarget" }
        }
    }
} finally {
    Pop-Location
    Remove-Item $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $root "desktop/.pyinstaller") -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Backend sidecar ready: $target"
