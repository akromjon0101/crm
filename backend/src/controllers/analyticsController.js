const { query } = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [students, teachers, groups, monthlyIncome, debtors, frozen, archived, paymentOverdue] = await Promise.all([
      query("SELECT COUNT(*) as count FROM students WHERE status = 'active'"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'teacher' AND is_active = 1"),
      query("SELECT COUNT(*) as count FROM groups WHERE status = 'active'"),
      query(
        'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE month = ? AND year = ?',
        [currentMonth, currentYear]
      ),
      query("SELECT COUNT(*) as count FROM students WHERE is_debtor = 1 AND status = 'active'"),
      query("SELECT COUNT(*) as count FROM students WHERE status = 'frozen'"),
      query("SELECT COUNT(*) as count FROM students WHERE status = 'archived'"),
      query(
        `SELECT COUNT(*) as count FROM students s
         WHERE s.status = 'active'
           AND s.id NOT IN (
             SELECT DISTINCT p.student_id FROM payments p WHERE p.month = ? AND p.year = ?
           )`,
        [currentMonth, currentYear]
      ),
    ]);

    // Recent transfers from activity_log (if exists)
    let recentTransfers = [];
    try {
      const transfersResult = await query(
        `SELECT * FROM activity_log WHERE action = 'transfer' ORDER BY created_at DESC LIMIT 5`
      );
      recentTransfers = transfersResult.rows.map(r => ({
        ...r,
        details: r.details ? JSON.parse(r.details) : {},
      }));
    } catch (_) {}

    res.json({
      total_students: parseInt(students.rows[0].count),
      total_teachers: parseInt(teachers.rows[0].count),
      total_groups: parseInt(groups.rows[0].count),
      monthly_income: parseFloat(monthlyIncome.rows[0].total),
      debtors: parseInt(debtors.rows[0].count),
      frozen_count: parseInt(frozen.rows[0].count),
      archived_count: parseInt(archived.rows[0].count),
      payment_overdue_count: parseInt(paymentOverdue.rows[0].count),
      recent_transfers: recentTransfers,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMonthlyIncomeChart = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const result = await query(
      `SELECT month, SUM(amount) as total
       FROM payments WHERE year = ?
       GROUP BY month ORDER BY month`,
      [year]
    );

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = result.rows.find((r) => parseInt(r.month) === i + 1);
      return { month: i + 1, total: found ? parseFloat(found.total) : 0 };
    });

    res.json(months);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getStudentGrowthChart = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const result = await query(
      `SELECT CAST(strftime('%m', start_date) AS INTEGER) as month, COUNT(*) as count
       FROM students
       WHERE strftime('%Y', start_date) = ?
       GROUP BY month ORDER BY month`,
      [String(year)]
    );

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = result.rows.find((r) => parseInt(r.month) === i + 1);
      return { month: i + 1, count: found ? parseInt(found.count) : 0 };
    });

    res.json(months);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getTeacherPerformance = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.subject,
        COUNT(DISTINCT g.id) as group_count,
        COUNT(DISTINCT s.id) as student_count
       FROM users u
       LEFT JOIN groups g ON g.teacher_id = u.id AND g.status = 'active'
       LEFT JOIN students s ON s.group_id = g.id AND s.is_active = 1
       WHERE u.role = 'teacher' AND u.is_active = 1
       GROUP BY u.id, u.name, u.subject
       ORDER BY student_count DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const payments = await query(
      `SELECT 'payment' as type, p.created_at, s.name as student_name, p.amount
       FROM payments p JOIN students s ON s.id = p.student_id
       ORDER BY p.created_at DESC LIMIT 5`
    );

    const newStudents = await query(
      `SELECT 'student' as type, s.created_at, s.name as student_name, g.name as group_name
       FROM students s LEFT JOIN groups g ON g.id = s.group_id
       ORDER BY s.created_at DESC LIMIT 5`
    );

    const combined = [...payments.rows, ...newStudents.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    res.json(combined);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`;
    const monthEnd   = `${currentYear}-${String(currentMonth).padStart(2,'0')}-31`;

    const [groups, students, presentToday, absentToday] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM groups WHERE teacher_id = ? AND status = 'active'`, [teacherId]),
      query(
        `SELECT COUNT(*) as count FROM students s
         JOIN groups g ON g.id = s.group_id
         WHERE g.teacher_id = ? AND s.is_active = 1`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) as count FROM attendance a
         JOIN groups g ON g.id = a.group_id
         WHERE g.teacher_id = ? AND a.date = date('now') AND a.status = 'present'`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) as count FROM attendance a
         JOIN groups g ON g.id = a.group_id
         WHERE g.teacher_id = ? AND a.date = date('now') AND a.status = 'absent'`,
        [teacherId]
      ),
    ]);

    const myGroups = await query(
      `SELECT g.*, c.name as course_name, COUNT(s.id) as student_count
       FROM groups g
       LEFT JOIN courses c ON c.id = g.course_id
       LEFT JOIN students s ON s.group_id = g.id AND s.is_active = 1
       WHERE g.teacher_id = ? AND g.status = 'active'
       GROUP BY g.id`,
      [teacherId]
    );

    // ── Lesson-based earnings (new per-lesson system) ─────────────────────────
    let todayEarnings = 0, monthEarnings = 0, totalEarnings = 0;
    let lessonsToday = 0, lessonsThisMonth = 0, lessonsRemaining = 0;
    let todayLessons = [];

    try {
      const [todayInc, monthInc, totalInc, todayLessonCount, monthLessonCount, remainingCount, todayLessonList] = await Promise.all([
        query(
          `SELECT COALESCE(SUM(price_earned),0) as v FROM lesson_students
           WHERE teacher_id=? AND date=? AND status='attended'`,
          [teacherId, todayStr]
        ),
        query(
          `SELECT COALESCE(SUM(price_earned),0) as v FROM lesson_students
           WHERE teacher_id=? AND date>=? AND date<=? AND status='attended'`,
          [teacherId, monthStart, monthEnd]
        ),
        query(
          `SELECT COALESCE(SUM(price_earned),0) as v FROM lesson_students
           WHERE teacher_id=? AND status='attended'`,
          [teacherId]
        ),
        query(
          `SELECT COUNT(DISTINCT lesson_id) as v FROM lesson_students WHERE teacher_id=? AND date=?`,
          [teacherId, todayStr]
        ),
        query(
          `SELECT COUNT(DISTINCT lesson_id) as v FROM lesson_students
           WHERE teacher_id=? AND date>=? AND date<=?`,
          [teacherId, monthStart, monthEnd]
        ),
        query(
          `SELECT COUNT(*) as v FROM lessons WHERE teacher_id=? AND date>=? AND date<=? AND status='scheduled'`,
          [teacherId, todayStr, monthEnd]
        ),
        query(
          `SELECT l.id, l.date, l.status, l.price_per_student, g.name as group_name,
                  (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id=l.id AND ls.status='attended') as attended,
                  (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id=l.id) as total_marked
           FROM lessons l JOIN groups g ON g.id=l.group_id
           WHERE l.teacher_id=? AND l.date=?
           ORDER BY l.id`,
          [teacherId, todayStr]
        ),
      ]);

      todayEarnings    = parseFloat(todayInc.rows[0].v);
      monthEarnings    = parseFloat(monthInc.rows[0].v);
      totalEarnings    = parseFloat(totalInc.rows[0].v);
      lessonsToday     = parseInt(todayLessonCount.rows[0].v);
      lessonsThisMonth = parseInt(monthLessonCount.rows[0].v);
      lessonsRemaining = parseInt(remainingCount.rows[0].v);
      todayLessons     = todayLessonList.rows;
    } catch (_) {
      // lesson_students table not yet created — fallback to zero
    }

    // ── Old salary system (fallback / secondary display) ──────────────────────
    const salaryRes = await query(`SELECT salary_per_student FROM users WHERE id = ?`, [teacherId]);
    const salaryPerStudent = salaryRes.rows[0]?.salary_per_student ?? null;
    const myStudentCount = parseInt(students.rows[0].count);
    const totalSalary = salaryPerStudent != null ? salaryPerStudent * myStudentCount : null;

    res.json({
      my_groups:         parseInt(groups.rows[0].count),
      my_students:       myStudentCount,
      present_today:     parseInt(presentToday.rows[0].count),
      absent_today:      parseInt(absentToday.rows[0].count),
      groups:            myGroups.rows,
      // Lesson-based earnings (primary)
      today_earnings:    todayEarnings,
      month_earnings:    monthEarnings,
      total_earnings:    totalEarnings,
      lessons_today:     lessonsToday,
      lessons_this_month: lessonsThisMonth,
      lessons_remaining: lessonsRemaining,
      today_lessons:     todayLessons,
      // Old salary system (secondary)
      salary_per_student: salaryPerStudent,
      total_salary:       totalSalary,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Financial Summary for CEO ─────────────────────────────────────────────────
const getFinancialSummary = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();

    // Previous period
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;

    // Date range helpers
    const pad = (n) => String(n).padStart(2, '0');
    const monthStart = `${year}-${pad(month)}-01`;
    const lastDay    = new Date(year, month, 0).getDate();
    const monthEnd   = `${year}-${pad(month)}-${lastDay}`;
    const prevStart  = `${prevYear}-${pad(prevMonth)}-01`;
    const prevLastDay= new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd    = `${prevYear}-${pad(prevMonth)}-${prevLastDay}`;

    // ── Income (payments from students) ─────────────────────────────────────
    const [
      incomeTotal,
      incomeByGroup,
      incomeByDay,
      paidStudentsCount,
      activeStudentsCount,
      incomeByPaymentType,
      prevIncomeTotal,
    ] = await Promise.all([
      // Total income this month
      query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE month=? AND year=?',
        [month, year]),

      // Income breakdown per group
      query(`
        SELECT g.id as group_id, g.name as group_name,
               u.name as teacher_name, u.id as teacher_id,
               COALESCE(g.monthly_fee, c.monthly_fee, 0) as monthly_fee,
               COUNT(DISTINCT s.id) as student_count,
               COALESCE(SUM(p.amount), 0) as total_income,
               COUNT(DISTINCT p.student_id) as paid_count
        FROM groups g
        LEFT JOIN users u   ON u.id  = g.teacher_id
        LEFT JOIN courses c ON c.id  = g.course_id
        LEFT JOIN students s ON s.group_id = g.id AND s.status = 'active'
        LEFT JOIN payments p ON p.student_id = s.id AND p.month = ? AND p.year = ?
        WHERE g.status = 'active'
        GROUP BY g.id, g.name, u.name, u.id, g.monthly_fee, c.monthly_fee
        ORDER BY total_income DESC
      `, [month, year]),

      // Daily income breakdown
      query(`
        SELECT payment_date as date,
               SUM(amount) as total,
               COUNT(*) as count,
               COUNT(DISTINCT student_id) as students
        FROM payments WHERE month=? AND year=?
        GROUP BY payment_date ORDER BY payment_date
      `, [month, year]),

      // Count distinct students who paid
      query('SELECT COUNT(DISTINCT student_id) as count FROM payments WHERE month=? AND year=?',
        [month, year]),

      // All active students
      query("SELECT COUNT(*) as count FROM students WHERE status='active'"),

      // Income by payment type
      query(`
        SELECT payment_type, SUM(amount) as total, COUNT(*) as count
        FROM payments WHERE month=? AND year=?
        GROUP BY payment_type
      `, [month, year]),

      // Previous month income
      query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE month=? AND year=?',
        [prevMonth, prevYear]),
    ]);

    // ── Expenses (teacher earnings from lessons) ─────────────────────────────
    const [
      expensesByTeacher,
      expensesTotal,
      prevExpensesTotal,
      salaryRecords,
    ] = await Promise.all([
      // Per-teacher lesson earnings this month
      query(`
        SELECT u.id as teacher_id, u.name as teacher_name, u.subject,
               COALESCE(SUM(CASE WHEN ls.status='attended' THEN ls.price_earned ELSE 0 END), 0) as earned,
               COUNT(DISTINCT ls.lesson_id) as lessons_count,
               COUNT(DISTINCT ls.student_id) as students_taught,
               COUNT(CASE WHEN ls.status='attended' THEN 1 END) as attended_slots,
               COUNT(CASE WHEN ls.status='missed'   THEN 1 END) as missed_slots
        FROM users u
        LEFT JOIN lesson_students ls
          ON ls.teacher_id = u.id AND ls.date >= ? AND ls.date <= ?
        WHERE u.role = 'teacher' AND u.is_active = 1
        GROUP BY u.id, u.name, u.subject
        ORDER BY earned DESC
      `, [monthStart, monthEnd]),

      // Total teacher expenses this month
      query(`
        SELECT COALESCE(SUM(ls.price_earned),0) as total
        FROM lesson_students ls
        WHERE ls.date >= ? AND ls.date <= ? AND ls.status = 'attended'
      `, [monthStart, monthEnd]),

      // Previous month teacher expenses
      query(`
        SELECT COALESCE(SUM(ls.price_earned),0) as total
        FROM lesson_students ls
        WHERE ls.date >= ? AND ls.date <= ? AND ls.status = 'attended'
      `, [prevStart, prevEnd]),

      // Finalized salary records if any exist
      query(`
        SELECT ts.teacher_id, ts.final_salary, ts.status, ts.method,
               u.name as teacher_name
        FROM teacher_salaries ts
        JOIN users u ON u.id = ts.teacher_id
        WHERE ts.month=? AND ts.year=?
        ORDER BY ts.final_salary DESC
      `, [month, year]),
    ]);

    // ── Compute summary numbers ──────────────────────────────────────────────
    const revenue      = parseFloat(incomeTotal.rows[0].total)   || 0;
    const prevRevenue  = parseFloat(prevIncomeTotal.rows[0].total) || 0;

    // Use finalized salary records if available, else lesson-based earnings
    let expenses = 0;
    let expenseSource = 'lesson_based';
    if (salaryRecords.rows.length > 0) {
      expenses      = salaryRecords.rows.reduce((s, r) => s + (parseFloat(r.final_salary) || 0), 0);
      expenseSource = 'salary_records';
    } else {
      expenses = parseFloat(expensesTotal.rows[0].total) || 0;
    }
    const prevExpenses = parseFloat(prevExpensesTotal.rows[0].total) || 0;

    const netProfit     = revenue - expenses;
    const prevNetProfit = prevRevenue - prevExpenses;
    const profitMargin  = revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0;
    const payrollRatio  = revenue > 0 ? +((expenses / revenue) * 100).toFixed(1) : 0;

    const revenueGrowth = prevRevenue > 0
      ? +((( revenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null;
    const profitGrowth  = prevNetProfit > 0
      ? +((( netProfit - prevNetProfit) / prevNetProfit) * 100).toFixed(1) : null;

    const totalStudents = parseInt(activeStudentsCount.rows[0].count) || 0;
    const paidStudents  = parseInt(paidStudentsCount.rows[0].count)   || 0;
    const unpaidStudents= totalStudents - paidStudents;
    const collectionRate= totalStudents > 0 ? +((paidStudents / totalStudents) * 100).toFixed(1) : 0;

    // Enrich expense-by-teacher with salary records if available
    const salaryMap = {};
    salaryRecords.rows.forEach(r => { salaryMap[r.teacher_id] = r; });

    const teacherExpenses = expensesByTeacher.rows.map(t => {
      const sal = salaryMap[t.teacher_id];
      return {
        teacher_id:     t.teacher_id,
        teacher_name:   t.teacher_name,
        subject:        t.subject,
        earned:         parseFloat(t.earned) || 0,
        final_salary:   sal ? parseFloat(sal.final_salary) || 0 : null,
        salary_status:  sal?.status || null,
        salary_method:  sal?.method || null,
        lessons_count:  parseInt(t.lessons_count)  || 0,
        students_taught:parseInt(t.students_taught) || 0,
        attended_slots: parseInt(t.attended_slots) || 0,
        missed_slots:   parseInt(t.missed_slots)   || 0,
      };
    });

    res.json({
      period: { month, year, prev_month: prevMonth, prev_year: prevYear },
      income: {
        total:          revenue,
        prev_total:     prevRevenue,
        growth:         revenueGrowth,
        paid_students:  paidStudents,
        unpaid_students:unpaidStudents,
        total_students: totalStudents,
        collection_rate:collectionRate,
        by_group:       incomeByGroup.rows.map(r => ({
          ...r,
          total_income:  parseFloat(r.total_income)  || 0,
          monthly_fee:   parseFloat(r.monthly_fee)   || 0,
          student_count: parseInt(r.student_count)   || 0,
          paid_count:    parseInt(r.paid_count)       || 0,
        })),
        by_day:         incomeByDay.rows.map(r => ({
          ...r,
          total: parseFloat(r.total) || 0,
          count: parseInt(r.count)   || 0,
        })),
        by_type:        incomeByPaymentType.rows.map(r => ({
          ...r,
          total: parseFloat(r.total) || 0,
        })),
      },
      expenses: {
        total:        expenses,
        prev_total:   prevExpenses,
        source:       expenseSource,
        by_teacher:   teacherExpenses,
      },
      summary: {
        net_profit:     netProfit,
        prev_net_profit:prevNetProfit,
        profit_growth:  profitGrowth,
        profit_margin:  profitMargin,
        payroll_ratio:  payrollRatio,
      },
    });
  } catch (err) {
    console.error('Financial summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats,
  getMonthlyIncomeChart,
  getStudentGrowthChart,
  getTeacherPerformance,
  getRecentActivity,
  getTeacherDashboard,
  getFinancialSummary,
};
