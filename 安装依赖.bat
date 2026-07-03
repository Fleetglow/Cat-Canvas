@echo off
cd /d "%~dp0"

echo ============================================
echo   Install Dependencies
echo ============================================
echo.

REM Detect Python: system first, bundled fallback
set "PYEXE="

echo [INFO] Detecting Python...

REM Try py launcher first (most reliable for system Python)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('py -3 -c "import sys; print(sys.executable)"') do set "PYEXE=%%i"
    if defined PYEXE (
        echo [OK] Found system Python via py launcher: !PYEXE!
        goto :python_found
    )
)

REM Try PATH commands and verify they work
for %%c in (python python3 python314 python313 python312 python311 python310) do (
    where %%c >nul 2>&1
    if not errorlevel 1 (
        %%c --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%%c"
            echo [OK] Found system Python in PATH: %%c
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
            echo [OK] Found system Python: !PYEXE!
            goto :python_found
        )
    )
    if exist "%LOCALAPPDATA%\Python\Python%%v\python.exe" (
        "%LOCALAPPDATA%\Python\Python%%v\python.exe" --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%LOCALAPPDATA%\Python\Python%%v\python.exe"
            echo [OK] Found system Python: !PYEXE!
            goto :python_found
        )
    )
)

REM Check pythoncore paths (like pythoncore-3.14-64)
for %%v in (14 13 12 11 10) do (
    if exist "%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe" (
        "%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe" --version >nul 2>&1
        if not errorlevel 1 (
            set "PYEXE=%LOCALAPPDATA%\Python\pythoncore-3.%%v-64\python.exe"
            echo [OK] Found system Python: !PYEXE!
            goto :python_found
        )
    )
)

REM Fallback to bundled Python (last resort)
if exist "%~dp0python\python.exe" (
    "%~dp0python\python.exe" --version >nul 2>&1
    if not errorlevel 1 (
        set "PYEXE=%~dp0python\python.exe"
        echo [WARN] Using bundled Python as fallback: !PYEXE!
        goto :python_found
    )
)

echo [ERROR] No working Python found.
echo Please install Python 3.10-3.14 from python.org
pause
exit /b 1

:python_found
setlocal enabledelayedexpansion

echo.

"%PYEXE%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [1/3] Installing pip via get-pip.py...
    if not exist "%~dp0get-pip.py" (
        echo Downloading get-pip.py...
        powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%~dp0get-pip.py'" 2>nul
        if not exist "%~dp0get-pip.py" (
            echo [ERROR] Failed to download get-pip.py. Check network connection.
            pause
            exit /b 1
        )
    )
    "%PYEXE%" "%~dp0get-pip.py" --quiet
    if errorlevel 1 (
        echo [ERROR] Failed to install pip.
        pause
        exit /b 1
    )
    echo [OK] pip installed.
)

echo.
echo [2/3] Trying offline install from packages folder...
"%PYEXE%" -m pip install --no-index --find-links=packages -r requirements.txt
if not errorlevel 1 (
    echo.
    echo [OK] Offline install succeeded.
    goto :extra
)

echo [3/3] Offline failed, trying online install...
"%PYEXE%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Install failed. Check your network connection.
    pause
    exit /b 1
)

:extra
echo.
echo [Extra] Installing WebSocket support for Uvicorn...
"%PYEXE%" -m pip install "uvicorn[standard]"
if errorlevel 1 (
    echo [WARN] Failed to install uvicorn[standard]. WebSocket features may be unavailable.
)

:done
echo.
echo ============================================
echo   Done. Run start.bat to launch the server.
echo ============================================
pause
