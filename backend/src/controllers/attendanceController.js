const { query, db } = require('../config/database');
const eskizService = require('../utils/smsService');

const getAttendance = async (req, res) => {
  try {
    const { group_id, student_id, date, start_date, end_date } = req.query;
    const params = [];
    let conditions = 'WHERE 1=1';

    if (group_id) { params.push(group_id); conditions += ` AND a.group_id = ?`; }
    if (student_id) { params.push(student_id); conditions += ` AND a.student_id = ?`; }
    if (date) { params.push(date); conditions += ` AND a.date = ?`; }
    if (start_date) { params.push(start_date); conditions += ` AND a.date >= ?`; }
    if (end_date) { params.push(end_date); conditions += ` AND a.date <= ?`; }
    if (req.user.role === 'teacher') { params.push(req.user.id); conditions += ` AND g.teacher_id = ?`; }

    const result = await query(
      `SELECT a.*, s.name as student_name, g.name as group_name, u.name as marked_by_name
       FROM attendance a
       LEFT JOIN students s ON s.id = a.student_id
       LEFT JOIN groups g ON g.id = a.group_id
       LEFT JOIN users u ON u.id = a.marked_by
       ${conditions}
       ORDER BY a.date DESC, s.name ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[getAttendance]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Records array is required' });
    }

    const VALID_STATUSES = ['present', 'absent', 'late', 'excused', 'freeze'];

    // Pre-validate all records before touching the DB — fail fast on bad input.
    for (const record of records) {
      if (!record.student_id || !record.group_id || !record.status) {
        return res.status(400).json({ message: 'Each record must have student_id, group_id, and status' });
      }
      if (!VALID_STATUSES.includes(record.status)) {
        return res.status(400).json({
          message: `Invalid status "${record.status}". Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
    }

    // Pre-fetch group info for each unique group_id so we don't query inside the
    // transaction (better-sqlite3 transactions are synchronous; async queries can't
    // run inside them).
    const uniqueGroupIds = [...new Set(records.map(r => r.group_id).filter(Boolean))];
    const groupInfoMap = {};
    for (const gid of uniqueGroupIds) {
      const gRes = await query(
        `SELECT g.teacher_id, g.lessons_per_month, COALESCE(g.monthly_fee, c.monthly_fee, 0) as fee
         FROM groups g
         LEFT JOIN courses c ON c.id = g.course_id
         WHERE g.id = ?`,
        [gid]
      );
      if (gRes.rows[0]) groupInfoMap[gid] = gRes.rows[0];
    }

    // Pre-fetch any existing lessons for (group_id, date) pairs in this batch.
    const lessonMap = {};
    for (const record of records) {
      const d = record.date || new Date().toISOString().split('T')[0];
      const key = `${record.group_id}_${d}`;
      if (!(key in lessonMap) && record.group_id) {
        const lRes = await query(
          'SELECT id, teacher_id, price_per_student FROM lessons WHERE group_id = ? AND date = ? LIMIT 1',
          [record.group_id, d]
        );
        lessonMap[key] = lRes.rows[0] || null;
      }
    }

    // Run all DB writes inside a single synchronous transaction for atomicity.
    // SMS side-effects are collected and fired after the transaction commits.
    const smsTasks = [];

    const runTransaction = db.transaction((records, userId) => {
      const results = [];

      for (const record of records) {
        const { student_id, group_id, status, notes } = record;
        const d = record.date || new Date().toISOString().split('T')[0];

        // 1. Upsert attendance record
        const attStmt = db.prepare(
          `INSERT INTO attendance (student_id, group_id, date, status, notes, marked_by)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(student_id, date) DO UPDATE SET
             status=excluded.status, notes=excluded.notes, marked_by=excluded.marked_by
           RETURNING *`
        );
        const attRow = attStmt.get(student_id, group_id, d, status, notes || null, userId);
        results.push(attRow);

        // 2. Sync with lesson_students (skip if group has no fee — zero-price guard)
        if (group_id && d && status) {
          const gInfo = groupInfoMap[group_id];
          // Skip auto-lesson creation when the group has no monetary fee configured;
          // this prevents ghost salary entries for free/demo groups.
          if (gInfo && gInfo.fee > 0) {
            const key = `${group_id}_${d}`;
            let lesson = lessonMap[key];

            if (!lesson) {
              // Auto-create lesson on the fly for attendance-journal workflow
              const calculatedPrice = (gInfo.fee || 0) / (gInfo.lessons_per_month || 12);
              const insertLesson = db.prepare(
                `INSERT INTO lessons (group_id, teacher_id, date, title, price_per_student, status, created_by)
                 VALUES (?, ?, ?, 'Attendance Journal Lesson', ?, 'conducted', ?)
                 RETURNING id, teacher_id, price_per_student`
              );
              lesson = insertLesson.get(group_id, gInfo.teacher_id, d, calculatedPrice, userId);
              lessonMap[key] = lesson; // cache for subsequent records with same group+date
            }

            if (lesson) {
              // Map attendance status → lesson_student status
              // BUG FIX: 'freeze' was previously unhandled and fell through to 'scheduled'
              let lsStatus = 'scheduled';
              if (status === 'present' || status === 'late') lsStatus = 'attended';
              else if (status === 'absent') lsStatus = 'missed';
              else if (status === 'excused') lsStatus = 'excused';
              else if (status === 'freeze') lsStatus = 'excused';

              const price = lsStatus === 'attended' ? parseFloat(lesson.price_per_student || 0) : 0;

              db.prepare(
                `INSERT INTO lesson_students (lesson_id, student_id, teacher_id, group_id, date, status, price_earned)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(lesson_id, student_id) DO UPDATE SET
                   status = excluded.status,
                   price_earned = excluded.price_earned,
                   updated_at = datetime('now')`
              ).run(lesson.id, student_id, lesson.teacher_id, group_id, d, lsStatus, price);

              // Queue SMS for absent students — fired after commit
              if (status === 'absent') {
                smsTasks.push({ student_id, group_id });
              }
            }
          }
        }
      }

      return results;
    });

    const results = runTransaction(records, req.user.id);

    // Fire SMS notifications after the transaction has committed (non-blocking)
    for (const { student_id, group_id } of smsTasks) {
      (async () => {
        try {
          const sRes = await query('SELECT name, parent_phone, phone FROM students WHERE id = ?', [student_id]);
          const sInfo = sRes.rows[0];
          const phone = sInfo?.parent_phone || sInfo?.phone;
          if (phone && sInfo?.name) {
            const gNameRes = await query('SELECT name FROM groups WHERE id = ?', [group_id]);
            const gName = gNameRes.rows[0]?.name || 'guruh';
            eskizService.sendSMS(phone, `Ma'lumot: Bugun ${sInfo.name} "${gName}" darsiga kelmadi.`).catch(console.error);
          }
        } catch (smsErr) {
          console.error('[markAttendance SMS]', smsErr);
        }
      })();
    }

    res.json(results);
  } catch (err) {
    console.error('[markAttendance]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAttendanceByGroup = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const students = await query(
      `SELECT s.id, s.name, a.status, a.notes, a.id as attendance_id
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
       WHERE s.group_id = ? AND s.is_active = 1
       ORDER BY s.name`,
      [targetDate, req.params.groupId]
    );

    res.json({ date: targetDate, students: students.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { month, year } = req.query;
    const params = [student_id];
    let conditions = 'WHERE student_id = ?';

    if (month) { params.push(month); conditions += ` AND CAST(strftime('%m', date) AS INTEGER) = ?`; }
    if (year) { params.push(year); conditions += ` AND strftime('%Y', date) = ?`; }

    const result = await query(`SELECT status, COUNT(*) as count FROM attendance ${conditions} GROUP BY status`, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /attendance/journal?group_id=X&month=M&year=Y
// Returns a school-journal structure: students × dates × statuses
const getAttendanceJournal = async (req, res) => {
  try {
    const { group_id, month, year } = req.query;
    if (!group_id) return res.status(400).json({ message: 'group_id required' });

    const now = new Date();
    const m = parseInt(month) || (now.getMonth() + 1);
    const y = parseInt(year) || now.getFullYear();

    // Access control: teacher can only see own groups
    const groupCheck = await query(
      `SELECT g.*, u.name as teacher_name FROM groups g LEFT JOIN users u ON u.id = g.teacher_id WHERE g.id = ?`,
      [group_id]
    );
    if (!groupCheck.rows[0]) return res.status(404).json({ message: 'Group not found' });
    const group = groupCheck.rows[0];
    if (req.user.role === 'teacher' && group.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Students in this group (including frozen but still associated with this group)
    // Use COALESCE to get the start_date from student_group_history if available, otherwise fallback to students table.
    const studentsRes = await query(
      `SELECT s.id, s.name, s.phone, s.status, COALESCE((SELECT start_date FROM student_group_history WHERE student_id = s.id AND group_id = s.group_id ORDER BY id DESC LIMIT 1), s.start_date) as start_date 
       FROM students s 
       WHERE s.group_id = ? AND (s.is_active = 1 OR s.status = 'frozen') ORDER BY s.name`,
      [group_id]
    );
    const students = studentsRes.rows;

    // All dates in the selected month that have any records OR are lesson days
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    // Get all attendance records for this group in this month
    const attendanceRes = await query(
      `SELECT student_id, date, status FROM attendance
       WHERE group_id = ? AND date >= ? AND date <= ?
       ORDER BY date`,
      [group_id, startDate, endDate]
    );

    // Build records map: { studentId: { 'YYYY-MM-DD': 'present'|'absent'|'late' } }
    const records = {};
    const datesWithRecords = new Set();
    for (const row of attendanceRes.rows) {
      if (!records[row.student_id]) records[row.student_id] = {};
      records[row.student_id][row.date] = row.status;
      datesWithRecords.add(row.date);
    }

    // Generate lesson dates based on group schedule
    // Schedule format: "1,3,5|14:00-16:00"  (1=Mon,2=Tue,...6=Sat in JS: Mon=1,Tue=2,...Sat=6)
    const lessonDates = [];
    if (group.schedule) {
      const [daysStr] = group.schedule.split('|');
      const lessonDays = daysStr.split(',').map(Number);
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        const dow = cur.getDay(); // 0=Sun,1=Mon,...6=Sat
        if (lessonDays.includes(dow)) {
          lessonDates.push(cur.toISOString().split('T')[0]);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Merge: lesson dates + dates with existing records
    const allDates = [...new Set([...lessonDates, ...datesWithRecords])].sort();

    // Stats per student
    const stats = {};
    for (const s of students) {
      const sr = records[s.id] || {};
      let present = 0, absent = 0, late = 0;
      for (const date of allDates) {
        const st = sr[date];
        if (st === 'present') present++;
        else if (st === 'absent') absent++;
        else if (st === 'late') late++;
      }
      const total = present + absent + late;
      stats[s.id] = { present, absent, late, total, pct: total > 0 ? Math.round(((present + late) / total) * 100) : 0 };
    }

    res.json({ group, students, dates: allDates, records, stats });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAttendance, markAttendance, getAttendanceByGroup, getStudentAttendanceSummary, getAttendanceJournal };
