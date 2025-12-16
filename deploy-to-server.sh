#!/bin/bash
# Deploy to Server Script - Linux/Mac version

echo "🚀 Starting deployment to lyra-app.co.in..."

# Step 1: Build locally
echo ""
echo "📦 Building application locally..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Step 2: Create deployment package
echo ""
echo "📁 Creating deployment package..."
timestamp=$(date +%Y%m%d_%H%M%S)
deployDir="deploy_$timestamp"
mkdir -p "$deployDir"

# Copy necessary files
cp -r .next "$deployDir/"
cp package.json "$deployDir/"
cp package-lock.json "$deployDir/" 2>/dev/null || true
cp next.config.ts "$deployDir/"
cp ecosystem.config.cjs "$deployDir/"
cp -r public "$deployDir/" 2>/dev/null || true

echo "✅ Deployment package created: $deployDir"

# Step 3: Upload to server
echo ""
echo "📤 Uploading to server..."
scp -r "$deployDir" suman@lyra-app.co.in:/home/suman/

echo ""
echo "🔧 Deploying on server..."
ssh suman@lyra-app.co.in << EOF
cd /var/www/lyra-app-v3
pm2 stop all
cp -r /home/suman/$deployDir/.next .
npm install --production --no-optional
pm2 restart all
rm -rf /home/suman/$deployDir
echo "✅ Deployment complete!"
EOF

# Cleanup local deployment folder
rm -rf "$deployDir"

echo ""
echo "✨ Deployment finished successfully!"
