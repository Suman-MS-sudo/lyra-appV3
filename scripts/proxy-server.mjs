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
import net from 'net';

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || 'lyra-app-v3-chi.vercel.app';
// MQTT machines can't reach the broker's own port from customer networks that
// only allow 8080/443, so raw MQTT is accepted on PROXY_PORT too and piped to
// the broker here. Broker only needs to listen on the VPS itself.
const MQTT_BROKER_HOST = process.env.MQTT_BROKER_HOST || '127.0.0.1';
const MQTT_BROKER_PORT = Number(process.env.MQTT_BROKER_PORT || 1883);
const FIRST_BYTE_TIMEOUT_MS = 30000;

// Ethernet machines poll /api/payment_success every 4s. Caching per-URL here
// (mirroring the jumphost nginx cache used for WiFi machines) means only 1 in
// ~4 polls reaches Vercel, keeping free-plan usage down without touching
// firmware or payment-detection latency.
const PAYMENT_CACHE_TTL_MS = 15000;
const paymentCache = new Map(); // url -> { status, headers, body, expiresAt }

const httpServer = http.createServer((req, res) => {
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

    // Only the "No pending payments" response sets Cache-Control: s-maxage=15;
    // the real payment-success response sets no-store. Caching a success
    // response would replay the same dispense instruction to the machine on
    // every poll for up to 15s, risking a double dispense -- so only cache
    // when the upstream itself marked the response cacheable.
    const cacheControl = proxyRes.headers['cache-control'] || '';
    const upstreamAllowsCache = cacheable && proxyRes.statusCode === 200 && cacheControl.includes('s-maxage');

    if (upstreamAllowsCache) {
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

// An HTTP request starts with an ASCII method letter; an MQTT CONNECT packet
// starts with 0x10. Peek at the first byte and hand the socket to whichever
// side it belongs to, so existing HTTP handling above is untouched.
const server = net.createServer((socket) => {
  socket.setNoDelay(true);
  socket.setTimeout(FIRST_BYTE_TIMEOUT_MS, () => socket.destroy());
  socket.on('error', () => {});

  socket.once('data', (chunk) => {
    socket.setTimeout(0);

    if (chunk[0] !== 0x10) {
      socket.unshift(chunk);
      httpServer.emit('connection', socket);
      return;
    }

    const broker = net.connect(MQTT_BROKER_PORT, MQTT_BROKER_HOST, () => {
      broker.write(chunk);
      socket.pipe(broker);
      broker.pipe(socket);
    });
    broker.setNoDelay(true);
    // No TCP keepalive on the machine leg: the ENC28J60/uIP stack in the
    // machines never answers zero-length keepalive probes, so the kernel
    // (libuv sets a 1s probe interval) reset every MQTT connection ~43s after
    // it went idle -- each reconnect then cost a catch-up poll to Vercel.
    // MQTT's own keepalive (90s, enforced by Mosquitto) detects dead peers and
    // closes the broker leg, which tears this socket down via 'close' below.
    broker.on('error', (err) => {
      console.error('[Relay] MQTT broker error:', err.message);
      socket.destroy();
    });
    broker.on('close', () => socket.destroy());
    socket.on('close', () => broker.destroy());
  });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`\nMachine relay listening on http://0.0.0.0:${PROXY_PORT}`);
  console.log(`Forwarding HTTP to https://${UPSTREAM_HOST}, MQTT to ${MQTT_BROKER_HOST}:${MQTT_BROKER_PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PROXY_PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
