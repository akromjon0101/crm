/**
 * billingCalculator.js
 *
 * Pure billing calculation for monthly tuition fees.
 * No I/O, no side effects — safe to unit-test in isolation.
 *
 * RULES
 * ─────
 * • Each month has a fixed fee that covers up to maxLessons (default 12) lessons.
 * • If a student accrues maxConsecutiveAbsences ≥ minAbsences (default 4) in a row,
 *   a per-lesson discount is applied.
 * • Freeze days are transparent: they do not count as absences and do not reset the streak.
 * • Late can be treated as present (lateWeight=0) or as a fractional absence (e.g. 0.5).
 * • finalFee cannot fall below minimumPayment (default: 50 % of monthlyFee).
 * • finalFee is always ≥ 0.
 */

/**
 * @typedef {Object} BillingConfig
 * @property {number} [maxLessons=12]     - Lessons included in the monthly fee (>12 are free)
 * @property {number} [minAbsences=4]     - Consecutive absences needed to trigger the discount
 * @property {number} [minFeeRatio=0.5]   - Minimum payable fraction of monthlyFee (0 – 1)
 * @property {number} [lateWeight=0]      - 0 = late treated as present; 0.5 = half-absence; 1 = full
 */

/**
 * @typedef {Object} BillingResult
 * @property {number}  monthlyFee             - Original monthly fee
 * @property {number}  lessonPrice            - Fee per lesson (floor(monthlyFee / maxLessons))
 * @property {number}  lessonsCount           - Number of real lessons this month (≤ maxLessons)
 * @property {number}  consecutiveAbsences    - Streak at the END of the period
 * @property {number}  maxConsecutiveAbsences - Longest consecutive-absence run (drives discount)
 * @property {number}  discount               - Total discount amount
 * @property {number}  finalFee               - Amount the student owes (after discount & floor)
 * @property {number}  minimumPayment         - Absolute floor (50 % of monthlyFee by default)
 * @property {boolean} discountApplied        - Whether the discount threshold was reached
 */

/**
 * Calculate billing for one student for one month.
 *
 * @param {Object}   params
 * @param {number}   params.monthlyFee          - Fixed monthly fee (e.g. 200_000)
 * @param {string[]} params.attendanceStatuses  - Ordered lesson statuses for the month.
 *                                               Accepted values: 'present' | 'absent' | 'late' | 'freeze'
 * @param {BillingConfig} [params.config]       - Optional overrides
 * @returns {BillingResult}
 */
function calculateBilling({ monthlyFee, attendanceStatuses, config = {} }) {
  // ── Validate inputs ────────────────────────────────────────────────────────
  if (typeof monthlyFee !== 'number' || monthlyFee <= 0) {
    throw new Error('monthlyFee must be a positive number');
  }
  if (!Array.isArray(attendanceStatuses)) {
    throw new Error('attendanceStatuses must be an array');
  }

  const {
    maxLessons  = 12,
    minAbsences = 4,
    minFeeRatio = 0.5,
    lateWeight  = 0,   // 0 = ignored, 0.5 = half absence, 1 = full absence
  } = config;

  // maxLessons feeds a division below (lessonPrice) — guard so a caller-supplied
  // 0 (or negative) config can never produce Infinity/NaN billing results.
  if (typeof maxLessons !== 'number' || maxLessons <= 0) {
    throw new Error('config.maxLessons must be a positive number');
  }

  // ── Derived constants ──────────────────────────────────────────────────────
  // Floor so we always deal in whole currency units.
  const lessonPrice    = Math.floor(monthlyFee / maxLessons);
  const minimumPayment = Math.round(monthlyFee * minFeeRatio);

  // ── Step 1: strip freeze days, then cap at maxLessons ─────────────────────
  // Freeze days are skipped entirely — they neither accumulate nor reset the streak.
  const activeLessons = attendanceStatuses
    .filter(s => s !== 'freeze')
    .slice(0, maxLessons);

  // ── Step 2: walk lessons, track consecutive absence streaks ───────────────
  let currentStreak          = 0;   // running streak (may be fractional with lateWeight)
  let maxConsecutiveAbsences = 0;   // longest integer streak

  for (const status of activeLessons) {
    switch (status) {
      case 'absent':
        currentStreak += 1;
        break;

      case 'late':
        if (lateWeight === 0) {
          // Treat as present → reset streak
          currentStreak = 0;
        } else {
          // Contribute lateWeight (0.5 or 1) to the streak without resetting it
          currentStreak += lateWeight;
        }
        break;

      case 'present':
      default:
        currentStreak = 0;
        break;
    }

    // Track the maximum reached so far (integer floor, so 2 × late(0.5) = 1 counted)
    if (Math.floor(currentStreak) > maxConsecutiveAbsences) {
      maxConsecutiveAbsences = Math.floor(currentStreak);
    }
  }

  const consecutiveAbsences = Math.floor(currentStreak); // streak at period end

  // ── Step 3: calculate discount ─────────────────────────────────────────────
  // Discount only applies when the threshold is met.
  let discount = 0;
  if (maxConsecutiveAbsences >= minAbsences) {
    discount = lessonPrice * maxConsecutiveAbsences;
  }

  // ── Step 4: apply discount and floor ──────────────────────────────────────
  let finalFee = monthlyFee - discount;
  finalFee = Math.max(finalFee, minimumPayment); // cannot go below minimum
  finalFee = Math.max(finalFee, 0);              // absolute safety

  return {
    monthlyFee,
    lessonPrice,
    lessonsCount:           activeLessons.length,
    consecutiveAbsences,
    maxConsecutiveAbsences,
    discount,
    finalFee,
    minimumPayment,
    discountApplied: maxConsecutiveAbsences >= minAbsences,
  };
}

