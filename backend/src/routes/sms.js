const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendBulkSms, previewRecipients, getSmsLogs } = require('../controllers/smsController');

router.use(authenticate);
router.use(authorize('superadmin', 'admin'));

router.get('/preview', previewRecipients);
router.get('/logs',    getSmsLogs);
router.post('/send',   sendBulkSms);

module.exports = router;
