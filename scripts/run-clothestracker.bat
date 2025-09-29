@echo off
setlocal enabledelayedexpansion

set IMAGE_NAME=clothestracker
set HOST_PORT=4242
set CONTAINER_PORT=4000

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker is required but was not found in PATH.
  exit /b 1
)

echo Building Docker image "%IMAGE_NAME%"...
docker build -t %IMAGE_NAME% %~dp0.. || goto :error

echo Running container on http://localhost:%HOST_PORT% (press Ctrl+C to stop)...
docker run --rm -p %HOST_PORT%:%CONTAINER_PORT% %IMAGE_NAME%
exit /b %errorlevel%

:error
echo Failed to build Docker image.
exit /b 1
