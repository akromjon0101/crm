# Agent Memory — React CRM Frontend

## Project Structure
- Working directory: `/Users/akromjon/Desktop/crm/frontend`
- Pages live in `src/pages/`, context in `src/context/`, shared components in `src/components/common/`

## Theme System
- `ThemeContext` at `src/context/ThemeContext.jsx` exports `{ theme, toggleTheme, isDark }` via `useTheme()`
- `isDark` is a boolean: `true` when `theme === 'dark'`
- The `.dark` class is toggled on `document.documentElement` — Tailwind `dark:` variants work via class strategy
- Import: `import { useTheme } from '../context/ThemeContext';`

## Dark-Mode Token Pattern (confirmed in StudentProfile)
- Static design-token objects must be replaced with `getTokens(isDark)` factory functions called inside the component body
- Sub-components defined outside the main component (e.g. `TimelineEntry`) cannot call hooks directly — pass `T` and theme-dependent config as props
- `HISTORY_STATUS` and similar config objects that contain colors must follow the same factory pattern: `getHistoryStatus(isDark)`
- Inline `style={{}}` props use JS values from `T`; Tailwind `dark:` variants handle class-based elements

## Tailwind Dark Variant Conventions
- Labels / secondary text: `text-gray-400 dark:text-slate-500`
- Primary text / headings: `text-gray-900 dark:text-slate-100`
- Body text: `text-gray-700 dark:text-slate-300` | `text-gray-600 dark:text-slate-400`
- Muted / caption text: `text-gray-500 dark:text-slate-400`
- Borders: `border-gray-100 dark:border-slate-700/60` | `border-gray-200 dark:border-slate-700` | `divide-gray-50 dark:divide-slate-700/40`
- Table/card header bg: `bg-gray-50 dark:bg-slate-800/50`
- Note card backgrounds: `bg-gray-50 dark:bg-slate-800/50`
- Row hover: `hover:bg-gray-50 dark:hover:bg-slate-700/30`
- Green amounts: `text-emerald-600 dark:text-emerald-400`
- Red amounts: `text-red-600 dark:text-red-400`
- Primary accent: `text-primary-600 dark:text-primary-400` | `bg-primary-100 dark:bg-primary-900/30`
- Inline bg-white panels (tooltips, dropdowns, modals): `bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700`
- Inline colored bg boxes: replace `style={{ background: '#hex' }}` with Tailwind `bg-[#hex] dark:bg-color/20`
- Debtor/status card borders: `border-red-200 dark:border-red-800/60 bg-red-50/40 dark:bg-red-900/10`

## Component Conventions
- Shared UI primitives: `Modal`, `ConfirmDialog`, `LoadingSpinner` in `src/components/common/`
- CSS utility classes `btn-primary`, `btn-secondary`, `btn-success`, `btn-sm`, `badge-green`, `badge-red`, `badge-blue`, `badge-yellow`, `badge-gray`, `card`, `input`, `label` — these are global classes (not per-file)
- `InfoRow` is a local micro-component pattern: label + value with dark variants

## See Also
- `patterns.md` — for recurring fix patterns
