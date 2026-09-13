// The Next.js web app deploys to Vercel — Vercel manages its own process,
// scaling, and HTTPS termination, so it has no entry here. This VPS instead
// runs two tiny relays, because lyra-app.co.in is hardcoded into the ESP32
// firmware for BOTH transports and DNS can't split one hostname by port:
//   - lyra-machine-relay: plain-HTTP :8080 for Ethernet machines (their
//     Ethernet stack can't do TLS at all)
//   - lyra-tls-passthrough: raw TCP :443 for WiFi machines' HTTPS calls,
//     piped through untouched (no cert needed here — Vercel terminates TLS
//     using the original SNI)
// Both forward to UPSTREAM_HOST, your Vercel deployment's *.vercel.app
// domain (not lyra-app.co.in itself, or this loops back on itself).
// Binding :443 needs root, or `setcap cap_net_bind_service=+ep $(which node)`.
module.exports = {
  apps: [
    {
      name: 'lyra-machine-relay',
      script: 'scripts/proxy-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=300',
      env: {
        NODE_ENV: 'production',
        PROXY_PORT: 8080,
        UPSTREAM_HOST: 'lyra-app-v3-geegd7zfn-suman-ms-sudos-projects.vercel.app',
        NODE_OPTIONS: '--max-old-space-size=300',
      },
      error_file: './logs/relay-error.log',
      out_file: './logs/relay-out.log',
      log_file: './logs/relay-combined.log',
      time: true,
      kill_timeout: 3000,
      listen_timeout: 5000,
    },
    {
      name: 'lyra-tls-passthrough',
      script: 'scripts/tls-passthrough.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      node_args: '--max-old-space-size=200',
      env: {
        NODE_ENV: 'production',
        TLS_PORT: 443,
        UPSTREAM_HOST: 'lyra-app-v3-geegd7zfn-suman-ms-sudos-projects.vercel.app',
        NODE_OPTIONS: '--max-old-space-size=200',
      },
      error_file: './logs/tls-error.log',
      out_file: './logs/tls-out.log',
      log_file: './logs/tls-combined.log',
      time: true,
      kill_timeout: 3000,
      listen_timeout: 5000,
    },
  ],
};
