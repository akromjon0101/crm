# CRM Project — Bug Report
**Generated:** May 30, 2026
**Updated:** August 27, 2026 — all items below fixed, plus additional issues
found in a follow-up full-codebase audit (see note at bottom).
**Status:** Running on Backend:5001, Frontend:5173

---

## 🔴 **CRITICAL BUGS**

### 1. **Analytics Data Mapping Crash**
**Location:** `frontend/src/pages/Analytics.jsx` line 55  
**Severity:** 🔴 CRITICAL  
**Description:**
```javascript
// BUGGY CODE:
setIncomeData(ic.data.map(d => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
```
If the API returns `null` or `undefined` for `ic.data`, this will crash the component with:
```
TypeError: Cannot read property 'map' of undefined
```

**Fix:**
```javascript
setIncomeData((ic.data || []).map(d => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
setGrowthData((gr.data || []).map(d => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
```

**Impact:** Analytics page crashes if API response is malformed.

---

### 2. **StudentProfile Missing Error Handling on Add Note & Payment**
**Location:** `frontend/src/pages/StudentProfile.jsx` lines 122–127  
**Severity:** 🔴 CRITICAL  
**Description:**
```javascript
const handlePayment = async (e) => {
  e.preventDefault();
  await api.post('/payments', { ...payment, student_id: id });
  setPaymentModal(false); fetchStudent();
  // NO TRY/CATCH — if API fails, user sees nothing!
};
```

This lacks error handling. If payment creation fails, the user sees no error message and the modal closes silently.

**Fix:**
```javascript
const handlePayment = async (e) => {
  e.preventDefault();
  try {
    await api.post('/payments', { ...payment, student_id: id });
    toast.success('Payment recorded successfully');
    setPaymentModal(false);
    fetchStudent();
  } catch (err) {
    toast.error(err.response?.data?.message || 'Error recording payment');
  }
};
```

**Impact:** Users can't see when payment/note operations fail, leading to confusion.

---

### 3. **Inconsistent Payment Response Structure**
**Location:** Backend `src/controllers/paymentsController.js` line ~130 + Frontend  
**Severity:** 🟠 HIGH  
**Description:**
Frontend code expects:
```javascript
// frontend/src/pages/Payments.jsx
const payments = await api.get('/payments');
payments.data.data // accessing .data twice!
```

But the backend returns:
```javascript
// Backend getAllPayments()
res.json({ data: result.rows, total, page, limit });
// This is correct, but some pages expect: { data: { data: [] } }
```

**Fix:** Ensure all GET endpoints return `{ data: [...], total: N }` consistently.

---

## 🟠 **HIGH PRIORITY BUGS**

### 4. **Dashboard Analytics Fails Silently on Partial API Failures**
**Location:** `frontend/src/pages/Dashboard.jsx` lines ~580–595  
**Severity:** 🟠 HIGH  
**Description:**
```javascript
Promise.all([...])
  .then(([s, ic, g]) => { ... })
  .catch(() => setError('Failed to load...'))  // Catches all errors
  .finally(() => setLoadingMain(false));
```

If one API call fails, the entire dashboard fails. No granular error handling.

**Fix:** Use individual `.catch()` handlers or `Promise.allSettled()`:
```javascript
const results = await Promise.allSettled([
  api.get('/analytics/dashboard'),
  api.get('/analytics/income-chart', { params: { year: chartYear } }),
  api.get('/groups'),
]);

results.forEach((r, idx) => {
  if (r.status === 'rejected') {
    console.warn(`API call ${idx} failed`);
  }
});
```

**Impact:** One slow/failed API call breaks entire dashboard.

---

### 5. **SMS Service Missing Phone Normalization in Student Operations**
**Location:** `backend/src/controllers/studentsController.js` line ~246 (transfer) and ~250 (freeze)  
**Severity:** 🟠 HIGH  
**Description:**

`createStudent()` normalizes phone numbers before storing (line 134–135):
```javascript
const normalizedPhone = normalizePhone(phone);
```

But `transferStudent()`, `freezeStudent()`, and other operations use the phone **as-is** from the database, which could be malformed:
```javascript
// Line 246 in transferStudent():
if (student.phone && toGroup.rows[0]?.name) {
  eskizService.sendSMS(student.phone, ...); // ❌ No normalization!
}
```

