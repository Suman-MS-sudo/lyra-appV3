#!/usr/bin/env node

/**
 * HTTP Proxy Server
 * Listens on port 8080 and forwards requests to HTTPS on port 443
 */

import http from 'http';
import https from 'https';

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const TARGET_PORT = 443;
const TARGET_HOST = 'localhost';

const server = http.createServer((req, res) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
    },
    rejectUnauthorized: false, // Accept self-signed certificates
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy] Error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`\n🔀 HTTP Proxy Server running on http://0.0.0.0:${PROXY_PORT}`);
  console.log(`   Forwarding to https://localhost:${TARGET_PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PROXY_PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
