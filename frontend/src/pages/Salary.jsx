import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, MONTH_NAMES } from '../utils/helpers';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v) =>
  v == null ? '—' : new Intl.NumberFormat('uz-UZ').format(v) + " so'm";

const now = new Date();
const TODAY_DAY = now.getDate();
const THIS_MONTH = now.getMonth() + 1;
const THIS_YEAR = now.getFullYear();

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, trend, icon, accentColor, loading }) => (
  <div
    className="card p-5 relative overflow-hidden"
    style={{ borderTop: `3px solid ${accentColor}` }}
  >
    {loading ? (
      <div className="space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-36" />
        <div className="skeleton h-3 w-28" />
      </div>
    ) : (
      <>
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
          <span className="text-lg leading-none">{icon}</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight mt-1">
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
        {trend && (
          <p className="text-xs font-medium text-emerald-600 mt-1">{trend}</p>
        )}
      </>
    )}
  </div>
);

// ─── Monthly Progress Bar ─────────────────────────────────────────────────────
const MonthlyProgress = ({ income, target, progress }) => {
  const pct = Math.min(Math.round(progress ?? (target > 0 ? (income / target) * 100 : 0)), 100);
  const color =
    pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">Oylik maqsad</p>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 mb-1.5">
        <span className="font-medium text-gray-700 dark:text-slate-300 tabular-nums">{fmt(income)}</span>
        <span className="tabular-nums">{fmt(target)}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

// ─── Recharts custom tooltip ──────────────────────────────────────────────────
const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card px-3 py-2 shadow-md">
      <p className="text-xs text-gray-400">{d.date || `Kun ${label}`}</p>
      <p className="text-sm font-bold text-gray-900 tabular-nums">
        {fmt(d.income)}
      </p>
      <p className="text-xs text-gray-500">{d.lessons} lessons</p>
    </div>
  );
};

