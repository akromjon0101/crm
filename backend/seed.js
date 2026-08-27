/**
 * Seed script — EduCRM demo data
 * Run: node seed.js
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'crm.db'));

const hash = (p) => bcrypt.hashSync(p, 10);

function seed() {
  console.log('🌱 Seeding demo data...\n');

  // ── Temporarily disable foreign keys to clear data ──────────────────
  db.pragma('foreign_keys = OFF');

  // ── Clear existing demo data (keep superadmin) ──────────────────────
  db.prepare(`DELETE FROM attendance`).run();
  db.prepare(`DELETE FROM payments`).run();
  db.prepare(`DELETE FROM student_notes`).run();
  db.prepare(`DELETE FROM students`).run();
  db.prepare(`DELETE FROM groups`).run();
  db.prepare(`DELETE FROM courses`).run();
  db.prepare(`DELETE FROM users WHERE role != 'superadmin'`).run();

  // ── Re-enable foreign keys ───────────────────────────────────────────
  db.pragma('foreign_keys = ON');

  // ── Users (teachers + admin) ────────────────────────────────────────
  const users = [
    { name: 'Admin User',     email: 'admin@crm.uz',     role: 'admin',    phone: '+998901234567', subject: null },
    { name: 'Sarvar Toshmatov', email: 'sarvar@crm.uz',  role: 'teacher',  phone: '+998901111111', subject: 'Frontend Development' },
    { name: 'Dilnoza Yusupova', email: 'dilnoza@crm.uz', role: 'teacher',  phone: '+998902222222', subject: 'English Language' },
    { name: 'Anvar Karimov',   email: 'anvar@crm.uz',    role: 'teacher',  phone: '+998903333333', subject: 'Python Programming' },
  ];

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password, role, phone, subject) VALUES (?,?,?,?,?,?)`
  );
  const userIds = {};
  for (const u of users) {
    const info = insertUser.run(u.name, u.email, hash('password'), u.role, u.phone, u.subject);
    userIds[u.email] = info.lastInsertRowid;
    console.log(`  ✅ User: ${u.name} (${u.role})`);
  }

  // ── Courses ─────────────────────────────────────────────────────────
  const courses = [
    { name: 'Frontend PRO',        description: 'HTML, CSS, JS, React — full frontend stack', duration_months: 6, monthly_fee: 600000 },
    { name: 'IELTS Preparation',   description: 'Academic IELTS — all 4 skills', duration_months: 4, monthly_fee: 500000 },
    { name: 'English A2',          description: 'Elementary English for beginners', duration_months: 3, monthly_fee: 350000 },
    { name: 'Python Basics',       description: 'Python programming fundamentals', duration_months: 4, monthly_fee: 500000 },
    { name: "Kids English",        description: "English for children ages 6-12", duration_months: 3, monthly_fee: 300000 },
  ];

  const insertCourse = db.prepare(
    `INSERT INTO courses (name, description, duration_months, monthly_fee) VALUES (?,?,?,?)`
  );
  const courseIds = {};
  for (const c of courses) {
    const info = insertCourse.run(c.name, c.description, c.duration_months, c.monthly_fee);
    courseIds[c.name] = info.lastInsertRowid;
    console.log(`  ✅ Course: ${c.name}`);
  }

  // ── Groups ──────────────────────────────────────────────────────────
  // schedule format: "days|HH:MM-HH:MM"  days: 1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const groups = [
    {
      name: 'Frontend PRO',
      course: 'Frontend PRO',
      teacher: 'sarvar@crm.uz',
      schedule: '2,4,6|14:00-16:00',
      schedule_type: 'specific',
      room: 'Room 201',
      start_date: '2025-01-15',
      max_students: 12,
    },
    {
      name: 'IELTS Preparation',
      course: 'IELTS Preparation',
      teacher: 'dilnoza@crm.uz',
      schedule: '1,3,5|10:00-12:00',
      schedule_type: 'specific',
      room: 'Room 102',
      start_date: '2025-01-20',
      max_students: 10,
    },
    {
      name: 'English A2',
      course: 'English A2',
      teacher: 'dilnoza@crm.uz',
      schedule: '2,4|15:00-17:00',
      schedule_type: 'specific',
      room: 'Room 103',
      start_date: '2025-02-01',
      max_students: 15,
    },
    {
      name: 'Python Basics',
      course: 'Python Basics',
      teacher: 'anvar@crm.uz',
      schedule: '1,3,5|14:00-16:00',
      schedule_type: 'specific',
      room: 'Room 201',
      start_date: '2025-02-10',
      max_students: 12,
    },
    {
      name: "Kids English",
      course: "Kids English",
      teacher: 'dilnoza@crm.uz',
      schedule: '1,3,5|09:00-10:00',
      schedule_type: 'specific',
      room: 'Room 101',
      start_date: '2025-01-10',
      max_students: 10,
    },
  ];

  const insertGroup = db.prepare(
    `INSERT INTO groups (name, course_id, teacher_id, schedule, room, start_date, max_students, status)
     VALUES (?,?,?,?,?,?,?,'active')`
  );
  const groupIds = {};
  for (const g of groups) {
    const info = insertGroup.run(
      g.name,
      courseIds[g.course],
      userIds[g.teacher],
      g.schedule,
      g.room,
      g.start_date,
      g.max_students
    );
    groupIds[g.name] = info.lastInsertRowid;
    console.log(`  ✅ Group: ${g.name}`);
  }

  // ── Students ─────────────────────────────────────────────────────────
  const studentData = [
    // Frontend PRO (5 students)
    { name: 'Alisher Nazarov',    phone: '+998901001001', parent_phone: '+998901001002', group: 'Frontend PRO',      start_date: '2025-01-15' },
    { name: 'Bobur Xasanov',      phone: '+998901002001', parent_phone: '+998901002002', group: 'Frontend PRO',      start_date: '2025-01-15' },
    { name: 'Camila Razzaqova',   phone: '+998901003001', parent_phone: '+998901003002', group: 'Frontend PRO',      start_date: '2025-01-20' },
    { name: 'Doniyor Mirzayev',   phone: '+998901004001', parent_phone: '+998901004002', group: 'Frontend PRO',      start_date: '2025-01-20' },
    { name: 'Ezgulik Sobirov',    phone: '+998901005001', parent_phone: '+998901005002', group: 'Frontend PRO',      start_date: '2025-02-01' },
    // IELTS Preparation (4 students)
    { name: "Feruza Qodirov",     phone: '+998901006001', parent_phone: '+998901006002', group: 'IELTS Preparation', start_date: '2025-01-20' },
    { name: 'Gulnora Tursunova',  phone: '+998901007001', parent_phone: '+998901007002', group: 'IELTS Preparation', start_date: '2025-01-20' },
    { name: 'Hamza Yoʻldoshev',   phone: '+998901008001', parent_phone: '+998901008002', group: 'IELTS Preparation', start_date: '2025-02-01' },
    { name: 'Iroda Mirzaeva',     phone: '+998901009001', parent_phone: '+998901009002', group: 'IELTS Preparation', start_date: '2025-02-01' },
    // English A2 (4 students)
    { name: 'Jasur Umarov',       phone: '+998901010001', parent_phone: '+998901010002', group: 'English A2',        start_date: '2025-02-01' },
    { name: 'Kamola Ergasheva',   phone: '+998901011001', parent_phone: '+998901011002', group: 'English A2',        start_date: '2025-02-01' },
    { name: 'Lochinbek Qosimov',  phone: '+998901012001', parent_phone: '+998901012002', group: 'English A2',        start_date: '2025-02-10' },
    { name: 'Malika Xoliqova',    phone: '+998901013001', parent_phone: '+998901013002', group: 'English A2',        start_date: '2025-02-10' },
    // Python Basics (4 students)
    { name: 'Nodir Sultonov',     phone: '+998901014001', parent_phone: '+998901014002', group: 'Python Basics',     start_date: '2025-02-10' },
    { name: 'Ozoda Raximova',     phone: '+998901015001', parent_phone: '+998901015002', group: 'Python Basics',     start_date: '2025-02-10' },
    { name: 'Parviz Yunusov',     phone: '+998901016001', parent_phone: '+998901016002', group: 'Python Basics',     start_date: '2025-02-15' },
    { name: 'Qahramon Normatov',  phone: '+998901017001', parent_phone: '+998901017002', group: 'Python Basics',     start_date: '2025-02-15' },
    // Kids English (3 students)
    { name: 'Rohila Hamidova',    phone: '+998901018001', parent_phone: '+998901018002', group: "Kids English",      start_date: '2025-01-10' },
    { name: 'Sarvinoz Qurbonova', phone: '+998901019001', parent_phone: '+998901019002', group: "Kids English",      start_date: '2025-01-10' },
    { name: 'Temur Toshqoʻziev',  phone: '+998901020001', parent_phone: '+998901020002', group: "Kids English",      start_date: '2025-01-15' },
  ];

  const insertStudent = db.prepare(
    `INSERT INTO students (name, phone, parent_phone, group_id, start_date, is_active)
     VALUES (?,?,?,?,?,1)`
  );
  const studentIds = {};
  for (const s of studentData) {
    const info = insertStudent.run(s.name, s.phone, s.parent_phone, groupIds[s.group], s.start_date);
    studentIds[s.name] = { id: info.lastInsertRowid, group: s.group };
    console.log(`  ✅ Student: ${s.name} → ${s.group}`);
  }

  // ── Attendance history (last 3 months) ──────────────────────────────
  console.log('\n  📅 Generating attendance history...');

  // Parse schedule to get lesson days: "1,3,5|14:00-16:00" → [1,3,5]
  function getLessonDays(schedule) {
    if (!schedule) return [1, 2, 3, 4, 5];
    const parts = schedule.split('|');
    return parts[0].split(',').map(Number);
  }

  function getDatesInRange(startDate, endDate) {
    const dates = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const insertAttendance = db.prepare(
    `INSERT OR IGNORE INTO attendance (student_id, group_id, date, status, marked_by)
     VALUES (?,?,?,?,?)`
  );

  const superadmin = db.prepare(`SELECT id FROM users WHERE role='superadmin' LIMIT 1`).get();
  const markerId = superadmin?.id || 1;

  const statuses = ['present', 'present', 'present', 'present', 'present', 'present', 'present', 'present', 'absent', 'late'];

  for (const [groupName, groupId] of Object.entries(groupIds)) {
    const group = groups.find(g => g.name === groupName);
    const lessonDays = getLessonDays(group?.schedule);
    const allDates = getDatesInRange(threeMonthsAgo.toISOString().split('T')[0], now.toISOString().split('T')[0]);
    const lessonDates = allDates.filter(d => {
      const dow = new Date(d).getDay(); // 0=Sun,1=Mon,...
      // Convert: 1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat → JS: Mon=1,Tue=2,...Sat=6
      return lessonDays.includes(dow);
    });

    const groupStudents = studentData.filter(s => s.group === groupName);
    for (const student of groupStudents) {
      const sid = studentIds[student.name]?.id;
      if (!sid) continue;
      for (const date of lessonDates) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        insertAttendance.run(sid, groupId, date, status, markerId);
      }
    }
  }
  console.log('  ✅ Attendance records generated');

  // ── Payments ─────────────────────────────────────────────────────────
  console.log('\n  💳 Generating payments...');

  const insertPayment = db.prepare(
    `INSERT INTO payments (student_id, amount, payment_date, month, year, payment_type, created_by)
     VALUES (?,?,?,?,?,?,?)`
  );

  const paymentTypes = ['cash', 'card', 'transfer'];
  const months = [1, 2, 3]; // Jan, Feb, Mar 2025

  let paidCount = 0;
  for (const [studentName, info] of Object.entries(studentIds)) {
    const groupName = info.group;
    const course = courses.find(c => c.name === groups.find(g => g.name === groupName)?.course);
    if (!course) continue;

    // ~80% chance paid each month
    for (const month of months) {
      if (Math.random() < 0.8) {
        const day = Math.floor(Math.random() * 25) + 1;
        const dateStr = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const ptype = paymentTypes[Math.floor(Math.random() * paymentTypes.length)];
        insertPayment.run(info.id, course.monthly_fee, dateStr, month, 2025, ptype, markerId);
        paidCount++;
      } else {
        // Mark as debtor
        db.prepare(`UPDATE students SET is_debtor=1 WHERE id=?`).run(info.id);
      }
    }
  }
  console.log(`  ✅ ${paidCount} payment records generated`);

  console.log('\n✅ Seeding complete!\n');
  console.log('Demo accounts:');
  console.log('  superadmin@crm.uz  / password  (CEO)');
  console.log('  admin@crm.uz       / password  (Admin)');
  console.log('  sarvar@crm.uz      / password  (Teacher - Frontend)');
  console.log('  dilnoza@crm.uz     / password  (Teacher - English)');
  console.log('  anvar@crm.uz       / password  (Teacher - Python)\n');
}

seed();
db.close();
