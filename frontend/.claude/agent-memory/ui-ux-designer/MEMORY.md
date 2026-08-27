# EduCRM UI/UX Designer Memory

## Project Overview
- React + Tailwind CSS CRM app for learning centers
- Files: `/Users/akromjon/Desktop/crm/frontend/src`
- Global CSS: `src/index.css` (CSS vars + @layer components)
- Tailwind config: `tailwind.config.js`

## Established Color Situation (as of 2026-03-26)
- Sidebar accent: `#7C3AED` (violet-600) — DARK background `#0D0D1C`
- Primary token: `#2563EB` (blue-600) — MISMATCH with sidebar
- Recommendation: migrate primary to violet `#7C3AED` family
- See `color-audit.md` for full token plan

## Key Files
- Design tokens: `src/index.css` `:root` and `.dark` blocks
- Tailwind tokens: `tailwind.config.js` `theme.extend.colors`
- Global components: `.btn-primary`, `.btn-secondary`, `.card`, `.input`, `.badge-*`, `.tbl`
- StatCard: `src/components/common/StatCard.jsx`
- Sidebar: `src/components/layout/Sidebar.jsx`
- Header: `src/components/layout/Header.jsx`

## Patterns & Conventions
- Border radius: `--radius: 6px` globally, cards use `10px`, login uses `rounded-3xl`
- Font: Inter
- Shadow: `shadow-modal: 0 16px 48px rgba(0,0,0,0.12)`
- Dark mode: `darkMode: 'class'` on `html` element
- All component classes defined in `@layer components` in `index.css`
- StatCard uses `borderTop: 3px solid {color}` accent pattern

## Design Debt Identified
- `primary` token = blue but sidebar = violet → visual split
- 82+ blue utility class instances across pages (not using token)
- StatCard uses raw hex border colors, not CSS vars
- Header admin role badge hardcoded `bg-blue-600`
- Login page uses blue/violet gradient — partially aligned
- `focus:ring-primary-600/10` and `focus:border-primary-600` in `.input` — will auto-fix if primary token changes
