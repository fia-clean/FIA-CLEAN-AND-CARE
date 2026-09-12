Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   FIA CLEAN AND CARE - Git Push to GitHub" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Set-Location "c:\Users\DELL\Documents\antigravity\lively-lovelace"

Write-Host "Checking git status..." -ForegroundColor Yellow
git status -s

Write-Host "Adding modified files..." -ForegroundColor Yellow
git add index.html sw.js src/ deploy_to_github.bat deploy_to_github.ps1

Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "fix: Update invoice header to FIA CLEAN AND CARE, EDATHANATTUKARA, MOB: 8086452106, WHOLESALE/RETAIL INVOICE and SW v25 cache refresh"

Write-Host "Pushing to GitHub origin main..." -ForegroundColor Yellow
git push origin main

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   Done! Changes pushed to GitHub successfully." -ForegroundColor Green
Write-Host "   GitHub Pages / Hosting will update in ~30 seconds." -ForegroundColor Green
Write-Host "   Please do a Hard Refresh (Ctrl + F5) on your browser/app." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
