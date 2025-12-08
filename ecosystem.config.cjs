module.exports = {
  apps: [
    {
      name: 'lyra-https',
      script: 'scripts/https-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 443,
      },
      error_file: './logs/https-error.log',
      out_file: './logs/https-out.log',
      log_file: './logs/https-combined.log',
      time: true,
    },
    {
      name: 'lyra-proxy',
      script: 'scripts/proxy-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PROXY_PORT: 8080,
      },
      error_file: './logs/proxy-error.log',
      out_file: './logs/proxy-out.log',
      log_file: './logs/proxy-combined.log',
      time: true,
    },
  ],
};
