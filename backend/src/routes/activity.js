const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getActivityLog } = require('../controllers/activityController');

router.use(authenticate);
router.get('/', getActivityLog);

module.exports = router;
