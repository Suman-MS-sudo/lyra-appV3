# SSL Certificate Renewal Guide

## Current Certificate Info
- **Domain**: lyra-app.co.in
- **Issuer**: Let's Encrypt (E7)
- **Expired On**: March 12, 2026
- **Certificate ID**: 1e77f3b5c531cdb674aac90c27796b1d1f9728ca6971de1c97b38a020a025a93

## Quick Renewal Commands

### 1. SSH into production server
```bash
ssh suman@lyra-app.co.in
```

### 2. Check current certificates
```bash
sudo certbot certificates
```

### 3. Renew certificate
```bash
# Automatic renewal (recommended)
sudo certbot renew

# OR manual renewal for specific domain
sudo certbot certonly --nginx -d lyra-app.co.in
```

### 4. Restart services
```bash
sudo systemctl restart nginx
pm2 restart all
```

### 5. Verify new certificate
```bash
echo | openssl s_client -servername lyra-app.co.in -connect lyra-app.co.in:443 2>/dev/null | openssl x509 -noout -enddate
```

## Automatic Renewal Setup

Add to crontab to prevent future expiration:
```bash
sudo crontab -e
```

Add this line:
```bash
0 12 * * * /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx
```

## Important Notes

- Let's Encrypt certificates are valid for **90 days** maximum
- Automatic renewal should run 30 days before expiration
- Always test with `--dry-run` flag first
- Keep backups of your certificates in `/etc/letsencrypt/`

## Troubleshooting

### If certbot is not installed:
```bash
sudo apt update && sudo apt install certbot python3-certbot-nginx
```

### If renewal fails:
1. Check if ports 80/443 are open
2. Verify DNS points to correct server IP
3. Temporarily stop nginx and use `--standalone` flag
4. Check nginx configuration syntax: `sudo nginx -t`

### Alternative renewal with standalone:
```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d lyra-app.co.in
sudo systemctl start nginx
```

## Last Renewal
- **Date**: [Update when renewed]
- **Next Expiration**: [Update with new expiry date]
- **Method Used**: [Update with method used]