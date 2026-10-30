@echo off
setlocal enabledelayedexpansion
title FIA CLEAN & CARE - App Updater v51.2.25
color 0A

echo ====================================================================
echo             FIA CLEAN & CARE - ONE-CLICK APP UPDATER
echo                  Version: v51.2.25 (Live Release)
echo ====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git Status and Changed Files...
git status -s
echo.

set DEFAULT_MSG=Update billing items visibility and customer change credit balance v51.2.25 (%date% %time%)
set /p COMMIT_MSG="Enter commit note (or press Enter for default): "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=!DEFAULT_MSG!

echo.
echo [2/4] Staging all files...
git add -A
echo      Done.

echo.
echo [3/4] Committing: "!COMMIT_MSG!"...
git commit -m "!COMMIT_MSG!"
echo.

echo [4/4] Pushing update to GitHub (origin main)...
git push origin main
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [NOTE] Push failed, pulling latest commits with rebase...
    git pull origin main --rebase
    git push origin main
)

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ====================================================================
    echo             SUCCESSFULLY UPDATED AND DEPLOYED TO GITHUB!
    echo ====================================================================
    echo.
    echo  ==================================================================
    echo   HOW TO ACTIVATE v51.2.25 ON YOUR MOBILE PHONE / TABLET:
    echo  ==================================================================
    echo.
    echo   METHOD 1 (Easiest - 1 Click inside the App):
    echo     1. Open FIA Clean App on your phone.
    echo     2. At the top header, tap the version badge: [ v51.2.25 ]
    echo     3. Tap 'OK' to confirm - the app clears cache and reloads instantly!
    echo.
    echo   METHOD 2 (From Settings):
    echo     1. Tap 'Settings' (Gear icon at top).
    echo     2. Tap 'Check for Updates / Clear Cache'.
    echo     3. Tap 'OK'.
    echo.
    echo ====================================================================
) else (
    color 0C
    echo.
    echo [ERROR] Could not push to GitHub. Please check your internet connection.
    echo.
)

pause