**Fix:** Always normalize before sending SMS:
```javascript
if (student.phone) {
  const normalized = normalizePhone(student.phone);
  if (normalized) {
    eskizService.sendSMS(normalized, message).catch(console.error);
  }
}
```

**Impact:** SMS fails silently for students with improperly stored phone numbers.

---

### 6. **Unfreeze Student Doesn't Check if Group Still Exists**
**Location:** `backend/src/controllers/studentsController.js` lines ~284–312  
**Severity:** 🟠 HIGH  
**Description:**
```javascript
const unfreezeStudent = async (req, res) => {
  const lastFrozen = await query(
    `SELECT group_id FROM student_group_history...`
  );
  const groupId = lastFrozen.rows[0]?.group_id || student.group_id;
  if (!groupId) return res.status(400).json({ message: 'No group found' });

  // ❌ BUG: No check if this group still exists!
  const result = await query(
    `UPDATE students SET group_id = ? ...`,
    [groupId, req.params.id]
  );
};
```

If the group was deleted, the student is assigned to a non-existent group, breaking foreign key integrity.

**Fix:**
```javascript
if (!groupId) return res.status(400).json({ message: 'No group found' });

// Check group exists
const groupCheck = await query('SELECT id FROM groups WHERE id = ?', [groupId]);
if (!groupCheck.rows[0]) {
  return res.status(400).json({ message: 'Original group no longer exists' });
}
```

**Impact:** Data integrity violation; orphaned students with deleted group references.

---

## 🟡 **MEDIUM PRIORITY BUGS**

### 7. **Frontend `useApi` Hook Doesn't Handle Concurrent Requests Properly**
**Location:** `frontend/src/hooks/useApi.js` lines ~30–45  
**Severity:** 🟡 MEDIUM  
**Description:**
```javascript
const fetch = useCallback(async () => {
  if (!url) return;
  setLoading(true);
  // ...eslint-disable-next-line react-hooks/exhaustive-deps
}, [url, ...deps]);
```

The `// eslint-disable-next-line` mask a real issue: if `deps` changes between renders, stale closures can cause race conditions.

**Fix:** Remove the disable comment and fix the dependency properly:
```javascript
const depString = JSON.stringify(deps); // Stable reference
const fetch = useCallback(async () => {
  if (!url) return;
  setLoading(true);
  // ...
}, [url, depString]); // Now truly reactive
```

**Impact:** Data can be out-of-sync if dependencies change rapidly.

---

### 8. **Salary Calculation Missing Validation for Zero Division**
**Location:** `backend/src/utils/billingCalculator.js` (not shown)  
**Severity:** 🟡 MEDIUM  
**Description:**
From migrations, salary calculations involve percentages and lesson counts. If a teacher has 0 lessons, percentage-based salary could be zero without warning.

**Recommendation:** Add safeguards in salary calculation:
```javascript
if (lessons_count === 0) {
  console.warn(`Teacher ${teacher_id} has 0 lessons for month ${month}`);
  // Return minimum salary or zero explicitly
}
```

**Impact:** Silent calculation errors; no audit trail of why a salary is zero.

---

### 9. **Attendance Toggle Debtor Status Without Confirmation**
**Location:** `frontend/src/pages/Students.jsx` line ~344  
**Severity:** 🟡 MEDIUM  
**Description:**
```javascript
const handleToggleDebtor = async (id) => {
  try {
    await api.put(`/students/${id}/toggle-debtor`);
    fetchStudents(); // No confirmation, user might click accidentally
  } catch { ... }
};
```

No confirmation dialog before marking a student as debtor — can happen by accident.

**Fix:** Add confirmation:
```javascript
if (window.confirm(`Mark ${student.name} as debtor?`)) {
  await api.put(`/students/${id}/toggle-debtor`);
}
```

**Impact:** Accidental debtor marking affects billing calculations.

---

## 🟢 **LOW PRIORITY ISSUES**

### 10. **Missing Null Checks in Student Notes Display**
**Location:** `frontend/src/pages/StudentProfile.jsx` line ~228  
**Description:** If `o.notes` is `null`, the `.map()` would fail.

**Current Code:**
```javascript
o.notes?.map(...) // Good — using optional chaining
```
Actually **✅ NOT A BUG** — code correctly uses optional chaining.

---

### 11. **Console Errors in Development Mode**
**Location:** Multiple controllers (`messagesController.js`, `smsService.js`)  
**Description:**
```javascript
console.error(err);  // Logs full error objects to console
```

