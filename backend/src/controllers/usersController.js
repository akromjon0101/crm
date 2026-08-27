const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const params = [];
    let sql = 'SELECT id, name, email, role, phone, subject, is_active, created_at FROM users WHERE 1=1';
    if (role) { params.push(role); sql += ` AND role = ?`; }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getTeachers = async (req, res) => {
  try {
    const isCeo = req.user?.role === 'superadmin';
    const salaryFields = isCeo
      ? `, u.salary_per_student,
        CASE WHEN u.salary_per_student IS NOT NULL
          THEN CAST(u.salary_per_student * COUNT(DISTINCT s.id) AS INTEGER)
          ELSE NULL END as total_salary`
      : '';

    const result = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.subject, u.is_active${salaryFields},
        COUNT(DISTINCT g.id) as group_count,
        COUNT(DISTINCT s.id) as student_count
       FROM users u
       LEFT JOIN groups g ON g.teacher_id = u.id AND g.status = 'active'
       LEFT JOIN students s ON s.group_id = g.id AND s.is_active = 1
       WHERE u.role = 'teacher'
       GROUP BY u.id
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, phone, subject, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, subject, salary_per_student } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password and role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    // Privilege-escalation guard: only a superadmin may create admin/superadmin
    // accounts. Without this, an 'admin' caller (also authorized on this route)
    // could grant themselves or anyone else superadmin access.
    if (['admin', 'superadmin'].includes(role) && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only a superadmin can create admin or superadmin accounts' });
    }
    const existing = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.rows[0]) return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password, role, phone, subject, salary_per_student)
       VALUES (?,?,?,?,?,?,?) RETURNING id, name, email, role, phone, subject, is_active, salary_per_student, created_at`,
      [name, email.toLowerCase(), hashed, role, phone || null, subject || null, salary_per_student || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, phone, subject, is_active, salary_per_student } = req.body;

    // Same privilege-escalation guard as createUser: a non-superadmin 'admin'
    // (also authorized on this route) must not be able to promote a user to
    // admin/superadmin, or demote/alter an existing superadmin.
    if (req.user.role !== 'superadmin') {
      if (['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({ message: 'Only a superadmin can grant admin or superadmin access' });
      }
      const target = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
      if (target.rows[0]?.role === 'superadmin') {
        return res.status(403).json({ message: 'Only a superadmin can modify a superadmin account' });
      }
    }

    const result = await query(
      `UPDATE users SET name=?, email=?, role=?, phone=?, subject=?, is_active=?, salary_per_student=?, updated_at=datetime('now')
       WHERE id=? RETURNING id, name, email, role, phone, subject, is_active, salary_per_student`,
      [name, email?.toLowerCase(), role, phone || null, subject || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, salary_per_student !== undefined ? (salary_per_student || null) : null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const result = await query('DELETE FROM users WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllUsers, getTeachers, getUserById, createUser, updateUser, deleteUser, resetPassword };
