@echo off
echo Starting Expense Tracker ML Service...
cd ml-service

set "PYTHON_CMD="

if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=venv\Scripts\python.exe"
)

if "%PYTHON_CMD%"=="" (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if "%PYTHON_CMD%"=="" (
    py --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py"
)

if "%PYTHON_CMD%"=="" (
    echo Python was not found. Install Python 3.12, then run:
    echo cd ml-service
    echo python -m venv venv
    echo venv\Scripts\pip install -r requirements.txt
    echo venv\Scripts\python app.py
    pause
    exit /b 1
)
rem If the venv doesn't exist, create it and install requirements for a smoother developer experience
if not exist "venv" (
    echo Creating virtual environment in ml-service\venv using %PYTHON_CMD%
    %PYTHON_CMD% -m venv venv
    if exist "venv\Scripts\python.exe" (
        echo Activating venv and installing requirements...
        venv\Scripts\python.exe -m pip install --upgrade pip
        venv\Scripts\python.exe -m pip install -r requirements.txt
    ) else (
        echo Failed to create venv; falling back to system python to run app.py
    )
)

rem Start the ML service using the venv python if available, otherwise system python
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe app.py
) else (
    %PYTHON_CMD% app.py
)
pause
