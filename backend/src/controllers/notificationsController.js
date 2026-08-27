const { query } = require('../config/database');

/**
 * GET /api/notifications
 * Returns structured notifications: freeze_ending, payment_overdue, new_student, recent_transfer
 */
const getNotifications = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const isTeacher   = req.user.role === 'teacher';
    const teacherCond = isTeacher ? 'AND g.teacher_id = ?' : '';
    const teacherParam = isTeacher ? [req.user.id] : [];

    const notifications = [];

    // 1. Freeze ending soon (within 3 days)
    const freezeEnding = await query(
      `SELECT s.id, s.name, s.freeze_until, g.name as group_name
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.status = 'frozen' AND s.freeze_until IS NOT NULL
         AND s.freeze_until <= ? AND s.freeze_until >= ?
         ${teacherCond}
       ORDER BY s.freeze_until ASC`,
      [in3Days, today, ...teacherParam]
    );
    for (const s of freezeEnding.rows) {
      const daysLeft = Math.ceil((new Date(s.freeze_until) - now) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `freeze_${s.id}`,
        type: 'freeze_ending',
        severity: daysLeft <= 1 ? 'danger' : 'warning',
        message: `${s.name} freeze ends ${daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}`,
        student_id: s.id,
        student_name: s.name,
        group_name: s.group_name,
        extra: { freeze_until: s.freeze_until, days_left: daysLeft },
        created_at: now.toISOString(),
      });
    }

    // 2. Payment overdue (active students with no payment this month)
    const unpaid = await query(
      `SELECT s.id, s.name, s.phone, g.name as group_name,
              COALESCE(g.monthly_fee, c.monthly_fee) as monthly_fee
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE s.status = 'active' ${teacherCond}
         AND s.id NOT IN (
           SELECT DISTINCT p.student_id FROM payments p
           WHERE p.month = ? AND p.year = ?
         )
       ORDER BY s.name
       LIMIT 20`,
      [...teacherParam, month, year]
    );
    for (const s of unpaid.rows) {
      notifications.push({
        id: `payment_${s.id}`,
        type: 'payment_overdue',
        severity: 'warning',
        message: `${s.name} hasn't paid for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`,
        student_id: s.id,
        student_name: s.name,
        group_name: s.group_name,
        extra: { amount_owed: s.monthly_fee, month, year },
        created_at: now.toISOString(),
      });
    }

    // 3. New students (last 7 days)
    const newStudents = await query(
      `SELECT s.id, s.name, g.name as group_name, s.created_at
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.created_at >= ?
       ORDER BY s.created_at DESC
       LIMIT 5`,
      [last7Days]
    );
    for (const s of newStudents.rows) {
      notifications.push({
        id: `new_student_${s.id}`,
        type: 'new_student',
        severity: 'info',
        message: `New student added: ${s.name}${s.group_name ? ` → ${s.group_name}` : ''}`,
        student_id: s.id,
        student_name: s.name,
        group_name: s.group_name,
        extra: {},
        created_at: s.created_at,
      });
    }

    // 4. Recent transfers (last 7 days from activity_log — if table exists)
    try {
      const transfers = await query(
        `SELECT * FROM activity_log
         WHERE action = 'transfer' AND created_at >= ?
         ORDER BY created_at DESC LIMIT 5`,
        [last7Days]
      );
      for (const t of transfers.rows) {
        const details = t.details ? JSON.parse(t.details) : {};
        notifications.push({
          id: `transfer_${t.id}`,
          type: 'transfer',
          severity: 'info',
          message: `${t.entity_name} transferred${details.from_group ? ` from ${details.from_group}` : ''}${details.to_group ? ` to ${details.to_group}` : ''}`,
          student_id: t.entity_id,
          student_name: t.entity_name,
          extra: details,
          created_at: t.created_at,
        });
      }
    } catch (_) { /* activity_log may not exist yet */ }

    // Sort by severity: danger > warning > info, then by created_at desc
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => {
      const sv = severityOrder[a.severity] - severityOrder[b.severity];
      if (sv !== 0) return sv;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.json({
      notifications,
      counts: {
        total: notifications.length,
        danger: notifications.filter(n => n.severity === 'danger').length,
        warning: notifications.filter(n => n.severity === 'warning').length,
        info: notifications.filter(n => n.severity === 'info').length,
      },
      // Legacy format for backwards compatibility
      month,
      year,
      debtors: unpaid.rows,
      unpaid:  unpaid.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getNotifications };
