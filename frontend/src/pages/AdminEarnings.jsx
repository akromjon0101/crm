import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, MONTH_NAMES } from '../utils/helpers';
import useDarkMode from '../hooks/useDarkMode';

// ── SVG icon helper ────────────────────────────────────────────────────────────
const Ic = ({ d, cls = 'w-5 h-5' }) => (
  <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  money:    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  teachers: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  book:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  users:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  groups:   'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  chevronL: 'M15 19l-7-7 7-7',
  chevronR: 'M9 5l7 7-7 7',
  chevronD: 'M19 9l-7 7-7-7',
  chevronU: 'M5 15l7-7 7 7',
  x:        'M6 18L18 6M6 6l12 12',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  star:     'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  analytics:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  edit:     'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
};

// ── Summary KPI card ───────────────────────────────────────────────────────────
const SummaryCard = ({ title, value, subtitle, icon, bg, text, loading }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
    {loading ? (
      <div className="space-y-3">
        <div className="w-9 h-9 rounded-lg skeleton" />
        <div className="h-7 w-28 skeleton rounded" />
        <div className="h-3.5 w-20 skeleton rounded" />
      </div>
    ) : (
      <>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${bg} ${text}`}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{value}</p>
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </>
    )}
  </div>
);

// ── Income share pill ──────────────────────────────────────────────────────────
const SharePill = ({ pct }) => {
  const n = parseFloat(pct) || 0;
  const cls =
    n >= 30 ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' :
    n >= 15 ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' :
    n >= 5  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
    'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {n.toFixed(1)}%
    </span>
  );
};

// ── Rank indicator ─────────────────────────────────────────────────────────────
const RankBadge = ({ rank }) => {
  if (rank === 1) return (
    <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-sm">
      <svg className="w-4 h-4 fill-amber-400 stroke-amber-500" strokeWidth={1} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.star} />
      </svg>
      #1
    </span>
  );
  const color =
    rank === 2 ? 'text-slate-500' :
    rank === 3 ? 'text-amber-700' :
    'text-gray-400';
  return <span className={`font-bold text-sm ${color}`}>#{rank}</span>;
};

// ── Recharts custom tooltip ────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-lg rounded-xl px-3 py-2.5">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Day {label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{formatCurrency(payload[0].value)}</p>
      {payload[0].payload?.lessons > 0 && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{payload[0].payload.lessons} lesson{payload[0].payload.lessons !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
};

// ── Teacher Detail Panel ───────────────────────────────────────────────────────
const TeacherDetailPanel = ({ teacherId, month, year, onClose }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/earnings/teacher/${teacherId}`, { params: { month, year } })
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load teacher details.'))
      .finally(() => setLoading(false));
  }, [teacherId, month, year]);

  useEffect(() => { fetch(); }, [fetch]);

  const chartData = useMemo(() => {
    return (data?.daily_chart || []).map((item) => ({
      ...item,
      fill: item.income > 0 ? '#818cf8' : '#e5e7eb',
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 shadow-md p-6 space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 skeleton rounded" />
          <div className="w-7 h-7 skeleton rounded-lg" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-48 skeleton rounded-xl" />
        <div className="h-32 skeleton rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/50 p-5 flex items-center gap-3">
        <Ic d={ICONS.x} cls="w-4 h-4 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700 flex-1">{error}</p>
        <button onClick={fetch} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
          <Ic d={ICONS.refresh} cls="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 shadow-md p-6 space-y-5 animate-fadeIn">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">{data.teacher?.name || 'Teacher Details'}</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {data.teacher?.subject || ''} · {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close">
          <Ic d={ICONS.x} cls="w-4 h-4" />
        </button>
      </div>

      {/* 3 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Month Income</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(data.month_income ?? 0)}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Lessons Conducted</p>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
            {(data.group_breakdown || []).reduce((s, g) => s + (g.lessons || 0), 0)}
          </p>
        </div>
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/40 rounded-xl p-4">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">Students Attended</p>
          <p className="text-xl font-bold text-primary-700 dark:text-primary-300 tabular-nums">
            {(data.group_breakdown || []).reduce((s, g) => s + (g.attended || 0), 0)}
          </p>
        </div>
      </div>

      {/* Daily chart */}
      {chartData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Daily Earnings</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -15 }} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 9, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'K' : v}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="income" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.income > 0 ? '#818cf8' : '#e5e7eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-group breakdown */}
      {data.group_breakdown?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Group Breakdown</p>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Lessons</th>
                  <th>Attended</th>
                  <th>Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {data.group_breakdown.map((g, i) => (
                  <tr key={g.group_id || i} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="font-medium text-gray-900 dark:text-slate-100">{g.group_name || '—'}</td>
                    <td className="tabular-nums text-gray-600 dark:text-slate-300">{g.lessons ?? 0}</td>
                    <td className="tabular-nums text-gray-600 dark:text-slate-300">{g.attended ?? 0}</td>
                    <td className="font-semibold text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(g.income ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin note */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
        <Ic d={ICONS.info} cls="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Admin can adjust individual lesson records from the <strong>Lessons page</strong> to correct attendance or income discrepancies.
        </p>
      </div>
    </div>
  );
};

// ── Skeleton table row ─────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3.5 rounded bg-gray-100 dark:bg-slate-700" style={{ width: i === 1 ? 120 : i === 0 ? 32 : 64 }} />
      </td>
    ))}
  </tr>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const AdminEarnings = () => {
  useAuth(); // ensure auth context is loaded
  const toast = useToast();
  const isDark = useDarkMode();
  const chartGrid = isDark ? '#1e293b' : '#f0f4f8';
  const chartTick = isDark ? '#94a3b8' : '#9ca3af';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [overview,        setOverview]        = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [expandedTeacher, setExpandedTeacher] = useState(null);
  const [sortKey,         setSortKey]         = useState('month_income');
  const [sortDir,         setSortDir]         = useState('desc');

  // ── Fetch overview ─────────────────────────────────────────────────────────
  const fetchOverview = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/earnings/overview', { params: { month, year } })
      .then((r) => setOverview(r.data))
      .catch(() => setError('Failed to load earnings overview.'))
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setExpandedTeacher(null);
  };
  const nextMonth = () => {
    if (year === now.getFullYear() && month >= now.getMonth() + 1) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setExpandedTeacher(null);
  };
  const isNextDisabled = year === now.getFullYear() && month >= now.getMonth() + 1;

  // ── Sorting ───────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedTeachers = useMemo(() => {
    const list = [...(overview?.teachers || [])];
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const num = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? num : -num;
    });
    return list;
  }, [overview?.teachers, sortKey, sortDir]);

  // ── Top earner id ─────────────────────────────────────────────────────────
  const topEarnerId = useMemo(() => {
    const list = overview?.teachers || [];
    if (!list.length) return null;
    return list.reduce((best, t) => (t.month_income > best.month_income ? t : best), list[0]).id;
  }, [overview?.teachers]);

  // ── Column header with sort indicator ────────────────────────────────────
  const SortTh = ({ label, field, right = false }) => {
    const active = sortKey === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`cursor-pointer select-none text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors ${right ? 'text-right' : ''} ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="text-gray-300 dark:text-slate-600">
            {active ? (
              <Ic d={sortDir === 'asc' ? ICONS.chevronU : ICONS.chevronD} cls="w-3 h-3 text-indigo-400 dark:text-indigo-400" />
            ) : (
              <Ic d={ICONS.chevronD} cls="w-3 h-3 text-gray-300 dark:text-slate-600" />
            )}
          </span>
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">Admin View</p>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">Teacher Earnings Overview</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-1 py-1 shadow-sm">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Ic d={ICONS.chevronL} cls="w-4 h-4 text-gray-500 dark:text-slate-400" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 min-w-[110px] text-center px-1">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={isNextDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Ic d={ICONS.chevronR} cls="w-4 h-4 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl">
          <Ic d={ICONS.x} cls="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            onClick={fetchOverview}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
          >
            <Ic d={ICONS.refresh} cls="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ── Summary KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Income"
          value={loading ? '—' : formatCurrency(overview?.total_income ?? 0)}
          subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
          icon={<Ic d={ICONS.money} cls="w-4 h-4" />}
          bg="bg-emerald-50"
          text="text-emerald-600"
          loading={loading}
        />
        <SummaryCard
          title="Active Teachers"
          value={loading ? '—' : (overview?.teachers?.length ?? 0)}
          subtitle="With earnings this period"
          icon={<Ic d={ICONS.teachers} cls="w-4 h-4" />}
          bg="bg-indigo-50"
          text="text-indigo-600"
          loading={loading}
        />
        <SummaryCard
          title="Lessons Conducted"
          value={loading ? '—' : (
            (overview?.teachers || []).reduce((s, t) => s + (t.lessons_conducted ?? 0), 0)
          )}
          subtitle="Across all groups"
          icon={<Ic d={ICONS.book} cls="w-4 h-4" />}
          bg="bg-blue-50"
          text="text-blue-600"
          loading={loading}
        />
        <SummaryCard
          title="Students Taught"
          value={loading ? '—' : (
            (overview?.teachers || []).reduce((s, t) => s + (t.students_taught ?? 0), 0)
          )}
          subtitle="Unique student visits"
          icon={<Ic d={ICONS.users} cls="w-4 h-4" />}
          bg="bg-amber-50"
          text="text-amber-600"
          loading={loading}
        />
      </div>

      {/* ── Leaderboard Table ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Teacher Leaderboard</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500">Click column headers to sort · Click "Details" to expand</p>
        </div>

        {loading ? (
          <table className="tbl">
            <thead>
              <tr>
                {['Rank', 'Teacher', 'Groups', 'Students', 'Lessons', 'Income', 'Share', ''].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : sortedTeachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center mb-3">
              <Ic d={ICONS.teachers} cls="w-7 h-7 text-gray-300 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No earnings data for this period</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Teachers need to conduct lessons for earnings to appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700">
                    Rank
                  </th>
                  <SortTh label="Teacher" field="name" />
                  <SortTh label="Groups" field="active_groups" />
                  <SortTh label="Students" field="students_taught" />
                  <SortTh label="Lessons" field="lessons_conducted" />
                  <SortTh label="Month Income" field="month_income" />
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700">
                    Share
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {sortedTeachers.map((teacher, idx) => {
                  const rank = idx + 1;
                  const isTop = teacher.id === topEarnerId;
                  const isExpanded = expandedTeacher === teacher.id;

                  return (
                    <React.Fragment key={teacher.id}>
                      <tr
                        className={`transition-colors ${
                          isTop
                            ? 'bg-amber-50/70 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'hover:bg-gray-50/60 dark:hover:bg-slate-700/40'
                        } ${isExpanded ? 'border-b-0' : ''}`}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3 w-12">
                          <RankBadge rank={rank} />
                        </td>

                        {/* Teacher name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isTop ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                              }`}
                            >
                              {(teacher.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate max-w-[140px]">
                                {teacher.name}
                              </p>
                              {teacher.subject && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{teacher.subject}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Groups */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-slate-300">
                            <Ic d={ICONS.groups} cls="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                            {teacher.active_groups ?? 0}
                          </span>
                        </td>

                        {/* Students taught */}
                        <td className="px-4 py-3 tabular-nums text-sm text-gray-700 dark:text-slate-300">
                          {teacher.students_taught ?? 0}
                        </td>

                        {/* Lessons conducted */}
                        <td className="px-4 py-3 tabular-nums text-sm text-gray-700 dark:text-slate-300">
                          {teacher.lessons_conducted ?? 0}
                        </td>

                        {/* Month income */}
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold tabular-nums ${isTop ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}`}>
                            {formatCurrency(teacher.month_income ?? 0)}
                          </span>
                        </td>

                        {/* Income share */}
                        <td className="px-4 py-3">
                          <SharePill pct={teacher.income_share} />
                        </td>

                        {/* Details button */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isExpanded
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                          >
                            <Ic d={ICONS.analytics} cls="w-3.5 h-3.5" />
                            {isExpanded ? 'Close' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail panel row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-4 pt-1 bg-indigo-50/30 dark:bg-indigo-900/10">
                            <TeacherDetailPanel
                              teacherId={teacher.id}
                              month={month}
                              year={year}
                              onClose={() => setExpandedTeacher(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer summary */}
        {!loading && sortedTeachers.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {sortedTeachers.length} teacher{sortedTeachers.length !== 1 ? 's' : ''} · {MONTH_NAMES[month - 1]} {year}
            </p>
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Total payout: <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(overview?.total_income ?? 0)}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Admin guidance note ───────────────────────────────────────── */}
      {!loading && sortedTeachers.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-primary-900/20 border border-blue-100 dark:border-primary-900/40 rounded-xl">
          <Ic d={ICONS.info} cls="w-4 h-4 text-blue-500 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-primary-300">Admin Tip</p>
            <p className="text-xs text-blue-600 dark:text-primary-400 mt-0.5 leading-relaxed">
              Click <strong>Details</strong> on any teacher row to view their daily chart and per-group breakdown.
              To adjust individual lesson records (attendance or income), navigate to the <strong>Lessons page</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEarnings;
