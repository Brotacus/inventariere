@echo off
cd /d "%~dp0backend"

if not exist .venv (
    echo Creating Python virtual environment...
    py -m venv .venv
)

call .venv\Scripts\activate

echo Installing backend dependencies...
python -m pip install -r requirements.txt

echo Starting FastAPI...
python -m uvicorn app.main:app --reload
pause
