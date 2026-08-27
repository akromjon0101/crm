const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllStudents, getStudentById,
  createStudent, updateStudent, deleteStudent,
  transferStudent, freezeStudent, unfreezeStudent,
  archiveStudent, restoreStudent, addStudentToGroup,
  getStudentHistory, toggleDebtor, addNote, bulkAction,
} = require('../controllers/studentsController');

router.use(authenticate);

router.get('/',          getAllStudents);
router.get('/:id',       getStudentById);
router.get('/:id/history', getStudentHistory);

router.post('/',              authorize('superadmin', 'admin'), createStudent);
router.post('/bulk-action',   authorize('superadmin', 'admin'), bulkAction);
router.put('/:id',       authorize('superadmin', 'admin'), updateStudent);
router.delete('/:id',    authorize('superadmin', 'admin'), deleteStudent);

router.put('/:id/transfer',     authorize('superadmin', 'admin'), transferStudent);
router.put('/:id/freeze',       authorize('superadmin', 'admin'), freezeStudent);
router.put('/:id/unfreeze',     authorize('superadmin', 'admin'), unfreezeStudent);
router.put('/:id/archive',      authorize('superadmin', 'admin'), archiveStudent);
router.put('/:id/restore',      authorize('superadmin', 'admin'), restoreStudent);
router.post('/:id/add-to-group',authorize('superadmin', 'admin'), addStudentToGroup);

router.put('/:id/toggle-debtor', authorize('superadmin', 'admin'), toggleDebtor);

// Notes are credited to whichever authenticated user writes them (teacher_id = req.user.id)
// and the frontend exposes "+ Add note" to every role viewing a student profile — so this
// must stay open to all authenticated roles, not just admins.
router.post('/:id/notes', addNote);

module.exports = router;
