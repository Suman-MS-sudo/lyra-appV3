# Deploy to Server Script
# This script builds locally and deploys to your 1GB RAM server

Write-Host "🚀 Starting deployment to lyra-app.co.in..." -ForegroundColor Cyan

# Step 1: Build locally
Write-Host "`n📦 Building application locally..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Create deployment package
Write-Host "`n📁 Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployDir = "deploy_$timestamp"
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

# Copy necessary files
Copy-Item -Recurse -Force .next "$deployDir\"
Copy-Item package.json "$deployDir\"
Copy-Item package-lock.json "$deployDir\" -ErrorAction SilentlyContinue
Copy-Item next.config.ts "$deployDir\"
Copy-Item ecosystem.config.cjs "$deployDir\"
Copy-Item -Recurse public "$deployDir\" -ErrorAction SilentlyContinue

Write-Host "✅ Deployment package created: $deployDir" -ForegroundColor Green

# Step 3: Upload to server
Write-Host "`n📤 Uploading to server..." -ForegroundColor Yellow
Write-Host "Run these commands to complete deployment:" -ForegroundColor Cyan
Write-Host ""
Write-Host "# 1. Upload the deployment package:" -ForegroundColor White
Write-Host "scp -r $deployDir suman@lyra-app.co.in:/home/suman/" -ForegroundColor Gray
Write-Host ""
Write-Host "# 2. SSH into server:" -ForegroundColor White
Write-Host "ssh suman@lyra-app.co.in" -ForegroundColor Gray
Write-Host ""
Write-Host "# 3. On server, run:" -ForegroundColor White
Write-Host "cd /var/www/lyra-app-v3" -ForegroundColor Gray
Write-Host "pm2 stop all" -ForegroundColor Gray
Write-Host "cp -r /home/suman/$deployDir/.next ." -ForegroundColor Gray
Write-Host "npm install --production" -ForegroundColor Gray
Write-Host "pm2 restart all" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Deployment package ready!" -ForegroundColor Green
