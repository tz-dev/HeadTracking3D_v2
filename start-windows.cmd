@echo off
setlocal
cd /d "%~dp0" || exit /b 1

set "PORT=8765"
where py >nul 2>&1
if %errorlevel%==0 (
  set "PYEXE=py -3"
) else (
  where python >nul 2>&1
  if not %errorlevel%==0 (
    echo Python 3 was not found. Install Python 3 and try again.
    pause
    exit /b 1
  )
  set "PYEXE=python"
)

echo.
echo   HeadTracking3D - Your Screen Becomes a Window
echo   -----------------------------------------
echo   Opening http://127.0.0.1:%PORT%/index.html
echo   Press Ctrl+C to stop the local server.
echo.
start "" "http://127.0.0.1:%PORT%/index.html"
%PYEXE% -m http.server %PORT% --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo The local server could not start. Is port %PORT% already in use?
  pause
)
