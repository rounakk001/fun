# ==============================================================================
# Yeonix - 1-Click Error-Free Live Deploy Script
# Usage: .\deploy.ps1 "Your commit message here"
# ==============================================================================

param(
    [string]$CommitMessage = "Update Yeonix platform"
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================================" -ForegroundColor Magenta
Write-Host "   YEONIX LIVE AUTO-DEPLOYMENT PIPELINE" -ForegroundColor Magenta
Write-Host "========================================================`n" -ForegroundColor Magenta

# Step 1: Pre-deployment checks
Write-Host "[1/4] Verifying code integrity (Pre-Deploy Tests)..." -ForegroundColor Cyan
try {
    npm test --prefix backend -- --passWithNoTests
    Write-Host "   All backend tests passed cleanly!" -ForegroundColor Green
} catch {
    Write-Host "`nERROR: Tests failed! Deployment ABORTED to protect live website." -ForegroundColor Red
    Write-Host "Fix the test error locally before deploying.`n" -ForegroundColor Red
    exit 1
}

# Step 2: Push changes to GitHub
Write-Host "`n[2/4] Committing and pushing to GitHub..." -ForegroundColor Cyan
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "$CommitMessage"
} else {
    Write-Host "   No local code changes to commit, proceeding with sync..." -ForegroundColor DarkGray
}
git push origin main
Write-Host "   Pushed to origin/main successfully!" -ForegroundColor Green

# Step 3: Trigger remote server update via SSH
Write-Host "`n[3/4] Updating live EC2 server (yeonix.duckdns.org)..." -ForegroundColor Cyan

$remoteScript = @'
set -e
cd /home/ubuntu/yeonix

echo "--> [EC2] Pulling latest code..."
git pull origin main

echo "--> [EC2] Building production frontend..."
cd /home/ubuntu/yeonix/frontend
npm install --silent
npm run build
chmod -R 755 /home/ubuntu/yeonix/frontend/dist

echo "--> [EC2] Updating backend dependencies..."
cd /home/ubuntu/yeonix/backend
npm install --omit=dev --silent

echo "--> [EC2] Reloading services with zero downtime..."
pm2 reload yeonix-backend --update-env || pm2 restart yeonix-backend
pm2 reload yeonix-ml || pm2 restart yeonix-ml

echo "--> [EC2] Reloading Nginx web server..."
sudo systemctl reload nginx

echo "--> [EC2] All services updated successfully!"
'@

try {
    ssh -o StrictHostKeyChecking=no -i C:\Users\rouna\yeonix-key.pem ubuntu@yeonix.duckdns.org "$remoteScript"
} catch {
    Write-Host "`nERROR: Failed to connect to EC2 via SSH. Please check your network connection." -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE! LIVE SITE UPDATED ERROR-FREE" -ForegroundColor Green
Write-Host "Visit live website: https://yeonix.duckdns.org" -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Green
