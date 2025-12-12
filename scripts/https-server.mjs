#!/usr/bin/env node

/**
 * HTTPS Development Server
 * Runs Next.js with HTTPS support using self-signed certificates
 */

import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 443;

// Path to SSL certificates
const certsDir = join(process.cwd(), 'certs');

// Try production certificates first, fallback to localhost
let keyPath, certPath;

if (process.env.NODE_ENV === 'production') {
  // Production: Use Let's Encrypt certificates
  keyPath = join(certsDir, 'lyra-app-key.pem');
  certPath = join(certsDir, 'lyra-app.pem');
  
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    console.error('❌ Production certificates not found!');
    console.error('Expected:');
    console.error('  - ' + keyPath);
    console.error('  - ' + certPath);
    console.error('\nRun these commands on the server:');
    console.error('  sudo certbot certonly --standalone -d lyra-app.co.in -d www.lyra-app.co.in');
    console.error('  sudo cp /etc/letsencrypt/live/lyra-app.co.in/privkey.pem certs/lyra-app-key.pem');
    console.error('  sudo cp /etc/letsencrypt/live/lyra-app.co.in/fullchain.pem certs/lyra-app.pem');
    console.error('  sudo chown suman:suman certs/lyra-app*.pem');
    process.exit(1);
  }
  console.log('🔒 Using production SSL certificates');
} else {
  // Development: Use self-signed certificates
  keyPath = join(certsDir, 'localhost-key.pem');
  certPath = join(certsDir, 'localhost.pem');
  
  // Generate certificates if they don't exist
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    console.log('🔐 Generating SSL certificates...');
    try {
      execSync('node scripts/generate-certs.mjs', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to generate certificates');
      process.exit(1);
    }
  }
  console.log('🔓 Using development SSL certificates (localhost)');
}

// Read SSL certificates
const httpsOptions = {
  key: readFileSync(keyPath),
  cert: readFileSync(certPath),
};

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) {
      if (err.code === 'EACCES') {
        console.error(`\n❌ Permission denied to bind to port ${port}`);
        console.log('💡 On Windows, you need to run this as Administrator:');
        console.log('   1. Right-click PowerShell');
        console.log('   2. Select "Run as Administrator"');
        console.log('   3. Navigate to your project directory');
        console.log('   4. Run: npm run dev\n');
      } else {
        console.error('Error starting server:', err);
      }
      process.exit(1);
    }
    console.log(`\n✅ Next.js HTTPS server ready on https://${hostname}:${port}`);
  });
});
