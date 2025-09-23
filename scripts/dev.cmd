@echo off
setlocal
set PORT=%1
if "%PORT%"=="" set PORT=5173
cd /d %~dp0\..
echo Starting Vite dev server on port %PORT%...
start /min cmd /c npm --prefix apps\vplm-portal run dev
REM Wait a moment then open browser
timeout /t 3 /nobreak >nul
start https://localhost:%PORT%
endlocal

