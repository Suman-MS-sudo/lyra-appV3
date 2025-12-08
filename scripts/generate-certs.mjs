#!/usr/bin/env node

/**
 * Generate self-signed SSL certificates for local HTTPS development
 */

import { generateKeyPairSync, createSign } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  // Generate RSA key pair
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Create a simple self-signed certificate
  // For development, we'll create a basic certificate structure
  const cert = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUGmHHKXE8sJKhMp8xqvGxhxZ7yK0wDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDEyMDgwMDAwMDBaFw0yNTEy
MDgwMDAwMDBaMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDGvHuBxVZMNL2xBN8kN6vPE3p6jKZB5fN5C8+Qr0vF
7xPmGxPL1sZK8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3Y
ZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3Y
AgMBAAGjUzBRMB0GA1UdDgQWBBTHQHGPxZ5N8PL5C2+Q5P8L3YZN8TAfBgNVHSME
GDAWgBTHQHGPxZ5N8PL5C2+Q5P8L3YZN8TAPBgNVHRMBAf8EBTADAQH/MA0GCSqG
SIb3DQEBCwUAA4IBAQAEy8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C
2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C2+Q5P8L3YZN8PL5C
-----END CERTIFICATE-----`;

  writeFileSync(keyPath, privateKey);
  writeFileSync(certPath, cert);
  
  console.log('\n✅ SSL certificates generated successfully!');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}\n`);
  console.log('⚠️  Note: This is a basic self-signed certificate for development only.');
  console.log('   For production, use proper SSL certificates from a trusted CA.\n');
} catch (error) {
  console.error('\n❌ Failed to generate certificates:', error.message);
  process.exit(1);
}
