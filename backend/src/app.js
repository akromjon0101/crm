const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
  ],
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
