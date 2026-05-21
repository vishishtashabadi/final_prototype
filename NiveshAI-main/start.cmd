@echo off
setlocal

echo ==========================================
echo   Nivesh AI - Docker Startup Script
echo ==========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM Check if Docker Desktop is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Docker Desktop is not running. Starting it now...
    start /b "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" >nul 2>&1
    
    echo [INFO] Waiting for Docker Desktop to start...
    :wait_for_docker
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        goto :wait_for_docker
    )
    echo [INFO] Docker Desktop is now running.
) else (
    echo [INFO] Docker Desktop is already running.
)

echo.
echo [INFO] Building and starting Nivesh AI...
echo.

REM Run docker compose
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start the application.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   SUCCESS! Application is now running.
echo   Open your browser and go to:
echo   http://localhost:8080
echo ==========================================
echo.

REM Open the browser automatically
start http://localhost:8080

pause
