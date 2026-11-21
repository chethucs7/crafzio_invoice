@echo off
title Swift Invoice Starter

echo ===================================================
echo   Swift Invoice - Backend ^& Frontend Launcher
echo ===================================================
echo.

:: Launch Backend in a new window
echo Starting Backend Setup ^& Server...
start cmd /k "title Swift Invoice - Backend && cd backend && echo Creating Python Virtual Environment (if it doesn't exist)... && if not exist venv ( python -m venv venv ) && echo Activating Virtual Environment ^& Installing Dependencies... && call venv\Scripts\activate && pip install -r requirements.txt && echo Creating Database (if not exists)... && python create_db.py && echo Running migrations and seed... && python migrate.py && echo Starting Flask Backend server... && python run.py"

:: Launch Frontend in a new window
echo Starting Frontend Setup ^& Server...
:: Check if bun is installed, default to npm if not
where bun >nul 2>&1
if %errorlevel% equ 0 (
    echo Bun detected. Using bun for frontend...
    start cmd /k "title Swift Invoice - Frontend && echo Installing frontend dependencies using bun... && bun install && echo Starting development server... && bun run dev"
) else (
    echo Bun not detected. Using npm for frontend...
    start cmd /k "title Swift Invoice - Frontend && echo Installing frontend dependencies using npm... && npm install && echo Starting development server... && npm run dev"
)

echo.
echo ===================================================
echo Backend and Frontend launch scripts have been started
echo in separate windows.
echo.
echo - Backend: http://localhost:5000
echo - Frontend: Check the frontend terminal for URL (usually http://localhost:5173)
echo ===================================================
echo.
