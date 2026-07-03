@echo off
cd /d "%~dp0"

REM Detect Python: system first, bundled fallback
set "PYEXE="

REM Try py launcher first (most reliable for system Python)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('py -3 -c "import sys; print(sys.executable)"') do set "PYEXE=%%i"
    if defined PYEXE goto :python_found
)

REM Try PATH commands and verify they work
for %%c in (python python3 python314 python313 python312 python311 python310) do (
    where %%c >nul 2>&1
    if not errorlevel 1 (
        %%c --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%%c"
            goto :python_found
        )
    )
)

REM Try common installation paths
for %%v in (314 313 312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe" --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python%%v\python.exe"
            goto :python_found
        )
    )
    if exist "%LOCALAPPDATA%\Python\Python%%v\python.exe" (
        "%LOCALAPPDATA%\Python\Python%%v\python.exe" --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%LOCALAPPDATA%\Python\Python%%v\python.exe"
            goto :python_found
        )
    )
)

REM Check pythoncore paths
for %%v in (14 13 12 11 10) do (
    if exist "%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe" (
        "%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe" --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe"
            goto :python_found
        )
    )
)

REM Fallback to bundled Python
if exist "%~dp0python\python.exe" (
    "%~dp0python\python.exe" --version >nul 2>&1
    if not errorlevel 1 (
        set "PYEXE=%~dp0python\python.exe"
        goto :python_found
    )
)

echo [ERROR] No working Python found.
echo Please install Python 3.10-3.14 from python.org
pause
exit /b 1

:python_found

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
