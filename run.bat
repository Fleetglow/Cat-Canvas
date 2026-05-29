@echo off
cd /d "%~dp0"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" (
    REM 备用：如果 bundled Python 不存在，找系统 Python 3.14/3.13/3.12/3.11
    for %%v in (314 313 312 311) do (
        if not defined PYEXE (
            where python%%v >nul 2>&1 && set "PYEXE=python%%v"
        )
    )
    if not defined PYEXE set "PYEXE=python"
)

echo Starting ComfyUI-API-Modelscope...
echo Using Python: %PYEXE%
echo Visit: http://127.0.0.1:3000/
echo Press Ctrl+C to stop.
echo.

title Infinite Canvas Server [CMD]

:: 创建 PowerShell 辅助脚本：3秒后打开浏览器，然后最小化本 CMD 窗口
> "%TEMP%\ic_minimize.ps1" (
    echo Start-Sleep -Seconds 3
    echo Start-Process "http://127.0.0.1:3000/"
    echo Start-Sleep -Milliseconds 800
    echo.
    echo # 调用 Win32 API 最小化窗口
    echo $code = @'
    echo using System;
    echo using System.Runtime.InteropServices;
    echo public class Win32 {
    echo     [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    echo     [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    echo     [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    echo }
    echo '@
    echo Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    echo.
    echo # 只找 cmd.exe 进程，按标题模糊匹配
    echo $found = $false
    echo Get-Process cmd ^| Where-Object { $_.MainWindowTitle -like "*Infinite Canvas*" } ^| ForEach-Object {
    echo     if ((-not $found) -and $_.MainWindowHandle -ne [IntPtr]::Zero) {
    echo         [Win32]::ShowWindow($_.MainWindowHandle, 6)
    echo         $found = $true
    echo     }
    echo }
)

:: 后台执行 PowerShell 脚本
start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%TEMP%\ic_minimize.ps1"

:: 启动服务器（前台运行，显示日志）
"%PYEXE%" main.py

:: 清理临时脚本
del "%TEMP%\ic_minimize.ps1" 2>nul

echo.
echo Server stopped.
pause
