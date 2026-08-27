const { query } = require('../config/database');
const { calculateBilling } = require('../utils/billingCalculator');

const getAllPayments = async (req, res) => {
  try {
    const { student_id, month, year, page = 1, limit = 50 } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (student_id) { params.push(student_id); conditions += ` AND p.student_id = ?`; }
    if (month) { params.push(parseInt(month)); conditions += ` AND p.month = ?`; }
    if (year) { params.push(parseInt(year)); conditions += ` AND p.year = ?`; }
    if (req.user.role === 'teacher') { params.push(req.user.id); conditions += ` AND g.teacher_id = ?`; }

    const countResult = await query(
      `SELECT COUNT(*) as count FROM payments p
       LEFT JOIN students s ON s.id = p.student_id
       LEFT JOIN groups g ON g.id = s.group_id
       ${conditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await query(
      `SELECT p.*, s.name as student_name, g.name as group_name, u.name as created_by_name
       FROM payments p
       LEFT JOIN students s ON s.id = p.student_id
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN users u ON u.id = p.created_by
       ${conditions}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const createPayment = async (req, res) => {
  try {
    const { student_id, amount, payment_date, month, year, payment_type, description } = req.body;
    if (!student_id || !amount || !month || !year) {
      return res.status(400).json({ message: 'student_id, amount, month and year are required' });
    }

    // Duplicate guard: same student + month + year + amount within 10 seconds
    const recent = await query(
      `SELECT id FROM payments
       WHERE student_id = ? AND month = ? AND year = ? AND amount = ?
         AND created_at >= datetime('now', '-10 seconds')`,
      [student_id, parseInt(month), parseInt(year), amount]
    );
    if (recent.rows[0]) {
      return res.status(409).json({ message: 'Duplicate payment detected. Please wait a moment before submitting again.' });
    }

    const result = await query(
      `INSERT INTO payments (student_id, amount, payment_date, month, year, payment_type, description, created_by)
       VALUES (?,?,?,?,?,?,?,?) RETURNING *`,
      [student_id, amount, payment_date || new Date().toISOString().split('T')[0], month, year, payment_type || 'cash', description || null, req.user.id]
    );

    // NOTE: debtor status is managed manually by admin — not auto-cleared on payment
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const deletePayment = async (req, res) => {
  try {
    const result = await query('DELETE FROM payments WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getMonthlyStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const result = await query(
      `SELECT month, SUM(amount) as total, COUNT(*) as count
       FROM payments WHERE year = ? GROUP BY month ORDER BY month`,
      [year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getDebtors = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const result = await query(
      `SELECT s.id, s.name, s.phone, s.parent_phone, s.is_debtor,
        g.name as group_name, u.name as teacher_name,
        COALESCE(p.total_paid, 0) as total_paid_this_month
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN users u ON u.id = g.teacher_id
       LEFT JOIN (
         SELECT student_id, SUM(amount) as total_paid
         FROM payments WHERE month = ? AND year = ?
         GROUP BY student_id
       ) p ON p.student_id = s.id
       WHERE s.is_active = 1 AND s.is_debtor = 1
       ORDER BY s.name`,
      [currentMonth, currentYear]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/payments/billing?group_id=X&month=M&year=Y[&late_weight=0]
 *
 * Calculates the correct monthly fee for every student in a group,
 * taking into account their attendance for that month.
 *
 * Returns:
 *   { group, month, year, config, students: [{ student, billing, alreadyPaid }] }
 */
const getBillingForGroup = async (req, res) => {
  try {
    const { group_id, month, year, late_weight } = req.query;

    if (!group_id) return res.status(400).json({ message: 'group_id is required' });

    const now = new Date();
    const m = parseInt(month)      || (now.getMonth() + 1);
    const y = parseInt(year)       || now.getFullYear();
    const lateWeight = parseFloat(late_weight ?? 0);

    // ── 1. Fetch group with monthly_fee from courses as fallback ─────────────
    const groupRes = await query(
      `SELECT g.*, c.monthly_fee AS course_monthly_fee, c.name AS course_name,
              u.name AS teacher_name
       FROM groups g
       LEFT JOIN courses c ON c.id = g.course_id
       LEFT JOIN users   u ON u.id = g.teacher_id
       WHERE g.id = ?`,
      [group_id]
    );
    if (!groupRes.rows[0]) return res.status(404).json({ message: 'Group not found' });
    const group = groupRes.rows[0];

    // group.monthly_fee overrides course fee; fallback to course fee
    const monthlyFee = group.monthly_fee || group.course_monthly_fee || 0;
    if (!monthlyFee) {
      return res.status(422).json({
        message: 'No monthly_fee set for this group or its course. Set a fee before billing.',
      });
    }

    // ── 2. Compute lesson dates for this month from group schedule ────────────
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay   = new Date(y, m, 0).getDate();
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const lessonDates = [];
    if (group.schedule) {
      const [daysStr] = group.schedule.split('|');
      const lessonDays = daysStr.split(',').map(Number);
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        const dow = cur.getDay(); // 0=Sun, 1=Mon … 6=Sat
        if (lessonDays.includes(dow)) {
          lessonDates.push(cur.toISOString().split('T')[0]);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // ── 3. Fetch students in the group ────────────────────────────────────────
    const studentsRes = await query(
      `SELECT id, name, phone FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name`,
      [group_id]
    );
    const students = studentsRes.rows;
    if (!students.length) return res.json({ group, month: m, year: y, students: [] });

    const studentIds = students.map(s => s.id);

    // ── 4. Fetch attendance records for all students in the month ─────────────
    const placeholders = studentIds.map(() => '?').join(',');
    const attRes = await query(
      `SELECT student_id, date, status
       FROM attendance
       WHERE student_id IN (${placeholders})
         AND group_id = ?
         AND date >= ? AND date <= ?
       ORDER BY date`,
      [...studentIds, group_id, startDate, endDate]
    );

    // Build: { studentId: { 'YYYY-MM-DD': 'present'|'absent'|'late'|'freeze' } }
    const attMap = {};
    for (const row of attRes.rows) {
      if (!attMap[row.student_id]) attMap[row.student_id] = {};
      attMap[row.student_id][row.date] = row.status;
    }

    // ── 5. Fetch payments already recorded for this month ─────────────────────
    const paidRes = await query(
      `SELECT student_id, COALESCE(SUM(amount), 0) AS total_paid
       FROM payments
       WHERE student_id IN (${placeholders})
         AND month = ? AND year = ?
       GROUP BY student_id`,
      [...studentIds, m, y]
    );
    const paidMap = {};
    for (const row of paidRes.rows) {
      paidMap[row.student_id] = parseFloat(row.total_paid);
    }

    // ── 6. Run billing calculator for each student ────────────────────────────
    const billingConfig = {
      maxLessons:  12,
      minAbsences: 4,
      minFeeRatio: 0.5,
      lateWeight,
    };

    const result = students.map(student => {
      // Build ordered list of statuses for lesson dates only
      const studentAtt = attMap[student.id] || {};
      const attendanceStatuses = lessonDates.map(date => studentAtt[date] || null)
        .filter(Boolean); // only count dates where something was recorded

      // If no attendance was recorded yet, return base fee with no discount
      const billing = attendanceStatuses.length > 0
        ? calculateBilling({ monthlyFee, attendanceStatuses, config: billingConfig })
        : {
            monthlyFee,
            lessonPrice:            Math.floor(monthlyFee / 12),
            lessonsCount:           0,
            consecutiveAbsences:    0,
            maxConsecutiveAbsences: 0,
            discount:               0,
            finalFee:               monthlyFee,
            minimumPayment:         Math.round(monthlyFee * 0.5),
            discountApplied:        false,
          };

      const alreadyPaid = paidMap[student.id] || 0;
      const balanceDue  = Math.max(0, billing.finalFee - alreadyPaid);

      return {
        student,
        alreadyPaid,
        balanceDue,
        billing,
      };
    });

    res.json({
      group: {
        id:           group.id,
        name:         group.name,
        teacher_name: group.teacher_name,
        monthly_fee:  monthlyFee,
        schedule:     group.schedule,
      },
      month:       m,
      year:        y,
      lessonDates,
      config:      billingConfig,
      students:    result,
    });
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

/**
 * GET /api/payments/monthly-status?month=&year=&group_id=
 *
 * Returns every active (non-archived) student with their payment status for the
 * requested month.  The monthly_fee comes from the group override first, then
 * falls back to the course fee.
 *
 * Status logic (computed in JS after the SQL fetch):
 *   paid    — total_paid >= monthly_fee  (and monthly_fee > 0)
 *   partial — 0 < total_paid < monthly_fee
 *   unpaid  — total_paid === 0
 */
const getStudentMonthlyStatus = async (req, res) => {
  try {
    const now = new Date();
    const month    = parseInt(req.query.month) || (now.getMonth() + 1);
    const year     = parseInt(req.query.year)  || now.getFullYear();
    const group_id = req.query.group_id;

    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    const params = [month, year];
    let groupFilter = '';

    if (group_id) {
      params.push(group_id);
      groupFilter = 'AND g.id = ?';
    }

    // For teachers, restrict to their own groups
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      groupFilter += ' AND g.teacher_id = ?';
    }

    const result = await query(
      `SELECT s.id, s.name, s.phone, s.is_debtor,
         g.name AS group_name, g.id AS group_id,
         COALESCE(g.monthly_fee, c.monthly_fee, 0) AS monthly_fee,
         COALESCE(p.total_paid, 0)                 AS total_paid,
         p.last_payment
       FROM students s
       LEFT JOIN groups  g ON g.id = s.group_id
       LEFT JOIN courses c ON c.id = g.course_id
       LEFT JOIN (
         SELECT student_id,
                SUM(amount)          AS total_paid,
                MAX(payment_date)    AS last_payment
         FROM payments
         WHERE month = ? AND year = ?
         GROUP BY student_id
       ) p ON p.student_id = s.id
       WHERE s.is_active = 1
         AND s.status != 'archived'
         ${groupFilter}
       ORDER BY g.name, s.name`,
      params
    );

    // Compute payment status in JS — avoids complex CASE logic in SQL
    const data = result.rows.map(row => {
      const fee       = parseFloat(row.monthly_fee)  || 0;
      const paid      = parseFloat(row.total_paid)   || 0;
      let payStatus;

      if (paid === 0) {
        payStatus = 'unpaid';
      } else if (fee > 0 && paid >= fee) {
        payStatus = 'paid';
      } else {
        // paid > 0 but less than the required fee (or fee is 0 with any payment)
        payStatus = 'partial';
      }

      return {
        ...row,
        total_paid:   paid,
        monthly_fee:  fee,
        pay_status:   payStatus,
      };
    });

    res.json({ data, total: data.length, month, year });
  } catch (err) {
    console.error('[getStudentMonthlyStatus]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllPayments, createPayment, deletePayment, getMonthlyStats, getDebtors, getBillingForGroup, getStudentMonthlyStatus };
