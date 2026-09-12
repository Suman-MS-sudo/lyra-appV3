// The Next.js web app deploys to Vercel — Vercel manages its own process,
// scaling, and HTTPS termination, so it has no entry here. This VPS now
// only runs the machine relay: a plain-HTTP listener for ESP32 machines
// (which can't do TLS over Ethernet) that forwards to the Vercel deployment.
// Set UPSTREAM_HOST to your production Vercel domain before starting.
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
        UPSTREAM_HOST: 'lyra-app-v3-chi.vercel.app',
        NODE_OPTIONS: '--max-old-space-size=300',
      },
      error_file: './logs/relay-error.log',
      out_file: './logs/relay-out.log',
      log_file: './logs/relay-combined.log',
      time: true,
      kill_timeout: 3000,
      listen_timeout: 5000,
    },
  ],
};
