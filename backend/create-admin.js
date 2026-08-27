/**
 * create-admin.js - create a superadmin account.
 *
 * The safe way to bootstrap (or add) an admin login on a real deployment -
 * unlike seed.js, this never touches students/groups/payments/etc., and
 * unlike the old migration default, it never falls back to a hardcoded
 * password.
 *
 * Usage:
 *   node create-admin.js                     (interactive prompts, hidden password)
 *   printf 'Name\nemail@x.com\npass\npass\n' | node create-admin.js   (scripted/CI use)
 */
const readline = require('readline');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'crm.db');

const isTTY = process.stdin.isTTY;

// Raw single-byte control characters, built with String.fromCharCode (never
// typed literally) so nothing invisible is hiding in the source file itself.
const CTRL_D = String.fromCharCode(4);   // EOF
const CTRL_C = String.fromCharCode(3);   // interrupt
const DEL    = String.fromCharCode(127); // backspace (most terminals)
const BS     = String.fromCharCode(8);   // backspace (older terminals)

// ── Interactive (real terminal) mode ────────────────────────────────────────
const rl = isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const askTTY = (q) => new Promise((resolve) => rl.question(q, resolve));

const askHiddenTTY = (q) => new Promise((resolve) => {
  process.stdout.write(q);
  let input = '';
  const stdin = process.stdin;
  const onData = (buf) => {
    const char = buf.toString('utf8');
    if (char === '\n' || char === '\r' || char === CTRL_D) {
      stdin.setRawMode(false);
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(input);
      return;
    }
    if (char === CTRL_C) process.exit(1);
    if (char === DEL || char === BS) { input = input.slice(0, -1); return; }
    input += char;
  };
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', onData);
});

// ── Non-interactive (piped input) mode ──────────────────────────────────────
// readline auto-closes on EOF and silently stops answering further
// .question() calls afterwards, so for piped/scripted use we instead read
// the whole stream up front and consume it line by line ourselves.
const readAllStdinLines = () => new Promise((resolve, reject) => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => resolve(data.split('\n')));
  process.stdin.on('error', reject);
});

async function main() {
  console.log('EduCRM - create a superadmin account\n');

  const db = new Database(DB_PATH);

  let name, email, password, confirm;

  if (isTTY) {
    name = (await askTTY('Name: ')).trim();
    email = (await askTTY('Email: ')).trim().toLowerCase();

    if (!name || !email || !email.includes('@')) {
      console.error('\nName and a valid email are required.');
      process.exit(1);
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      console.error(`\nA user with email ${email} already exists (id ${existing.id}). Aborting.`);
      process.exit(1);
    }

    password = await askHiddenTTY('Password (min 8 chars, hidden): ');
    confirm  = await askHiddenTTY('Confirm password: ');
  } else {
    const lines = await readAllStdinLines();
    [name, email, password, confirm] = lines.map((l) => (l || '').trim());
    name = name || '';
    email = (email || '').toLowerCase();

    if (!name || !email || !email.includes('@')) {
      console.error('Name and a valid email are required (expected 4 lines: name, email, password, confirm).');
      process.exit(1);
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      console.error(`A user with email ${email} already exists (id ${existing.id}). Aborting.`);
      process.exit(1);
    }
  }

  if (!password || password.length < 8) {
    console.error('\nPassword must be at least 8 characters.');
    process.exit(1);
  }
  if (confirm !== password) {
    console.error('\nPasswords did not match.');
    process.exit(1);
  }

  const hashed = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'superadmin', 1)`
  ).run(name, email, hashed);

  console.log(`\nSuperadmin created: ${email}`);
  db.close();
  if (rl) rl.close();
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
