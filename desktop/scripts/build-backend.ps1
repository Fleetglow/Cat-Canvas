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
} finally {
    Pop-Location
    Remove-Item $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $root "desktop/.pyinstaller") -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Backend sidecar ready: $target"
