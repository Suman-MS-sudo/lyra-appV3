# HTTPS Development Server Setup

## Overview

The Lyra app runs on **HTTPS port 443** with an **HTTP proxy on port 8080** that forwards requests to the HTTPS server.

## Architecture

```
HTTP Request (port 8080) → Proxy Server → HTTPS (port 443) → Next.js App
```

## Quick Start

### Prerequisites

1. **Administrator Privileges**: Port 443 requires admin rights on Windows
2. **Node.js**: Already installed (certificates are generated using Node.js crypto)

### Running the App

**Option 1: Run both servers (Recommended)**
```powershell
# Run as Administrator
npm run dev
```

This starts:
- HTTPS server on port 443 (Next.js app)
- HTTP proxy on port 8080 (forwards to 443)

**Option 2: Run separately**
```powershell
# Terminal 1 (as Administrator)
npm run dev:app

# Terminal 2 (normal)
npm run dev:proxy
```

## Access Points

- **HTTPS (Primary)**: https://localhost:443
- **HTTP (Proxy)**: http://localhost:8080 → redirects to HTTPS

## SSL Certificates

Self-signed certificates are automatically generated on first run using Node.js crypto and stored in `certs/`:
- `localhost-key.pem` - Private key (RSA 2048-bit)
- `localhost.pem` - Self-signed certificate

To regenerate certificates:
```powershell
npm run setup:certs
```

## Browser Security Warning

Since we use self-signed certificates, browsers will show a security warning:
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

This is normal for local development.

## Troubleshooting

### "Permission denied" on port 443
- Run PowerShell as Administrator
- Right-click PowerShell → "Run as Administrator"

### "Port 8080 already in use"
- Find process: `netstat -ano | findstr :8080`
- Kill process: `taskkill /PID <PID> /F`

### Certificate errors
- Regenerate certificates: `npm run setup:certs`
- Ensure `certs/` directory has both key and cert files

### Proxy not forwarding requests
- Check both servers are running
- Verify proxy logs show incoming requests
- Try accessing HTTPS directly: https://localhost:443

## Scripts

- `npm run dev` - Start both HTTPS app and HTTP proxy
- `npm run dev:app` - Start only HTTPS app (port 443)
- `npm run dev:proxy` - Start only HTTP proxy (port 8080)
- `node scripts/generate-certs.mjs` - Generate SSL certificates

## Production

For production deployments, use a proper reverse proxy like:
- **Nginx** or **Apache** for HTTP → HTTPS forwarding
- **Cloudflare** or **Let's Encrypt** for valid SSL certificates
- Never use self-signed certificates in production
