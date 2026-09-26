@echo off
echo ========================================================
echo   FIA CLEAN AND CARE - Git Push to GitHub
echo ========================================================
cd /d "c:\Users\DELL\Documents\antigravity\lively-lovelace"

echo Checking git status...
git status -s

echo Adding modified files...
git add index.html dev.html sw.js manifest.json icon-192.png icon-512.png icon.svg apple-touch-icon.png favicon.png lib/ modules/ public/ src/ deploy_to_github.bat deploy_to_github.ps1

echo Committing updates...
git commit -m "feat(release): v51.0.2 - add period filters (Today, Week, Month, All Time, Custom) and KPI summary to billing history"

echo Pushing to GitHub (origin main)...
git push origin main

echo ========================================================
echo   Done! GitHub and GitHub Pages are now updating.
echo   Please wait 30-60 seconds, then hard refresh (Ctrl+F5)
echo   or clear site cache on your browser/PWA.
echo ========================================================
