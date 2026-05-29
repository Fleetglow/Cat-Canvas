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

:: 设置窗口标题（用于后续最小化定位）
title Infinite Canvas Server [CMD]

:: 创建临时脚本：3秒后打开浏览器并最小化本窗口
> "%TEMP%\ic_launch_helper.vbs" (
    echo Set WshShell = WScript.CreateObject("WScript.Shell"^)
    echo WScript.Sleep 3000
    echo WshShell.Run "http://127.0.0.1:3000/"
    echo WshShell.AppActivate "Infinite Canvas Server [CMD]"
    echo WScript.Sleep 300
    echo WshShell.SendKeys "%% n"
)

:: 后台执行辅助脚本
start /b wscript //nologo "%TEMP%\ic_launch_helper.vbs"

:: 启动服务器（前台运行，显示日志）
"%PYEXE%" main.py

:: 清理临时脚本
del "%TEMP%\ic_launch_helper.vbs" 2>nul

echo.
echo Server stopped.
pause
