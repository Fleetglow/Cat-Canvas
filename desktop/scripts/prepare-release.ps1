param(
    [Parameter(Mandatory = $true)][string]$BundleDir,
    [string]$OutputDir = "",
    [string]$Version = "",
    [string]$ReleaseNotesFile = ""
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$version = if ($Version) { $Version.TrimStart('v') } else { (Get-Content (Join-Path $root "VERSION") -Raw).Trim() }
if (-not $OutputDir) { $OutputDir = Join-Path $root "desktop/release" }
New-Item $OutputDir -ItemType Directory -Force | Out-Null
Remove-Item (Join-Path $OutputDir "*") -Recurse -Force -ErrorAction SilentlyContinue

$escapedVersion = [regex]::Escape($version)
$installer = Get-ChildItem $BundleDir -Recurse -Filter "*-setup.exe" |
    Where-Object { $_.Name -match "_${escapedVersion}_x64-setup\.exe$" } |
    Select-Object -First 1
if (-not $installer) { throw "NSIS installer for $version was not found" }
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
$notes = if ($ReleaseNotesFile) {
    [System.IO.File]::ReadAllText((Resolve-Path $ReleaseNotesFile), [System.Text.Encoding]::UTF8).Trim()
} elseif ($env:RELEASE_NOTES) {
    $env:RELEASE_NOTES
} else {
    "Cat Canvas $version"
}
$pubDate = (Get-Date).ToUniversalTime().ToString("o")
$githubName = $updateName -replace ' ', '.'
$encodedGithubName = [uri]::EscapeDataString($githubName)
$giteeParts = @()
$partSize = 4MB
$source = [System.IO.File]::OpenRead($installer.FullName)
try {
    $index = 0
    $buffer = [byte[]]::new($partSize)
    while (($count = $source.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $partName = "$githubName.part$($index.ToString('000'))"
        $partPath = Join-Path $OutputDir $partName
        $part = [byte[]]::new($count)
        [System.Array]::Copy($buffer, $part, $count)
        [System.IO.File]::WriteAllBytes($partPath, $part)
        $giteeParts += "https://gitee.com/hnz4796/Cat-Canvas/raw/desktop-updates/$([uri]::EscapeDataString($partName))"
        $index++
    }
} finally {
    $source.Dispose()
}

function Write-Manifest([string]$Path, [string]$Url, [string[]]$Parts = @()) {
    $platform = [ordered]@{
        url = $Url
        signature = $signature
        sha256 = $sha256
    }
    if ($Parts.Count -gt 0) {
        $platform.parts = $Parts
        $platform.size = $installer.Length
    }
    $manifest = [ordered]@{
        version = $version
        notes = $notes
        pub_date = $pubDate
        platforms = [ordered]@{ "windows-x86_64" = $platform }
    }
    [System.IO.File]::WriteAllText($Path, ($manifest | ConvertTo-Json -Depth 8), $utf8)
}

Write-Manifest (Join-Path $OutputDir "latest-github.json") "https://github.com/Fleetglow/Cat-Canvas/releases/download/v$version/$encodedGithubName"
Write-Manifest (Join-Path $OutputDir "latest-gitee.json") $giteeParts[0] $giteeParts
Write-Host "Release artifacts ready: $OutputDir"
