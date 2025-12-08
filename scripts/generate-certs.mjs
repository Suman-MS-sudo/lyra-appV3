#!/usr/bin/env node

/**
 * Generate self-signed SSL certificates for local HTTPS development
 */

import forge from 'node-forge';
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
  // Generate a keypair
  console.log('   Generating RSA keypair...');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Create a certificate
  console.log('   Creating certificate...');
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'US'
  }, {
    shortName: 'ST',
    value: 'State'
  }, {
    name: 'localityName',
    value: 'City'
  }, {
    name: 'organizationName',
    value: 'Development'
  }, {
    shortName: 'OU',
    value: 'IT'
  }];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
  }, {
    name: 'nsCertType',
    server: true,
    client: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true
  }, {
    name: 'subjectAltName',
    altNames: [{
      type: 2, // DNS
      value: 'localhost'
    }, {
      type: 7, // IP
      ip: '127.0.0.1'
    }]
  }, {
    name: 'subjectKeyIdentifier'
  }]);
  
  // Self-sign certificate
  console.log('   Signing certificate...');
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  // Convert to PEM format
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);
  
  // Write files
  writeFileSync(keyPath, privateKeyPem);
  writeFileSync(certPath, certPem);
  
  console.log('\n✅ SSL certificates generated successfully!');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}\n`);
  console.log('⚠️  Note: This is a self-signed certificate for development only.');
  console.log('   For production, use proper SSL certificates from a trusted CA.\n');
} catch (error) {
  console.error('\n❌ Failed to generate certificates:', error.message);
  console.error(error.stack);
  process.exit(1);
}
