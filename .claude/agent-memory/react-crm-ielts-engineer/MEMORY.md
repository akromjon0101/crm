# EduCRM Agent Memory

## Project Stack
- React 18 + Vite, Tailwind CSS 3, NO shadcn/ui, NO Framer Motion
- API client: axios via `../services/api` (relative import)
- Auth: `useAuth()` from `../context/AuthContext` — gives `{ user, logout, loading }`
- `user.role`: 'superadmin' | 'admin' | 'teacher'

## File Writing Method
- Write tool and Bash tool may both be denied for file writes in some sessions
- Prefer Edit tool for modifying existing files (always read first — required)
- If Write/Bash are denied, use Edit tool with full replacement of old content
- `python3 << 'PYEOF' ... PYEOF` blocks work when Bash is allowed
- Node.js `node -e "require('fs').writeFileSync(...)"` also works when Bash is allowed

## Theme & Lang Contexts (added)
- ThemeContext: `/frontend/src/context/ThemeContext.jsx` — exports `ThemeProvider`, `useTheme`
  - `useTheme()` returns `{ theme, toggleTheme, isDark }`
  - Reads/writes `localStorage.getItem('theme')`, adds/removes `dark` class on `<html>`
- LangContext: `/frontend/src/context/LangContext.jsx` — exports `LangProvider`, `useLang`
  - `useLang()` returns `{ lang, setLang, t }` where `t(key)` looks up TRANSLATIONS[lang][key]
  - Supports 'en' and 'uz'; persisted in `localStorage.getItem('lang')`
  - Keys: days_short[], months[], months_short[], att_*, set_*
- Provider wrap order in App.jsx: `<ThemeProvider><LangProvider><BrowserRouter><AuthProvider>`
- Dark mode FOUC fix: inline `<script>` in index.html head reads theme from localStorage before React hydrates

## Design Conventions
- Light theme: white cards `bg-white rounded-xl border border-gray-200 p-5`
- Dark mode: use `dark:` Tailwind variants — NO inline `style={{}}` props ever
- Tailwind utility classes `card`, `btn-primary`, `btn-secondary`, `btn-danger`, `input`, `label`
- Badge classes: `badge-green`, `badge-red`, `badge-yellow`, `badge-blue`, `badge-purple`, `badge-orange`, `badge-gray`
- Tables: `<table className="tbl">` with `divide-y divide-gray-50` tbody and `.tbl th/.tbl td` classes from index.css
- Indigo theme for Payments: `#6366F1`  |  Purple theme for SalaryAdmin: `#8B5CF6`
- Status colors: green=paid, amber/yellow=partial/pending, red=unpaid/overdue
- Skeleton rows: use `.skeleton` CSS class with `animate-pulse` for loading states
- CSS animations available: `animate-fadeIn`, `animate-slideIn` (defined in index.css)

## Component Usage
- `StatCard` props: `{ title, value, subtitle, icon, color, trend }`
  - color options: green, blue, purple, orange, indigo, red, teal, cyan
  - icon = JSX SVG element
- `Modal` props: `{ open, onClose, title, children, size }` — size: sm|md|lg|xl
- `ConfirmDialog` props: `{ open, onClose, onConfirm, title, message, confirmText, variant, loading }`
- `LoadingSpinner` props: `{ text }`
- `EmptyState` props: `{ title, description, action }`

## Utility Helpers (`../utils/helpers`)
- `formatCurrency(amount, currency='UZS')` — returns "1 000 000 UZS"
- `formatDate(dateStr)` — returns dd.mm.yyyy
- `MONTH_NAMES` — English month names array [0..11]
- `MONTH_NAMES_SHORT`, `getMonthName(month)`, `getRoleBadge(role)`, `getStatusBadge(status)`

## API Patterns
- All API calls via `api.get/post/put/delete('/endpoint', { params, data })`
- Response shape: `res.data.data` (array) or `res.data` (array for rules/advances)
- Error message: `err.response?.data?.message`

## Pages Written (Payment System)
- `/pages/Payments.jsx` — 2 tabs: To'lovlar (monthly status table + quick pay modal) + Hisob-faktura (billing calc)
- `/pages/SalaryAdmin.jsx` — salary records table + collapsible rules section + advances section
- `/pages/Salary.jsx` — FULLY REWRITTEN: teacher earnings dashboard with KPI cards, today's lessons, conduct modal, daily bar chart (Cell-based coloring), history table with pagination, monthly progress bar, old salary records fallback, advances
- `/pages/LessonsPage.jsx` — NEW: teacher lessons page, month/group filter, stats strip (computed client-side), lesson cards grid, conduct modal, toast, sorted scheduled-first
- `/App.jsx` — added LessonsPage import + `/lessons` route (roles: teacher); TeacherEarnings + AdminEarnings routes already present
- `/components/layout/Sidebar.jsx` — already updated by another agent; lessons/earnings icons present; TEACHER_NAV has Lessons+Earnings; ADMIN_NAV has Lessons+Earnings+Maosh

