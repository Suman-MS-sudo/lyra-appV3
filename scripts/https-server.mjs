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
const keyPath = join(certsDir, 'localhost-key.pem');
const certPath = join(certsDir, 'localhost.pem');

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
  }).listen(port, (err) => {
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
