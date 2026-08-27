const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getLessons, getTodayLessons, getLessonById,
  createLesson, bulkCreateLessons,
  conductLesson, updateLesson, overrideAttendance,
  deleteLesson,
} = require('../controllers/lessonsController');

router.use(authenticate);

// Read — teacher sees own, admin sees all
router.get('/',       getLessons);
router.get('/today',  getTodayLessons);
router.get('/:id',    getLessonById);

// Admin-only: create & manage lessons
router.post('/',             authorize('superadmin', 'admin'), createLesson);
router.post('/bulk-create',  authorize('superadmin', 'admin'), bulkCreateLessons);
router.put('/:id',           authorize('superadmin', 'admin'), updateLesson);
router.delete('/:id',        authorize('superadmin', 'admin'), deleteLesson);

// Teacher or admin: mark lesson as conducted
router.put('/:id/conduct', conductLesson);

// Admin only: override single student attendance
router.put('/:id/attendance/:studentId', authorize('superadmin', 'admin'), overrideAttendance);

module.exports = router;
