@echo off
setlocal enabledelayedexpansion
title FIA CLEAN & CARE - One-Click App Updater
color 0A

echo ====================================================================
echo             FIA CLEAN & CARE - ONE-CLICK APP UPDATER
echo ====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Git Repository Status...
git status -s
echo.

set /p COMMIT_MSG="Enter commit note (or press Enter for default): "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=Update FIA Clean App to latest version (%date% %time%)

echo.
echo [2/4] Staging all modified files...
git add -A
echo      Done.

echo.
echo [3/4] Committing changes...
git commit -m "!COMMIT_MSG!"
echo.

echo [4/4] Pushing changes to GitHub (origin main)...
git push origin main
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Push failed! Trying git pull --rebase then push...
    git pull origin main --rebase
    git push origin main
)

echo.
echo ====================================================================
echo                 SUCCESSFULLY UPDATED TO GITHUB!
echo ====================================================================
echo.
echo  ==================================================================
echo   HOW TO ACTIVATE THE UPDATE IMMEDIATELY ON YOUR PHONE / DEVICE:
echo  ==================================================================
echo.
echo   Because FIA Clean is an offline PWA app, your phone keeps the
echo   old version saved in cache until refreshed.
echo.
echo   STEP 1 (Easiest - Inside App):
echo     1. Open the FIA app on your phone.
echo     2. Go to Settings (the Gear icon).
echo     3. Tap "Check for Updates / Clear Cache".
echo     4. Tap OK - The app will instantly reload with latest version!
echo.
echo   STEP 2 (If using Chrome Browser on Android):
echo     1. Tap the 3 dots in the top right.
echo     2. Tap "Settings" -> "Site settings" -> "All sites".
echo     3. Search "FIA" and tap "Clear & reset".
echo.
echo   STEP 3 (If installed on Phone Home Screen):
echo     1. Swipe away / close the FIA app from recent apps.
echo     2. Ensure WiFi or Mobile Data is ON.
echo     3. Open the FIA app again.
echo.
echo ====================================================================
echo.
pause
