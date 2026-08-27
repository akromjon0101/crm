/**
 * earningsController.js
 *
 * All earnings are derived LIVE from lesson_students.price_earned
 * filtered by teacher_id + date range. No stale cache — single source of truth.
 *
 * Key invariant: lesson_students.teacher_id = teacher who was running the group
 * at the time the lesson was conducted. Student transfers don't change past records.
 */

const { query } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const padMonth = m => String(m).padStart(2, '0');

const getMonthRange = (month, year) => ({
  start: `${year}-${padMonth(month)}-01`,
  end:   `${year}-${padMonth(month)}-31`,
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /earnings/my  (teacher — own earnings only)
// Returns: todayIncome, monthIncome, totalIncome, lesson counts, daily chart
// Query: ?month=&year=
// ─────────────────────────────────────────────────────────────────────────────
const getMyEarnings = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month || now.getMonth() + 1);
    const year  = parseInt(req.query.year  || now.getFullYear());
    const todayStr = now.toISOString().split('T')[0];
    const teacherId = req.user.id;
    const { start, end } = getMonthRange(month, year);

    const [todayResult, monthResult, totalResult,
           todayLessons, monthLessons, remainingResult] = await Promise.all([

      // Today's income
      query(
        `SELECT COALESCE(SUM(price_earned), 0) as income,
                COUNT(*) as lesson_student_count
         FROM lesson_students
         WHERE teacher_id = ? AND date = ? AND status = 'attended'`,
        [teacherId, todayStr]
      ),

      // This month income + lesson counts
      query(
        `SELECT COALESCE(SUM(ls.price_earned), 0) as income,
                COUNT(DISTINCT ls.lesson_id) as lessons_conducted,
                COUNT(CASE WHEN ls.status = 'attended' THEN 1 END) as attended_slots,
                COUNT(CASE WHEN ls.status = 'missed'   THEN 1 END) as missed_slots
         FROM lesson_students ls
         WHERE ls.teacher_id = ? AND ls.date >= ? AND ls.date <= ?`,
        [teacherId, start, end]
      ),

      // Cumulative total
      query(
        `SELECT COALESCE(SUM(price_earned), 0) as income
         FROM lesson_students WHERE teacher_id = ? AND status = 'attended'`,
        [teacherId]
      ),

      // Lessons conducted today (distinct lessons)
      query(
        `SELECT COUNT(DISTINCT lesson_id) as count
         FROM lesson_students WHERE teacher_id = ? AND date = ?`,
        [teacherId, todayStr]
      ),

      // Lessons conducted this month
      query(
        `SELECT COUNT(DISTINCT lesson_id) as count
         FROM lesson_students WHERE teacher_id = ? AND date >= ? AND date <= ?`,
        [teacherId, start, end]
      ),

      // Remaining scheduled lessons this month (status=scheduled, date >= today)
      query(
        `SELECT COUNT(*) as count FROM lessons
         WHERE teacher_id = ? AND date >= ? AND date <= ? AND status = 'scheduled'`,
        [teacherId, todayStr, end]
      ),
    ]);

    // Daily breakdown for chart (all days of the month)
    const dailyResult = await query(
      `SELECT date, SUM(price_earned) as income, COUNT(DISTINCT lesson_id) as lessons
       FROM lesson_students
       WHERE teacher_id = ? AND date >= ? AND date <= ? AND status = 'attended'
       GROUP BY date ORDER BY date`,
      [teacherId, start, end]
    );

    // Build full month array (fill zeros for days without lessons)
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyMap = {};
    for (const row of dailyResult.rows) dailyMap[row.date] = row;

    const dailyChart = Array.from({ length: daysInMonth }, (_, i) => {
      const d = `${year}-${padMonth(month)}-${String(i + 1).padStart(2, '0')}`;
      const row = dailyMap[d];
      return {
        date: d,
        day: i + 1,
        income: row ? parseFloat(row.income) : 0,
        lessons: row ? parseInt(row.lessons) : 0,
      };
    });

    // Top earning days (highlight)
    const topDays = [...dailyChart]
      .filter(d => d.income > 0)
      .sort((a, b) => b.income - a.income)
      .slice(0, 3)
      .map(d => d.date);

    // Monthly target (from salary rules or default)
    const salaryRule = await query(
      `SELECT fixed_amount FROM salary_rules WHERE teacher_id = ? LIMIT 1`,
      [teacherId]
    );
    const monthlyTarget = salaryRule.rows[0]?.fixed_amount || null;

    res.json({
      period: { month, year },
      today_income:      parseFloat(todayResult.rows[0].income),
      month_income:      parseFloat(monthResult.rows[0].income),
      total_income:      parseFloat(totalResult.rows[0].income),
      lessons_today:     parseInt(todayLessons.rows[0].count),
      lessons_this_month: parseInt(monthLessons.rows[0].count),
      lessons_remaining: parseInt(remainingResult.rows[0].count),
      attended_slots:    parseInt(monthResult.rows[0].attended_slots),
      missed_slots:      parseInt(monthResult.rows[0].missed_slots),
      monthly_target:    monthlyTarget,
      target_progress:   monthlyTarget ? Math.min(100, Math.round((parseFloat(monthResult.rows[0].income) / monthlyTarget) * 100)) : null,
      daily_chart:       dailyChart,
      top_earning_days:  topDays,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /earnings/teacher/:id  (admin — any teacher's earnings)
// Same structure as getMyEarnings but for any teacherId.
// ─────────────────────────────────────────────────────────────────────────────
const getTeacherEarnings = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month || now.getMonth() + 1);
    const year  = parseInt(req.query.year  || now.getFullYear());
    const todayStr = now.toISOString().split('T')[0];
    const teacherId = parseInt(req.params.id);
    const { start, end } = getMonthRange(month, year);

    const teacher = await query(
      'SELECT id, name, email, subject FROM users WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );
    if (!teacher.rows[0]) return res.status(404).json({ message: 'Teacher not found' });

    const [todayResult, monthResult, totalResult, remainingResult, dailyResult, groupBreakdown] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(price_earned), 0) as income FROM lesson_students
         WHERE teacher_id = ? AND date = ? AND status = 'attended'`,
        [teacherId, todayStr]
      ),
      query(
        `SELECT COALESCE(SUM(ls.price_earned), 0) as income,
                COUNT(DISTINCT ls.lesson_id) as lessons_conducted,
                COUNT(CASE WHEN ls.status = 'attended' THEN 1 END) as attended_slots,
                COUNT(CASE WHEN ls.status = 'missed'   THEN 1 END) as missed_slots
         FROM lesson_students ls
         WHERE ls.teacher_id = ? AND ls.date >= ? AND ls.date <= ?`,
        [teacherId, start, end]
      ),
      query(
        `SELECT COALESCE(SUM(price_earned), 0) as income
         FROM lesson_students WHERE teacher_id = ? AND status = 'attended'`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) as count FROM lessons
         WHERE teacher_id = ? AND date >= ? AND date <= ? AND status = 'scheduled'`,
        [teacherId, todayStr, end]
      ),
      query(
        `SELECT date, SUM(price_earned) as income
         FROM lesson_students WHERE teacher_id = ? AND date >= ? AND date <= ? AND status = 'attended'
         GROUP BY date ORDER BY date`,
        [teacherId, start, end]
      ),
      // Per-group breakdown for the month
      query(
        `SELECT g.id, g.name as group_name, c.name as course_name,
                COUNT(DISTINCT ls.lesson_id) as lessons,
                SUM(ls.price_earned) as income,
                COUNT(CASE WHEN ls.status = 'attended' THEN 1 END) as attended
         FROM lesson_students ls
         JOIN groups g  ON g.id = ls.group_id
         LEFT JOIN courses c ON c.id = g.course_id
         WHERE ls.teacher_id = ? AND ls.date >= ? AND ls.date <= ?
         GROUP BY g.id, g.name, c.name`,
        [teacherId, start, end]
      ),
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyMap = {};
    for (const row of dailyResult.rows) dailyMap[row.date] = row;
    const dailyChart = Array.from({ length: daysInMonth }, (_, i) => {
      const d = `${year}-${padMonth(month)}-${String(i + 1).padStart(2, '0')}`;
      const row = dailyMap[d];
      return { date: d, day: i + 1, income: row ? parseFloat(row.income) : 0 };
    });

    res.json({
      teacher: teacher.rows[0],
      period: { month, year },
      today_income:       parseFloat(todayResult.rows[0].income),
      month_income:       parseFloat(monthResult.rows[0].income),
      total_income:       parseFloat(totalResult.rows[0].income),
      lessons_this_month: parseInt(monthResult.rows[0].lessons_conducted),
      lessons_remaining:  parseInt(remainingResult.rows[0].count),
      attended_slots:     parseInt(monthResult.rows[0].attended_slots),
      missed_slots:       parseInt(monthResult.rows[0].missed_slots),
      group_breakdown:    groupBreakdown.rows,
      daily_chart:        dailyChart,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /earnings/overview  (admin — all teachers summary for a month)
// ─────────────────────────────────────────────────────────────────────────────
const getEarningsOverview = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month || now.getMonth() + 1);
    const year  = parseInt(req.query.year  || now.getFullYear());
    const { start, end } = getMonthRange(month, year);

    // All teachers with their month earnings + student count
    const teachers = await query(
      `SELECT u.id, u.name, u.email, u.subject,
              COALESCE(SUM(CASE WHEN ls.status='attended' THEN ls.price_earned ELSE 0 END), 0) as month_income,
              COUNT(DISTINCT ls.lesson_id) as lessons_conducted,
              COUNT(DISTINCT ls.student_id) as students_taught,
              COUNT(DISTINCT g.id) as active_groups
       FROM users u
       LEFT JOIN lesson_students ls ON ls.teacher_id = u.id AND ls.date >= ? AND ls.date <= ?
       LEFT JOIN groups g ON g.teacher_id = u.id AND g.status = 'active'
       WHERE u.role = 'teacher' AND u.is_active = 1
       GROUP BY u.id, u.name, u.email, u.subject
       ORDER BY month_income DESC`,
      [start, end]
    );

    const totalIncome = teachers.rows.reduce((s, t) => s + parseFloat(t.month_income), 0);

    res.json({
      period: { month, year },
      total_income: totalIncome,
      teachers: teachers.rows.map(t => ({
        ...t,
        month_income: parseFloat(t.month_income),
        income_share: totalIncome > 0 ? Math.round((parseFloat(t.month_income) / totalIncome) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /earnings/history  (teacher — paginated lesson history with earnings)
// ─────────────────────────────────────────────────────────────────────────────
const getEarningsHistory = async (req, res) => {
  try {
    const { month, year, group_id, page = 1, limit = 30 } = req.query;
    const now = new Date();
    const m = parseInt(month || now.getMonth() + 1);
    const y = parseInt(year  || now.getFullYear());
    const { start, end } = getMonthRange(m, y);
    const teacherId = req.user.role === 'teacher' ? req.user.id : (req.query.teacher_id || req.user.id);

    const params = [teacherId, start, end];
    let cond = 'WHERE ls.teacher_id = ? AND ls.date >= ? AND ls.date <= ?';
    if (group_id) { params.push(group_id); cond += ' AND ls.group_id = ?'; }

    const total = await query(
      `SELECT COUNT(DISTINCT ls.lesson_id) as count FROM lesson_students ls ${cond}`, params
    );

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await query(
      `SELECT l.id as lesson_id, l.date, l.status as lesson_status, l.title,
              g.name as group_name, g.id as group_id,
              SUM(CASE WHEN ls.status='attended' THEN ls.price_earned ELSE 0 END) as lesson_income,
              COUNT(CASE WHEN ls.status='attended' THEN 1 END) as attended,
              COUNT(*) as total_students
       FROM lesson_students ls
       JOIN lessons l ON l.id = ls.lesson_id
       JOIN groups g  ON g.id = ls.group_id
       ${cond}
       GROUP BY l.id, l.date, l.status, l.title, g.name, g.id
       ORDER BY l.date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(total.rows[0].count),
      period: { month: m, year: y },
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMyEarnings,
  getTeacherEarnings,
  getEarningsOverview,
  getEarningsHistory,
};