// ─── Today Lesson Card ────────────────────────────────────────────────────────
const LessonCard = ({ lesson, onMark }) => {
  const isConducted = lesson.status === 'conducted';
  const estimatedIncome = (lesson.price_per_student ?? 0) * (lesson.total_students ?? 0);
  const actualIncome = (lesson.price_per_student ?? 0) * (lesson.attended_count ?? 0);
  const attendancePct =
    lesson.total_students > 0
      ? Math.round((lesson.attended_count / lesson.total_students) * 100)
      : 0;

  return (
    <div
      className={`card p-4 flex flex-col gap-3 transition-all duration-200 ${
        isConducted ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-blue-400'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
              isConducted ? 'bg-green-500' : 'bg-blue-500'
            }`}
          />
          <p className="font-semibold text-gray-900 text-sm truncate">
            {lesson.group_name}
          </p>
        </div>
        {isConducted ? (
          <span className="badge-green flex-shrink-0">O&apos;tkazildi</span>
        ) : (
          <span className="badge-blue flex-shrink-0">Rejalashtirilgan</span>
        )}
      </div>

      {/* Time */}
      {lesson.time && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {lesson.time}
        </p>
      )}

      {/* Attendance bar (conducted only) */}
      {isConducted && lesson.total_students > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">
              {lesson.attended_count}/{lesson.total_students} keldi
            </span>
            <span className="font-medium text-gray-700">{attendancePct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${attendancePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Students count (scheduled) */}
      {!isConducted && lesson.total_students > 0 && (
        <p className="text-xs text-gray-500">
          {lesson.total_students} talaba
        </p>
      )}

      {/* Earnings */}
      <div className="flex items-center justify-between">
        <p
          className={`text-base font-bold tabular-nums ${
            isConducted ? 'text-green-600' : 'text-blue-500'
          }`}
        >
          {isConducted ? `+${fmt(actualIncome)}` : `~${fmt(estimatedIncome)} kutilmoqda`}
        </p>
      </div>

      {/* Action button */}
      {isConducted ? (
        <button
          disabled
          className="w-full btn btn-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/60 opacity-80 cursor-default"
        >
          O&apos;tkazildi ✅
        </button>
      ) : (
        <button
          onClick={() => onMark(lesson)}
          className="w-full btn-primary btn-sm"
        >
          Dars o&apos;tkazish
        </button>
      )}
    </div>
  );
};

// ─── Conduct Modal ─────────────────────────────────────────────────────────────
const ConductModal = ({ lesson, onClose, onSuccess }) => {
  const toast = useToast();
  const [attendance, setAttendance] = useState(() =>
    (lesson.students || []).map((s) => ({
      student_id: s.id,
      name: s.name,
      status: 'attended',
    }))
  );
  const [saving, setSaving] = useState(false);

  const setStatus = (studentId, status) => {
    setAttendance((prev) =>
      prev.map((a) => (a.student_id === studentId ? { ...a, status } : a))
    );
  };

  const attendedCount = attendance.filter((a) => a.status === 'attended').length;
  const totalIncome = attendedCount * (lesson.price_per_student ?? 0);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/lessons/${lesson.id}/conduct`, { attendance });
      onSuccess(totalIncome, attendedCount);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Xatolik yuz berdi";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const statusConfig = {
    attended: { label: 'Keldi', cls: 'bg-green-100 text-green-700 border-green-200' },
    missed:   { label: 'Kelmadi', cls: 'bg-red-100 text-red-700 border-red-200' },
    excused:  { label: 'Uzr', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-slideIn">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700/50 flex items-start justify-between">
          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-base">{lesson.group_name}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Mark Attendance</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Live earnings counter */}
        <div className="mx-5 mt-4 mb-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-green-700">
            <span className="font-bold tabular-nums">{fmt(totalIncome)}</span>
            <span className="text-xs ml-1 opacity-75">({attendedCount} talaba keldi)</span>
          </p>
          <span className="text-green-500 text-lg">💰</span>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
          {attendance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Talabalar topilmadi</p>
          ) : (
            attendance.map((a) => (
              <div
                key={a.student_id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(a.name || '?').charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200 flex-1 truncate">{a.name}</p>

                {/* Status toggles */}
                <div className="flex gap-1">
                  {['attended', 'missed', 'excused'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(a.student_id, s)}
                      className={`px-2 py-1 text-xs rounded-lg border font-medium transition-all ${
                        a.status === s
                          ? statusConfig[s].cls
                          : 'bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-slate-600 hover:border-gray-200 dark:hover:border-slate-500'
                      }`}
                    >
                      {s === 'attended' ? '✅' : s === 'missed' ? '❌' : '🔁'}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700/50 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Saqlanmoqda...' : 'Tasdiqlash'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Lesson History Table ─────────────────────────────────────────────────────
const HistoryTable = ({ history, loading, page, totalPages, onPage }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">No lesson history for this month</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Sana</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Group</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide hidden sm:table-cell">Talabalar</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Daromad</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Holat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {history.map((h) => (
              <tr key={h.lesson_id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {formatDate(h.date)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100 truncate max-w-[140px]">
                  {h.group_name}
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {h.attended}/{h.total_students}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-green-600">
                  +{fmt(h.lesson_income)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="badge-green">O&apos;tkazildi</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="btn-secondary btn-sm disabled:opacity-40"
          >
            ← Oldingi
          </button>
          <span className="text-xs text-gray-500 px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="btn-secondary btn-sm disabled:opacity-40"
          >
            Keyingi →
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Salary Badge helpers ──────────────────────────────────────────────────────
const SalaryStatusBadge = ({ status }) =>
  status === 'paid'
    ? <span className="badge-green">To&apos;landi</span>
    : <span className="badge-yellow">Kutilmoqda</span>;

const AdvanceBadge = ({ status }) => {
  const map = {
    pending:  { label: 'Kutilmoqda',     cls: 'badge-yellow' },
    approved: { label: 'Tasdiqlandi',    cls: 'badge-green'  },
    rejected: { label: 'Rad etildi',     cls: 'badge-red'    },
    deducted: { label: 'Ushlab qolindi', cls: 'badge-gray'   },
  };
  const b = map[status] || { label: status || '—', cls: 'badge-gray' };
  return <span className={b.cls}>{b.label}</span>;
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const Salary = () => {
  const { user } = useAuth();
  const toast = useToast();

  // ── state: month selector ─────────────────────────────────────────────────
  const [month, setMonth] = useState(THIS_MONTH);
  const [year,  setYear]  = useState(THIS_YEAR);

  // ── state: earnings (new system) ─────────────────────────────────────────
  const [earnings,     setEarnings]     = useState(null);
  const [earningsLoad, setEarningsLoad] = useState(true);
  const [earningsErr,  setEarningsErr]  = useState(false);

  // ── state: today's lessons ─────────────────────────────────────────────────
  const [todayLessons,    setTodayLessons]    = useState([]);
  const [todayLessonsLoad, setTodayLessonsLoad] = useState(true);

  // ── state: lesson history ─────────────────────────────────────────────────
  const [history,     setHistory]     = useState([]);
  const [historyLoad, setHistoryLoad] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  // ── state: old salary records (secondary) ─────────────────────────────────
  const [salaryRecords,    setSalaryRecords]    = useState([]);
  const [salaryRecordsLoad, setSalaryRecordsLoad] = useState(true);
  const [advances,         setAdvances]         = useState([]);
  const [advancesLoad,     setAdvancesLoad]     = useState(true);

  // ── state: group filter for history ──────────────────────────────────────
  const [groupFilter, setGroupFilter] = useState('');
  const [groups,      setGroups]      = useState([]);

  // ── state: conduct modal ──────────────────────────────────────────────────
  const [conductingLesson, setConductingLesson] = useState(null);

  // ── state: selected salary record modal ───────────────────────────────────
  const [selectedRecord, setSelectedRecord] = useState(null);

  // ── fetch earnings ─────────────────────────────────────────────────────────
  const fetchEarnings = useCallback(async () => {
    setEarningsLoad(true);
    setEarningsErr(false);
    try {
      const res = await api.get('/earnings/my', { params: { month, year } });
      setEarnings(res.data);
    } catch {
      setEarningsErr(true);
    } finally {
      setEarningsLoad(false);
    }
  }, [month, year]);

  // ── fetch today's lessons ──────────────────────────────────────────────────
  const fetchTodayLessons = useCallback(async () => {
    setTodayLessonsLoad(true);
    try {
      const res = await api.get('/lessons/today');
      setTodayLessons(res.data || []);
    } catch {
      setTodayLessons([]);
    } finally {
      setTodayLessonsLoad(false);
    }
  }, []);

  // ── fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoad(true);
    try {
      const res = await api.get('/earnings/history', {
        params: { month, year, page: historyPage, group_id: groupFilter || undefined },
      });
      setHistory(res.data?.data || []);
      setHistoryTotal(res.data?.total || 0);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoad(false);
    }
  }, [month, year, historyPage, groupFilter]);

  // ── fetch groups (for filter dropdown) ────────────────────────────────────
  useEffect(() => {
    api.get('/groups')
      .then((r) => setGroups(r.data || []))
      .catch(() => {});
  }, []);

  // ── fetch salary records (old system) ─────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    setSalaryRecordsLoad(true);
    api.get('/salary/records', { params: { teacher_id: user.id } })
      .then((r) => setSalaryRecords(r.data?.data || []))
      .catch(() => setSalaryRecords([]))
      .finally(() => setSalaryRecordsLoad(false));
  }, [user?.id]);

  // ── fetch advances ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    setAdvancesLoad(true);
    api.get('/salary/advances', { params: { teacher_id: user.id } })
      .then((r) => setAdvances(r.data || []))
      .catch(() => setAdvances([]))
      .finally(() => setAdvancesLoad(false));
  }, [user?.id]);

  useEffect(() => { fetchEarnings();     }, [fetchEarnings]);
  useEffect(() => { fetchTodayLessons(); }, [fetchTodayLessons]);
  useEffect(() => { fetchHistory();      }, [fetchHistory]);

  // ── month navigation ───────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setHistoryPage(1);
  };
  const nextMonth = () => {
    if (year === THIS_YEAR && month === THIS_MONTH) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setHistoryPage(1);
  };
  const isCurrentMonth = year === THIS_YEAR && month === THIS_MONTH;
  const isNextDisabled  = isCurrentMonth;

  // ── build daily chart data ─────────────────────────────────────────────────
  const dailyChart = earnings?.daily_chart || [];
  const topEarningSet = new Set((earnings?.top_earning_days || []).map((d) => d.split('T')[0]));

  const chartData = dailyChart.map((d) => {
    const dateStr = (d.date || '').split('T')[0];
    const isToday = d.day === TODAY_DAY && isCurrentMonth;
    const isTop   = topEarningSet.has(dateStr);
    return {
      ...d,
      fillColor: isToday ? '#2563EB' : isTop ? '#F59E0B' : '#D1D5DB',
    };
  });

  // ── handle lesson conducted ────────────────────────────────────────────────
  const handleConductSuccess = (totalIncome, attendedCount) => {
    toast.success(`Dars belgilandi! +${fmt(totalIncome)} qo'shildi`);
    fetchTodayLessons();
    fetchEarnings();
    fetchHistory();
  };

  const totalPages = Math.ceil(historyTotal / HISTORY_PAGE_SIZE);
  const currentSalaryRecord = salaryRecords.find((r) => r.month === month && r.year === year);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Mening daromadlarim</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
          <button
            onClick={prevMonth}
            className="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 w-32 text-center select-none">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isNextDisabled}
            className="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      {earningsErr ? (
        <div className="card p-5 flex items-center gap-4">
          <div className="text-red-400 text-2xl">⚠️</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">
              Ma&apos;lumotlar yuklanmadi
            </p>
            <p className="text-xs text-gray-400 mt-0.5">API ulanishini tekshiring</p>
          </div>
          <button onClick={fetchEarnings} className="btn-secondary btn-sm">
            Qayta urinish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Bugungi daromad"
            value={fmt(earnings?.today_income ?? 0)}
            sub={`${earnings?.lessons_today ?? 0} lessons taught`}
            trend={
              earnings?.today_income > 0
                ? `▲ Bugun faol`
                : undefined
            }
            icon="💰"
            accentColor="#22C55E"
            loading={earningsLoad}
          />
          <KpiCard
            label="Bu oy"
            value={fmt(earnings?.month_income ?? 0)}
            sub={`${earnings?.lessons_this_month ?? 0} lessons / ${earnings?.lessons_remaining ?? 0} remaining`}
            icon="📅"
            accentColor="#2563EB"
            loading={earningsLoad}
          />
          <KpiCard
            label="Jami daromad"
            value={fmt(earnings?.total_income ?? 0)}
            sub={`${earnings?.attended_slots ?? 0} total lessons taught`}
            icon="📈"
            accentColor="#8B5CF6"
            loading={earningsLoad}
          />
        </div>
      )}

      {/* ── Monthly progress ───────────────────────────────────────────── */}
      {!earningsLoad && earnings?.monthly_target > 0 && (
        <MonthlyProgress
          income={earnings.month_income}
          target={earnings.monthly_target}
          progress={earnings.target_progress}
        />
      )}

      {/* ── Today's Lessons ─────────────────────────────────────────────── */}
      {isCurrentMonth && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Today's Lessons</h3>
            {!todayLessonsLoad && (
              <span className="text-xs text-gray-400">
                {todayLessons.length} lessons
              </span>
            )}
          </div>

          {todayLessonsLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-40 rounded-xl" />
              ))}
            </div>
          ) : todayLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No lessons today</p>
              <p className="text-xs text-gray-400 mt-1">Dam oling yoki jadvalingizni tekshiring</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todayLessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onMark={(l) => setConductingLesson(l)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chart + Stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Daily chart */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Kunlik daromad</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                Bugun
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                Eng yaxshi
              </span>
            </div>
          </div>

          {earningsLoad ? (
            <div className="skeleton h-40 rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              Bu oy uchun ma&apos;lumotlar yo&apos;q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? (v / 1000000).toFixed(1) + 'M'
                      : v >= 1000
                      ? (v / 1000).toFixed(0) + 'K'
                      : String(v)
                  }
                  width={36}
                />
                <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="income" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats panel */}
        <div className="card p-5 lg:col-span-2 space-y-4">
          <p className="text-sm font-semibold text-gray-900">Bu oy statistikasi</p>

          {earningsLoad ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-3 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Lessons Taught', value: `${earnings?.lessons_this_month ?? 0} ta` },
                { label: 'Remaining Lessons', value: `${earnings?.lessons_remaining ?? 0} ta` },
                { label: 'Kelgan talabalar', value: `${earnings?.attended_slots ?? 0} ta` },
                { label: 'Kelmagan', value: `${earnings?.missed_slots ?? 0} ta` },
                {
                  label: "O'rtacha kunlik",
                  value: fmt(
                    earnings?.lessons_this_month > 0
                      ? Math.round((earnings?.month_income ?? 0) / Math.max(earnings.lessons_this_month, 1))
                      : 0
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lesson History ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Dars tarixi
            {historyTotal > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({historyTotal} ta)
              </span>
            )}
          </h3>

          {/* Group filter */}
          <select
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setHistoryPage(1); }}
            className="input text-xs py-1.5 w-auto"
          >
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <HistoryTable
          history={history}
          loading={historyLoad}
          page={historyPage}
          totalPages={totalPages}
          onPage={setHistoryPage}
        />
      </div>

      {/* ── Old Salary Records (from admin) ─────────────────────────── */}
      {!salaryRecordsLoad && salaryRecords.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Salary set by admin
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {salaryRecords.slice(0, 6).map((rec) => {
              const isPaid = rec.status === 'paid';
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedRecord(rec)}
                  className="card p-4 text-left hover:shadow-md transition-shadow w-full"
                  style={{ borderTop: `3px solid ${isPaid ? '#10B981' : '#F59E0B'}` }}
                >
                  <p className="text-xs text-gray-500 mb-1">
                    {MONTH_NAMES[(rec.month || 1) - 1]} {rec.year}
                  </p>
                  <p className="text-base font-bold text-gray-900 tabular-nums">
                    {formatCurrency(rec.final_salary)}
                  </p>
                  <SalaryStatusBadge status={rec.status} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Advances ──────────────────────────────────────────────────── */}
      {!advancesLoad && advances.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700/50">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Avanslar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-xs">Miqdor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-xs">Sabab</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-xs hidden md:table-cell">Sana</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400 text-xs">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {advances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 dark:text-slate-100">
                      {formatCurrency(adv.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 truncate max-w-[160px]">
                      {adv.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">
                      {formatDate(adv.request_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AdvanceBadge status={adv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Salary detail modal ────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-slideIn">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
              <p className="font-bold text-gray-900 dark:text-slate-100">Salary Details</p>
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  {MONTH_NAMES[(selectedRecord.month || 1) - 1]} {selectedRecord.year}
                </p>
                <SalaryStatusBadge status={selectedRecord.status} />
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700/50">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-50 dark:border-slate-700/40">
                      <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">Base Salary</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums dark:text-slate-200">
                        {formatCurrency(selectedRecord.base_amount)}
                      </td>
                    </tr>
                    {(Number(selectedRecord.bonus_amount) || 0) > 0 && (
                      <tr className="border-b border-gray-50 dark:border-slate-700/40 bg-green-50/50 dark:bg-green-900/10">
                        <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">Bonus</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-green-600 dark:text-green-400">
                          + {formatCurrency(selectedRecord.bonus_amount)}
                        </td>
                      </tr>
                    )}
                    {(Number(selectedRecord.deductions) || 0) > 0 && (
                      <tr className="border-b border-gray-50 dark:border-slate-700/40 bg-red-50/50 dark:bg-red-900/10">
                        <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">Ushlamalar</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-red-600 dark:text-red-400">
                          - {formatCurrency(selectedRecord.deductions)}
                        </td>
                      </tr>
                    )}
                    {(Number(selectedRecord.advance_paid) || 0) > 0 && (
                      <tr className="border-b border-gray-50 dark:border-slate-700/40 bg-orange-50/50 dark:bg-orange-900/10">
                        <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">Avans</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-orange-600 dark:text-orange-400">
                          - {formatCurrency(selectedRecord.advance_paid)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-blue-50 dark:bg-blue-900/20">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-slate-100">= Yakuniy</td>
                      <td className="px-4 py-3 text-right font-bold text-lg tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(selectedRecord.final_salary)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedRecord(null)}
                >
                  Yopish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Conduct lesson modal ─────────────────────────────────────── */}
      {conductingLesson && (
        <ConductModal
          lesson={conductingLesson}
          onClose={() => setConductingLesson(null)}
          onSuccess={handleConductSuccess}
        />
      )}

    </div>
  );
};

export default Salary;
