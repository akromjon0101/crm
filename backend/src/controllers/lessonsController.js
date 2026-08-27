/**
 * lessonsController.js
 *
 * Manages group lesson sessions and per-student attendance tracking.
 * Core invariants:
 *   1. lesson.price_per_student is snapshotted at creation — never retroactively changed.
 *   2. lesson_students.teacher_id is denormalized from group.teacher_id at mark time.
 *   3. Students can only be marked for lessons in the group they belonged to on that date.
 *   4. Teachers can only mark attendance for their own upcoming/today lessons.
 *   5. Admin can create, edit prices, override past records.
 */

const { query, db } = require('../config/database');

const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Verify a student was in groupId on lessonDate (via student_group_history). */
const validateStudentInGroup = async (studentId, groupId, lessonDate) => {
  // Check student's current group first (fast path)
  const cur = await query(
    `SELECT id FROM students WHERE id = ? AND group_id = ? AND status != 'archived'`,
    [studentId, groupId]
  );
  if (cur.rows[0]) return true;

  // Fall back to history: student was in this group on lessonDate
  const hist = await query(
    `SELECT id FROM student_group_history
     WHERE student_id = ? AND group_id = ?
       AND start_date <= ?
       AND (end_date IS NULL OR end_date > ?)`,
    [studentId, groupId, lessonDate, lessonDate]
  );
  return !!hist.rows[0];
};

