const app = require('./app');
const { db } = require('./config/database');

const PORT = process.env.PORT || 5000;

let server;

try {
  // Test DB with a simple query
  db.prepare('SELECT 1').get();
  console.log('✅ Database connected');

  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
} catch (err) {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
}

// Graceful shutdown — PM2 (and `systemctl stop`/container orchestrators) send
// SIGTERM and expect the process to finish in-flight requests and close its
// own resources before exiting, rather than being hard-killed.
const shutdown = (signal) => {
  console.log(`${signal} received: closing server...`);
  if (!server) return process.exit(0);
  server.close(() => {
    try { db.close(); } catch (_) { /* already closed */ }
    console.log('Server closed.');
    process.exit(0);
  });
  // Safety net in case some connection never drains
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
