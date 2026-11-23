@echo off
setlocal enabledelayedexpansion
title FIA CLEAN & CARE - One-Click App Updater v52.0.0
color 0A

echo ====================================================================
echo             FIA CLEAN & CARE - ONE-CLICK APP UPDATER
echo               Version: v52.0.0 (Locked Final Stable Release)
echo ====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking Changed Files...
git status -s
echo.

set COMMIT_MSG=Release v52.0.0: Unified pure accounting engine with 117 automated regression tests (Locked Final Stable Milestone) (%date% %time%)

echo [2/4] Staging all files...
git add -A
echo      Done.
echo.

echo [3/4] Committing changes: "%COMMIT_MSG%"...
git commit -m "%COMMIT_MSG%"
echo.

echo [4/4] Pushing update to GitHub (origin main)...
git push origin main
if %errorlevel% neq 0 (
    color 0E
    echo.
    echo [NOTE] Push had conflict or remote update. Syncing with remote...
    git pull origin main --rebase
    git push origin main
)

if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ====================================================================
    echo        [SUCCESS] APP v52.0.0 UPDATED AND PUSHED TO GITHUB!
    echo ====================================================================
    echo.
    echo  ------------------------------------------------------------------
    echo   HOW TO ACTIVATE v52.0.0 ON YOUR PHONE / PC:
    echo  ------------------------------------------------------------------
    echo   1. Open FIA Clean App on your phone / PC.
    echo   2. Tap the version badge at top: [ v52.0.0 ]
    echo   3. Tap 'OK' - Cache clears and updates instantly!
    echo.
    echo   (Or go to Settings --^> 'Check for Updates / Clear Cache')
    echo ====================================================================
) else (
    color 0C
    echo.
    echo ====================================================================
    echo   [ERROR] Push failed. Please check your internet connection.
    echo ====================================================================
    echo.
)

echo.
pause
