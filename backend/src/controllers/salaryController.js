const { query } = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Left-pad a number to 2 digits so strftime comparisons work correctly.
 * SQLite strftime('%m', date) returns '01'..'12', so we must pass '01' not '1'.
 */
const pad2 = n => String(n).padStart(2, '0');

// ── GET /api/salary/rules ──────────────────────────────────────────────────────
/**
 * Returns all active teachers with their salary rule.
 * If no rule has been created for a teacher yet, COALESCE supplies the defaults
 * so the frontend always gets a complete object.
 */
const getSalaryRules = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.subject,
         COALESCE(r.method,'percentage')   AS method,
         COALESCE(r.percentage,30)         AS percentage,
         COALESCE(r.fixed_amount,0)        AS fixed_amount,
         COALESCE(r.rate_per_lesson,50000) AS rate_per_lesson,
         COALESCE(r.base_amount,0)         AS base_amount,
         COALESCE(r.bonus_percentage,0)    AS bonus_percentage,
         r.id                              AS rule_id
       FROM users u
       LEFT JOIN salary_rules r ON r.teacher_id = u.id
       WHERE u.role IN ('teacher','admin','superadmin') AND u.is_active = 1
       ORDER BY u.name`,
      []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[getSalaryRules]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/salary/rules ─────────────────────────────────────────────────────
/**
 * Create or update the salary rule for a teacher.
 * Uses a check-then-INSERT/UPDATE approach because INSERT OR REPLACE would
 * reset the auto-increment id and created_at on every update.
 */
const upsertSalaryRule = async (req, res) => {
  try {
    const {
      teacher_id,
      method = 'percentage',
      percentage = 30,
      fixed_amount = 0,
      rate_per_lesson = 50000,
      base_amount = 0,
      bonus_percentage = 0,
    } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ message: 'teacher_id is required' });
    }

    const validMethods = ['percentage', 'fixed', 'per_lesson', 'combined'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: `method must be one of: ${validMethods.join(', ')}` });
    }

    // Validate numeric fields — reject negatives and non-finite values
    const pct = parseFloat(percentage);
    const fa  = parseFloat(fixed_amount);
    const rpl = parseFloat(rate_per_lesson);
    const ba  = parseFloat(base_amount);
    const bp  = parseFloat(bonus_percentage);

    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: 'percentage must be between 0 and 100' });
    }
    if (!Number.isFinite(fa) || fa < 0) {
      return res.status(400).json({ message: 'fixed_amount must be a non-negative number' });
    }
    if (!Number.isFinite(rpl) || rpl < 0) {
      return res.status(400).json({ message: 'rate_per_lesson must be a non-negative number' });
    }
    if (!Number.isFinite(ba) || ba < 0) {
      return res.status(400).json({ message: 'base_amount must be a non-negative number' });
    }
    if (!Number.isFinite(bp) || bp < 0 || bp > 100) {
      return res.status(400).json({ message: 'bonus_percentage must be between 0 and 100' });
    }

    // Check if a rule already exists for this teacher
    const existing = await query(
      'SELECT id FROM salary_rules WHERE teacher_id = ?',
      [teacher_id]
    );

    let result;
    if (existing.rows[0]) {
      result = await query(
        `UPDATE salary_rules
         SET method=?, percentage=?, fixed_amount=?, rate_per_lesson=?,
             base_amount=?, bonus_percentage=?, updated_at=datetime('now')
         WHERE teacher_id=?
         RETURNING *`,
        [method, pct, fa, rpl, ba, bp, teacher_id]
      );
    } else {
      result = await query(
        `INSERT INTO salary_rules
           (teacher_id, method, percentage, fixed_amount, rate_per_lesson, base_amount, bonus_percentage)
         VALUES (?,?,?,?,?,?,?)
         RETURNING *`,
        [teacher_id, method, pct, fa, rpl, ba, bp]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[upsertSalaryRule]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/salary/calculate ─────────────────────────────────────────────────
/**
 * Calculate and persist salary records for every active teacher for the given
 * month + year.  Existing records are replaced (INSERT OR REPLACE triggers the
 * UNIQUE(teacher_id, month, year) conflict resolution in SQLite).
 *
 * After INSERT OR REPLACE we do a follow-up SELECT because INSERT OR REPLACE
 * is not detected as RETURNING-bearing by the query() helper.
 */
const calculateSalary = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const m = parseInt(month);
    const y = parseInt(year);
    if (m < 1 || m > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });

    // SQLite strftime returns zero-padded strings like '03', '2025'
    const monthStr = pad2(m);
    const yearStr  = String(y);

    // 1. Fetch all active teachers
    const teachersResult = await query(
      `SELECT u.id, u.name,
         COALESCE(r.method,'percentage')   AS method,
         COALESCE(r.percentage,30)         AS percentage,
         COALESCE(r.fixed_amount,0)        AS fixed_amount,
         COALESCE(r.rate_per_lesson,50000) AS rate_per_lesson,
         COALESCE(r.base_amount,0)         AS base_amount,
         COALESCE(r.bonus_percentage,0)    AS bonus_percentage
       FROM users u
       LEFT JOIN salary_rules r ON r.teacher_id = u.id
       WHERE u.role IN ('teacher','admin','superadmin') AND u.is_active = 1`,
      []
    );

    const teachers = teachersResult.rows;
    if (!teachers.length) {
      return res.json({ data: [], total: 0 });
    }

    const calculated = [];

    for (const teacher of teachers) {
      // 2. Count distinct lessons conducted by this teacher this month
      //    (uses lesson_students — the primary attendance/earnings source)
      const lessonsResult = await query(
        `SELECT COUNT(DISTINCT lesson_id) AS lessons_count
         FROM lesson_students
         WHERE teacher_id = ?
           AND strftime('%m', date) = ?
           AND strftime('%Y', date) = ?`,
        [teacher.id, monthStr, yearStr]
      );
      const lessonsCount = parseInt(lessonsResult.rows[0].lessons_count) || 0;

      // 3. Sum price_earned from lesson_students — accurate even after student transfers,
      //    because price_earned is snapshotted per-lesson at conduct time.
      const paymentsResult = await query(
        `SELECT COALESCE(SUM(price_earned), 0) AS total_paid
         FROM lesson_students
         WHERE teacher_id = ?
           AND strftime('%m', date) = ?
           AND strftime('%Y', date) = ?
           AND status = 'attended'`,
        [teacher.id, monthStr, yearStr]
      );
      const totalPaid = parseFloat(paymentsResult.rows[0].total_paid) || 0;

      // 4. Calculate gross salary based on the configured method
      let baseSalary = 0;
      switch (teacher.method) {
        case 'percentage':
          // Teacher earns a percentage of what their students paid
          baseSalary = totalPaid * teacher.percentage / 100;
          break;
        case 'fixed':
          // Flat monthly amount regardless of lessons or payments
          baseSalary = parseFloat(teacher.fixed_amount);
          break;
        case 'per_lesson':
          // Fixed rate multiplied by the number of lessons delivered
          baseSalary = lessonsCount * parseFloat(teacher.rate_per_lesson);
          break;
        case 'combined':
          // Fixed base plus a bonus percentage of student payments
          baseSalary = parseFloat(teacher.base_amount)
                     + (totalPaid * teacher.bonus_percentage / 100);
          break;
        default:
          baseSalary = 0;
      }

      // 5. Sum approved advances that should be deducted this month
      const advanceResult = await query(
        `SELECT COALESCE(SUM(amount), 0) AS advance_total
         FROM teacher_advances
         WHERE teacher_id = ?
           AND status = 'approved'
           AND deduct_from_month = ?
           AND deduct_from_year  = ?`,
        [teacher.id, m, y]
      );
      const advancePaid = parseFloat(advanceResult.rows[0].advance_total) || 0;

      // 6. Final salary = gross - advance deductions (floor at 0)
      const finalSalary = Math.max(0, baseSalary - advancePaid);

      // 7. Persist — INSERT OR REPLACE handles the UNIQUE(teacher_id, month, year)
      //    constraint.  We pass 0 for bonus_amount and deductions; those can be
      //    adjusted manually via PUT /records/:id after calculation.
      await query(
        `INSERT OR REPLACE INTO teacher_salaries
           (teacher_id, month, year, method,
            base_amount, bonus_amount, deductions, advance_paid, final_salary,
            lessons_count, students_total_paid,
            status, calculated_by, updated_at)
         VALUES (?,?,?,?,?,0,0,?,?,?,?,'pending',?,datetime('now'))`,
        [
          teacher.id, m, y, teacher.method,
          baseSalary, advancePaid, finalSalary,
          lessonsCount, totalPaid,
          req.user.id,
        ]
      );

      // Fetch the persisted row to return consistent data
      const savedResult = await query(
        `SELECT ts.*, u.name AS teacher_name
         FROM teacher_salaries ts
         JOIN users u ON u.id = ts.teacher_id
         WHERE ts.teacher_id = ? AND ts.month = ? AND ts.year = ?`,
        [teacher.id, m, y]
      );

      if (savedResult.rows[0]) {
        calculated.push(savedResult.rows[0]);
      }
    }

    res.json({ data: calculated, total: calculated.length });
  } catch (err) {
    console.error('[calculateSalary]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/salary/records ────────────────────────────────────────────────────
/**
 * List salary records, optionally filtered by month, year, or teacher_id.
 */
const getSalaryRecords = async (req, res) => {
  try {
    const { month, year, teacher_id } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (month)      { params.push(parseInt(month));  conditions += ' AND ts.month = ?'; }
    if (year)       { params.push(parseInt(year));   conditions += ' AND ts.year = ?'; }
    if (teacher_id) { params.push(teacher_id);       conditions += ' AND ts.teacher_id = ?'; }

    // Teachers can only see their own records
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      conditions += ' AND ts.teacher_id = ?';
    }

    const countResult = await query(
      `SELECT COUNT(*) AS count FROM teacher_salaries ts ${conditions}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT ts.*,
         u.name  AS teacher_name,
         u.email AS teacher_email,
         cb.name AS calculated_by_name
       FROM teacher_salaries ts
       JOIN users u  ON u.id  = ts.teacher_id
       LEFT JOIN users cb ON cb.id = ts.calculated_by
       ${conditions}
       ORDER BY ts.year DESC, ts.month DESC, u.name ASC`,
      params
    );

    res.json({ data: result.rows, total });
  } catch (err) {
    console.error('[getSalaryRecords]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/salary/records/:id ────────────────────────────────────────────────
const getSalaryRecord = async (req, res) => {
  try {
    const result = await query(
      `SELECT ts.*,
         u.name  AS teacher_name,
         u.email AS teacher_email,
         u.phone AS teacher_phone,
         cb.name AS calculated_by_name
       FROM teacher_salaries ts
       JOIN users u  ON u.id  = ts.teacher_id
       LEFT JOIN users cb ON cb.id = ts.calculated_by
       WHERE ts.id = ?`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Salary record not found' });

    // Teachers may only view their own record
    if (req.user.role === 'teacher' && result.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[getSalaryRecord]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /api/salary/records/:id ────────────────────────────────────────────────
/**
 * Manually update a salary record — mark as paid, adjust bonus/deductions,
 * add a note, or override final_salary.
 */
const updateSalaryRecord = async (req, res) => {
  try {
    const { status, paid_date, note, deductions, bonus_amount, final_salary } = req.body;

    // Fetch existing record first to validate it exists
    const existing = await query(
      'SELECT * FROM teacher_salaries WHERE id = ?',
      [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ message: 'Salary record not found' });

    const current = existing.rows[0];

    // Build updated values, falling back to current values for omitted fields
    const newStatus      = status       !== undefined ? status       : current.status;
    const newPaidDate    = paid_date    !== undefined ? paid_date    : current.paid_date;
    const newNote        = note         !== undefined ? note         : current.note;
    const newDeductions  = deductions   !== undefined ? parseFloat(deductions)   : current.deductions;
    const newBonus       = bonus_amount !== undefined ? parseFloat(bonus_amount) : current.bonus_amount;
    // Allow explicit final_salary override; otherwise recompute from base - advance - deductions + bonus
    const newFinal = final_salary !== undefined
      ? parseFloat(final_salary)
      : Math.max(0, current.base_amount + newBonus - current.advance_paid - newDeductions);

    const result = await query(
      `UPDATE teacher_salaries
       SET status=?, paid_date=?, note=?, deductions=?, bonus_amount=?, final_salary=?,
           updated_at=datetime('now')
       WHERE id=?
       RETURNING *`,
      [newStatus, newPaidDate || null, newNote || null, newDeductions, newBonus, newFinal, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[updateSalaryRecord]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/salary/records/:id ────────────────────────────────────────────
const deleteSalaryRecord = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM teacher_salaries WHERE id = ? RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Salary record not found' });
    res.json({ message: 'Salary record deleted' });
  } catch (err) {
    console.error('[deleteSalaryRecord]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/salary/advances ───────────────────────────────────────────────────
/**
 * List advance requests.  Admin/superadmin see all; teacher sees only their own.
 */
const getAdvances = async (req, res) => {
  try {
    const { teacher_id, status } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (teacher_id) { params.push(teacher_id); conditions += ' AND a.teacher_id = ?'; }
    if (status)     { params.push(status);     conditions += ' AND a.status = ?'; }

    // Teachers can only see their own advance requests
    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      conditions += ' AND a.teacher_id = ?';
    }

    const result = await query(
      `SELECT a.*,
         u.name  AS teacher_name,
         ab.name AS approved_by_name
       FROM teacher_advances a
       JOIN users u  ON u.id  = a.teacher_id
       LEFT JOIN users ab ON ab.id = a.approved_by
       ${conditions}
       ORDER BY a.created_at DESC`,
      params
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[getAdvances]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/salary/advances ─────────────────────────────────────────────────
/**
 * Create a new advance request.  Any authenticated user can request an advance
 * for themselves; admins can create on behalf of any teacher.
 */
const createAdvance = async (req, res) => {
  try {
    const { teacher_id, amount, reason, deduct_from_month, deduct_from_year } = req.body;

    if (!teacher_id || !amount) {
      return res.status(400).json({ message: 'teacher_id and amount are required' });
    }
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be greater than 0' });
    }

    // Non-admin users may only create advances for themselves
    if (req.user.role === 'teacher' && parseInt(teacher_id) !== req.user.id) {
      return res.status(403).json({ message: 'You can only request advances for yourself' });
    }

    const result = await query(
      `INSERT INTO teacher_advances
         (teacher_id, amount, reason, deduct_from_month, deduct_from_year)
       VALUES (?,?,?,?,?)
       RETURNING *`,
      [
        teacher_id,
        parseFloat(amount),
        reason || null,
        deduct_from_month ? parseInt(deduct_from_month) : null,
        deduct_from_year  ? parseInt(deduct_from_year)  : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[createAdvance]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /api/salary/advances/:id ──────────────────────────────────────────────
/**
 * Approve or reject an advance request.  Sets approved_by to the current user.
 */
const updateAdvance = async (req, res) => {
  try {
    const { status, approved_date } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await query(
      'SELECT id FROM teacher_advances WHERE id = ?',
      [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ message: 'Advance not found' });

    const result = await query(
      `UPDATE teacher_advances
       SET status=?, approved_by=?, approved_date=?
       WHERE id=?
       RETURNING *`,
      [
        status,
        req.user.id,
        approved_date || new Date().toISOString().split('T')[0],
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[updateAdvance]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSalaryRules,
  upsertSalaryRule,
  calculateSalary,
  getSalaryRecords,
  getSalaryRecord,
  updateSalaryRecord,
  deleteSalaryRecord,
  getAdvances,
  createAdvance,
  updateAdvance,
};
