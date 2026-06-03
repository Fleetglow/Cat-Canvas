@echo off
cd /d "%~dp0"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" (
    for %%v in (314 313 312 1) do (
        if not defined PYEXE (
            where python%%v >nul 2>&1 && set "PYEXE=python%%v"
        )
    )
    if not defined PYEXE set "PYEXE=python"
)

echo Starting ComfyUI-API-Modelscope...
echo Using Python: %PYEXE%
echo Visit: http://127.0.0.1:4796/
echo Press Ctrl+C to stop.
echo.

title Infinite Canvas Server [CMD]

start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0minimize_window.ps1"

"%PYEXE%" main.py

echo.
echo Server stopped.
pause