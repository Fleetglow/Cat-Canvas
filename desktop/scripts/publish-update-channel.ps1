param(
    [Parameter(Mandatory = $true)][string]$AssetDir,
    [Parameter(Mandatory = $true)][string]$CommitMessage
)

$ErrorActionPreference = "Stop"
if (-not $env:GH_PUSH_TOKEN -or -not $env:GITEE_TOKEN) {
    throw "GH_PUSH_TOKEN and GITEE_TOKEN are required"
}

function Publish-Channel([string]$Path, [string]$RemoteUrl) {
    Push-Location $Path
    try {
        git init -b desktop-updates
        git config user.name "Fleetglow"
        git config user.email "47961924@qq.com"
        git add .
        git commit -m $CommitMessage
        if ($LASTEXITCODE -ne 0) { throw "Failed to commit update channel" }
        git remote add target $RemoteUrl
        git config http.version HTTP/1.1
        git config http.postBuffer 104857600
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            git push target HEAD:desktop-updates --force
            if ($LASTEXITCODE -eq 0) { return }
            if ($attempt -lt 3) {
                Write-Warning "Update channel push failed, retrying ($attempt/3)"
                Start-Sleep -Seconds (10 * $attempt)
            }
        }
        throw "Failed to push update channel after 3 attempts"
    } finally {
        Pop-Location
    }
}

$githubChannel = Join-Path $env:RUNNER_TEMP "cat-canvas-update-github"
$giteeChannel = Join-Path $env:RUNNER_TEMP "cat-canvas-update-gitee"
Remove-Item $githubChannel, $giteeChannel -Recurse -Force -ErrorAction SilentlyContinue
New-Item $githubChannel, $giteeChannel -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $AssetDir "latest-github.json") $githubChannel
Copy-Item (Join-Path $AssetDir "latest-gitee.json") $githubChannel
Copy-Item (Join-Path $AssetDir "latest-github.json") $giteeChannel
Copy-Item (Join-Path $AssetDir "latest-gitee.json") $giteeChannel
Get-ChildItem $AssetDir -File | Where-Object { $_.Name -like "*.part*" -or $_.Name -like "*.sig" } |
    Copy-Item -Destination $giteeChannel

Publish-Channel $githubChannel "https://x-access-token:$env:GH_PUSH_TOKEN@github.com/Fleetglow/Cat-Canvas.git"
Publish-Channel $giteeChannel "https://hnz4796:$env:GITEE_TOKEN@gitee.com/hnz4796/Cat-Canvas.git"
