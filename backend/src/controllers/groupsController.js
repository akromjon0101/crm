const { query } = require('../config/database');

const getAllGroups = async (req, res) => {
  try {
    const { status, teacher_id } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (status) { params.push(status); conditions += ` AND g.status = ?`; }
    if (teacher_id) { params.push(teacher_id); conditions += ` AND g.teacher_id = ?`; }
    if (req.user.role === 'teacher') { params.push(req.user.id); conditions += ` AND g.teacher_id = ?`; }

    const result = await query(
      `SELECT g.*, u.name as teacher_name, c.name as course_name, c.monthly_fee,
        COUNT(DISTINCT s.id) as student_count
       FROM groups g
       LEFT JOIN users u ON u.id = g.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       LEFT JOIN students s ON s.group_id = g.id AND s.is_active = 1
       ${conditions}
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getGroupById = async (req, res) => {
  try {
    const group = await query(
      `SELECT g.*, u.name as teacher_name, c.name as course_name, c.monthly_fee
       FROM groups g
       LEFT JOIN users u ON u.id = g.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE g.id = ?`,
      [req.params.id]
    );

    if (!group.rows[0]) return res.status(404).json({ message: 'Group not found' });

    const students = await query(
      `SELECT s.*
       FROM students s
       WHERE s.group_id = ? AND s.is_active = 1
       ORDER BY s.name`,
      [req.params.id]
    );

    res.json({ ...group.rows[0], students: students.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createGroup = async (req, res) => {
  try {
    const { name, course_id, teacher_id, schedule, room, start_date, end_date, max_students } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const result = await query(
      `INSERT INTO groups (name, course_id, teacher_id, schedule, room, start_date, end_date, max_students)
       VALUES (?,?,?,?,?,?,?,?) RETURNING *`,
      [name, course_id || null, teacher_id || null, schedule || null, room || null, start_date || null, end_date || null, max_students || 20]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { name, course_id, teacher_id, schedule, room, start_date, end_date, max_students, status } = req.body;

    const result = await query(
      `UPDATE groups SET name=?, course_id=?, teacher_id=?, schedule=?, room=?,
       start_date=?, end_date=?, max_students=?, status=?, updated_at=datetime('now')
       WHERE id=? RETURNING *`,
      [name, course_id || null, teacher_id || null, schedule || null, room || null,
       start_date || null, end_date || null, max_students || 20, status || 'active', req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const students = await query(
      'SELECT COUNT(*) as count FROM students WHERE group_id = ? AND is_active = 1',
      [req.params.id]
    );
    if (parseInt(students.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete group with active students' });
    }
    const result = await query('DELETE FROM groups WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Group not found' });
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllGroups, getGroupById, createGroup, updateGroup, deleteGroup };