## Pages Written (Earnings System)
- `/pages/TeacherEarnings.jsx` — teacher personal earnings dashboard:
  - Month navigator (prev/next buttons), Export CSV, 6 KPI cards (today/month/total income + lesson counts)
  - Monthly target progress bar (conditional on `monthly_target != null`, color-coded green/amber/red)
  - Recharts BarChart (daily, Cell-based coloring: today=blue-400, topDay=amber-400, regular=indigo-300, zero=gray-200)
  - Today's lessons list with "Mark Conducted" button (only shown for current month)
  - ConductModal: per-student AttToggle (attended/missed/excused), live income preview banner
  - PUT `/api/lessons/:id/conduct` with `{ attendance: [{student_id, status}] }`
  - Lesson history table: group filter + server-side pagination (histPage state)
- `/pages/AdminEarnings.jsx` — admin view of all teacher earnings:
  - Month navigator, 4 summary KPI cards (total income, teachers, lessons, students)
  - Leaderboard table: click-to-sort any column via `SortTh` component, `sortKey`+`sortDir` state
  - Top earner row: amber-tinted + gold star #1 badge via `RankBadge` component
  - Income share colored pills via `SharePill` component (violet>30%, blue>15%, green>5%, gray rest)
  - Inline `TeacherDetailPanel`: fetches `/earnings/teacher/:id`, shows 3 KPIs + daily chart + group breakdown
  - Panel toggle: `expandedTeacher` state (teacher id or null), closes on re-click or X button
- Routes added to `/App.jsx`:
  - `/earnings` → TeacherEarnings (roles: ['teacher'])
  - `/admin-earnings` → AdminEarnings (roles: ['superadmin', 'admin'])
- Sidebar icons added to ICONS object: `earnings` (bar-chart path), `lessons` (book path)
- TEACHER_NAV: added Lessons (/lessons) + My Earnings (/earnings) between Attendance and Salary
- ADMIN_NAV: added Lessons (/lessons) between Schedule and Payments; Earnings (/admin-earnings) between Analytics and Maosh

## Toast Pattern (inline, no library)
- `useToast()` hook returns `{ toasts, add }` — `add(message, type)` where type = 'success'|'error'|'info'
- Self-dismiss after 3500ms via `setTimeout` clearing by id
- `<ToastContainer toasts={toasts} />` placed at top of page JSX
- Positioned: `fixed top-4 right-4 z-50`, each toast uses `animate-slideIn`

## Recharts Patterns (confirmed)
- Use `<Cell>` inside `<Bar>` for per-bar coloring — do NOT put static `fill` on `<Bar>` when using Cell
- Always wrap in `<ResponsiveContainer width="100%" height={N}>`
- Custom tooltip: functional component checking `if (!active || !payload?.length) return null`
- Large-number Y-axis formatter: `v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? Math.round(v/1000)+'K' : v`
- Standard margin: `{{ top: 4, right: 4, bottom: 0, left: -10 }}` reclaims left padding
- `barSize={14}` for standard charts, `radius={[4,4,0,0]}` for rounded bar tops

## Students Page Patterns (confirmed in Students.jsx rewrite)
- Bulk selection uses `new Set()` state, toggled with `toggleSelect(id)` / `toggleSelectAll()`
- Indeterminate checkbox: set via `ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}`
- useDebounce hook (local, 350ms) for search inputs before API call
- Pagination: `page` + `pageSize` state; reset page to 1 on filter change
- Stats strip clickable pills filter the table by status
- Toast component: self-dismissing after 3500ms, types: success/error/info
- Floating bulk action bar: `fixed bottom-4 left-1/2 -translate-x-1/2 z-40`
- Student status: 'active' | 'frozen' | 'archived'
- Freeze modal sends `{ freeze_until?, notes? }` to PUT /students/:id/freeze
- Bulk actions: POST /students/bulk-action with `{ action, student_ids, ...extras }`
- Restore action: PUT /students/:id/restore (for archived students)

