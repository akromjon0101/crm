# UI/UX Designer Memory — EduCRM

## Design System (ClickUp AI Brain Dark Theme)

**Established March 2026** — Full dark glassmorphism redesign.

### Color Tokens
- Background:     `#09090F` (deepest), `#0F0F1E` (alt), `#0D0D1C` (sidebar)
- Surface cards:  `rgba(255,255,255,0.03)` with `border: 1px solid rgba(255,255,255,0.08)`
- Primary:        `#7C3AED` (purple), gradient `135deg #7C3AED → #5B21B6`
- Primary glow:   `rgba(124,58,237,0.3)`
- Text:           `#E2E8F0` (main), `#94A3B8` (mid), `#475569` (muted), `#CBD5E1` (secondary)

### Component Patterns
- **Cards**: glassmorphism — `backdrop-blur(20px)`, `rgba(255,255,255,0.03)` bg, `border-radius: 14px`
- **Buttons primary**: `linear-gradient(135deg, #7C3AED, #5B21B6)` + `box-shadow: 0 4px 15px rgba(124,58,237,0.35)`
- **Buttons secondary**: `rgba(255,255,255,0.05)` bg, `rgba(255,255,255,0.1)` border
- **Inputs**: `rgba(255,255,255,0.04)` bg, focus ring `rgba(124,58,237,0.2)`, `border-radius: 10px`
- **Active nav link**: gradient bg + `inset 3px 0 0 #7C3AED` box-shadow + purple border
- **Sidebar**: `#0D0D1C` bg, `border-right: 1px solid rgba(255,255,255,0.06)`
- **Header**: `rgba(9,9,15,0.85)` + `backdrop-filter: blur(20px)` frosted glass

### Badges (dark semi-transparent)
All badges use `rgba(color, 0.12)` bg + `rgba(color, 0.2)` border. See index.css.

### StatCard Colors
Purple/Green/Blue/Orange/Indigo/Red/Teal/Cyan — each has gradient icon + glow + top color stripe.

### Key Files
- `/frontend/src/index.css` — design tokens + all component classes
- `/frontend/src/components/layout/Sidebar.jsx`
- `/frontend/src/components/layout/Header.jsx`
- `/frontend/src/components/common/StatCard.jsx`
- `/frontend/tailwind.config.js` — primary now violet #7C3AED

### Animation Standards
- Transitions: `0.2s ease` (hover), `0.15s ease` (micro)
- Entrance: `fadeIn 0.2s ease-out` / `slideIn 0.2s ease-out`
- Skeleton shimmer: `shimmer 1.6s infinite ease-in-out`

### Scrollbar
`rgba(124,58,237,0.3)` thumb, hover `rgba(124,58,237,0.5)`, 4px width

### User Preferences
- Inline styles preferred for one-off values, CSS classes for reusable patterns
- No new dependencies — pure CSS + Tailwind + inline styles only
- Keep all existing logic/imports intact when redesigning components
