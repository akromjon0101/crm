const { query } = require('../config/database');

// GET /api/messages — inbox
const getInbox = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, sender_id, sender_name, sender_role, subject, body, is_read, created_at
       FROM user_messages
       WHERE recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread_count = result.rows.filter(m => !m.is_read).length;
    res.json({ messages: result.rows, unread_count });
  } catch (err) {
    console.error('[Messages] getInbox failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/messages/sent
const getSent = async (req, res) => {
  try {
    const result = await query(
      `SELECT m.id, m.recipient_id, u.name AS recipient_name, u.role AS recipient_role,
              m.subject, m.body, m.is_read, m.created_at
       FROM user_messages m
       JOIN users u ON u.id = m.recipient_id
       WHERE m.sender_id = ?
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error('[Messages] getSent failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/messages/recipients — all active users except self
const getRecipients = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, role FROM users
       WHERE id != ? AND is_active = 1
       ORDER BY role, name`,
      [req.user.id]
    );
    res.json({ recipients: result.rows });
  } catch (err) {
    console.error('[Messages] getRecipients failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/messages/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) AS count FROM user_messages WHERE recipient_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ unread_count: result.rows[0]?.count ?? 0 });
  } catch (err) {
    console.error('[Messages] getUnreadCount failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/messages — send a message
const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, body } = req.body;
    if (!recipient_id || !body?.trim()) {
      return res.status(400).json({ message: 'recipient_id and body are required' });
    }
    const recipientCheck = await query('SELECT id FROM users WHERE id = ? AND is_active = 1', [recipient_id]);
    if (!recipientCheck.rows.length) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    const result = await query(
      `INSERT INTO user_messages (sender_id, sender_name, sender_role, recipient_id, subject, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.name, req.user.role, recipient_id, subject?.trim() || null, body.trim()]
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Sent' });
  } catch (err) {
    console.error('[Messages] sendMessage failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/messages/:id/read
const markRead = async (req, res) => {
  try {
    await query(
      `UPDATE user_messages SET is_read = 1 WHERE id = ? AND recipient_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Messages] markRead failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/messages/read-all
const markAllRead = async (req, res) => {
  try {
    await query(
      `UPDATE user_messages SET is_read = 1 WHERE recipient_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Messages] markAllRead failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getInbox, getSent, getRecipients, getUnreadCount, sendMessage, markRead, markAllRead };