**Fix:** Use structured logging:
```javascript
console.error('[StudentController]', err.message);
```

**Impact:** Hard to debug; security risk if error objects contain sensitive data.

---

## **Summary Table**

| ID | Bug | File | Severity | Status |
|----|----|------|----------|--------|
| 1 | Analytics map null crash | Analytics.jsx:55 | 🔴 CRITICAL | ✅ FIXED |
| 2 | StudentProfile no error on payment | StudentProfile.jsx:122 | 🔴 CRITICAL | ✅ FIXED |
| 3 | Payment response structure mismatch | Multiple | 🟠 HIGH | ✅ Already defensive (`res.data?.data \|\| res.data \|\| []`) — no change needed |
| 4 | SMS phone not normalized in ops | studentsController.js:246 | 🟠 HIGH | ✅ FIXED (also fixed updateStudent, which had the same gap) |
| 5 | Unfreeze group validity check missing | studentsController.js:284 | 🟠 HIGH | ✅ FIXED |
| 6 | Dashboard API failures silent | Dashboard.jsx:580 | 🟠 HIGH | ✅ FIXED (Promise.allSettled) |
| 7 | useApi hook race condition | useApi.js:30 | 🟡 MEDIUM | ✅ FIXED (request-id guard) |
| 8 | Salary zero division edge case | billingCalculator.js | 🟡 MEDIUM | ✅ FIXED (maxLessons guard) |
| 9 | Debtor toggle no confirmation | Students.jsx:344 | 🟡 MEDIUM | ✅ FIXED |
| 10 | Error logging not structured | Multiple | 🟢 LOW | ✅ FIXED (all controllers) |

## Additional bugs found in the Aug 27, 2026 follow-up audit

| Bug | File | Severity | Status |
|----|------|----------|--------|
| Global 401 interceptor hijacked failed login attempts — wiped the error message via a forced reload of `/login` | frontend/src/services/api.js | 🔴 CRITICAL | ✅ FIXED |
| `/api/leads/*` had no role check — any authenticated user (e.g. teacher) could call it directly, bypassing the frontend's admin-only restriction | backend/src/routes/leads.js | 🟠 HIGH | ✅ FIXED |
| `POST /students/:id/notes` was admin-only, but the frontend lets every role add notes (credited via `req.user.id`) — teachers got 403s | backend/src/routes/students.js | 🟠 HIGH | ✅ FIXED |
| nodemon watched SQLite WAL files (`*.db-shm`/`*.db-wal`), restarting on every DB write — caused EADDRINUSE crash loops under load | backend/package.json | 🟡 MEDIUM | ✅ FIXED |
| Stale nested `frontend/.git` (old CRA-era repo, no remote) would have blocked the root repo from tracking frontend files | frontend/ | 🟡 MEDIUM (repo hygiene) | ✅ FIXED |
| Unused empty `backend/src/config/database.sqlite` (app actually reads `backend/crm.db`) | backend/src/config/ | 🟢 LOW | ✅ FIXED |

---

## **Recommended Action Plan**

1. **IMMEDIATE (Today):**
   - Fix bug #1 (Analytics crash) — 5 min
   - Fix bug #2 (StudentProfile error handling) — 10 min
   - Fix bug #4 (SMS normalization) — 15 min

2. **TODAY (Before deploy):**
   - Fix bug #5 (Group existence check) — 10 min
   - Fix bug #3 (Response structure consistency) — 30 min
   - Fix bug #6 (Dashboard error handling) — 20 min

3. **THIS WEEK:**
   - Fix bug #7 (useApi race conditions) — 20 min
   - Fix bug #8 (Salary validation) — 30 min
   - Fix bug #9 (Debtor confirmation) — 10 min

---

**Note:** Servers running successfully:
- ✅ Backend API: http://localhost:5001
- ✅ Frontend: http://localhost:5173
- ✅ Database schema initialized with migrations

**Update (Aug 27, 2026):** All bugs above, plus the 6 additional ones found
in the follow-up audit, are fixed. Verified via `npm run build` (frontend,
clean) and `node src/utils/billingCalculator.js` (backend, all 20 unit
tests pass), plus manual end-to-end checks of login, the leads permission
fix, and the teacher-notes permission fix. The project is committed to a
fresh local git repo (`git log`) and ready to push once a remote is added.
