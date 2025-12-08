#!/usr/bin/env node

/**
 * Generate self-signed SSL certificates for local HTTPS development
 * Uses the selfsigned package for proper certificate generation
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const certsDir = join(process.cwd(), 'certs');

// Create certs directory if it doesn't exist
if (!existsSync(certsDir)) {
  mkdirSync(certsDir);
}

const keyPath = join(certsDir, 'localhost-key.pem');
const certPath = join(certsDir, 'localhost.pem');

// Check if certificates already exist
if (existsSync(keyPath) && existsSync(certPath)) {
  console.log('✅ SSL certificates already exist');
  process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificates...');

try {
  // Try using selfsigned package
  const selfsigned = await import('selfsigned');
  
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const options = {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  };

  const pems = selfsigned.default.generate(attrs, options);

  writeFileSync(keyPath, pems.private);
  writeFileSync(certPath, pems.cert);
  
  console.log('\n✅ SSL certificates generated successfully!');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}\n`);
  console.log('⚠️  Note: This is a self-signed certificate for development only.');
  console.log('   For production, use proper SSL certificates from a trusted CA.\n');
} catch (error) {
  console.error('\n❌ Failed to generate certificates:', error.message);
  console.error('\nTrying alternative method with openssl...\n');
  
  try {
    // Fallback to openssl if available
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" ` +
      `-keyout "${keyPath}" -out "${certPath}" -days 365 2>/dev/null`,
      { stdio: 'inherit' }
    );
    console.log('\n✅ SSL certificates generated successfully with openssl!');
  } catch (opensslError) {
    console.error('OpenSSL also failed. Please install openssl or check the error above.');
    process.exit(1);
  }
}
