const { query } = require('../config/database');
const smsService = require('../utils/smsService');

/**
 * POST /api/sms/send
 * Body: { message, recipient_type, group_id?, student_ids? }
 * recipient_type: 'all' | 'group' | 'debtors' | 'selected'
 */
const sendBulkSms = async (req, res) => {
  const { message, recipient_type, group_id, student_ids } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message text is required' });
  }
  if (!recipient_type) {
    return res.status(400).json({ message: 'recipient_type is required' });
  }

  try {
    // ── Resolve phone numbers based on recipient type ─────────────────────────
    let rows = [];

    if (recipient_type === 'all') {
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE status = 'active' AND (phone IS NOT NULL OR parent_phone IS NOT NULL)`
      );
      rows = r.rows;

    } else if (recipient_type === 'debtors') {
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE status = 'active' AND is_debtor = 1 AND (phone IS NOT NULL OR parent_phone IS NOT NULL)`
      );
      rows = r.rows;

    } else if (recipient_type === 'group') {
      if (!group_id) return res.status(400).json({ message: 'group_id required for group type' });
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE group_id = ? AND status = 'active' AND (phone IS NOT NULL OR parent_phone IS NOT NULL)`,
        [group_id]
      );
      rows = r.rows;

    } else if (recipient_type === 'selected') {
      if (!student_ids?.length) return res.status(400).json({ message: 'student_ids required for selected type' });
      const placeholders = student_ids.map(() => '?').join(',');
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE id IN (${placeholders}) AND (phone IS NOT NULL OR parent_phone IS NOT NULL)`,
        student_ids
      );
      rows = r.rows;

    } else {
      return res.status(400).json({ message: 'Invalid recipient_type' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No recipients with phone numbers found' });
    }

    // ── Send SMS to each recipient (use parent_phone first, fallback to student phone) ─
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const student of rows) {
      const phone = student.parent_phone || student.phone;
      if (!phone) { failed++; continue; }

      const result = await smsService.sendSMS(phone, message);
      if (result.success) {
        sent++;
        results.push({ id: student.id, name: student.name, phone, status: 'sent' });
      } else {
        failed++;
        results.push({ id: student.id, name: student.name, phone, status: 'failed', error: result.error || result.message });
      }
    }

    // ── Log to sms_logs ───────────────────────────────────────────────────────
    await query(
      `INSERT INTO sms_logs (message, recipient_type, group_id, total_sent, total_failed, sent_by, sent_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message.trim(),
        recipient_type,
        group_id || null,
        sent,
        failed,
        req.user?.id || null,
        req.user?.name || null,
      ]
    );

    res.json({
      success: true,
      total:   rows.length,
      sent,
      failed,
      results,
    });

  } catch (err) {
    console.error('[SMS sendBulkSms]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/sms/preview
 * Query: recipient_type, group_id?, student_ids?
 * Returns count + first 5 names (no SMS sent)
 */
const previewRecipients = async (req, res) => {
  const { recipient_type, group_id, student_ids } = req.query;

  try {
    let rows = [];

    if (recipient_type === 'all') {
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE status = 'active' AND (phone IS NOT NULL OR parent_phone IS NOT NULL) LIMIT 200`
      );
      rows = r.rows;

    } else if (recipient_type === 'debtors') {
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE status = 'active' AND is_debtor = 1 AND (phone IS NOT NULL OR parent_phone IS NOT NULL) LIMIT 200`
      );
      rows = r.rows;

    } else if (recipient_type === 'group' && group_id) {
      const r = await query(
        `SELECT id, name, phone, parent_phone FROM students WHERE group_id = ? AND status = 'active' AND (phone IS NOT NULL OR parent_phone IS NOT NULL) LIMIT 200`,
        [group_id]
      );
      rows = r.rows;

    } else if (recipient_type === 'selected' && student_ids) {
      const ids = student_ids.split(',').map(Number).filter(Boolean);
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const r = await query(
          `SELECT id, name, phone, parent_phone FROM students WHERE id IN (${placeholders}) AND (phone IS NOT NULL OR parent_phone IS NOT NULL)`,
          ids
        );
        rows = r.rows;
      }
    }

    res.json({
      count:   rows.length,
      preview: rows.slice(0, 5).map(s => ({ id: s.id, name: s.name, phone: s.parent_phone || s.phone })),
    });

  } catch (err) {
    console.error('[SMS previewRecipients]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/sms/logs
 * Returns recent SMS send history
 */
const getSmsLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const r = await query(
      `SELECT sl.*, g.name as group_name
       FROM sms_logs sl
       LEFT JOIN groups g ON g.id = sl.group_id
       ORDER BY sl.created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[SMS getSmsLogs]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { sendBulkSms, previewRecipients, getSmsLogs };
