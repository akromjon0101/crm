const app = require('./app');
const { db } = require('./config/database');

const PORT = process.env.PORT || 5000;

try {
  // Test DB with a simple query
  db.prepare('SELECT 1').get();
  console.log('✅ Database connected');

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
} catch (err) {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
}
