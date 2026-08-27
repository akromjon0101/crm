const { query } = require('../config/database');

// ── GET /leads ─────────────────────────────────────────────────────────────────
const getAllLeads = async (req, res) => {
  try {
    const { search, status, source, page = 1, limit = 50 } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      conditions += ` AND (l.name LIKE ? OR l.phone LIKE ?)`;
    }
    if (status) { params.push(status); conditions += ` AND l.status = ?`; }
    if (source) { params.push(source); conditions += ` AND l.source = ?`; }

    const countResult = await query(
      `SELECT COUNT(*) as count FROM leads l ${conditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT l.*, u.name as assigned_to_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ${conditions}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Stats scoped to search/source but NOT status (so frontend shows all tab counts)
    const statsParams = [];
    let statsConditions = 'WHERE 1=1';
    if (search) {
      statsParams.push(`%${search}%`, `%${search}%`);
      statsConditions += ` AND (name LIKE ? OR phone LIKE ?)`;
    }
    if (source) { statsParams.push(source); statsConditions += ` AND source = ?`; }

    const statsResult = await query(
      `SELECT status, COUNT(*) as count FROM leads ${statsConditions} GROUP BY status`,
      statsParams
    );

    const stats = {};
    for (const row of statsResult.rows) {
      stats[row.status] = parseInt(row.count);
    }

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit), stats });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /leads/stats ───────────────────────────────────────────────────────────
const getLeadStats = async (req, res) => {
  try {
    const byStatus = await query(
      `SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC`, []
    );
    const bySource = await query(
      `SELECT source, COUNT(*) as count FROM leads GROUP BY source ORDER BY count DESC`, []
    );
    const total = await query(`SELECT COUNT(*) as count FROM leads`, []);

    res.json({
      total:     parseInt(total.rows[0].count),
      by_status: byStatus.rows,
      by_source: bySource.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /leads/:id ─────────────────────────────────────────────────────────────
const getLeadById = async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*, u.name as assigned_to_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.id = ?`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /leads ────────────────────────────────────────────────────────────────
const createLead = async (req, res) => {
  try {
    const { name, phone, email, source, status, course_interest, notes, assigned_to, follow_up_date } = req.body;

    if (!name)  return res.status(400).json({ message: 'Lead name is required' });
    if (!phone) return res.status(400).json({ message: 'Lead phone is required' });

    const result = await query(
      `INSERT INTO leads (name, phone, email, source, status, course_interest, notes, assigned_to, follow_up_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        name, phone,
        email           || null,
        source          || 'other',
        status          || 'new',
        course_interest || null,
        notes           || null,
        assigned_to     || null,
        follow_up_date  || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /leads/:id ─────────────────────────────────────────────────────────────
const updateLead = async (req, res) => {
  try {
    const { name, phone, email, source, status, course_interest, notes, assigned_to, follow_up_date } = req.body;

    const existing = await query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Lead not found' });

    const result = await query(
      `UPDATE leads SET
         name            = ?,
         phone           = ?,
         email           = ?,
         source          = ?,
         status          = ?,
         course_interest = ?,
         notes           = ?,
         assigned_to     = ?,
         follow_up_date  = ?,
         updated_at      = datetime('now')
       WHERE id = ?
       RETURNING *`,
      [
        name, phone,
        email           || null,
        source          || 'other',
        status          || 'new',
        course_interest || null,
        notes           || null,
        assigned_to     || null,
        follow_up_date  || null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /leads/:id ──────────────────────────────────────────────────────────
const deleteLead = async (req, res) => {
  try {
    const result = await query('DELETE FROM leads WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllLeads, getLeadStats, getLeadById, createLead, updateLead, deleteLead };