/** Log to activity_log (non-critical). */
const logActivity = async (action, entityId, entityName, details, user) => {
  try {
    await query(
      `INSERT INTO activity_log (action, entity_type, entity_id, entity_name, details, performed_by, performed_by_name)
       VALUES (?, 'lesson', ?, ?, ?, ?, ?)`,
      [action, entityId, entityName, JSON.stringify(details), user?.id, user?.name]
    );
  } catch (_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /lessons
// Teacher sees only their groups; admin sees all.
// Query: ?group_id=&date=&month=&year=&status=&page=&limit=
// ─────────────────────────────────────────────────────────────────────────────
const getLessons = async (req, res) => {
  try {
    const { group_id, date, month, year, status, page = 1, limit = 50 } = req.query;
    const params = [];
    let cond = 'WHERE 1=1';

    if (req.user.role === 'teacher') {
      params.push(req.user.id);
      cond += ' AND l.teacher_id = ?';
    }
    if (group_id) { params.push(group_id); cond += ' AND l.group_id = ?'; }
    if (date)     { params.push(date);     cond += ' AND l.date = ?'; }
    if (status)   { params.push(status);   cond += ' AND l.status = ?'; }
    if (month)    { params.push(String(month).padStart(2, '0')); cond += ` AND strftime('%m', l.date) = ?`; }
    if (year)     { params.push(String(year));                   cond += ` AND strftime('%Y', l.date) = ?`; }

    const countResult = await query(
      `SELECT COUNT(*) as count FROM lessons l ${cond}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT l.*,
              g.name as group_name, g.lessons_per_month,
              u.name as teacher_name,
              c.name as course_name,
              (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.status = 'attended') as attended_count,
              (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = l.id) as total_students,
              (SELECT SUM(ls.price_earned) FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.status = 'attended') as lesson_income
       FROM lessons l
       JOIN groups g ON g.id = l.group_id
       JOIN users u  ON u.id = l.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       ${cond}
       ORDER BY l.date DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /lessons/today
// Teacher's lessons for today with student list and attendance status.
// ─────────────────────────────────────────────────────────────────────────────
const getTodayLessons = async (req, res) => {
  try {
    const t = today();
    const teacherCond = req.user.role === 'teacher' ? 'AND l.teacher_id = ?' : '';
    const params = req.user.role === 'teacher' ? [t, req.user.id] : [t];

    const lessons = await query(
      `SELECT l.*, g.name as group_name, u.name as teacher_name,
              (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = l.id AND ls.status = 'attended') as attended_count,
              (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = l.id) as total_students
       FROM lessons l
       JOIN groups g ON g.id = l.group_id
       JOIN users u  ON u.id = l.teacher_id
       WHERE l.date = ? ${teacherCond}
       ORDER BY l.group_id`,
      params
    );

    if (!lessons.rows.length) return res.json([]);

    // Batch fetch all students for all lessons in ONE query — eliminates N+1
    const lessonIds = lessons.rows.map(l => l.id);
    const ph = lessonIds.map(() => '?').join(',');

    const studentsRes = await query(
      `SELECT s.id, s.name, s.phone, sgh.group_id, l.id as lesson_id,
              ls.id as ls_id, ls.status as attendance_status, ls.price_earned
       FROM lessons l
       JOIN student_group_history sgh ON sgh.group_id = l.group_id
       JOIN students s ON s.id = sgh.student_id
       LEFT JOIN lesson_students ls ON ls.lesson_id = l.id AND ls.student_id = s.id
       WHERE l.id IN (${ph})
         AND sgh.start_date <= ?
         AND (sgh.end_date IS NULL OR sgh.end_date >= ?)
       ORDER BY l.id, s.name`,
      [...lessonIds, t, t]
    );

    // Build lessonId → students[] map
    const lessonStudentsMap = {};
    for (const row of studentsRes.rows) {
      if (!lessonStudentsMap[row.lesson_id]) lessonStudentsMap[row.lesson_id] = [];
      lessonStudentsMap[row.lesson_id].push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        ls_id: row.ls_id,
        attendance_status: row.attendance_status,
        price_earned: row.price_earned,
      });
    }

    const result = lessons.rows.map(lesson => ({
      ...lesson,
      students: lessonStudentsMap[lesson.id] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /lessons/:id
// ─────────────────────────────────────────────────────────────────────────────
const getLessonById = async (req, res) => {
  try {
    const lesson = await query(
      `SELECT l.*, g.name as group_name, u.name as teacher_name, c.name as course_name
       FROM lessons l
       JOIN groups g ON g.id = l.group_id
       JOIN users u  ON u.id = l.teacher_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE l.id = ?`,
      [req.params.id]
    );
    if (!lesson.rows[0]) return res.status(404).json({ message: 'Lesson not found' });

    // Enforce teacher ownership
    if (req.user.role === 'teacher' && lesson.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const students = await query(
      `SELECT s.id, s.name, s.phone,
              ls.id as ls_id, ls.status as attendance_status, ls.price_earned,
              ls.is_overridden, ls.override_reason
       FROM students s
       JOIN student_group_history sgh ON sgh.student_id = s.id
       LEFT JOIN lesson_students ls ON ls.lesson_id = ? AND ls.student_id = s.id
       WHERE sgh.group_id = ? 
         AND sgh.start_date <= ?
         AND (sgh.end_date IS NULL OR sgh.end_date >= ?)
       ORDER BY s.name`,
      [req.params.id, lesson.rows[0].group_id, lesson.rows[0].date, lesson.rows[0].date]
    );

    res.json({ ...lesson.rows[0], students: students.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /lessons  (admin/superadmin only)
// Creates a lesson for a group. Auto-sets teacher from group. Price defaults to
// group.monthly_fee / group.lessons_per_month if not provided.
// ─────────────────────────────────────────────────────────────────────────────
const createLesson = async (req, res) => {
  try {
    const { group_id, date, title, price_per_student, notes } = req.body;
    if (!group_id || !date) {
      return res.status(400).json({ message: 'group_id and date are required' });
    }

    const group = await query(
      `SELECT g.*, COALESCE(g.monthly_fee, c.monthly_fee) as effective_fee, g.lessons_per_month
       FROM groups g LEFT JOIN courses c ON c.id = g.course_id WHERE g.id = ?`,
      [group_id]
    );
    if (!group.rows[0]) return res.status(404).json({ message: 'Group not found' });

    const g = group.rows[0];
    const divisor = g.lessons_per_month > 0 ? g.lessons_per_month : 20;
    const rawPrice = price_per_student != null
      ? parseFloat(price_per_student)
      : parseFloat(g.effective_fee || 0) / divisor;
    const lessonPrice = Number.isFinite(rawPrice) ? rawPrice : 0;

    const result = await query(
      `INSERT INTO lessons (group_id, teacher_id, date, title, price_per_student, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [group_id, g.teacher_id, date, title || null, lessonPrice, notes || null, req.user.id]
    );

    await logActivity('lesson_created', result.rows[0].id,
      `${g.name} - ${date}`, { group_id, date, price: lessonPrice }, req.user);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ message: 'A lesson already exists for this group on this date' });
    }
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /lessons/bulk-create  (admin only)
// Auto-generate lessons for a group for an entire month based on its schedule.
// Body: { group_id, month, year }
// ─────────────────────────────────────────────────────────────────────────────
const bulkCreateLessons = async (req, res) => {
  try {
    const { group_id, month, year } = req.body;
    if (!group_id || !month || !year) {
      return res.status(400).json({ message: 'group_id, month, and year are required' });
    }

    const group = await query(
      `SELECT g.*, COALESCE(g.monthly_fee, c.monthly_fee) as effective_fee,
              g.lessons_per_month, g.schedule
       FROM groups g LEFT JOIN courses c ON c.id = g.course_id WHERE g.id = ?`,
      [group_id]
    );
    if (!group.rows[0]) return res.status(404).json({ message: 'Group not found' });

    const g = group.rows[0];
    const lessonPrice = parseFloat((g.effective_fee || 0) / (g.lessons_per_month || 20));

    // Parse schedule: "1,3,5|08:00-10:00" → days [1,3,5] (Mon=1, Sun=7 per ISO)
    let scheduleDays = [];
    if (g.schedule) {
      const [daysPart] = g.schedule.split('|');
      scheduleDays = daysPart.split(',').map(Number).filter(d => d >= 0 && d <= 6);
    }

    // Generate dates for the month that match schedule days
    const created = [];
    const skipped = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      // JavaScript: 0=Sun, 1=Mon … 6=Sat. Schedule uses 0=Sun or 1-7 Mon-Sun
      const jsDay = d.getDay(); // 0-6
      const scheduleDay = jsDay === 0 ? 7 : jsDay; // convert Sun=0 → 7

      if (scheduleDays.length > 0 && !scheduleDays.includes(jsDay) && !scheduleDays.includes(scheduleDay)) {
        continue;
      }

      const dateStr = d.toISOString().split('T')[0];
      try {
        await query(
          `INSERT INTO lessons (group_id, teacher_id, date, price_per_student, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [group_id, g.teacher_id, dateStr, lessonPrice, req.user.id]
        );
        created.push(dateStr);
      } catch (e) {
        if (e.message?.includes('UNIQUE')) skipped.push(dateStr);
        else throw e;
      }
    }

    res.json({ created: created.length, skipped: skipped.length, dates: created });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /lessons/:id/conduct  (teacher or admin)
// Marks a lesson as conducted and records attendance for ALL active group students.
// Body: { attendance: [{ student_id, status: 'attended'|'missed'|'excused' }] }
// ─────────────────────────────────────────────────────────────────────────────
const conductLesson = async (req, res) => {
  try {
    const { attendance = [], notes } = req.body;
    const lessonId = req.params.id;

    const lessonResult = await query(
      `SELECT l.*, g.teacher_id FROM lessons l JOIN groups g ON g.id = l.group_id WHERE l.id = ?`,
      [lessonId]
    );
    if (!lessonResult.rows[0]) return res.status(404).json({ message: 'Lesson not found' });

    const lesson = lessonResult.rows[0];

    // Teachers can only conduct their own lessons
    if (req.user.role === 'teacher' && lesson.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only conduct your own lessons' });
    }

    // Prevent re-conducting — all roles blocked; use overrideAttendance for corrections
    if (lesson.status === 'conducted') {
      return res.status(409).json({ message: 'Lesson already conducted. Use attendance override to make changes.' });
    }

    // Mark lesson as conducted
    await query(
      `UPDATE lessons SET status = 'conducted', notes = COALESCE(?, notes),
       conducted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [notes || null, lessonId]
    );

    // Get active students in the group (those assigned on lesson.date)
    const groupStudents = await query(
      `SELECT s.id, s.name FROM students s
       JOIN student_group_history sgh ON sgh.student_id = s.id
       WHERE sgh.group_id = ? 
         AND sgh.start_date <= ?
         AND (sgh.end_date IS NULL OR sgh.end_date >= ?)`,
      [lesson.group_id, lesson.date, lesson.date]
    );

    // Build attendance map from request
    const attMap = {};
    for (const a of attendance) attMap[a.student_id] = a.status || 'missed';

    // Upsert lesson_students for each student
    const records = [];
    for (const student of groupStudents.rows) {
      const status = attMap[student.id] || 'missed'; // default missed if not in attendance list
      const priceEarned = status === 'attended' ? parseFloat(lesson.price_per_student || 0) : 0;

      await query(
        `INSERT INTO lesson_students (lesson_id, student_id, teacher_id, group_id, date, status, price_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(lesson_id, student_id) DO UPDATE SET
           status = excluded.status,
           price_earned = excluded.price_earned,
           updated_at = datetime('now')`,
        [lessonId, student.id, lesson.teacher_id, lesson.group_id, lesson.date, status, priceEarned]
      );
      records.push({ student_id: student.id, name: student.name, status, price_earned: priceEarned });
    }

    await logActivity('lesson_conducted', lesson.id,
      `Group ${lesson.group_id} - ${lesson.date}`,
      { attended: records.filter(r => r.status === 'attended').length, total: records.length },
      req.user
    );

    res.json({
      lesson_id: lessonId,
      date: lesson.date,
      group_id: lesson.group_id,
      records,
      total_income: records.reduce((s, r) => s + r.price_earned, 0),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /lessons/:id  (admin only)
// Update lesson metadata (title, notes). Price update creates audit log.
// ─────────────────────────────────────────────────────────────────────────────
const updateLesson = async (req, res) => {
  try {
    const { title, notes, status, price_per_student } = req.body;
    const lessonResult = await query('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
    if (!lessonResult.rows[0]) return res.status(404).json({ message: 'Lesson not found' });

    const old = lessonResult.rows[0];
    const newPrice = price_per_student != null ? parseFloat(price_per_student) : old.price_per_student;

    const result = await query(
      `UPDATE lessons SET title = COALESCE(?, title), notes = COALESCE(?, notes),
       status = COALESCE(?, status), price_per_student = ?,
       updated_at = datetime('now') WHERE id = ? RETURNING *`,
      [title || null, notes || null, status || null, newPrice, req.params.id]
    );

    // If price changed, update existing lesson_students records (admin override)
    if (price_per_student != null && newPrice !== old.price_per_student) {
      await query(
        `UPDATE lesson_students
         SET price_earned = CASE WHEN status = 'attended' THEN ? ELSE 0 END,
             is_overridden = 1, override_by = ?, override_reason = 'Admin price update',
             updated_at = datetime('now')
         WHERE lesson_id = ?`,
        [newPrice, req.user.id, req.params.id]
      );
      await logActivity('lesson_price_updated', old.id,
        `Lesson ${old.date}`, { old_price: old.price_per_student, new_price: newPrice }, req.user);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /lessons/:id/attendance/:studentId  (admin override only)
// Override a single student's attendance record with reason.
// ─────────────────────────────────────────────────────────────────────────────
const overrideAttendance = async (req, res) => {
  try {
    const { status, override_reason } = req.body;
    const { id: lessonId, studentId } = req.params;

    const lessonResult = await query('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!lessonResult.rows[0]) return res.status(404).json({ message: 'Lesson not found' });
    const lesson = lessonResult.rows[0];

    const priceEarned = status === 'attended' ? parseFloat(lesson.price_per_student || 0) : 0;

    await query(
      `INSERT INTO lesson_students (lesson_id, student_id, teacher_id, group_id, date, status, price_earned, is_overridden, override_by, override_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(lesson_id, student_id) DO UPDATE SET
         status = excluded.status, price_earned = excluded.price_earned,
         is_overridden = 1, override_by = excluded.override_by,
         override_reason = excluded.override_reason, updated_at = datetime('now')`,
      [lessonId, studentId, lesson.teacher_id, lesson.group_id, lesson.date,
       status, priceEarned, req.user.id, override_reason || 'Admin override']
    );

    await logActivity('attendance_overridden', parseInt(lessonId),
      `Lesson ${lesson.date}`, { student_id: studentId, status, reason: override_reason }, req.user);

    res.json({ lesson_id: lessonId, student_id: studentId, status, price_earned: priceEarned });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /lessons/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const deleteLesson = async (req, res) => {
  try {
    const result = await query('DELETE FROM lessons WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Lesson not found' });
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getLessons, getTodayLessons, getLessonById,
  createLesson, bulkCreateLessons,
  conductLesson, updateLesson, overrideAttendance,
  deleteLesson,
};
