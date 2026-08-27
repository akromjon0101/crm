const router  = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// ── Rate limit login: max 10 attempts per 15 minutes per IP ───────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.post('/login',           loginLimiter, login);
router.get('/me',               authenticate, getMe);
router.put('/change-password',  authenticate, changePassword);

module.exports = router;
