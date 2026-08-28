const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Honor DB_PATH from .env (useful on a VPS to keep the database file outside
// the deployed code directory, e.g. /var/lib/educrm/crm.db, so redeploys and
// `git pull` never risk touching it). Falls back to the historical location.
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../crm.db');

// better-sqlite3 throws if the parent directory doesn't exist yet — create it
// so a custom DB_PATH (e.g. a fresh /var/lib/educrm/) doesn't need a manual
// mkdir before the first run.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// pg-compatible async query wrapper
// Converts $1,$2... params to SQLite ? params
const query = async (text, params = []) => {
  try {
    // Replace $1, $2, ... with ?
    const sql = text.replace(/\$\d+/g, '?');
    const upper = sql.trim().toUpperCase();
    const stmt = db.prepare(sql);

    const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
    const hasReturning = upper.includes('RETURNING');

    if (isSelect || hasReturning) {
      const rows = stmt.all(...(params || []));
      return { rows };
    } else {
      const info = stmt.run(...(params || []));
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    throw err;
  }
};

const getClient = () => ({ query, release: () => {} });

// Initialize schema if DB is new.
// This file lives inside backend/ (not the repo-root database/ folder) on
// purpose — some deploy platforms (e.g. Railway with Root Directory set to
// "backend") only ship the backend/ subtree to the running container, so a
// path reaching outside it silently doesn't exist there, initSchema() would
// no-op, and every migration after it fails with "no such table: ...".
const initSchema = () => {
  const schemaPath = path.join(__dirname, '../../database/schema_sqlite.sql');
  if (!fs.existsSync(schemaPath)) {
    // Fail loudly rather than silently booting with an empty database —
    // that failure mode is much harder to diagnose (see the note above).
    throw new Error(`Schema file not found at ${schemaPath}. The app cannot start without it.`);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('✅ Database schema initialized');
};

initSchema();

// Run incremental migrations (idempotent — safe to call every startup)
const { runMigrations } = require('./migrations');
runMigrations(db);

module.exports = { query, getClient, db };
