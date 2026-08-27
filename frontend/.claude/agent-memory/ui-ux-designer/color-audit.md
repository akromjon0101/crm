# EduCRM Color Audit & Palette Plan

## Current State Audit

### Color Conflicts Found
1. Sidebar accent: #7C3AED (violet) vs Primary token: #2563EB (blue) — HARD MISMATCH
2. Header Admin role badge: bg-blue-600 — should be violet if primary shifts
3. Dashboard SH (section header) links: text-indigo-600 — not using primary token
4. Dashboard activity config uses bg-blue-50 for transfers — ad-hoc, not tokenized
5. 82 instances of raw bg-blue-*/text-blue-* across pages instead of primary token
6. StatCard `blue` color option still points to #2563EB
7. Header Settings active state: bg-blue-50/border-blue-200 — uses blue directly
8. LoadingSpinner: border-t-primary-600 (correct token) but dark:border-t-violet-500 (inconsistent)

### Recommended Resolution: SHIFT PRIMARY TO VIOLET
Rationale: The sidebar (always visible) is the dominant chrome element.
Violet is already used for logo, avatar gradient, active nav, CEO role badge.
Blue has no structural anchor — it is purely incidental.

## Recommended Color Palette

### Primary (Violet — replaces Blue)
primary-50:  #F5F3FF
primary-100: #EDE9FE
primary-200: #DDD6FE
primary-300: #C4B5FD
primary-400: #A78BFA
primary-500: #8B5CF6
primary-600: #7C3AED  ← main action color (was #2563EB)
primary-700: #6D28D9
primary-800: #5B21B6
primary-900: #4C1D95

### Semantic Colors (unchanged)
success: #16A34A (green-600 — slightly deeper than current #22C55E for better contrast)
danger:  #DC2626 (red-600 — consistent with current #EF4444 family)
warning: #D97706 (amber-600 — slightly deeper for contrast)
info:    #0284C7 (sky-600 — replaces blue for informational only)

### Surface (Light Mode)
bg:         #FFFFFF
bg-alt:     #F8F7FF  ← very slight violet tint (replaces #F9FAFB)
border:     #E4E2F0  ← slight violet tint (replaces #E5E7EB)
border-sub: #F0EEF9  ← very light (replaces #F3F4F6)
text:       #111827
text-mid:   #6B7280
text-light: #9CA3AF

### Surface (Dark Mode)
bg:         #1E1B2E  ← violet-tinted dark (replaces #1E293B)
bg-alt:     #13111F  ← deeper violet dark (replaces #0F172A)
border:     #2D2A42  ← violet-tinted border (replaces #334155)
border-sub: #1E1B2E  ← same as bg
text:       #F1F5F9
text-mid:   #94A3B8
text-light: #64748B

### Sidebar (unchanged — already correct)
bg:        #0D0D1C
active-bg: linear-gradient(135deg, rgba(124,58,237,0.22), rgba(91,33,182,0.14))
active-fg: #A78BFA
accent:    #7C3AED

## CSS Variable Changes Required (index.css :root)
--color-primary: #7C3AED;   (was #2563EB)
--color-bg-alt:  #F8F7FF;   (was #F9FAFB)
--color-border:  #E4E2F0;   (was #E5E7EB)

## Tailwind Config Changes Required (tailwind.config.js)
primary.600: #7C3AED  (was #2563EB)
(full remap of primary scale to violet)

## Badge Color Strategy
badge-blue  → keep for "frozen" student status (semantic blue = cool/frozen)
badge-purple → already violet, now matches primary
New: badge-primary = alias for badge-purple (add to index.css)
