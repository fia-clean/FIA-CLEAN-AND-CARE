@echo off
title FIA CLEAN & CARE - Push Updates to GitHub
color 0A

echo ========================================================
echo    FIA CLEAN & CARE - GITHUB AUTO PUSH & DEPLOY
echo    Version: v51.2.2 (Day Book Profit Margin & Markup)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Staging all updated files...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "feat(daybook): v51.2.2 - dual profit margin (sales) and markup (cost/ROI) analysis with interactive ring"

echo.
echo [3/3] Pushing to GitHub (main branch)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo    SUCCESS! Updates pushed to GitHub successfully.
    echo    Version v51.2.2 is now LIVE on GitHub!
    echo ========================================================
) else (
    echo ========================================================
    echo    NOTE: If push had an issue, check git credentials.
    echo ========================================================
)

echo.
pause