## Dashboard Patterns (Dashboard.jsx)
- date-fns v3 is installed; use `formatDistanceToNow(date, { addSuffix: true })` for time-ago
- Wrap date parsing in try/catch + isNaN check — invalid dates must not crash the feed
- Split data fetching: primary (blocks render) vs secondary (loads independently with skeleton)
- `debtors` response shape: `r.data?.data || r.data` (handles both wrapped and unwrapped)
- `notifications` response shape: same dual-unwrap pattern
- KPI cards as `<button onClick={() => navigate(...)}>` for clickable navigation
- StatusOverview: stacked horizontal bar using percentage widths, gap-0.5 between segments
- Activity type icons: transfer=blue, payment=emerald, enrollment=violet, freeze=cyan, archive=gray
- Admin check: `user?.role === 'superadmin' || user?.role === 'admin'` (not just isCEO)
- Chart year selector: offset array `[0,1,2]` mapped to `getFullYear() - offset`
- `stats.total_teachers` field used directly (no separate teacher-performance API needed in dashboard)
- `activeCount` falls back: `stats?.active_students ?? stats?.total_students ?? 0`
- Dashboard routing: teacher → TeacherDashboard | superadmin → CeoDashboard | admin → AdminDashboard
- CeoDashboard (lines ~924-1618): FULLY REWRITTEN — 6-section layout:
  1. Alert banner (red/amber gradient, conditional on debtorCount>0 OR collectionRate<70)
  2. Page header ("Executive Overview") + Analytics/Earnings/Payments nav buttons
  3. Primary KPI row (grid-cols-2 lg:grid-cols-4): Revenue, Payroll, Net Profit, Collection Rate — each has colored top accent bar `absolute top-0 left-0 right-0 h-1 bg-{color}-500`
  4. Secondary metrics row (grid-cols-3): Students (active/frozen breakdown + stacked bar), Groups+Teachers (split card), Year Performance (YTD + YoY)
  5. Charts row (xl:col-span-3 + xl:col-span-2): Revenue AreaChart with year selector + Top Debtors list
  6. Financial row (xl:col-span-3 + xl:col-span-2): Payroll table with income bars + Payment Status (thick h-4 bar + stat rows)
- CeoDashboard fetches: 3 parallel in primary effect (dashboard, income-chart current year, income-chart prev year); 2 parallel in secondary (earnings/overview, payments/debtors)
- prevIncomeData state added for YoY comparison; yoyGrowth derived from prevYearTotal
- monthGrowth derived by finding `incomeData.find(d => d.month === currentMonth - 1)?.total`
- collectionColor is now an object `{ bar, text, bg, border }` not a plain string
- payrollMax used for proportional income bars in teacher table
- debtorCount fallback: `stats?.debtors ?? debtors.length ?? 0`
- CeoDashboard uses gradient ID `ceoRevGrad` (not `revGrad`) to avoid SVG defs collision
- Stacked bar percentages: paidPct + debtorPct; pendingPct = Math.max(0, 100 - paidPct - debtorPct)
- Payment Status section uses icon rows (present/clock/absent icons) not pills

## Routing (App.jsx)
- ProtectedRoute wraps Layout; roles array restricts access
- `'/'` route renders `<RootPage />` — a role dispatcher: teacher → TeacherDashboard, others → Dashboard
- Teacher-only: `/earnings`, `/lessons` (`/salary` route still exists but removed from teacher sidebar nav)
- Admin-only: `/salary-admin`, `/payments`, `/analytics`, `/admin-earnings`, etc.

## Sidebar
- Sidebar is at `/components/layout/Sidebar.jsx` (NOT `/components/Sidebar.jsx`)
- TEACHER_NAV: dashboard, groups, attendance, lessons, earnings, settings (6 items — `/salary` removed)
- Icons defined as path strings in ICONS object, rendered via `<Ic d={ICONS[key]} />`
- Active state: NavLink className isActive => 'sidebar-link active'

## TeacherDashboard (`/pages/TeacherDashboard.jsx`)
- Created 2026-04-11; teacher-specific home page shown at '/' for role='teacher'
- Sections: greeting header (Uzbek day/date), 4 KPI cards, today's lessons grid, quick-action links, monthly progress bar
- APIs: `GET /lessons/today` + `GET /earnings/my?month=&year=` fetched in parallel on mount
- Today lessons re-fetched individually after conduct success (no full reload)
- Inline ConductModal matches LessonsPage pattern: attended/missed/excused text buttons, income preview
- Monthly progress bar: only shown when `earnings.monthly_target != null`
- Progress bar color: green>=100%, indigo>=60%, amber<60%

Notes:
- Agent threads always have their cwd reset between bash calls, as a result please only use absolute file paths.
- In your final response always share relevant file names and code snippets. Any file paths you return in your response MUST be absolute. Do NOT use relative paths.
- For clear communication with the user the assistant MUST avoid using emojis.
- Do not use a colon before tool calls. Text like "Let me read the file:" followed by a read tool call should just be "Let me read the file." with a period.
