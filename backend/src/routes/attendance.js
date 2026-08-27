const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getAttendance, markAttendance, getAttendanceByGroup, getStudentAttendanceSummary, getAttendanceJournal,
} = require('../controllers/attendanceController');

router.use(authenticate);

router.get('/journal', getAttendanceJournal);
router.get('/', getAttendance);
router.post('/', markAttendance);
router.get('/group/:groupId', getAttendanceByGroup);
router.get('/student/:student_id/summary', getStudentAttendanceSummary);

module.exports = router;
