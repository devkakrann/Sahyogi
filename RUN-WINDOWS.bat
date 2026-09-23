@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo        SAHAYAK AI - LOCAL START
echo ========================================
echo.
where node >nul 2>nul || (echo Node.js is not installed. Install Node.js LTS first.&pause&exit /b 1)
echo Installing/checking server dependencies...
call npm.cmd install --prefix server
if errorlevel 1 goto fail
echo Installing/checking client dependencies...
call npm.cmd install --prefix client
if errorlevel 1 goto fail
echo.
echo Starting Sahayak AI...
call npm.cmd run live
exit /b 0
:fail
echo.
echo Dependency installation failed. Check your internet connection and npm output.
pause
exit /b 1
