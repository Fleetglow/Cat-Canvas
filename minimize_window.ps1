Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3000/"
Start-Sleep -Milliseconds 800

# Win32 API 定义
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# 只找 cmd.exe，标题模糊匹配，最小化第一个有效窗口
$found = $false
Get-Process cmd | Where-Object { $_.MainWindowTitle -like "*Infinite Canvas*" -and $_.MainWindowHandle -ne [IntPtr]::Zero } | ForEach-Object {
    if (-not $found) {
        [Win32]::ShowWindow($_.MainWindowHandle, 6)
        $found = $true
    }
}
