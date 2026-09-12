#!/usr/bin/env node

/**
 * Raw TCP passthrough for HTTPS (port 443) traffic from WiFi machines.
 *
 * lyra-app.co.in is used by BOTH transports the ESP32 firmware hardcodes:
 *   - WiFi machines call https://lyra-app.co.in         (port 443)
 *   - Ethernet machines call http://lyra-app.co.in:8080  (port 8080, see proxy-server.mjs)
 * Since DNS resolves a hostname to one IP regardless of port, lyra-app.co.in's
 * A record points at THIS VM, not at Vercel directly — so this VM has to
 * accept both ports and forward both to Vercel.
 *
 * This one does NOT terminate TLS or need a certificate: it just pipes the
 * raw encrypted bytes straight through to Vercel's edge. The TLS ClientHello
 * still carries the original SNI ("lyra-app.co.in"), so Vercel picks the
 * right project/cert on its own — as long as lyra-app.co.in is added as a
 * Custom Domain in the Vercel project (Vercel supports verifying a domain
 * via TXT record without pointing its A/CNAME at Vercel, exactly for this
 * "proxy in front" setup).
 *
 * UPSTREAM_HOST is resolved via normal public DNS at connect time — it must
 * be Vercel's own *.vercel.app hostname (NOT lyra-app.co.in), otherwise this
 * would try to connect back to itself.
 */

import net from 'net';

const LISTEN_PORT = process.env.TLS_PORT || 443;
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || 'lyra-app-v3-chi.vercel.app';
const UPSTREAM_PORT = 443;

const server = net.createServer((clientSocket) => {
  const upstream = net.connect(UPSTREAM_PORT, UPSTREAM_HOST, () => {
    clientSocket.pipe(upstream);
    upstream.pipe(clientSocket);
  });

  upstream.on('error', (err) => {
    console.error('[TLS Passthrough] Upstream error:', err.message);
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    console.error('[TLS Passthrough] Client error:', err.message);
    upstream.destroy();
  });
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`\nTLS passthrough listening on :${LISTEN_PORT}`);
  console.log(`Forwarding raw bytes to ${UPSTREAM_HOST}:${UPSTREAM_PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${LISTEN_PORT} is already in use`);
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error(`\nPermission denied binding to port ${LISTEN_PORT} — ports below 1024 need root/CAP_NET_BIND_SERVICE`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
