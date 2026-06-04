@echo off
cd /d "%~dp0"

REM Detect Python: system first, bundled fallback
set "PYEXE="
if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
if not defined PYEXE if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PYEXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYEXE where python314 >nul 2>&1 && set "PYEXE=python314"
if not defined PYEXE where python313 >nul 2>&1 && set "PYEXE=python313"
if not defined PYEXE where python312 >nul 2>&1 && set "PYEXE=python312"
if not defined PYEXE where python >nul 2>&1 && set "PYEXE=python"
if not defined PYEXE if exist "%~dp0python\python.exe" set "PYEXE=%~dp0python\python.exe"

echo Starting Cat Canvas...
echo Using Python: %PYEXE%
echo Visit: http://127.0.0.1:4796/
echo Press Ctrl+C to stop.
echo.

title Cat Canvas Server [CMD]

start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0minimize_window.ps1"

"%PYEXE%" main.py

echo.
echo Server stopped.
pause
