const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/salaryController');

// All salary routes require authentication
router.use(authenticate);

// ── Salary rules ──────────────────────────────────────────────────────────────
// Only CEO (superadmin) can view and manage salary rules
router.get('/rules',  authorize('superadmin'), c.getSalaryRules);
router.post('/rules', authorize('superadmin'), c.upsertSalaryRule);

// ── Bulk calculation ──────────────────────────────────────────────────────────
router.post('/calculate', authorize('superadmin'), c.calculateSalary);

// ── Salary records ────────────────────────────────────────────────────────────
// Teachers see their own records (controller filters by role); admin is blocked
router.get('/records',     authorize('superadmin', 'teacher'), c.getSalaryRecords);
router.get('/records/:id', authorize('superadmin', 'teacher'), c.getSalaryRecord);
router.put('/records/:id',    authorize('superadmin'), c.updateSalaryRecord);
router.delete('/records/:id', authorize('superadmin'), c.deleteSalaryRecord);

// ── Advance requests ──────────────────────────────────────────────────────────
router.get('/advances',     authorize('superadmin', 'teacher'), c.getAdvances);
router.post('/advances',    authorize('superadmin', 'teacher'), c.createAdvance);
router.put('/advances/:id', authorize('superadmin'), c.updateAdvance);

module.exports = router;
