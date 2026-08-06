param(
    [string]$Backend = "",
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if (-not $Backend) { $Backend = Join-Path $root "desktop/backend-dist/cat-canvas-backend.exe" }
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$stdout = Join-Path $env:TEMP "cat-canvas-backend-smoke.out"
$stderr = Join-Path $env:TEMP "cat-canvas-backend-smoke.err"
Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue
$env:CAT_CANVAS_PORT = [string]$port
Remove-Item Env:CAT_CANVAS_DESKTOP -ErrorAction SilentlyContinue
Remove-Item Env:CAT_CANVAS_PARENT_PID -ErrorAction SilentlyContinue
$process = Start-Process $Backend -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) {
            throw "Backend exited with code $($process.ExitCode): $((Get-Content $stderr -Raw -ErrorAction SilentlyContinue).Trim())"
        }
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 2
            if ($health.ok) {
                Write-Host "Backend smoke test passed: version=$($health.version) port=$port"
                return
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    $detail = @(
        "stdout: $((Get-Content $stdout -Raw -ErrorAction SilentlyContinue).Trim())"
        "stderr: $((Get-Content $stderr -Raw -ErrorAction SilentlyContinue).Trim())"
    ) -join [Environment]::NewLine
    throw "Backend did not become healthy within $TimeoutSeconds seconds`n$detail"
} finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item Env:CAT_CANVAS_PORT -ErrorAction SilentlyContinue
}
