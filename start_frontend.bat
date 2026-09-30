@echo off
cd /d "%~dp0frontend"

echo Installing frontend dependencies...
call npm ci
if errorlevel 1 exit /b 1

echo Starting React/Vite...
call npm run dev
pause
