import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, MONTH_NAMES } from '../utils/helpers';
import ConductModal from '../components/teacher/ConductModal';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v) =>
  v == null ? '—' : new Intl.NumberFormat('uz-UZ').format(v) + " so'm";

const now = new Date();
const THIS_MONTH = now.getMonth() + 1;
const THIS_YEAR  = now.getFullYear();

// ─── SVG Icon ────────────────────────────────────────────────────────────────
const Icon = ({ path, cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d={path} />
  </svg>
);

const ICONS = {
  chevLeft:  'M15 19l-7-7 7-7',
  chevRight: 'M9 5l7 7-7 7',
  book:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  users:     'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  check:     'M5 13l4 4L19 7',
  warning:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  refresh:   'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  filter:    'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) =>
  status === 'conducted'
    ? <span className="badge-green">O&apos;tkazildi</span>
    : <span className="badge-blue">Rejalashtirilgan</span>;

// ─── Stats strip ──────────────────────────────────────────────────────────────
const STAT_CONFIGS = [
  { key: 'conducted', label: "O'tkazilgan",       borderColor: 'border-t-emerald-400', iconBg: 'from-emerald-400 to-teal-500',   textColor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'scheduled', label: 'Qolgan',             borderColor: 'border-t-blue-400',    iconBg: 'from-blue-500 to-indigo-600',    textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'income',    label: 'Jami daromad',       borderColor: 'border-t-violet-500',  iconBg: 'from-violet-500 to-purple-600',  textColor: 'text-violet-600 dark:text-violet-400' },
  { key: 'avg',       label: "O'rtacha daromad",   borderColor: 'border-t-amber-400',   iconBg: 'from-orange-400 to-amber-500',   textColor: 'text-amber-600 dark:text-amber-400' },
];

const StatsStrip = ({ lessons, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-4 space-y-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="skeleton h-3 w-20 rounded-lg" />
            <div className="skeleton h-6 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const conducted = lessons.filter((l) => l.status === 'conducted');
  const scheduled = lessons.filter((l) => l.status !== 'conducted');
  const totalIncome = conducted.reduce(
    (sum, l) => sum + (l.lesson_income ?? (l.price_per_student ?? 0) * (l.attended_count ?? 0)),
    0
  );
  const avgIncome = conducted.length > 0 ? Math.round(totalIncome / conducted.length) : 0;

  const values = {
    conducted: `${conducted.length} ta`,
    scheduled: `${scheduled.length} ta`,
    income: fmt(totalIncome),
    avg: fmt(avgIncome),
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STAT_CONFIGS.map(({ key, label, borderColor, textColor }) => (
        <div
          key={key}
          className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 border-t-2 ${borderColor} p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]`}
        >
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1.5">{label}</p>
          <p className={`text-base font-bold tabular-nums ${textColor}`}>{values[key]}</p>
        </div>
      ))}
    </div>
  );
};


// ─── Lesson Card ──────────────────────────────────────────────────────────────
const LessonCard = ({ lesson, onMark }) => {
  const isConducted = lesson.status === 'conducted';
  const income = lesson.lesson_income
    ?? (lesson.price_per_student ?? 0) * (lesson.attended_count ?? 0);
  const estimatedIncome = (lesson.price_per_student ?? 0) * (lesson.total_students ?? 0);
  const attendancePct =
    lesson.total_students > 0
      ? Math.round((lesson.attended_count / lesson.total_students) * 100)
      : 0;

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-4 flex flex-col gap-3 transition-all duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${
        isConducted ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-blue-400'
      }`}
    >
      {/* Date + Group */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5 font-medium">{formatDate(lesson.date)}</p>
          <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{lesson.group_name}</p>
        </div>
        <StatusBadge status={lesson.status} />
      </div>

      {/* Attendance bar (conducted) */}
      {isConducted && lesson.total_students > 0 && (
        <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-2.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400">
              <Icon path={ICONS.users} cls="w-3 h-3" />
              <span>{lesson.attended_count}/{lesson.total_students} keldi</span>
            </div>
            <span className="font-bold text-gray-700 dark:text-slate-200">{attendancePct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
              style={{ width: `${attendancePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Students count (scheduled) */}
      {!isConducted && lesson.total_students > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/40 rounded-xl px-3 py-1.5">
          <Icon path={ICONS.users} cls="w-3 h-3" />
          <span>{lesson.total_students} talaba</span>
        </div>
      )}

      {/* Earnings */}
      <p className={`text-sm font-bold tabular-nums ${isConducted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-500 dark:text-blue-400'}`}>
        {isConducted ? `+${fmt(income)}` : `~${fmt(estimatedIncome)} kutilmoqda`}
      </p>

      {/* Action */}
      {isConducted ? (
        <div className="flex items-center gap-2 w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Icon path={ICONS.check} cls="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">O'tkazildi</span>
        </div>
      ) : (
        <button
          onClick={() => onMark(lesson)}
          className="w-full btn-primary text-xs py-2.5 rounded-xl"
        >
          Dars o&apos;tkazish
        </button>
      )}
    </div>
  );
};

// ─── Skeleton cards ───────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
    <div className="skeleton h-3 w-20 rounded-lg" />
    <div className="skeleton h-4 w-32 rounded-lg" />
    <div className="skeleton h-8 w-full rounded-xl" />
    <div className="skeleton h-4 w-24 rounded-lg" />
    <div className="skeleton h-9 w-full rounded-xl" />
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const LessonsPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [month,  setMonth]  = useState(THIS_MONTH);
  const [year,   setYear]   = useState(THIS_YEAR);
  const [groupId, setGroupId] = useState('');
  const [groups,  setGroups]  = useState([]);

  const [lessons,     setLessons]     = useState([]);
  const [lessonsLoad, setLessonsLoad] = useState(true);
  const [lessonsErr,  setLessonsErr]  = useState(false);

  const [conductingLesson, setConductingLesson] = useState(null);

  // Incrementing ID guards against stale responses from cancelled/superseded fetches
  const fetchReqRef = useRef(0);

  // fetch groups for filter
  useEffect(() => {
    api.get('/groups')
      .then((r) => setGroups(r.data || []))
      .catch(() => setGroups([]));
  }, []);

  const fetchLessons = useCallback(async () => {
    const reqId = ++fetchReqRef.current;
    setLessonsLoad(true);
    setLessonsErr(false);
    try {
      const res = await api.get('/lessons', {
        params: { month, year, group_id: groupId || undefined },
      });
      if (reqId !== fetchReqRef.current) return; // superseded
      setLessons(res.data?.data || res.data || []);
    } catch {
      if (reqId !== fetchReqRef.current) return;
      setLessonsErr(true);
      setLessons([]);
      toast.error("Darslar yuklanmadi");
    } finally {
      if (reqId === fetchReqRef.current) setLessonsLoad(false);
    }
  }, [month, year, groupId]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  // month navigation
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (year === THIS_YEAR && month === THIS_MONTH) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const isNextDisabled = year === THIS_YEAR && month === THIS_MONTH;

  const handleConductSuccess = () => {
    toast.success("Dars belgilandi!");
    setConductingLesson(null);
    fetchLessons();
  };

  // sort: scheduled first, then conducted (most recent first)
  const sortedLessons = [...lessons].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'conducted' ? 1 : -1;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="space-y-5 animate-fadeIn pb-10">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Darslarim</h2>
          {!lessonsLoad && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/40">
              {lessons.length} ta
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Group filter */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon path={ICONS.filter} cls="w-3.5 h-3.5 text-gray-400" />
            </div>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="input text-xs py-2 pl-8 w-auto pr-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Month nav pill */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full px-1.5 py-1.5 shadow-sm">
            <button
              onClick={prevMonth}
              className="w-7 h-7 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/30 flex items-center justify-center transition-colors"
              aria-label="Oldingi oy"
            >
              <Icon path={ICONS.chevLeft} cls="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 w-32 text-center select-none px-1">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={isNextDisabled}
              className="w-7 h-7 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/30 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Keyingi oy"
            >
              <Icon path={ICONS.chevRight} cls="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────── */}
      <StatsStrip lessons={lessons} loading={lessonsLoad} />

      {/* ── Error state ─────────────────────────────────────────────── */}
      {lessonsErr && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-900/40 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Icon path={ICONS.warning} cls="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">Ma&apos;lumotlar yuklanmadi</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">API ulanishini tekshiring</p>
          </div>
          <button
            onClick={fetchLessons}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 px-3 py-2 rounded-xl border border-violet-100 dark:border-violet-800/40 transition-all"
          >
            <Icon path={ICONS.refresh} cls="w-3.5 h-3.5" />
            Qayta urinish
          </button>
        </div>
      )}

      {/* ── Lesson cards grid ────────────────────────────────────────── */}
      {lessonsLoad ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sortedLessons.length === 0 && !lessonsErr ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Icon path={ICONS.book} cls="w-8 h-8 text-violet-400 dark:text-violet-500" />
          </div>
          <p className="text-base font-semibold text-gray-700 dark:text-slate-200 mb-1">
            {MONTH_NAMES[month - 1]} {year} uchun dars topilmadi
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Boshqa oy yoki guruhni tanlang
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onMark={(l) => setConductingLesson(l)}
            />
          ))}
        </div>
      )}

      {/* ── Conduct modal ────────────────────────────────────────────── */}
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

export default LessonsPage;
