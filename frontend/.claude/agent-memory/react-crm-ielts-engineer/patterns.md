# Recurring Patterns & Fixes

## Dark Mode Migration Pattern

### Problem
Files use a static `const T = { ... }` object with hardcoded light hex colors. Sub-components are defined at module scope and use `T` directly. `HISTORY_STATUS` / similar config objects also carry hardcoded light backgrounds.

### Solution (applied in StudentProfile.jsx)

1. Add `import { useTheme } from '../context/ThemeContext';`
2. Replace `const T = { ... }` with a factory:
   ```js
   const getTokens = (isDark) => ({ ... dark : light values ... });
   ```
3. Replace `const HISTORY_STATUS = { ... }` with:
   ```js
   const getHistoryStatus = (isDark) => ({ ... });
   ```
4. In the main component body (after hooks):
   ```js
   const { isDark } = useTheme();
   const T = getTokens(isDark);
   const HISTORY_STATUS = getHistoryStatus(isDark);
   ```
5. Module-scope sub-components (e.g. `TimelineEntry`) cannot call hooks — add `T` and `HISTORY_STATUS` as explicit props and pass them from the parent.
6. For inline `style={{ color, background }}` "Current" badges and similar: use `T.blue` and a conditional `isDark ? 'rgba(...)' : '#HEXHEX'`.
7. Sweep all Tailwind classes in JSX and add `dark:` variants per the conventions in MEMORY.md.

### Key Rule
Never hoist `useTheme()` calls outside a React function component or custom hook. Always pass derived token objects down as props to module-scope sub-components.
