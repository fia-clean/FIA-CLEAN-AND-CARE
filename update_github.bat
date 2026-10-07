@echo off
title FIA CLEAN & CARE - Push Updates to GitHub
color 0A

echo ========================================================
echo    FIA CLEAN & CARE - GITHUB AUTO PUSH & DEPLOY
echo    Version: v51.2.15 (PC Widescreen ratio for Backup modal in Day Book)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Staging all updated files...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "feat(desktop): v51.2.15 - responsive PC widescreen layout for Day Book backup modal"

echo.
echo [3/3] Pushing to GitHub (main branch)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo    SUCCESS! Updates pushed to GitHub successfully.
    echo    Version v51.2.15 is now LIVE on GitHub!
    echo ========================================================
) else (
    echo ========================================================
    echo    NOTE: If push had an issue, check git credentials.
    echo ========================================================
)
