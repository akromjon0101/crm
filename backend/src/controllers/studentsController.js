const { query } = require('../config/database');
const eskizService = require('../utils/smsService');

// ── Helpers ────────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const logActivity = async (action, entityId, entityName, details, user) => {
  try {
    await query(
      `INSERT INTO activity_log (action, entity_type, entity_id, entity_name, details, performed_by, performed_by_name)
       VALUES (?, 'student', ?, ?, ?, ?, ?)`,
      [action, entityId, entityName, details ? JSON.stringify(details) : null,
       user?.id || null, user?.name || null]
    );
  } catch (_) { /* non-critical, don't fail main operation */ }
};

// ── GET /students ──────────────────────────────────────────────────────────────
const getAllStudents = async (req, res) => {
  try {
    const { search, group_id, status, is_debtor, page = 1, limit = 50 } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      conditions += ` AND (s.name LIKE ? OR s.phone LIKE ? OR s.parent_phone LIKE ?)`;
    }
    if (group_id) { params.push(group_id); conditions += ` AND s.group_id = ?`; }
    if (status)   { params.push(status);   conditions += ` AND s.status = ?`; }
    else           {                         conditions += ` AND s.status != 'archived'`; }
    if (is_debtor !== undefined) {
      params.push(is_debtor === 'true' ? 1 : 0);
      conditions += ` AND s.is_debtor = ?`;
    }
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      conditions += ` AND g.teacher_id = ?`;
    }

    const countResult = await query(
      `SELECT COUNT(*) as count FROM students s
       LEFT JOIN groups g ON g.id = s.group_id ${conditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT s.*, g.name as group_name, u.name as teacher_name, c.name as course_name,
              COALESCE(g.monthly_fee, c.monthly_fee) as effective_monthly_fee
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN users u ON u.id = g.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       ${conditions}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /students/:id ──────────────────────────────────────────────────────────
const getStudentById = async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, g.name as group_name, g.schedule, u.name as teacher_name,
              c.name as course_name, c.monthly_fee,
              COALESCE(g.monthly_fee, c.monthly_fee) as effective_monthly_fee
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN users u ON u.id = g.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });

    const [payments, attendanceStats, notes, history] = await Promise.all([
      query('SELECT * FROM payments WHERE student_id = ? ORDER BY year DESC, month DESC', [req.params.id]),
      query(`SELECT status, COUNT(*) as count FROM attendance WHERE student_id = ? GROUP BY status`, [req.params.id]),
      query(
        `SELECT sn.*, u.name as teacher_name FROM student_notes sn
         LEFT JOIN users u ON u.id = sn.teacher_id
         WHERE sn.student_id = ? ORDER BY sn.created_at DESC`,
        [req.params.id]
      ),
      query(
        `SELECT h.*, g.name as group_name, u.name as teacher_name
         FROM student_group_history h
         LEFT JOIN groups g ON g.id = h.group_id
         LEFT JOIN users u ON u.id = g.teacher_id
         WHERE h.student_id = ?
         ORDER BY h.start_date DESC, h.id DESC`,
        [req.params.id]
      ),
    ]);

    res.json({
      ...result.rows[0],
      payments:         payments.rows,
      attendance_stats: attendanceStats.rows,
      notes:            notes.rows,
      group_history:    history.rows,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Phone normalisation helper ─────────────────────────────────────────────────
const normalizePhone = (p) => {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  // Accept 998XXXXXXXXX (12 digits) or 9-digit local numbers → prepend 998
  if (digits.length === 12 && digits.startsWith('998')) return digits;
  if (digits.length === 9) return `998${digits}`;
  return null; // unrecognised — caller must handle
};

// ── POST /students ─────────────────────────────────────────────────────────────
const createStudent = async (req, res) => {
  try {
    const { name, phone, parent_phone, email, birth_date, address, group_id, start_date, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Student name is required' });

    // Normalize phones — silently drop unrecognised formats so we never store
    // junk numbers that the SMS gateway will reject.
    const normalizedPhone = normalizePhone(phone);
    const normalizedParentPhone = normalizePhone(parent_phone);

    const sd = start_date || today();

    const result = await query(
      `INSERT INTO students (name, phone, parent_phone, email, birth_date, address, group_id, start_date, notes, status, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,'active',1) RETURNING *`,
      [name, normalizedPhone, normalizedParentPhone, email || null,
       birth_date || null, address || null, group_id || null, sd, notes || null]
    );

    const student = result.rows[0];

    if (group_id) {
      await query(
        `INSERT INTO student_group_history (student_id, group_id, start_date, status)
         VALUES (?, ?, ?, 'active')`,
        [student.id, group_id, sd]
      );
    }

    await logActivity('new_student', student.id, student.name, { group_id }, req.user);

    // [SMS] Welcome Message
    if (student.phone) {
      eskizService.sendSMS(student.phone, `Assalomu alaykum, ${student.name}! EduCRM tizimiga xush kelibsiz.`).catch(console.error);
    }

    res.status(201).json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id ──────────────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const { name, phone, parent_phone, email, birth_date, address, group_id, start_date, is_active, is_debtor, notes } = req.body;

    // Normalize phones — keep them consistent with createStudent() so downstream
    // consumers (e.g. SMS sending) never see malformed numbers.
    const normalizedPhone = normalizePhone(phone);
    const normalizedParentPhone = normalizePhone(parent_phone);

    const result = await query(
      `UPDATE students SET name=?, phone=?, parent_phone=?, email=?, birth_date=?,
       address=?, group_id=?, start_date=?, is_active=?, is_debtor=?, notes=?,
       updated_at=datetime('now')
       WHERE id=? RETURNING *`,
      [name, normalizedPhone, normalizedParentPhone, email || null, birth_date || null,
       address || null, group_id || null, start_date || null,
       is_active ? 1 : 0, is_debtor ? 1 : 0, notes || null, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /students/:id ───────────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const result = await query('DELETE FROM students WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/transfer ─────────────────────────────────────────────────
const transferStudent = async (req, res) => {
  try {
    const { group_id, notes } = req.body;
    if (!group_id) return res.status(400).json({ message: 'group_id is required' });

    const studentResult = await query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!studentResult.rows[0]) return res.status(404).json({ message: 'Student not found' });
    const student = studentResult.rows[0];

    const [fromGroup, toGroup] = await Promise.all([
      query('SELECT name FROM groups WHERE id = ?', [student.group_id]),
      query('SELECT name FROM groups WHERE id = ?', [group_id]),
    ]);

    const now = today();
    await query(
      `UPDATE student_group_history SET end_date = ?, status = 'transferred'
       WHERE student_id = ? AND end_date IS NULL`,
      [now, req.params.id]
    );

    const updated = await query(
      `UPDATE students SET group_id = ?, status = 'active', is_active = 1,
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [group_id, req.params.id]
    );

    await query(
      `INSERT INTO student_group_history (student_id, group_id, start_date, status, notes)
       VALUES (?, ?, ?, 'active', ?)`,
      [req.params.id, group_id, now, notes || null]
    );

    await logActivity('transfer', student.id, student.name, {
      from_group: fromGroup.rows[0]?.name,
      to_group: toGroup.rows[0]?.name,
    }, req.user);

    // [SMS] Transfer Notification — re-normalize in case the stored number
    // predates normalization or was written by an older code path.
    const smsPhone = normalizePhone(student.phone);
    if (smsPhone && toGroup.rows[0]?.name) {
      eskizService.sendSMS(smsPhone, `Siz muvaffaqiyatli ravishomda "${toGroup.rows[0].name}" guruhiga ko'chirildingiz.`).catch(console.error);
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/freeze ───────────────────────────────────────────────────
const freezeStudent = async (req, res) => {
  try {
    const { notes, freeze_until } = req.body;
    const now = today();

    await query(
      `UPDATE student_group_history SET end_date = ?, status = 'frozen', notes = COALESCE(?, notes)
       WHERE student_id = ? AND end_date IS NULL`,
      [now, notes || null, req.params.id]
    );

    const result = await query(
      `UPDATE students SET status = 'frozen', freeze_until = ?, updated_at = datetime('now')
       WHERE id = ? RETURNING *`,
      [freeze_until || null, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });

    await logActivity('freeze', result.rows[0].id, result.rows[0].name, {
      freeze_until: freeze_until || null,
    }, req.user);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/unfreeze ─────────────────────────────────────────────────
const unfreezeStudent = async (req, res) => {
  try {
    const { notes } = req.body;

    const studentResult = await query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!studentResult.rows[0]) return res.status(404).json({ message: 'Student not found' });
    const student = studentResult.rows[0];

    const lastFrozen = await query(
      `SELECT group_id FROM student_group_history
       WHERE student_id = ? AND status = 'frozen'
       ORDER BY id DESC LIMIT 1`,
      [req.params.id]
    );

    const groupId = lastFrozen.rows[0]?.group_id || student.group_id;
    if (!groupId) return res.status(400).json({ message: 'No group found to return to' });

    // Guard against the original group having been deleted while the student was frozen —
    // otherwise we'd assign a group_id that no longer exists, breaking referential integrity.
    const groupCheck = await query('SELECT id FROM groups WHERE id = ?', [groupId]);
    if (!groupCheck.rows[0]) {
      return res.status(400).json({ message: 'Original group no longer exists. Please transfer the student to a new group instead.' });
    }

    const now = today();
    await query(
      `INSERT INTO student_group_history (student_id, group_id, start_date, status, notes)
       VALUES (?, ?, ?, 'active', ?)`,
      [req.params.id, groupId, now, notes || null]
    );

    const result = await query(
      `UPDATE students SET status = 'active', group_id = ?, is_active = 1,
       freeze_until = NULL, updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [groupId, req.params.id]
    );

    await logActivity('unfreeze', student.id, student.name, {}, req.user);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/archive ──────────────────────────────────────────────────
const archiveStudent = async (req, res) => {
  try {
    const { notes } = req.body;
    const now = today();

    await query(
      `UPDATE student_group_history SET end_date = ?, status = 'transferred',
       notes = COALESCE(?, notes) WHERE student_id = ? AND end_date IS NULL`,
      [now, notes || null, req.params.id]
    );

    const result = await query(
      `UPDATE students SET status = 'archived', is_active = 0, archived_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });

    await logActivity('archive', result.rows[0].id, result.rows[0].name, {}, req.user);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/restore ──────────────────────────────────────────────────
const restoreStudent = async (req, res) => {
  try {
    // Look up the last group this student belonged to before archiving
    const histResult = await query(
      `SELECT group_id FROM student_group_history
       WHERE student_id = ?
       ORDER BY start_date DESC, id DESC
       LIMIT 1`,
      [req.params.id]
    );
    const lastGroupId = histResult.rows[0]?.group_id || null;

    const result = await query(
      `UPDATE students SET status = 'active', is_active = 1, group_id = ?,
       archived_at = NULL, updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [lastGroupId, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });

    await logActivity('restore', result.rows[0].id, result.rows[0].name, { restored_to_group: lastGroupId }, req.user);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /students/:id/add-to-group ───────────────────────────────────────────
const addStudentToGroup = async (req, res) => {
  try {
    const { group_id, start_date, notes } = req.body;
    if (!group_id) return res.status(400).json({ message: 'group_id is required' });

    const sd = start_date || today();

    await query(
      `UPDATE student_group_history SET end_date = ?, status = 'transferred'
       WHERE student_id = ? AND end_date IS NULL`,
      [sd, req.params.id]
    );

    const result = await query(
      `UPDATE students SET group_id = ?, status = 'active', is_active = 1,
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [group_id, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });

    await query(
      `INSERT INTO student_group_history (student_id, group_id, start_date, status, notes)
       VALUES (?, ?, ?, 'active', ?)`,
      [req.params.id, group_id, sd, notes || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /students/:id/history ──────────────────────────────────────────────────
const getStudentHistory = async (req, res) => {
  try {
    const result = await query(
      `SELECT h.*, g.name as group_name, u.name as teacher_name
       FROM student_group_history h
       LEFT JOIN groups g ON g.id = h.group_id
       LEFT JOIN users u ON u.id = g.teacher_id
       WHERE h.student_id = ?
       ORDER BY h.start_date DESC, h.id DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /students/:id/toggle-debtor ───────────────────────────────────────────
const toggleDebtor = async (req, res) => {
  try {
    const current = await query('SELECT is_debtor FROM students WHERE id = ?', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ message: 'Student not found' });
    const newVal = current.rows[0].is_debtor ? 0 : 1;
    const result = await query(
      'UPDATE students SET is_debtor = ? WHERE id = ? RETURNING id, name, is_debtor',
      [newVal, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /students/:id/notes ───────────────────────────────────────────────────
const addNote = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }
    if (note.length > 1000) {
      return res.status(400).json({ message: 'Note too long (max 1000 characters)' });
    }
    const result = await query(
      'INSERT INTO student_notes (student_id, teacher_id, note) VALUES (?,?,?) RETURNING *',
      [req.params.id, req.user.id, note.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Students] addNote failed:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /students/bulk-action ─────────────────────────────────────────────────
const bulkAction = async (req, res) => {
  try {
    const { action, student_ids, group_id, freeze_until } = req.body;
    if (!action || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ message: 'action and student_ids[] are required' });
    }

    const validActions = ['freeze', 'unfreeze', 'archive', 'restore', 'transfer'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: `Invalid action. Must be one of: ${validActions.join(', ')}` });
    }

    if (action === 'transfer' && !group_id) {
      return res.status(400).json({ message: 'group_id is required for transfer action' });
    }

    const now = today();
    const results = [];
    const errors = [];

    for (const id of student_ids) {
      try {
        const studentResult = await query('SELECT * FROM students WHERE id = ?', [id]);
        if (!studentResult.rows[0]) { errors.push({ id, error: 'Not found' }); continue; }
        const student = studentResult.rows[0];

        if (action === 'freeze') {
          await query(
            `UPDATE student_group_history SET end_date = ?, status = 'frozen'
             WHERE student_id = ? AND end_date IS NULL`,
            [now, id]
          );
          await query(
            `UPDATE students SET status = 'frozen', freeze_until = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [freeze_until || null, id]
          );
          await logActivity('freeze', id, student.name, { freeze_until: freeze_until || null, bulk: true }, req.user);

        } else if (action === 'unfreeze') {
          const lastFrozen = await query(
            `SELECT group_id FROM student_group_history WHERE student_id = ? AND status = 'frozen' ORDER BY id DESC LIMIT 1`,
            [id]
          );
          const gId = lastFrozen.rows[0]?.group_id || student.group_id;
          if (gId) {
            await query(
              `INSERT INTO student_group_history (student_id, group_id, start_date, status) VALUES (?, ?, ?, 'active')`,
              [id, gId, now]
            );
          }
          await query(
            `UPDATE students SET status = 'active', group_id = COALESCE(?, group_id), is_active = 1, freeze_until = NULL, updated_at = datetime('now') WHERE id = ?`,
            [gId || null, id]
          );
          await logActivity('unfreeze', id, student.name, { bulk: true }, req.user);

        } else if (action === 'archive') {
          await query(
            `UPDATE student_group_history SET end_date = ?, status = 'transferred' WHERE student_id = ? AND end_date IS NULL`,
            [now, id]
          );
          await query(
            `UPDATE students SET status = 'archived', is_active = 0, archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            [id]
          );
          await logActivity('archive', id, student.name, { bulk: true }, req.user);

        } else if (action === 'restore') {
          await query(
            `UPDATE students SET status = 'active', is_active = 1, group_id = NULL, archived_at = NULL, updated_at = datetime('now') WHERE id = ?`,
            [id]
          );
          await logActivity('restore', id, student.name, { bulk: true }, req.user);

        } else if (action === 'transfer') {
          await query(
            `UPDATE student_group_history SET end_date = ?, status = 'transferred' WHERE student_id = ? AND end_date IS NULL`,
            [now, id]
          );
          await query(
            `UPDATE students SET group_id = ?, status = 'active', is_active = 1, updated_at = datetime('now') WHERE id = ?`,
            [group_id, id]
          );
          await query(
            `INSERT INTO student_group_history (student_id, group_id, start_date, status) VALUES (?, ?, ?, 'active')`,
            [id, group_id, now]
          );
          await logActivity('transfer', id, student.name, { to_group_id: group_id, bulk: true }, req.user);
        }

        results.push({ id, success: true });
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({ results, errors, processed: results.length, failed: errors.length });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllStudents, getStudentById,
  createStudent, updateStudent, deleteStudent,
  transferStudent, freezeStudent, unfreezeStudent,
  archiveStudent, restoreStudent, addStudentToGroup,
  getStudentHistory, toggleDebtor, addNote, bulkAction,
};
