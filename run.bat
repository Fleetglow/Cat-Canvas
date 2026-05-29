@echo off
cd /d "%~dp0"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" (
    REM 备用：如果 bundled Python 不存在，找系统 Python 3.14/3.13/3.12/3.11
    for %%v in (314 313 312 1) do (
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

:: 后台启动 PowerShell 脚本：3秒后打开浏览器并最小化本窗口
start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0minimize_window.ps1"

:: 启动服务器（前台运行，显示日志）
"%PYEXE%" main.py

echo.
echo Server stopped.
pause
