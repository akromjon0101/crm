/**
 * schedule.js — ONE place for all schedule-related logic.
 * Schedule format in DB: "1,3,5|09:00-10:30"
 *   days  → comma-separated weekday numbers (1=Mon … 6=Sat)
 *   time  → "HH:MM-HH:MM" (optional)
 */

export const ALL_DAYS = [
  { id: 1, short: 'Mon', long: 'Monday'    },
  { id: 2, short: 'Tue', long: 'Tuesday'   },
  { id: 3, short: 'Wed', long: 'Wednesday' },
  { id: 4, short: 'Thu', long: 'Thursday'  },
  { id: 5, short: 'Fri', long: 'Friday'    },
  { id: 6, short: 'Sat', long: 'Saturday'  },
];

export const ODD_DAYS  = [1, 3, 5]; // Mon / Wed / Fri
export const EVEN_DAYS = [2, 4, 6]; // Tue / Thu / Sat

/**
 * Parse a schedule string into structured data.
 * @param {string|null} schedule
 * @returns {{ days: number[], startTime: string, endTime: string, timeStr: string }}
 */
export function parseSchedule(schedule) {
  if (!schedule) return { days: [], startTime: '', endTime: '', timeStr: '' };
  const [daysStr = '', timeStr = ''] = schedule.split('|');
  const days = daysStr
    .split(',')
    .map(Number)
    .filter((n) => n >= 1 && n <= 6);
  const [startTime = '', endTime = ''] = timeStr.split('-');
  return { days, startTime, endTime, timeStr };
}

/**
 * Human-readable day labels: "Mon · Wed · Fri"
 */
export function formatDayLabels(days) {
  return days
    .map((d) => ALL_DAYS.find((x) => x.id === d)?.short)
    .filter(Boolean)
    .join(' · ');
}

/**
 * Count how many times the given schedule days appear in a month.
 * @param {number[]} scheduleDays  weekday numbers (1=Mon…6=Sat)
 * @param {number}   year
 * @param {number}   month         1-based
 */
export function countLessonDays(scheduleDays, year, month) {
  if (!scheduleDays.length) return 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const jsDay = new Date(year, month - 1, d).getDay(); // 0=Sun … 6=Sat
    if (scheduleDays.includes(jsDay)) count++;
  }
  return count;
}

/**
 * Build daily bar-chart data for a set of groups in a given month.
 * Returns array of { day: number, lessons: number } for days that have lessons.
 */
export function buildDailyChart(groups, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const map = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const jsDay = new Date(year, month - 1, d).getDay();
    let count = 0;
    groups.forEach((g) => {
      const { days } = parseSchedule(g.schedule);
      if (days.includes(jsDay)) count++;
    });
    if (count > 0) map[d] = count;
  }
  return Object.entries(map).map(([d, lessons]) => ({ day: Number(d), lessons }));
}

/**
 * Determine if a group is active on odd days, even days, or mixed.
 */
export function getScheduleType(schedule) {
  const { days } = parseSchedule(schedule);
  if (!days.length) return 'none';
  const isOdd  = days.every((d) => ODD_DAYS.includes(d));
  const isEven = days.every((d) => EVEN_DAYS.includes(d));
  if (isOdd)  return 'odd';
  if (isEven) return 'even';
  return 'mixed';
}
