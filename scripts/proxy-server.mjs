#!/usr/bin/env node

/**
 * Plain-HTTP relay for ESP32 machines.
 *
 * The ESP32 firmware talks to the vending machines over Ethernet, and its
 * Ethernet HTTP client does not support TLS (see ESP32_RFID_Firmware.ino —
 * "HTTPS not supported over Ethernet"). Vercel only serves HTTPS on 443 and
 * has no way to expose a plain-HTTP port, so the web app itself now deploys
 * to Vercel while this small relay stays running on a VPS: it listens on
 * plain HTTP (port 8080 by default) for machine traffic and forwards each
 * request to the Vercel deployment over real HTTPS.
 *
 * Point the ESP32 firmware's ETHERNET_SERVER_BASE at this relay's host:port,
 * unchanged from before. Set UPSTREAM_HOST to your Vercel domain.
 */

import http from 'http';
import https from 'https';

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || 'lyra-app-v3-geegd7zfn-suman-ms-sudos-projects.vercel.app';

const server = http.createServer((req, res) => {
  console.log(`[Relay] ${req.method} ${req.url} -> https://${UPSTREAM_HOST}`);

  const options = {
    hostname: UPSTREAM_HOST,
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: UPSTREAM_HOST,
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Relay] Error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`\nMachine relay listening on http://0.0.0.0:${PROXY_PORT}`);
  console.log(`Forwarding to https://${UPSTREAM_HOST}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PROXY_PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
