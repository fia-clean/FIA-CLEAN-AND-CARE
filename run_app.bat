@echo off
title FIA Clean & Care - Launch Application
color 0B

echo ====================================================================
echo             FIA CLEAN & CARE - APPLICATION LAUNCHER
echo                  Version: v51.2.31 (Live Release)
echo ====================================================================
echo.

cd /d "%~dp0"

echo Launching FIA Clean & Care in your browser...
start "" "index.html"

echo.
echo Application started successfully!
timeout /t 3 >nul
