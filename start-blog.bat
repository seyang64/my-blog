@echo off
rem Double-click to start a local server for the blog and open it in the browser.
cd /d "%~dp0"

set PY=
where python >nul 2>nul && set PY=python
if not defined PY where py >nul 2>nul && set PY=py
if not defined PY (
  echo Python is not installed. Install it from https://www.python.org/downloads/
  pause
  exit /b 1
)

echo My Blog is running at http://localhost:8000
echo Close this window to stop the blog.
echo.
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8000"
%PY% -m http.server 8000
pause
