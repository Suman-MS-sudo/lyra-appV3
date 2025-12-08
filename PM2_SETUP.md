# PM2 Production Deployment Guide

## Prerequisites

1. **Build the Next.js app for production:**
   ```bash
   npm run build
   ```

2. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```

## Setup Steps

### 1. Update Environment Variables

Edit `.env.local` on your server to use your production domain:

```bash
nano .env.local
```

Update these values:
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com:443
NODE_ENV=production
```

### 2. Generate SSL Certificates

```bash
# Remove old certificates
rm -rf certs

# Generate new certificates
npm run setup:certs
```

### 3. Create Logs Directory

```bash
mkdir -p logs
```

### 4. Start with PM2

**Option A: Start both servers with PM2 (Recommended)**
```bash
# Start both HTTPS and proxy servers
sudo pm2 start ecosystem.config.cjs

# Save PM2 configuration
sudo pm2 save

# Setup PM2 to start on system boot
sudo pm2 startup systemd -u mssworlz --hp /home/mssworlz
```

**Option B: Start individually**
```bash
# Start HTTPS server
sudo pm2 start scripts/https-server.mjs --name lyra-https

# Start proxy server
sudo pm2 start scripts/proxy-server.mjs --name lyra-proxy

# Save configuration
sudo pm2 save
```

## PM2 Management Commands

### View Status
```bash
sudo pm2 status           # View all processes
sudo pm2 list            # List all processes
sudo pm2 show lyra-https # Show details for HTTPS app
sudo pm2 show lyra-proxy # Show details for proxy
```

### View Logs
```bash
sudo pm2 logs            # View all logs (live)
sudo pm2 logs lyra-https # View HTTPS app logs
sudo pm2 logs lyra-proxy # View proxy logs
sudo pm2 logs --lines 100 # View last 100 lines
```

### Restart/Reload
```bash
sudo pm2 restart all      # Restart all apps
sudo pm2 restart lyra-https
sudo pm2 reload all       # Reload with zero downtime
```

### Stop
```bash
sudo pm2 stop all         # Stop all apps
sudo pm2 stop lyra-https  # Stop specific app
sudo pm2 delete all       # Delete all apps from PM2
```

### Monitor
```bash
sudo pm2 monit           # Real-time monitoring dashboard
```

## Update Deployment

When you pull new code from Git:

```bash
# Pull latest code
git pull origin master

# Install dependencies
npm install

# Build the app
npm run build

# Restart PM2 processes
sudo pm2 restart all
```

## Logs Location

PM2 logs are stored in:
- `./logs/https-error.log` - HTTPS server errors
- `./logs/https-out.log` - HTTPS server output
- `./logs/proxy-error.log` - Proxy server errors
- `./logs/proxy-out.log` - Proxy server output

Default PM2 logs:
```bash
# View PM2 log locations
sudo pm2 show lyra-https
```

## Port 443 Without Sudo (Optional)

To run on port 443 without sudo, use authbind:

```bash
# Install authbind
sudo apt-get install authbind

# Allow port 443
sudo touch /etc/authbind/byport/443
sudo chmod 500 /etc/authbind/byport/443
sudo chown mssworlz /etc/authbind/byport/443

# Start with authbind
authbind --deep pm2 start ecosystem.config.cjs
```

## Troubleshooting

### Port already in use
```bash
# Find process using port 443
sudo lsof -i :443
sudo netstat -tulpn | grep :443

# Kill the process
sudo kill -9 <PID>
```

### PM2 not starting on boot
```bash
# Remove old startup script
sudo pm2 unstartup

# Create new startup script
sudo pm2 startup systemd -u mssworlz --hp /home/mssworlz

# Save current process list
sudo pm2 save
```

### Check PM2 status after reboot
```bash
sudo systemctl status pm2-mssworlz
```

## Production Best Practices

1. **Use a reverse proxy (Nginx)** instead of running Node.js on port 443
2. **Get proper SSL certificates** from Let's Encrypt instead of self-signed
3. **Enable log rotation** to prevent disk space issues:
   ```bash
   sudo pm2 install pm2-logrotate
   sudo pm2 set pm2-logrotate:max_size 10M
   sudo pm2 set pm2-logrotate:retain 7
   ```

4. **Monitor memory usage:**
   ```bash
   sudo pm2 set pm2-logrotate:compress true
   ```
