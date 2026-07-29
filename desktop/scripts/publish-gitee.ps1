param(
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$Tag,
    [Parameter(Mandatory = $true)][string]$AssetDir
)

$ErrorActionPreference = "Stop"
$base = "https://gitee.com/api/v5/repos/hnz4796/Cat-Canvas"
$encodedTag = [uri]::EscapeDataString($Tag)
try {
    $release = Invoke-RestMethod "${base}/releases/tags/${encodedTag}?access_token=$Token"
} catch {
    $release = Invoke-RestMethod "$base/releases" -Method Post -Body @{
        access_token = $Token
        tag_name = $Tag
        name = "Cat Canvas $Tag"
        body = "Cat Canvas Windows x64 desktop release"
        target_commitish = "main"
        prerelease = "false"
    }
}

Get-ChildItem $AssetDir -File | Where-Object { $_.Name -notlike "latest-*.json" } | ForEach-Object {
    Write-Host "Uploading to Gitee: $($_.Name)"
    Invoke-RestMethod "$base/releases/$($release.id)/attach_files" -Method Post -Form @{
        file = $_
        access_token = $Token
    } | Out-Null
}
