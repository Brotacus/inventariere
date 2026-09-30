@echo off
cd /d "%~dp0backend"

if not exist .venv\Scripts\python.exe (
    echo Creating Python virtual environment...
    py -m venv .venv
    if errorlevel 1 exit /b 1
)

call .venv\Scripts\activate
if errorlevel 1 exit /b 1

echo Installing backend dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo Starting FastAPI...
python -m uvicorn app.main:app --reload --host 0.0.0.0
pause
