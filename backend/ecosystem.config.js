// PM2 process config. Usage (from backend/): pm2 start ecosystem.config.js
//
// PM2 loads its own env from here — it does NOT source backend/.env for you.
// Either fill in the `env` block below, or (simpler) keep secrets only in
// backend/.env and let dotenv (already required in src/app.js) load them at
// runtime; in that case this file just needs NODE_ENV set so the app.js
// production checks and CORS allow-list activate correctly.
module.exports = {
  apps: [
    {
      name: 'educrm-backend',
      cwd: __dirname,
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
