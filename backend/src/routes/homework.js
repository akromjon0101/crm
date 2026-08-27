const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getHomework, createHomework, deleteHomework, updateHomework,
} = require('../controllers/homeworkController');

router.use(authenticate);

router.get('/',    getHomework);
router.post('/',   createHomework);
router.put('/:id', updateHomework);
router.delete('/:id', deleteHomework);

module.exports = router;
