const { query } = require('../config/database');

// Access control: a teacher may only see/create homework for groups they
// actually teach (same rule already applied throughout attendanceController
// and lessonsController). Admins/superadmins are unrestricted.
const assertTeacherOwnsGroup = async (req, group_id) => {
  if (req.user.role !== 'teacher') return null;
  const g = await query('SELECT teacher_id FROM groups WHERE id = ?', [group_id]);
  if (!g.rows[0]) return { status: 404, message: 'Group not found' };
  if (g.rows[0].teacher_id !== req.user.id) return { status: 403, message: 'Access denied' };
  return null;
};

// GET /api/homework?group_id=X
const getHomework = async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ message: 'group_id is required' });

    const denied = await assertTeacherOwnsGroup(req, group_id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const result = await query(
      `SELECT h.*, u.name as teacher_name
       FROM homework h
       LEFT JOIN users u ON u.id = h.teacher_id
       WHERE h.group_id = ?
       ORDER BY h.created_at DESC`,
      [group_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/homework
const createHomework = async (req, res) => {
  try {
    const { group_id, title, description, due_date } = req.body;
    if (!group_id || !title?.trim()) {
      return res.status(400).json({ message: 'group_id and title are required' });
    }

    const denied = await assertTeacherOwnsGroup(req, group_id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const result = await query(
      `INSERT INTO homework (group_id, teacher_id, title, description, due_date)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
      [group_id, req.user.id, title.trim(), description?.trim() || null, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/homework/:id
const deleteHomework = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM homework WHERE id = ? AND teacher_id = ? RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Not found or not authorized' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/homework/:id
const updateHomework = async (req, res) => {
  try {
    const { title, description, due_date } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });

    const result = await query(
      `UPDATE homework SET title = ?, description = ?, due_date = ?
       WHERE id = ? AND teacher_id = ?
       RETURNING *`,
      [title.trim(), description?.trim() || null, due_date || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Not found or not authorized' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getHomework, createHomework, deleteHomework, updateHomework };
