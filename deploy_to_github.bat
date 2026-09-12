@echo off
echo ========================================================
echo   FIA CLEAN AND CARE - Git Push to GitHub
echo ========================================================
cd /d "c:\Users\DELL\Documents\antigravity\lively-lovelace"

echo Checking git status...
git status -s

echo Adding modified files...
git add index.html sw.js src/ deploy_to_github.bat deploy_to_github.ps1

echo Committing updates...
git commit -m "fix: 5-column clean bill invoice formatting, automatic wholesale rate auto-apply, and SW v24 cache refresh"

echo Pushing to GitHub (origin main)...
git push origin main

echo ========================================================
echo   Done! GitHub and GitHub Pages are now updating.
echo   Please wait 30-60 seconds, then hard refresh (Ctrl+F5)
echo   or clear site cache on your browser/PWA.
echo ========================================================
pause
