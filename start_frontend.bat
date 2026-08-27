@echo off
cd /d "%~dp0frontend"

echo Installing frontend dependencies...
call npm install

echo Starting React/Vite...
call npm run dev
pause
