#!/usr/bin/env node

/**
 * Development Server Launcher
 * Starts both the Next.js app on port 443 and the HTTP proxy on port 8080
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('\n🚀 Starting Lyra App Development Servers...\n');

// Start the proxy server on port 8080
const proxy = spawn('node', ['scripts/proxy-server.mjs'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

// Give the proxy a moment to start
setTimeout(() => {
  // Start Next.js on port 443 (requires admin privileges on Windows)
  console.log('⚡ Starting Next.js app on port 443 with HTTPS...');
  console.log('⚠️  Note: You may need to run this with administrator privileges\n');
  
  const app = spawn('node', ['scripts/https-server.mjs'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });

  app.on('error', (err) => {
    console.error('\n❌ Failed to start Next.js app:', err.message);
    if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
      console.log('\n💡 Try running this command as Administrator:');
      console.log('   Right-click PowerShell → "Run as Administrator" → npm run dev\n');
    }
    proxy.kill();
    process.exit(1);
  });

  app.on('exit', (code) => {
    console.log(`\n⏹️  Next.js app exited with code ${code}`);
    proxy.kill();
    process.exit(code);
  });
}, 1000);

proxy.on('error', (err) => {
  console.error('\n❌ Failed to start proxy server:', err.message);
  process.exit(1);
});

proxy.on('exit', (code) => {
  console.log(`\n⏹️  Proxy server exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down servers...');
  proxy.kill();
  process.exit(0);
});
