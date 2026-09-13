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
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || 'lyra-app-v3-chi.vercel.app';

// Ethernet machines poll /api/payment_success every 4s. Caching per-URL here
// (mirroring the jumphost nginx cache used for WiFi machines) means only 1 in
// ~4 polls reaches Vercel, keeping free-plan usage down without touching
// firmware or payment-detection latency.
const PAYMENT_CACHE_TTL_MS = 15000;
const paymentCache = new Map(); // url -> { status, headers, body, expiresAt }

const server = http.createServer((req, res) => {
  const cacheable = req.method === 'GET' && req.url.startsWith('/api/payment_success');

  if (cacheable) {
    const cached = paymentCache.get(req.url);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Relay] ${req.method} ${req.url} -> cache HIT`);
      res.writeHead(cached.status, cached.headers);
      res.end(cached.body);
      return;
    }
  }

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

    if (cacheable && proxyRes.statusCode === 200) {
      const chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
        res.write(chunk);
      });
      proxyRes.on('end', () => {
        paymentCache.set(req.url, {
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: Buffer.concat(chunks),
          expiresAt: Date.now() + PAYMENT_CACHE_TTL_MS,
        });
        res.end();
      });
    } else {
      proxyRes.pipe(res);
    }
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
