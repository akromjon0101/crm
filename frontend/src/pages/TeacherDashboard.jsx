import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConductModal from '../components/teacher/ConductModal';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v) =>
  v == null ? '—' : new Intl.NumberFormat('uz-UZ').format(v) + " so'm";

const UZ_DAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function formatTodayUz() {
  const d = new Date();
  return `${UZ_DAYS[d.getDay()]}, ${d.getDate()} ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Xayrli tong";
  if (h < 17) return "Xayrli kun";
  return "Xayrli kech";
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Icon = ({ path, cls = "w-5 h-5" }) => (
  <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d={path} />
  </svg>
);

const ICONS = {
  attendance: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  lessons:    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  earnings:   'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  money:      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users:      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  clock:      'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check:      'M5 13l4 4L19 7',
  arrow:      'M9 5l7 7-7 7',
};

// ─── Skeleton primitives ──────────────────────────────────────────────────────
const Sk = ({ cls }) => <div className={`skeleton rounded-xl ${cls}`} />;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, gradient, loading }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] flex flex-col gap-4">
    {loading ? (
      <>
        <div className="flex items-center justify-between">
          <Sk cls="h-11 w-11 rounded-full" />
          <Sk cls="h-2 w-2 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Sk cls="h-7 w-28" />
          <Sk cls="h-3 w-18" />
        </div>
      </>
    ) : (
      <>
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
            <Icon path={icon} cls="w-5 h-5 text-white" />
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{value}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">{label}</p>
        </div>
      </>
    )}
  </div>
);

// ─── Group Initials Avatar ────────────────────────────────────────────────────
const GroupAvatar = ({ name }) => {
  const words = (name || '').replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, ' ').trim().split(/\s+/);
  const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || (name?.[0]?.toUpperCase() ?? '?');
  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm shadow-violet-200 dark:shadow-violet-900/30">
      {initials}
    </div>
  );
};

// ─── Today Lesson Card ────────────────────────────────────────────────────────
const TodayLessonCard = ({ lesson, onConduct }) => {
  const isConducted = lesson.status === 'conducted';
  return (
    <div className={`relative bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-4 flex flex-col gap-3 transition-all duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${
      isConducted
        ? 'border-l-4 border-l-emerald-400'
        : 'border-l-4 border-l-violet-400'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <GroupAvatar name={lesson.group_name} />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate leading-tight">{lesson.group_name}</p>
            {lesson.time && (
              <div className="flex items-center gap-1 mt-0.5">
                <Icon path={ICONS.clock} cls="w-3 h-3 text-gray-400 dark:text-slate-500" />
                <span className="text-xs text-gray-400 dark:text-slate-500">{lesson.time}</span>
              </div>
            )}
          </div>
        </div>
        {isConducted ? (
          <span className="badge-green flex-shrink-0">O'tkazildi</span>
        ) : (
          <span className="badge-blue flex-shrink-0">Kutilmoqda</span>
        )}
      </div>

      {/* Students count row */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/40 rounded-xl px-3 py-1.5">
        <Icon path={ICONS.users} cls="w-3.5 h-3.5" />
        <span>
          {isConducted
            ? `${lesson.attended_count ?? 0}/${lesson.total_students ?? 0} talaba keldi`
            : `${lesson.total_students ?? 0} talaba`}
        </span>
      </div>

      {/* Action */}
      {isConducted ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Icon path={ICONS.check} cls="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Davomat belgilangan</span>
        </div>
      ) : (
        <button
          onClick={() => onConduct(lesson)}
          className="btn-primary btn-sm w-full justify-center"
        >
          Davomat belgilash
        </button>
      )}
    </div>
  );
};

// ─── Quick Action Card ────────────────────────────────────────────────────────
const QuickAction = ({ to, icon, label, sub, gradient }) => (
  <Link
    to={to}
    className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-150 shadow-[0_2px_12px_rgba(0,0,0,0.04)] group"
  >
    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <Icon path={icon} cls="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{label}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>
    </div>
    <div className="w-7 h-7 rounded-full bg-gray-50 dark:bg-slate-700/60 flex items-center justify-center group-hover:bg-violet-50 dark:group-hover:bg-violet-900/30 transition-colors">
      <Icon path={ICONS.arrow} cls="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
    </div>
  </Link>
);


// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const TeacherDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear  = now.getFullYear();

  const [todayLessons, setTodayLessons] = useState([]);
  const [earnings,     setEarnings]     = useState(null);
  const [loading,      setLoading]      = useState(true);

  const [conductingLesson, setConductingLesson] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get('/lessons/today'),
      api.get('/earnings/my', { params: { month: thisMonth, year: thisYear } }),
    ])
      .then(([lessonsRes, earningsRes]) => {
        if (cancelled) return;
        const lessonsData = lessonsRes.data?.data || lessonsRes.data || [];
        setTodayLessons(Array.isArray(lessonsData) ? lessonsData : []);
        setEarnings(earningsRes.data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Ma'lumotlar yuklanmadi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [thisMonth, thisYear]);

  const handleConductSuccess = () => {
    toast.success('Dars belgilandi!');
    setConductingLesson(null);
    api.get('/lessons/today')
      .then((r) => {
        const data = r.data?.data || r.data || [];
        setTodayLessons(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error("Darslar yangilanmadi"));
    api.get('/earnings/my', { params: { month: thisMonth, year: thisYear } })
      .then((r) => setEarnings(r.data))
      .catch(() => toast.error("Daromad yangilanmadi"));
  };

  const conductedCount  = todayLessons.filter((l) => l.status === 'conducted').length;
  const pendingCount    = todayLessons.filter((l) => l.status !== 'conducted').length;

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-7 animate-fadeIn pb-12">

      {/* ── Greeting header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5">
        {/* Background blob */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.05) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              {formatTodayUz()}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              <span className="text-gray-800 dark:text-slate-100">{getGreeting()}, </span>
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">{firstName}</span>
              <span className="text-gray-800 dark:text-slate-100">!</span>
            </h1>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1.5">
              {!loading && (
                todayLessons.length === 0
                  ? "Bugun dars yo'q — yaxshi dam oling"
                  : `Bugun ${todayLessons.length} ta dars${conductedCount > 0 ? `, ${conductedCount} ta o'tkazildi` : ''}`
              )}
            </p>
          </div>

          {/* Today's progress pill */}
          {!loading && todayLessons.length > 0 && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-primary-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-primary-100 dark:border-primary-800/40 px-5 py-3 rounded-2xl w-fit flex-shrink-0">
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                  </span>
                )}
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {todayLessons.length} ta dars
                </span>
              </div>
              <div className="w-px h-4 bg-violet-200 dark:bg-violet-700" />
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {conductedCount} ta o'tkazildi
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Bugungi daromad"
          value={fmt(earnings?.today_income)}
          icon={ICONS.money}
          gradient="from-violet-500 to-purple-600"
          loading={loading}
        />
        <KpiCard
          label="Oylik daromad"
          value={fmt(earnings?.month_income)}
          icon={ICONS.earnings}
          gradient="from-blue-500 to-indigo-600"
          loading={loading}
        />
        <KpiCard
          label="Darslar soni"
          value={loading ? '—' : `${earnings?.lessons_this_month ?? 0} ta`}
          icon={ICONS.lessons}
          gradient="from-emerald-400 to-teal-500"
          loading={loading}
        />
        <KpiCard
          label="Bugun o'tkazildi"
          value={loading ? '—' : `${conductedCount}/${todayLessons.length}`}
          icon={ICONS.check}
          gradient="from-orange-400 to-amber-500"
          loading={loading}
        />
      </div>

      {/* ── Today's lessons + Quick actions ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Today's lessons — 2/3 width on large */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {pendingCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                </span>
              )}
              <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest">
                Bugungi Darslar
              </h2>
            </div>
            {pendingCount > 0 && (
              <span className="badge-blue">{pendingCount} ta kutilmoqda</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2.5">
                    <Sk cls="h-10 w-10 rounded-xl" />
                    <div className="space-y-1.5 flex-1">
                      <Sk cls="h-4 w-28" />
                      <Sk cls="h-3 w-16" />
                    </div>
                  </div>
                  <Sk cls="h-8 w-full" />
                  <Sk cls="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : todayLessons.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-blue-100 dark:from-primary-900/30 dark:to-blue-900/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Icon path={ICONS.lessons} cls="w-8 h-8 text-violet-400 dark:text-violet-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Bugun dars yo'q</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 max-w-48">Dam oling yoki darsga tayyorlaning</p>
              <Link
                to="/attendance"
                className="mt-4 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                Davomat jurnalini ko'rish
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {todayLessons.map((lesson) => (
                <TodayLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onConduct={setConductingLesson}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick actions — 1/3 width on large */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest">
            Tezkor Harakatlar
          </h2>
          <div className="flex flex-col gap-3">
            <QuickAction
              to="/attendance"
              icon={ICONS.attendance}
              label="Davomat belgilash"
              sub="Guruh davomatini ko'ring"
              gradient="from-violet-500 to-purple-600"
            />
            <QuickAction
              to="/lessons"
              icon={ICONS.lessons}
              label="Darslarim"
              sub="Barcha darslar ro'yxati"
              gradient="from-blue-500 to-indigo-600"
            />
            <QuickAction
              to="/earnings"
              icon={ICONS.earnings}
              label="Daromadlarim"
              sub="Oylik hisob-kitob"
              gradient="from-indigo-500 to-violet-600"
            />
          </div>

          {/* Monthly progress */}
          {!loading && earnings?.month_income != null && earnings?.monthly_target != null && (() => {
            const target = earnings.monthly_target;
            const pct = target > 0
              ? Math.min(100, Math.round((earnings.month_income / target) * 100))
              : 0;
            const textColor = pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 60 ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400';
            const barColor  = pct >= 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : pct >= 60 ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-gradient-to-r from-amber-400 to-orange-500';
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Oylik maqsad</p>
                  <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 tabular-nums">
                  <span>{fmt(earnings.month_income)}</span>
                  <span>{fmt(target)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

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

export default TeacherDashboard;
