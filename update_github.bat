@echo off
title FIA CLEAN & CARE - Push Updates to GitHub
color 0A

echo ========================================================
echo    FIA CLEAN & CARE - GITHUB AUTO PUSH & DEPLOY
echo    Version: v51.2.12 (Set D&O in original 5th place, This Month in 6th place, and add D&O to Main Modules)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Staging all updated files...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "feat(dashboard): v51.2.12 - place D&O at original position 5, This Month at position 6, and add D&O to Main Modules"

echo.
echo [3/3] Pushing to GitHub (main branch)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo    SUCCESS! Updates pushed to GitHub successfully.
    echo    Version v51.2.12 is now LIVE on GitHub!
    echo ========================================================
) else (
    echo ========================================================
    echo    NOTE: If push had an issue, check git credentials.
    echo ========================================================
)