// ── Self-contained unit tests (run with: node billingCalculator.js) ──────────
/* istanbul ignore next */
function _runTests() {
  const assert = (condition, msg) => {
    if (!condition) throw new Error(`FAIL: ${msg}`);
    console.log(`  ✓  ${msg}`);
  };

  console.log('\n=== billingCalculator tests ===\n');

  // Spec example: 4 consecutive absences
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: ['absent', 'absent', 'absent', 'absent', 'present'],
    });
    assert(r.lessonPrice === 16_666,  `lessonPrice = 16666 (got ${r.lessonPrice})`);
    assert(r.discount   === 66_664,  `discount = 66664 (got ${r.discount})`);
    assert(r.finalFee   === 133_336, `finalFee = 133336 (got ${r.finalFee})`);
    assert(r.discountApplied,        'discountApplied = true');
  }

  // Below threshold: 3 consecutive absences → no discount
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: ['absent', 'absent', 'absent', 'present'],
    });
    assert(r.discount === 0,         'no discount for 3 consecutive');
    assert(r.finalFee === 200_000,   'full fee for 3 consecutive');
    assert(!r.discountApplied,       'discountApplied = false');
  }

  // Freeze does not break streak
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: ['absent', 'freeze', 'absent', 'absent', 'absent'],
    });
    // freeze removed → [absent, absent, absent, absent] → maxStreak = 4
    assert(r.maxConsecutiveAbsences === 4, `freeze transparent: maxStreak = 4 (got ${r.maxConsecutiveAbsences})`);
    assert(r.discountApplied,              'discount applied after freeze');
  }

  // Minimum fee floor (12 consecutive absences)
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: Array(12).fill('absent'),
    });
    assert(r.finalFee === 100_000, `minimum payment floor (got ${r.finalFee})`);
  }

  // All present → full fee
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: Array(12).fill('present'),
    });
    assert(r.finalFee === 200_000, 'all present → full fee');
    assert(r.discount === 0,       'no discount for all present');
  }

  // More than 12 lessons → extra ignored
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: Array(20).fill('present'),
    });
    assert(r.lessonsCount === 12, `extra lessons capped (got ${r.lessonsCount})`);
    assert(r.finalFee === 200_000, 'full fee when all present (even with extra lessons)');
  }

  // Late weight 0 (default) → treated as present, resets streak
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: ['absent', 'absent', 'absent', 'late', 'absent'],
      config: { lateWeight: 0 },
    });
    // late resets streak → max streak is 3 (before late), then 1 after
    assert(r.maxConsecutiveAbsences === 3, `late(weight=0) resets streak (got ${r.maxConsecutiveAbsences})`);
    assert(!r.discountApplied, 'no discount for streak of 3');
  }

  // Late weight 0.5 → 2 lates = 1 counted absence
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: ['absent', 'absent', 'late', 'late', 'absent'],
      config: { lateWeight: 0.5 },
    });
    // streak: 1, 2, 2.5, 3, 4 → maxStreak = 4
    assert(r.maxConsecutiveAbsences === 4, `late(weight=0.5) accumulates (got ${r.maxConsecutiveAbsences})`);
    assert(r.discountApplied, 'discount applied with lateWeight=0.5');
  }

  // Custom min fee ratio
  {
    const r = calculateBilling({
      monthlyFee: 200_000,
      attendanceStatuses: Array(12).fill('absent'),
      config: { minFeeRatio: 0.25 },
    });
    assert(r.minimumPayment === 50_000, 'custom minFeeRatio = 0.25');
    assert(r.finalFee === 50_000,       'floor at 25% with 12 absences');
  }

  console.log('\nAll tests passed ✓\n');
}

if (require.main === module) {
  _runTests();
}

module.exports = { calculateBilling };
