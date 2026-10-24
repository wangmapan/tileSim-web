@echo off
setlocal
cd /d "%~dp0"
echo TileSim Windows release publisher
echo Close this window only after the package path is printed.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-windows-release.ps1" %*
set "exitCode=%ERRORLEVEL%"
echo.
if not "%exitCode%"=="0" echo Publishing failed with exit code %exitCode%.
if "%exitCode%"=="0" echo Publishing completed. The output folder was opened in Explorer.
pause
exit /b %exitCode%
