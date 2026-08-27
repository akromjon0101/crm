const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllLeads, getLeadStats, getLeadById, createLead, updateLead, deleteLead,
} = require('../controllers/leadsController');

router.use(authenticate);
// Leads are sales/CRM data — restrict to admin roles, matching the frontend's
// route guard (roles={['superadmin', 'admin']} on /leads in App.jsx). Without
// this, any authenticated user (e.g. a teacher) could hit these endpoints directly.
router.use(authorize('superadmin', 'admin'));

// /stats must be before /:id to avoid Express treating "stats" as an id param
router.get('/stats', getLeadStats);

router.get('/',       getAllLeads);
router.get('/:id',    getLeadById);
router.post('/',      createLead);
router.put('/:id',    updateLead);
router.delete('/:id', deleteLead);

module.exports = router;
