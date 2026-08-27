const { query } = require('../config/database');

/**
 * GET /api/activity
 * Returns activity log entries for the admin dashboard feed.
 * Query params: ?limit=50&entity_type=student&action=transfer
 */
const getActivityLog = async (req, res) => {
  try {
    const { limit = 50, entity_type, action } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (entity_type) { params.push(entity_type); conditions += ' AND entity_type = ?'; }
    if (action)       { params.push(action);      conditions += ' AND action = ?'; }

    const result = await query(
      `SELECT * FROM activity_log ${conditions}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, Math.min(parseInt(limit) || 50, 200)]
    );

    const entries = result.rows.map(r => ({
      ...r,
      details: r.details ? (() => { try { return JSON.parse(r.details); } catch { return {}; } })() : {},
    }));

    res.json(entries);
  } catch (err) {
    console.error(err.message);
    // If activity_log table doesn't exist yet, return empty array
    res.json([]);
  }
};

module.exports = { getActivityLog };
