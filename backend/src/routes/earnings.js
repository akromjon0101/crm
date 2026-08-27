const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMyEarnings,
  getTeacherEarnings,
  getEarningsOverview,
  getEarningsHistory,
} = require('../controllers/earningsController');

router.use(authenticate);

// Teacher: their own earnings
router.get('/my',      getMyEarnings);
router.get('/history', getEarningsHistory);

// Admin: specific teacher or all teachers
router.get('/overview',       authorize('superadmin', 'admin'), getEarningsOverview);
router.get('/teacher/:id',    authorize('superadmin', 'admin'), getTeacherEarnings);

module.exports = router;
