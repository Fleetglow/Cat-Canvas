param(
    [string]$ExpectedVersion = ""
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$version = (Get-Content (Join-Path $root "VERSION") -Raw).Trim()
if ($version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$') {
    throw "VERSION is not valid SemVer: $version"
}
if ($ExpectedVersion -and $ExpectedVersion.TrimStart('v') -ne $version) {
    throw "Tag version $ExpectedVersion does not match VERSION $version"
}

$packagePath = Join-Path $root "desktop/package.json"
$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$package.version = $version
[System.IO.File]::WriteAllText($packagePath, ($package | ConvertTo-Json -Depth 20), $utf8)

$lockPath = Join-Path $root "desktop/package-lock.json"
if (Test-Path $lockPath) {
    $lock = Get-Content $lockPath -Raw
    $lockVersionPattern = [regex]::new('(\"version\"\s*:\s*\")[^\"]+(\")')
    $lock = $lockVersionPattern.Replace($lock, "`${1}$version`${2}", 2)
    [System.IO.File]::WriteAllText($lockPath, $lock, $utf8)
}

$configPath = Join-Path $root "desktop/src-tauri/tauri.conf.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.version = $version
[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 30), $utf8)

$cargoPath = Join-Path $root "desktop/src-tauri/Cargo.toml"
$cargo = Get-Content $cargoPath -Raw
$versionPattern = [regex]::new('(?m)^(version\s*=\s*")[^"]+("\s*)$')
$cargo = $versionPattern.Replace($cargo, "`${1}$version`${2}", 1)
[System.IO.File]::WriteAllText($cargoPath, $cargo, $utf8)

Write-Host "Desktop version synchronized: $version"
