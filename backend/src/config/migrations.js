/**
 * migrations.js
 *
 * Lightweight, idempotent migration runner for SQLite (better-sqlite3).
 * Each migration runs exactly once, tracked in the _migrations table.
 *
 * Usage: call runMigrations(db) once at app startup.
 */

/**
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  // ── Ensure tracking table exists ─────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id      INTEGER PRIMARY KEY,
      name    TEXT    NOT NULL UNIQUE,
      run_at  TEXT    DEFAULT (datetime('now'))
    )
  `);

  const hasRun = db.prepare('SELECT id FROM _migrations WHERE name = ?');
  const record = db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)");

  // ── Migration 001: add 'freeze' to attendance.status CHECK constraint ─────
  // SQLite cannot ALTER a CHECK constraint, so we recreate the table.
  if (!hasRun.get('001_attendance_freeze_status')) {
    console.log('[migration] 001_attendance_freeze_status — running…');
    db.transaction(() => {
      // Check if migration is already applied (column already has 'freeze')
      const tableRow = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance'"
      ).get();

      const alreadyHasFreeze = tableRow && tableRow.sql && tableRow.sql.includes('freeze');

      if (!alreadyHasFreeze) {
        db.pragma('foreign_keys = OFF');

        // Drop any leftover temp table from a previous failed attempt
        db.exec('DROP TABLE IF EXISTS _attendance_new');

        // Recreate with updated CHECK constraint
        db.exec(`
          CREATE TABLE _attendance_new (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER REFERENCES students(id)  ON DELETE CASCADE,
            group_id   INTEGER REFERENCES groups(id)    ON DELETE CASCADE,
            date       TEXT    NOT NULL DEFAULT (date('now')),
            status     TEXT    NOT NULL CHECK (status IN ('present', 'absent', 'late', 'freeze')),
            notes      TEXT,
            marked_by  INTEGER REFERENCES users(id)     ON DELETE SET NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            UNIQUE(student_id, date)
          )
        `);

        // Copy existing rows (present / absent / late — all valid in new schema)
        db.exec('INSERT INTO _attendance_new SELECT * FROM attendance');

        db.exec('DROP TABLE attendance');
        db.exec('ALTER TABLE _attendance_new RENAME TO attendance');

        // Rebuild indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_group_id   ON attendance(group_id)');

        db.pragma('foreign_keys = ON');
      }

      record.run(1, '001_attendance_freeze_status');
    })();
    console.log('[migration] 001_attendance_freeze_status — done ✓');
  }

  // ── Migration 002: add monthly_fee override column to groups ──────────────
  // Groups can override their course's monthly_fee.
  // NULL means "use the course fee".
  if (!hasRun.get('002_groups_monthly_fee')) {
    console.log('[migration] 002_groups_monthly_fee — running…');
    db.transaction(() => {
      const cols = db.prepare('PRAGMA table_info(groups)').all();
      const exists = cols.some(c => c.name === 'monthly_fee');
      if (!exists) {
        db.exec('ALTER TABLE groups ADD COLUMN monthly_fee REAL DEFAULT NULL');
      }
      record.run(2, '002_groups_monthly_fee');
    })();
    console.log('[migration] 002_groups_monthly_fee — done ✓');
  }
  // ── Migration 003: add salary_per_student to users table ─────────────────
  if (!hasRun.get('003_users_salary_per_student')) {
    console.log('[migration] 003_users_salary_per_student — running…');
    db.transaction(() => {
      const cols = db.prepare('PRAGMA table_info(users)').all();
      const exists = cols.some(c => c.name === 'salary_per_student');
      if (!exists) {
        db.exec('ALTER TABLE users ADD COLUMN salary_per_student REAL DEFAULT NULL');
      }
      record.run(3, '003_users_salary_per_student');
    })();
    console.log('[migration] 003_users_salary_per_student — done ✓');
  }

  // ── Migration 004: student_group_history table + students.status ──────────
  if (!hasRun.get('004_student_history')) {
    console.log('[migration] 004_student_history — running…');
    db.transaction(() => {
      // 1. Create student_group_history
      db.exec(`
        CREATE TABLE IF NOT EXISTS student_group_history (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id),
          group_id   INTEGER NOT NULL REFERENCES groups(id),
          start_date TEXT    NOT NULL DEFAULT (date('now')),
          end_date   TEXT    DEFAULT NULL,
          status     TEXT    NOT NULL DEFAULT 'active',
          notes      TEXT,
          created_at TEXT    DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_sgh_student ON student_group_history(student_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_sgh_group   ON student_group_history(group_id)');

      // 2. Add status column to students (active / frozen / archived)
      const cols = db.prepare('PRAGMA table_info(students)').all();
      if (!cols.some(c => c.name === 'status')) {
        db.exec("ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'active'");
        // Sync from is_active
        db.exec("UPDATE students SET status = 'archived' WHERE is_active = 0");
        db.exec("UPDATE students SET status = 'active'   WHERE is_active = 1");
      }

      // 3. Backfill history for existing active students that have a group
      const existing = db.prepare('SELECT COUNT(*) as c FROM student_group_history').get();
      if (existing.c === 0) {
        db.exec(`
          INSERT INTO student_group_history (student_id, group_id, start_date, status)
          SELECT id, group_id, COALESCE(start_date, date('now')), 'active'
          FROM students
          WHERE group_id IS NOT NULL AND is_active = 1
        `);
      }

      record.run(4, '004_student_history');
    })();
    console.log('[migration] 004_student_history — done ✓');
  }
  // ── Migration 005: leads table ────────────────────────────────────────────
  if (!hasRun.get('005_leads_table')) {
    console.log('[migration] 005_leads_table — running…');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS leads (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          name            TEXT    NOT NULL,
          phone           TEXT    NOT NULL,
          email           TEXT,
          source          TEXT    DEFAULT 'other',
          status          TEXT    DEFAULT 'new',
          course_interest TEXT,
          notes           TEXT,
          assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
          follow_up_date  TEXT,
          created_at      TEXT    DEFAULT (datetime('now')),
          updated_at      TEXT    DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)');
      record.run(5, '005_leads_table');
    })();
    console.log('[migration] 005_leads_table — done ✓');
  }

  // ── Migration 007: freeze_until + archived_at + activity_log ─────────────
  if (!hasRun.get('007_activity_log')) {
    console.log('[migration] 007_activity_log — running…');
    db.transaction(() => {
      const cols = db.prepare('PRAGMA table_info(students)').all();

      if (!cols.some(c => c.name === 'freeze_until')) {
        db.exec('ALTER TABLE students ADD COLUMN freeze_until TEXT DEFAULT NULL');
      }
      if (!cols.some(c => c.name === 'archived_at')) {
        db.exec('ALTER TABLE students ADD COLUMN archived_at TEXT DEFAULT NULL');
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          action            TEXT    NOT NULL,
          entity_type       TEXT    NOT NULL DEFAULT 'student',
          entity_id         INTEGER,
          entity_name       TEXT,
          details           TEXT,
          performed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
          performed_by_name TEXT,
          created_at        TEXT    DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_entity  ON activity_log(entity_type, entity_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_students_status       ON students(status)');

      record.run(7, '007_activity_log');
    })();
    console.log('[migration] 007_activity_log — done ✓');
  }

  // ── Migration 008: lessons + lesson_students (per-lesson teacher earnings) ─
  if (!hasRun.get('008_lessons_earnings')) {
    console.log('[migration] 008_lessons_earnings — running…');
    db.transaction(() => {
      // Add lessons_per_month to groups so admin can set schedule density
      const groupCols = db.prepare('PRAGMA table_info(groups)').all();
      if (!groupCols.some(c => c.name === 'lessons_per_month')) {
        db.exec('ALTER TABLE groups ADD COLUMN lessons_per_month INTEGER DEFAULT 20');
      }

      // lessons: one record per group session (date + group = unique lesson slot)
      db.exec(`
        CREATE TABLE IF NOT EXISTS lessons (
          id                      INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id                INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          teacher_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          date                    TEXT    NOT NULL,
          title                   TEXT,
          status                  TEXT    NOT NULL DEFAULT 'scheduled'
                                    CHECK (status IN ('scheduled','conducted','cancelled','missed')),
          price_per_student       REAL    NOT NULL DEFAULT 0,
          notes                   TEXT,
          conducted_at            TEXT,
          created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at              TEXT    DEFAULT (datetime('now')),
          updated_at              TEXT    DEFAULT (datetime('now')),
          UNIQUE(group_id, date)
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_teacher  ON lessons(teacher_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_group    ON lessons(group_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_date     ON lessons(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_status   ON lessons(status)');

      // lesson_students: per-student attendance for each lesson
      // teacher_id denormalized = teacher who gets credit for this record (transfer-safe)
      db.exec(`
        CREATE TABLE IF NOT EXISTS lesson_students (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id      INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          teacher_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          group_id       INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          date           TEXT    NOT NULL,
          status         TEXT    NOT NULL DEFAULT 'attended'
                           CHECK (status IN ('attended','missed','excused')),
          price_earned   REAL    NOT NULL DEFAULT 0,
          is_overridden  INTEGER NOT NULL DEFAULT 0,
          override_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          override_reason TEXT,
          created_at     TEXT    DEFAULT (datetime('now')),
          updated_at     TEXT    DEFAULT (datetime('now')),
          UNIQUE(lesson_id, student_id)
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_ls_teacher   ON lesson_students(teacher_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ls_student   ON lesson_students(student_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ls_lesson    ON lesson_students(lesson_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ls_date      ON lesson_students(date)');

      record.run(8, '008_lessons_earnings');
    })();
    console.log('[migration] 008_lessons_earnings — done ✓');
  }

  // ── Migration 006: salary system ──────────────────────────────────────────
  if (!hasRun.get('006_salary_system')) {
    console.log('[migration] 006_salary_system — running…');
    db.transaction(() => {
      // Per-teacher salary configuration
      db.exec(`
        CREATE TABLE IF NOT EXISTS salary_rules (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          method           TEXT    NOT NULL DEFAULT 'percentage'
                             CHECK (method IN ('percentage','fixed','per_lesson','combined')),
          percentage       REAL    DEFAULT 30,
          fixed_amount     REAL    DEFAULT 0,
          rate_per_lesson  REAL    DEFAULT 50000,
          base_amount      REAL    DEFAULT 0,
          bonus_percentage REAL    DEFAULT 0,
          created_at       TEXT    DEFAULT (datetime('now')),
          updated_at       TEXT    DEFAULT (datetime('now'))
        )
      `);

      // Monthly salary records — one row per teacher per month/year
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_salaries (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          month                INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
          year                 INTEGER NOT NULL,
          method               TEXT    NOT NULL,
          base_amount          REAL    DEFAULT 0,
          bonus_amount         REAL    DEFAULT 0,
          deductions           REAL    DEFAULT 0,
          advance_paid         REAL    DEFAULT 0,
          final_salary         REAL    DEFAULT 0,
          lessons_count        INTEGER DEFAULT 0,
          students_total_paid  REAL    DEFAULT 0,
          status               TEXT    DEFAULT 'pending'
                                 CHECK (status IN ('pending','paid')),
          paid_date            TEXT,
          note                 TEXT,
          calculated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at           TEXT    DEFAULT (datetime('now')),
          updated_at           TEXT    DEFAULT (datetime('now')),
          UNIQUE(teacher_id, month, year)
        )
      `);

      // Cash advance requests from teachers
      db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_advances (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount              REAL    NOT NULL,
          reason              TEXT,
          request_date        TEXT    DEFAULT (date('now')),
          status              TEXT    DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected')),
          approved_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_date       TEXT,
          deduct_from_month   INTEGER,
          deduct_from_year    INTEGER,
          created_at          TEXT    DEFAULT (datetime('now'))
        )
      `);

      // Indexes for common query patterns
      db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher ON teacher_salaries(teacher_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_salaries_month   ON teacher_salaries(month, year)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_advances_teacher ON teacher_advances(teacher_id)');

      record.run(6, '006_salary_system');
    })();
    console.log('[migration] 006_salary_system — done ✓');
  }

  // ── Migration 010: user_messages (internal messaging) ────────────────────
  if (!hasRun.get('010_user_messages')) {
    console.log('[migration] 010_user_messages — running…');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_messages (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_name  TEXT    NOT NULL,
          sender_role  TEXT    NOT NULL,
          recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          subject      TEXT,
          body         TEXT    NOT NULL,
          is_read      INTEGER NOT NULL DEFAULT 0,
          created_at   TEXT    DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_messages_recipient ON user_messages(recipient_id, is_read)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_messages_sender    ON user_messages(sender_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_user_messages_created   ON user_messages(created_at DESC)');
      record.run(10, '010_user_messages');
    })();
    console.log('[migration] 010_user_messages — done ✓');
  }

  // ── Migration 009: sms_logs table ─────────────────────────────────────────
  if (!hasRun.get('009_sms_logs')) {
    console.log('[migration] 009_sms_logs — running…');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sms_logs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          message      TEXT    NOT NULL,
          recipient_type TEXT  NOT NULL DEFAULT 'custom',
          group_id     INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          total_sent   INTEGER DEFAULT 0,
          total_failed INTEGER DEFAULT 0,
          sent_by      INTEGER REFERENCES users(id)  ON DELETE SET NULL,
          sent_by_name TEXT,
          created_at   TEXT    DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at DESC)');
      record.run(9, '009_sms_logs');
    })();
    console.log('[migration] 009_sms_logs — done ✓');
  }
  // ── Migration 011: composite indexes for salary & payment queries ─────────
  if (!hasRun.get('011_composite_indexes')) {
    console.log('[migration] 011_composite_indexes — running…');
    db.transaction(() => {
      // Speed up salary calculation: teacher_id + date range filter
      db.exec('CREATE INDEX IF NOT EXISTS idx_ls_teacher_date ON lesson_students(teacher_id, date)');
      // Speed up duplicate payment check and billing queries
      db.exec('CREATE INDEX IF NOT EXISTS idx_payments_student_month ON payments(student_id, month, year)');
      // Speed up lesson queries by date + teacher combo (today lessons)
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_date_teacher ON lessons(date, teacher_id)');
      // Speed up students by group + active status
      db.exec('CREATE INDEX IF NOT EXISTS idx_students_group_active ON students(group_id, is_active)');
      record.run(11, '011_composite_indexes');
    })();
    console.log('[migration] 011_composite_indexes — done ✓');
  }

  // ── Migration 012: create superadmin account ───────────────────────────
  // SECURITY: this used to unconditionally create 'superadmin@crm.uz' with a
  // hardcoded bcrypt hash for the password "password" — meaning every fresh
  // deployment of this app, including production, got the exact same
  // publicly-known admin login with zero configuration. That's a live
  // backdoor the moment this code reaches a real server.
  //
  // In production, the account is only created if INITIAL_SUPERADMIN_EMAIL
  // and INITIAL_SUPERADMIN_PASSWORD are explicitly set in the environment
  // (see backend/.env.example and DEPLOY.md); otherwise this step is skipped
  // and a warning is logged — use `node create-admin.js` instead. Outside
  // production, the old zero-config default is kept for local dev/demo
  // convenience, matching README.md and BUG_REPORT.md.
  if (!hasRun.get('012_create_superadmin')) {
    console.log('[migration] 012_create_superadmin — running…');
    db.transaction(() => {
      const bcrypt = require('bcryptjs');
      const isProd = process.env.NODE_ENV === 'production';

      const email    = isProd ? process.env.INITIAL_SUPERADMIN_EMAIL    : 'superadmin@crm.uz';
      const password = isProd ? process.env.INITIAL_SUPERADMIN_PASSWORD : 'password';

      if (isProd && (!email || !password || password.length < 8)) {
        console.warn(
          '[migration] 012_create_superadmin — skipped: set INITIAL_SUPERADMIN_EMAIL and ' +
          'INITIAL_SUPERADMIN_PASSWORD (>=8 chars) in .env to auto-create the first admin, ' +
          'or run `node create-admin.js` to create one interactively.'
        );
        record.run(12, '012_create_superadmin');
        return;
      }

      const existingSuperadmin = db.prepare(
        'SELECT id FROM users WHERE email = ? AND role = ?'
      ).get(email, 'superadmin');

      if (!existingSuperadmin) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare(
          'INSERT INTO users (name, email, password, role, phone, subject, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run('CEO', email, hashedPassword, 'superadmin', '+998901000000', null, 1);
        console.log(`[migration] 012_create_superadmin — superadmin account created (${email}) ✓`);
      }

      record.run(12, '012_create_superadmin');
    })();
    console.log('[migration] 012_create_superadmin — done ✓');
  }
}

module.exports = { runMigrations };
