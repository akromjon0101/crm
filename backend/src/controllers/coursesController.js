const { query } = require('../config/database');

const getAllCourses = async (req, res) => {
  try {
    const result = await query('SELECT * FROM courses ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const createCourse = async (req, res) => {
  try {
    const { name, description, duration_months, monthly_fee } = req.body;
    if (!name || !monthly_fee) return res.status(400).json({ message: 'Name and monthly_fee required' });
    const result = await query(
      'INSERT INTO courses (name, description, duration_months, monthly_fee) VALUES (?,?,?,?) RETURNING *',
      [name, description || null, duration_months || 3, monthly_fee]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { name, description, duration_months, monthly_fee, is_active } = req.body;
    const result = await query(
      'UPDATE courses SET name=?, description=?, duration_months=?, monthly_fee=?, is_active=? WHERE id=? RETURNING *',
      [name, description || null, duration_months, monthly_fee, is_active ? 1 : 0, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Course not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const result = await query('DELETE FROM courses WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllCourses, createCourse, updateCourse, deleteCourse };
