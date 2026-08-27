const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllPayments, createPayment, deletePayment,
  getMonthlyStats, getDebtors, getBillingForGroup,
  getStudentMonthlyStatus,
} = require('../controllers/paymentsController');

router.use(authenticate);

router.get('/',               getAllPayments);
router.get('/monthly-status', authorize('superadmin', 'admin'), getStudentMonthlyStatus);
router.get('/stats/monthly',  getMonthlyStats);
router.get('/debtors',        getDebtors);
// Billing calculator — admin/superadmin only
router.get('/billing',        authorize('superadmin', 'admin'), getBillingForGroup);
router.post('/',              authorize('superadmin', 'admin'), createPayment);
router.delete('/:id',         authorize('superadmin', 'admin'), deletePayment);

module.exports = router;
