const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllGroups, getGroupById, createGroup, updateGroup, deleteGroup,
} = require('../controllers/groupsController');

router.use(authenticate);

router.get('/', getAllGroups);
router.get('/:id', getGroupById);
router.post('/', authorize('superadmin', 'admin'), createGroup);
router.put('/:id', authorize('superadmin', 'admin'), updateGroup);
router.delete('/:id', authorize('superadmin', 'admin'), deleteGroup);

module.exports = router;
