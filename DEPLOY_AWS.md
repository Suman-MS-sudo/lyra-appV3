# AWS Deployment Guide

## Server Details
- IP: 54.151.13.99
- User: suman
- Repository: https://github.com/Suman-MS-sudo/lyra-appV3.git

## Step 1: Connect to Server

```bash
ssh suman@54.151.13.99
```

If you need to use an SSH key:
```bash
ssh -i path/to/your-key.pem suman@54.151.13.99
```

## Step 2: Install Dependencies on Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Git (if not already installed)
sudo apt install -y git
```

## Step 3: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository
git clone https://github.com/Suman-MS-sudo/lyra-appV3.git

# Navigate to project
cd lyra-appV3
```

## Step 4: Setup Environment Variables

```bash
# Create .env.local file
nano .env.local
```

Paste the following content:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://fjghhrubobqwplvokszz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTU2OTUsImV4cCI6MjA4MDY3MTY5NX0.t84NMCPSj-nd7kUFX7Gjx7zsHkpkiQI5kbcAVbXbsxc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA5NTY5NSwiZXhwIjoyMDgwNjcxNjk1fQ.4VZ68bW9iyvTW1sPd_9mUNEY1xCkNTAD6QLeOAphkuw

# JWT Secret
JWT_SECRET=your_secure_jwt_secret_key_change_this

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_lmKnnhDWFEBx4e
RAZORPAY_KEY_SECRET=OrxoAbykv5jDlvzJxgPifKh6

# App Configuration
NEXT_PUBLIC_APP_URL=https://54.151.13.99:443
NODE_ENV=production
PROXY_PORT=8080
```

Save with `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Install Node Modules

```bash
npm install
```

## Step 6: Generate SSL Certificates

```bash
npm run setup:certs
```

## Step 7: Configure Firewall (if UFW is enabled)

```bash
# Check if UFW is active
sudo ufw status

# If active, allow ports
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 22/tcp
sudo ufw reload
```

## Step 8: Start Application with PM2

```bash
# Start the app using PM2 ecosystem config
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Run the command that PM2 outputs (it will be something like):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u suman --hp /home/suman
```

## Step 9: Check Status

```bash
# Check PM2 processes
pm2 list

# View logs
pm2 logs

# Check specific app logs
pm2 logs lyra-https
pm2 logs lyra-proxy
```

## Step 10: Access Your Application

- **HTTPS**: https://54.151.13.99:443
- **HTTP Proxy**: http://54.151.13.99:8080

## Useful PM2 Commands

```bash
# Restart all apps
pm2 restart all

# Stop all apps
pm2 stop all

# View detailed process info
pm2 show lyra-https

# Monitor in real-time
pm2 monit

# Pull latest changes from Git
cd ~/lyra-appV3
git pull origin master
npm install
pm2 restart all
```

## Troubleshooting

### Port Permission Issues
If you get permission errors for port 443:
```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

### Check if ports are in use
```bash
sudo netstat -tlnp | grep :443
sudo netstat -tlnp | grep :8080
```

### View system logs
```bash
pm2 logs --lines 100
```

### Reset PM2
```bash
pm2 kill
pm2 start ecosystem.config.cjs
pm2 save
```

## Security Recommendations

1. **Setup a domain name** instead of using IP address
2. **Get a real SSL certificate** using Let's Encrypt:
   ```bash
   sudo apt install certbot
   sudo certbot certonly --standalone -d yourdomain.com
   ```
3. **Enable firewall** if not already enabled
4. **Keep system updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## Notes

- The app runs on port 443 (HTTPS) and 8080 (HTTP proxy)
- PM2 keeps the app running and restarts it on crashes
- Logs are stored in `~/lyra-appV3/logs/`
- SSL certificates are self-signed (browser will show warning)
