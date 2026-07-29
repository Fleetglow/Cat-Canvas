param(
    [Parameter(Mandatory = $true)][string]$BundleDir,
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$version = (Get-Content (Join-Path $root "VERSION") -Raw).Trim()
if (-not $OutputDir) { $OutputDir = Join-Path $root "desktop/release" }
New-Item $OutputDir -ItemType Directory -Force | Out-Null
Remove-Item (Join-Path $OutputDir "*") -Recurse -Force -ErrorAction SilentlyContinue

$installer = Get-ChildItem $BundleDir -Recurse -Filter "*-setup.exe" | Select-Object -First 1
if (-not $installer) { throw "NSIS installer was not found" }
$sigPath = "$($installer.FullName).sig"
if (-not (Test-Path $sigPath)) { throw "Updater signature was not found: $sigPath" }

Copy-Item $installer.FullName $OutputDir
Copy-Item $sigPath $OutputDir
$updateName = $installer.Name
$signature = (Get-Content $sigPath -Raw).Trim()
$stream = [System.IO.File]::OpenRead($installer.FullName)
try {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $sha256 = -join ($hasher.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") })
} finally {
    $stream.Dispose()
}
$notes = if ($env:RELEASE_NOTES) { $env:RELEASE_NOTES } else { "Cat Canvas $version" }
$pubDate = (Get-Date).ToUniversalTime().ToString("o")
$encodedName = [uri]::EscapeDataString($updateName)

function Write-Manifest([string]$Path, [string]$Url) {
    $manifest = [ordered]@{
        version = $version
        notes = $notes
        pub_date = $pubDate
        platforms = [ordered]@{
            "windows-x86_64" = [ordered]@{
                url = $Url
                signature = $signature
                sha256 = $sha256
            }
        }
    }
    [System.IO.File]::WriteAllText($Path, ($manifest | ConvertTo-Json -Depth 8), $utf8)
}

Write-Manifest (Join-Path $OutputDir "latest-github.json") "https://github.com/Fleetglow/Cat-Canvas/releases/download/v$version/$encodedName"
Write-Manifest (Join-Path $OutputDir "latest-gitee.json") "https://gitee.com/hnz4796/Cat-Canvas/releases/download/v$version/$encodedName"
Write-Host "Release artifacts ready: $OutputDir"
