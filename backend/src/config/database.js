const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../crm.db');

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

// Initialize schema if DB is new
const initSchema = () => {
  const schemaPath = path.join(__dirname, '../../../database/schema_sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('✅ Database schema initialized');
  }
};

initSchema();

// Run incremental migrations (idempotent — safe to call every startup)
const { runMigrations } = require('./migrations');
runMigrations(db);

module.exports = { query, getClient, db };
