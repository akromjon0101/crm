# CRM Backend — Agent Memory

## Stack
- Runtime: Node.js + Express (no NestJS)
- DB: SQLite via `better-sqlite3`, wrapped in async `query()` helper
- Auth: JWT Bearer tokens, `authenticate` + `authorize(...roles)` middleware
- No ORM — raw SQL only

## Key Files
- `backend/src/config/database.js` — `query(sql, params)` helper (pg-compatible $N → ? rewrite)
- `backend/src/config/migrations.js` — idempotent migration runner, last migration is 006
- `backend/src/app.js` — route registration
- `backend/src/middleware/auth.js` — `authenticate`, `authorize`

## query() Behaviour (critical)
- SELECT / WITH → `stmt.all()` → returns `{ rows }`
- INSERT/UPDATE/DELETE → `stmt.run()` → returns `{ rows: [], rowCount, lastInsertRowid }`
- Statements containing `RETURNING` are treated as SELECT-like → returns `{ rows }` with the returned rows
- `INSERT OR REPLACE` does NOT contain RETURNING so it returns `{ rows: [] }` — always do a follow-up SELECT after INSERT OR REPLACE to get the saved row
- Parameters use `?` placeholders; the helper auto-converts `$1`/`$2` style if needed

## Migration Pattern
```js
if (!hasRun.get('00N_name')) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS ...`);
    record.run(N, '00N_name');
  })();
}
```
- All DDL goes inside a transaction
- `record.run(id, name)` inserts into `_migrations` — id must be unique integer

## Controller Style
- `const { query } = require('../config/database')`
- `try/catch` everywhere, `console.error('[fnName]', err)`, `res.status(500).json({ message: 'Server error' })`
- Build dynamic WHERE with `let conditions = 'WHERE 1=1'` + param array
- Role-based data scoping inside controller (teacher sees own data only)
- Use `RETURNING *` on INSERT/UPDATE to get back the saved row in one round-trip
- `res.status(201)` on POST creation, `res.json()` on everything else

## Auth Roles
`superadmin`, `admin`, `teacher` — `authorize('superadmin','admin')` for write operations

## Salary System (added 2026-03)
Tables: `salary_rules`, `teacher_salaries`, `teacher_advances`
Routes: `backend/src/routes/salary.js` → mounted at `/api/salary`
Controller: `backend/src/controllers/salaryController.js`
- Salary methods: `percentage` | `fixed` | `per_lesson` | `combined`
- `calculateSalary` loops teachers, queries attendance + payments, uses INSERT OR REPLACE + follow-up SELECT
- Advances are deducted from gross salary during calculation
- strftime('%m') returns zero-padded '01'..'12' — always pad2() month before comparison

## Payments — getStudentMonthlyStatus (added 2026-03)
- Route: `GET /api/payments/monthly-status?month&year&group_id`
- pay_status computed in JS: paid / partial / unpaid
- Registered in `backend/src/routes/payments.js` BEFORE the `/:id` wildcard to avoid route shadowing

## See Also
- `patterns.md` for detailed coding patterns (to be created as needed)
