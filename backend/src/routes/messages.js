const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getInbox, getSent, getRecipients, getUnreadCount,
  sendMessage, markRead, markAllRead,
} = require('../controllers/messagesController');

router.use(authenticate);

router.get('/',             getInbox);
router.get('/sent',         getSent);
router.get('/recipients',   getRecipients);
router.get('/unread-count', getUnreadCount);
router.post('/',            sendMessage);
router.patch('/read-all',   markAllRead);
router.patch('/:id/read',   markRead);

module.exports = router;
