const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAllCourses, createCourse, updateCourse, deleteCourse } = require('../controllers/coursesController');

router.use(authenticate);

router.get('/', getAllCourses);
router.post('/', authorize('superadmin', 'admin'), createCourse);
router.put('/:id', authorize('superadmin', 'admin'), updateCourse);
router.delete('/:id', authorize('superadmin'), deleteCourse);

module.exports = router;
