const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

// ── Startup safety checks ────────────────────────────────────────────────────
// Refuse to boot in production with the placeholder secret from .env.example —
// every deployed instance would otherwise share the same publicly-known JWT
// signing key, letting anyone forge valid tokens for any user.
if (process.env.NODE_ENV === 'production') {
  const insecureDefaults = ['your_super_secret_jwt_key_change_this_in_production', ''];
  if (!process.env.JWT_SECRET || insecureDefaults.includes(process.env.JWT_SECRET)) {
    console.error('FATAL: JWT_SECRET is unset or still the placeholder value. Set a strong, unique secret in .env before starting in production (e.g. `openssl rand -base64 48`).');
    process.exit(1);
  }
  if (!process.env.CLIENT_URL) {
    console.error('FATAL: CLIENT_URL must be set in production so CORS can allow your deployed frontend origin.');
    process.exit(1);
  }
}

const app = express();

// Behind an Nginx reverse proxy on a VPS: trust the first hop so req.ip and
// express-rate-limit see the real client IP (from X-Forwarded-For) instead of
// 127.0.0.1 for every request.
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());

// In production only the configured CLIENT_URL is allowed; localhost origins
// are for local development only and would be pointless (and slightly risky)
// to keep open on a public deployment.
const corsOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.CLIENT_URL]
  : [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/students', require('./routes/students'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/courses',  require('./routes/courses'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages',     require('./routes/messages'));
app.use('/api/leads',         require('./routes/leads'));
app.use('/api/salary',        require('./routes/salary'));
app.use('/api/activity',      require('./routes/activity'));
app.use('/api/lessons',       require('./routes/lessons'));
app.use('/api/earnings',      require('./routes/earnings'));
app.use('/api/sms',           require('./routes/sms'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
