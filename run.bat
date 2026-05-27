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

start /b cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:3000/"
"%PYEXE%" main.py

echo.
echo Server stopped.
pause
