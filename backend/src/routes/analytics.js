const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats, getMonthlyIncomeChart, getStudentGrowthChart,
  getTeacherPerformance, getRecentActivity, getTeacherDashboard,
  getFinancialSummary,
} = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/income-chart', authorize('superadmin', 'admin'), getMonthlyIncomeChart);
router.get('/student-growth', authorize('superadmin', 'admin'), getStudentGrowthChart);
router.get('/teacher-performance', authorize('superadmin', 'admin'), getTeacherPerformance);
router.get('/recent-activity', getRecentActivity);
router.get('/teacher-dashboard', authorize('teacher'), getTeacherDashboard);
router.get('/financial-summary', authorize('superadmin', 'admin'), getFinancialSummary);

module.exports = router;
