const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllUsers, getTeachers, getUserById, createUser, updateUser, deleteUser, resetPassword,
} = require('../controllers/usersController');

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin'), getAllUsers);
router.get('/teachers', getTeachers);
router.get('/:id', authorize('superadmin', 'admin'), getUserById);
router.post('/', authorize('superadmin', 'admin'), createUser);
router.put('/:id', authorize('superadmin', 'admin'), updateUser);
router.delete('/:id', authorize('superadmin'), deleteUser);
router.put('/:id/reset-password', authorize('superadmin', 'admin'), resetPassword);

module.exports = router;
