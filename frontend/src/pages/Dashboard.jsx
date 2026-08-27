import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/common/StatCard';
import { formatCurrency, MONTH_NAMES, MONTH_NAMES_SHORT } from '../utils/helpers';

// ── SVG icon shortcuts ────────────────────────────────────────────────────────
const SvgIcon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const PATHS = {
  students:   'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  teachers:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  groups:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  revenue:    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  debt:       'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  present:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  absent:     'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  clock:      'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  payment:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  plusUser:   'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  snowflake:  'M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364',
  archive:    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  transfer:   'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  bell:       'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  attendance: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  x:          'M6 18L18 6M6 6l12 12',
  refresh:    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

const Icon = ({ name, cls }) => <SvgIcon d={PATHS[name]} className={cls || 'w-5 h-5'} />;

// ── Safe time-ago helper ───────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
};

// ── Recharts custom tooltip ────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-lg rounded-xl px-3 py-2">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold text-gray-900 dark:text-slate-100">{fmt ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  );
};

// ── Section header ─────────────────────────────────────────────────────────────
const SH = ({ title, linkTo, linkLabel }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
    {linkTo && (
      <Link to={linkTo} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
        {linkLabel || 'View all'}
      </Link>
    )}
  </div>
);

// ── Skeleton row ───────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex items-center gap-3 py-2 animate-pulse">
    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="w-32 h-3.5 rounded bg-gray-200 dark:bg-slate-700" />
      <div className="w-20 h-3 rounded bg-gray-100 dark:bg-slate-700/60" />
    </div>
    <div className="w-16 h-3 rounded bg-gray-200 dark:bg-slate-700" />
  </div>
);

// ── Activity type config ───────────────────────────────────────────────────────
const ACTIVITY_CONFIG = {
  transfer:   { icon: 'transfer',  bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-600 dark:text-blue-400',    label: 'Transfer'   },
  payment:    { icon: 'payment',   bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'Payment'    },
  enrollment: { icon: 'plusUser',  bg: 'bg-violet-50 dark:bg-violet-900/30',  text: 'text-violet-600 dark:text-violet-400',  label: 'Enrollment' },
  freeze:     { icon: 'snowflake', bg: 'bg-cyan-50 dark:bg-cyan-900/30',    text: 'text-cyan-600 dark:text-cyan-400',    label: 'Frozen'     },
  archive:    { icon: 'archive',   bg: 'bg-gray-100 dark:bg-slate-700',   text: 'text-gray-500 dark:text-slate-400',    label: 'Archived'   },
  unfreeze:   { icon: 'present',   bg: 'bg-teal-50 dark:bg-teal-900/30',    text: 'text-teal-600 dark:text-teal-400',    label: 'Unfrozen'   },
};
const getActivityConfig = (type) =>
  ACTIVITY_CONFIG[type] || { icon: 'bell', bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', label: type };

// ── Quick action pill button ───────────────────────────────────────────────────
const QuickBtn = ({ icon, label, onClick, variant = 'secondary' }) => {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer border select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
  const variants = {
    primary:   'btn-primary',
    secondary: 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 shadow-sm',
    danger:    'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 shadow-sm',
  };
  return (
    <button onClick={onClick} className={base + ' ' + variants[variant]}>
      <Icon name={icon} cls="w-4 h-4" />
      {label}
    </button>
  );
};

// ── Today's classes widget ─────────────────────────────────────────────────────
const GROUP_COLORS = ['indigo', 'blue', 'emerald', 'violet', 'cyan', 'orange', 'pink', 'teal'];
const COLOR_MAP = {
  indigo:  'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800',
  blue:    'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
  violet:  'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800',
  cyan:    'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800',
  orange:  'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800',
  pink:    'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-100 dark:border-pink-800',
  teal:    'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800',
};

const TodayClasses = ({ groups }) => {
  const jsDay = new Date().getDay();
  const todayGroups = (groups || []).filter((g) => {
    if (!g.schedule) return false;
    const [daysStr] = g.schedule.split('|');
    return daysStr.split(',').map(Number).includes(jsDay);
  });

  if (!todayGroups.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-2">
          <Icon name="calendar" cls="w-6 h-6 text-indigo-400 dark:text-indigo-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No classes today</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todayGroups.map((g, i) => {
        const [, timeStr] = (g.schedule || '').split('|');
        const color = GROUP_COLORS[i % GROUP_COLORS.length];
        return (
          <div key={g.id} className={'flex items-center gap-3 p-3 rounded-xl border ' + COLOR_MAP[color] + ' transition-all hover:shadow-sm'}>
            <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Icon name="groups" cls="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{g.name}</p>
              <p className="text-xs opacity-70">{g.teacher_name || 'No teacher'} · {g.student_count || 0} students</p>
            </div>
            {timeStr && (
              <span className="text-xs font-bold opacity-80 flex-shrink-0 flex items-center gap-1">
                <Icon name="clock" cls="w-3 h-3" />
                {timeStr}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Status overview progress bar ───────────────────────────────────────────────
const StatusOverview = ({ active = 0, frozen = 0, archived = 0 }) => {
  const total = active + frozen + archived || 1;
  const activePct   = Math.round((active   / total) * 100);
  const frozenPct   = Math.round((frozen   / total) * 100);
  const archivedPct = Math.round((archived / total) * 100);
  const segments = [
    { label: 'Active',   count: active,   pct: activePct,   bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { label: 'Frozen',   count: frozen,   pct: frozenPct,   bar: 'bg-cyan-500',    dot: 'bg-cyan-500'    },
    { label: 'Archived', count: archived, pct: archivedPct, bar: 'bg-gray-300',    dot: 'bg-gray-400'    },
  ];
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-3">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div key={s.label} className={s.bar + ' rounded-full transition-all duration-500'} style={{ width: s.pct + '%' }} title={s.label + ': ' + s.count} />
          ) : null
        )}
      </div>
      <div className="flex items-center gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={'w-2 h-2 rounded-full ' + s.dot} />
            <span className="text-xs text-gray-500 dark:text-slate-400">{s.label}<span className="font-semibold text-gray-700 dark:text-slate-200 ml-1">{s.count}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Debtors snapshot ───────────────────────────────────────────────────────────
const DebtorsSnapshot = ({ debtors = [], loading, navigate }) => {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  }
  const top5 = debtors.slice(0, 5);
  if (!top5.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-2">
          <Icon name="present" cls="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        </div>
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">All payments up to date</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">No outstanding balances</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {top5.map((d, i) => (
        <button
          key={d.id || i}
          onClick={() => d.id && navigate('/students/' + d.id)}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {(d.student_name || d.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
              {d.student_name || d.name}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{d.group_name || 'No group'}</p>
          </div>
          <span className="text-xs font-bold text-red-600 dark:text-red-400 flex-shrink-0">
            {formatCurrency(d.balance || d.amount || 0)}
          </span>
        </button>
      ))}
    </div>
  );
};

// ── Recent activity feed ───────────────────────────────────────────────────────
const ActivityFeed = ({ activity = [], loading }) => {
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  }
  if (!activity.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-2">
          <Icon name="bell" cls="w-5 h-5 text-gray-400 dark:text-slate-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No recent activity</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {activity.slice(0, 10).map((item, i) => {
        const cfg = getActivityConfig(item.type);
        const ago = timeAgo(item.created_at || item.date);
        return (
          <div key={i} className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
            <div className={'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ' + cfg.bg + ' ' + cfg.text}>
              <Icon name={cfg.icon} cls="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.student_name || item.name || '—'}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed truncate">
                {item.description ||
                  (item.type === 'payment'    ? 'Paid ' + formatCurrency(item.amount) :
                   item.type === 'enrollment' ? 'Joined ' + (item.group_name || 'a group') :
                   item.type === 'freeze'     ? 'Frozen for ' + (item.freeze_days || '?') + ' days' :
                   item.type === 'transfer'   ? 'Transferred to ' + (item.group_name || 'a group') :
                   cfg.label)}
              </p>
            </div>
            {ago && <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 pt-0.5 whitespace-nowrap">{ago}</span>}
          </div>
        );
      })}
    </div>
  );
};

// ── Notifications widget ───────────────────────────────────────────────────────
const NotificationsWidget = ({ notifications = [], loading }) => {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  }
  if (!notifications.length) {
    return <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No notifications</p>;
  }
  return (
    <div className="space-y-2">
      {notifications.slice(0, 5).map((n, i) => {
        const isUnread = !n.read && !n.is_read;
        return (
          <div key={n.id || i} className={'flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ' + (isUnread ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30')}>
            {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
            <div className="flex-1 min-w-0">
              <p className={'text-xs leading-relaxed ' + (isUnread ? 'text-gray-800 dark:text-slate-200 font-medium' : 'text-gray-500 dark:text-slate-400')}>
                {n.message || n.text || n.body || '—'}
              </p>
              {(n.created_at || n.date) && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{timeAgo(n.created_at || n.date)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TEACHER DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/teacher-dashboard'),
      api.get('/groups'),
    ])
      .then(([d, g]) => {
        setData(d.data);
        setGroups(g.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Yuklanmoqda..." />;

  const today = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = user?.name?.split(' ')[0] || 'O\'qituvchi';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-10">
      
      {/* ── Top Bar ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-400 dark:text-slate-500 mb-1">{today}</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
            Welcome back, {firstName}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/attendance')}
            className="btn-primary px-5 py-2.5 rounded-full"
          >
            <Icon name="attendance" cls="w-4 h-4" />
            Mark Attendance
          </button>
          <button 
            onClick={() => navigate('/schedule')}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 px-5 py-2.5 rounded-full font-medium transition-all shadow-sm"
          >
            <Icon name="calendar" cls="w-4 h-4" />
            Jadval
          </button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-indigo-600 mb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl"><Icon name="groups" /></div>
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">My Groups</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{data?.my_groups ?? 0}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Faol guruhlar</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-blue-600 mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-2xl"><Icon name="students" /></div>
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">O'quvchilarim</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{data?.my_students ?? 0}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Jami o'quvchilar</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-emerald-600 mb-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl"><Icon name="present" /></div>
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Bugun kelgan</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{data?.present_today ?? 0}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-50 dark:bg-emerald-900/30 self-start px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">Keldi</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <div className="p-2.5 bg-red-50 dark:bg-red-900/30 rounded-2xl"><Icon name="absent" /></div>
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">Bugun kelmagan</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{data?.absent_today ?? 0}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-900/30 self-start px-2 py-0.5 rounded-full border border-red-100 dark:border-red-800">Yo'q</p>
        </div>
      </div>

      {/* ── Salary Banner ── */}
      {data?.total_salary != null && (
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-800 to-primary-900 rounded-xl p-5 shadow-xl shadow-primary-900/10 border border-primary-700">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/30 flex items-center justify-center text-white backdrop-blur-sm border border-white/10">
              <Icon name="revenue" cls="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-indigo-200 font-medium mb-1">Joriy oydagi daromad (Hisoblangan minimal)</p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-1.5 sm:gap-3">
                <p className="text-3xl font-bold text-white tracking-tight">
                  {formatCurrency(data.total_salary)}
                </p>
                <div className="mb-1.5 sm:px-2.5 sm:py-1 rounded-full sm:bg-white/10 sm:border border-white/10 text-[11px] sm:text-xs font-medium text-indigo-100 w-max">
                  {formatCurrency(data.salary_per_student)}/o'quvchi × {data.my_students} bosh
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Split Layout ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Today's Classes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-[0_2px_20px_rgb(0,0,0,0.04)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 tracking-tight">Today's Classes</h3>
            <Link to="/schedule" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-full transition-colors">
              To'liq jadval
            </Link>
          </div>
          
          <div className="space-y-3">
            {groups.filter((g) => {
              if (!g.schedule) return false;
              const [daysStr] = g.schedule.split('|');
              return daysStr.split(',').map(Number).includes(new Date().getDay());
            }).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3 shadow-sm text-gray-400 dark:text-slate-500">
                  <Icon name="calendar" cls="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-300">No classes today</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Maromida dam oling</p>
              </div>
            ) : groups.filter((g) => {
              if (!g.schedule) return false;
              const [daysStr] = g.schedule.split('|');
              return daysStr.split(',').map(Number).includes(new Date().getDay());
            }).map((g, i) => {
              const [, timeStr] = (g.schedule || '').split('|');
              const colors = ['bg-indigo-50 text-indigo-600', 'bg-emerald-50 text-emerald-600', 'bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600'];
              const c = colors[i % colors.length];
              return (
                <div key={g.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md hover:shadow-indigo-50/50 dark:hover:shadow-indigo-900/20 transition-all group cursor-pointer bg-white dark:bg-slate-800" onClick={() => navigate('/attendance')}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${c}`}>
                    <Icon name="groups" cls="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{g.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 px-2 py-0.5 rounded-md border border-gray-100 dark:border-slate-600">
                        {g.student_count || 0} o'quvchi
                      </span>
                    </div>
                  </div>
                  {timeStr && (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-600">
                      <Icon name="clock" cls="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                      {timeStr}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* My Groups List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-[0_2px_20px_rgb(0,0,0,0.04)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 tracking-tight">Mening guruhlarim</h3>
            <Link to="/groups" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition-colors">
              Barchasi
            </Link>
          </div>

          {!data?.groups?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
              <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3 shadow-sm text-gray-400 dark:text-slate-500">
                <Icon name="groups" cls="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-300">No groups assigned</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.groups.map((g, i) => (
                <div key={g.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer" onClick={() => navigate('/groups')}>
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{g.name}</p>
                    {g.schedule && <p className="text-xs font-medium text-gray-500 dark:text-slate-400 truncate mt-0.5">{g.schedule}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{g.student_count}</p>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Talaba</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/attendance'); }} title="Mark Attendance" className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-600 hover:text-white flex items-center justify-center transition-colors shadow-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const [stats,         setStats]         = useState(null);
  const [incomeData,    setIncomeData]     = useState([]);
  const [activity,      setActivity]      = useState([]);
  const [groups,        setGroups]        = useState([]);
  const [debtors,       setDebtors]       = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loadingMain,  setLoadingMain]  = useState(true);
  const [loadingAct,   setLoadingAct]   = useState(true);
  const [loadingDebt,  setLoadingDebt]  = useState(true);
  const [loadingNotif, setLoadingNotif] = useState(true);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [error,     setError]     = useState(null);

  // Primary data — blocks render. Uses allSettled so one failing endpoint
  // doesn't blank out the sections that loaded successfully.
  useEffect(() => {
    setLoadingMain(true);
    Promise.allSettled([
      api.get('/analytics/dashboard'),
      api.get('/analytics/income-chart', { params: { year: chartYear } }),
      api.get('/groups'),
    ])
      .then(([s, ic, g]) => {
        let failures = 0;

        if (s.status === 'fulfilled') setStats(s.value.data);
        else { failures++; console.warn('[Dashboard] analytics/dashboard failed', s.reason); }

        if (ic.status === 'fulfilled') {
          setIncomeData((ic.value.data || []).map((d) => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
        } else { failures++; console.warn('[Dashboard] income-chart failed', ic.reason); }

        if (g.status === 'fulfilled') setGroups(g.value.data || []);
        else { failures++; console.warn('[Dashboard] groups failed', g.reason); }

        setError(failures === 3 ? 'Failed to load dashboard data. Please refresh.' : null);
      })
      .finally(() => setLoadingMain(false));
  }, [chartYear]);

  // Secondary data — loads independently, no spinner
  useEffect(() => {
    api.get('/analytics/recent-activity')
      .then((r) => setActivity(r.data || []))
      .catch(() => setActivity([]))
      .finally(() => setLoadingAct(false));

    api.get('/payments/debtors')
      .then((r) => setDebtors(r.data?.data || r.data || []))
      .catch(() => setDebtors([]))
      .finally(() => setLoadingDebt(false));

    api.get('/notifications')
      .then((r) => setNotifications(r.data?.data || r.data || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotif(false));
  }, []);

  const currentMonthRevenue = incomeData[incomeData.length - 1]?.total || 0;
  const prevMonthRevenue    = incomeData[incomeData.length - 2]?.total || 0;
  const revTrend = prevMonthRevenue > 0
    ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
    : null;

  const activeCount   = stats?.active_students   ?? stats?.total_students   ?? 0;
  const frozenCount   = stats?.frozen_students   ?? stats?.frozen_count     ?? 0;
  const archivedCount = stats?.archived_students ?? stats?.archived_count   ?? 0;
  const debtorCount   = stats?.debtors           ?? 0;
  const yearTotal     = incomeData.reduce((s, d) => s + (d.total || 0), 0);

  if (loadingMain) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <Icon name="x" cls="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1"
          >
            <Icon name="refresh" cls="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
            Dashboard
            {revTrend != null && isAdmin && (
              <span className={'ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-md ' +
                (revTrend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
                {revTrend >= 0 ? '↑' : '↓'}{Math.abs(revTrend)}% vs last month
              </span>
            )}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/analytics" className="btn-secondary btn-sm">Analytics</Link>
          <Link to="/payments"  className="btn-primary  btn-sm">Payments</Link>
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">

        {/* Total Students */}
        <button
          onClick={() => navigate('/students')}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
            <Icon name="students" cls="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">
            {(activeCount + frozenCount + archivedCount) || stats?.total_students || 0}
          </p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Total Students</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {activeCount   > 0 && <span className="badge-green">{activeCount} active</span>}
            {frozenCount   > 0 && <span className="badge-blue">{frozenCount} frozen</span>}
            {archivedCount > 0 && <span className="badge-gray">{archivedCount} archived</span>}
          </div>
        </button>

        {/* Active Groups */}
        <button
          onClick={() => navigate('/groups')}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:border-blue-200 dark:hover:border-primary-700 hover:shadow-md transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <Icon name="groups" cls="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{stats?.total_groups ?? 0}</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Active Groups</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Running classes</p>
        </button>

        {/* Monthly Revenue — admin only */}
        {isAdmin ? (
          <button
            onClick={() => navigate('/analytics')}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Icon name="revenue" cls="w-4 h-4" />
              </div>
              {revTrend != null && (
                <span className={'text-xs font-semibold px-1.5 py-0.5 rounded-md ' +
                  (revTrend >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400')}>
                  {revTrend >= 0 ? '↑' : '↓'}{Math.abs(revTrend)}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">
              {formatCurrency(stats?.monthly_income ?? currentMonthRevenue)}
            </p>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Monthly Revenue</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{MONTH_NAMES[new Date().getMonth()]}</p>
          </button>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 opacity-40">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 mb-3" />
            <div className="h-7 w-12 rounded bg-gray-100 dark:bg-slate-700 mb-1" />
            <div className="h-4 w-20 rounded bg-gray-50 dark:bg-slate-700/50" />
          </div>
        )}

        {/* Debtors */}
        <button
          onClick={() => navigate('/payments?filter=overdue')}
          className={'bg-white dark:bg-slate-800 rounded-xl border p-4 text-left hover:shadow-md transition-all duration-150 ' +
            (debtorCount > 0 ? 'border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600')}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={'w-9 h-9 rounded-lg flex items-center justify-center ' +
              (debtorCount > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-slate-500')}>
              <Icon name="debt" cls="w-4 h-4" />
            </div>
            {debtorCount > 0 && <span className="badge-red">{debtorCount} overdue</span>}
          </div>
          <p className={'text-2xl font-bold tabular-nums leading-tight ' + (debtorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100')}>
            {debtorCount}
          </p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Debtors</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{debtorCount > 0 ? 'Needs attention' : 'No outstanding debts'}</p>
        </button>

        {/* Frozen Students */}
        <button
          onClick={() => navigate('/students?filter=frozen')}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:border-cyan-200 dark:hover:border-cyan-700 hover:shadow-md transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
            <Icon name="snowflake" cls="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{frozenCount}</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Frozen</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Temporarily paused</p>
        </button>

        {/* Teachers */}
        <button
          onClick={() => navigate('/teachers')}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:border-violet-200 dark:hover:border-violet-700 hover:shadow-md transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-3">
            <Icon name="teachers" cls="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{stats?.total_teachers ?? 0}</p>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-0.5">Teachers</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Active instructors</p>
        </button>

      </div>

      {/* Status overview bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Student Status Overview</p>
        <StatusOverview active={activeCount} frozen={frozenCount} archived={archivedCount} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickBtn icon="plusUser"   label="Add Student"     onClick={() => navigate('/students?action=add')}      variant="primary" />
        <QuickBtn icon="payment"    label="Add Payment"     onClick={() => navigate('/payments?action=add')} />
        <QuickBtn icon="attendance" label="Mark Attendance" onClick={() => navigate('/attendance')} />
        <QuickBtn
          icon="debt"
          label="View Debtors"
          onClick={() => navigate('/payments?filter=overdue')}
          variant={debtorCount > 0 ? 'danger' : 'secondary'}
        />
      </div>

      {/* 2-column layout */}
      <div className="grid xl:grid-cols-3 gap-5">

        {/* Left column (2/3) */}
        <div className="xl:col-span-2 space-y-5">

          {/* Income chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Monthly Revenue</h3>
                {isAdmin && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Year total: <span className="font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(yearTotal)}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={chartYear}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  className="input text-xs py-1 px-2 w-24"
                >
                  {[0, 1, 2].map((offset) => {
                    const y = new Date().getFullYear() - offset;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
                <Link to="/analytics" className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">Full report</Link>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={incomeData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'}
                />
                <Tooltip content={<ChartTip fmt={formatCurrency} />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                  dot={{ fill: '#2563EB', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <SH title="Recent Activity" linkTo="/students" linkLabel="View students" />
            <ActivityFeed activity={activity} loading={loadingAct} />
          </div>

        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">

          {/* Today's Classes */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <SH title="Today's Classes" linkTo="/schedule" linkLabel="Schedule" />
            <TodayClasses groups={groups} />
          </div>

          {/* Debtors snapshot — admin only */}
          {isAdmin && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  Debtors
                  {debtorCount > 0 && <span className="badge-red">{debtorCount}</span>}
                </h3>
                <Link to="/payments?filter=overdue" className="text-xs text-red-600 hover:text-red-700 font-medium">View all</Link>
              </div>
              <DebtorsSnapshot debtors={debtors} loading={loadingDebt} navigate={navigate} />
            </div>
          )}

          {/* Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <SH title="Notifications" />
            <NotificationsWidget notifications={notifications} loading={loadingNotif} />
          </div>

        </div>
      </div>

      {/* Debtors alert banner */}
      {debtorCount > 0 && isAdmin && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon name="debt" cls="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {debtorCount} student{debtorCount !== 1 ? 's have' : ' has'} overdue payments
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Review and follow up to keep revenue on track.</p>
          </div>
          <Link
            to="/payments?filter=overdue"
            className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap"
          >
            Review
          </Link>
        </div>
      )}

    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CEO DASHBOARD  (superadmin role)
// ══════════════════════════════════════════════════════════════════════════════

// Avatar colors for teacher rows
const AVATAR_COLORS = [
  'bg-primary-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-cyan-500',    'bg-pink-500',   'bg-teal-500',    'bg-orange-500',
];

// Skeleton rows for payroll loading state
const PayrollSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-1.5">
        <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="w-28 h-3.5 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="w-16 h-3 rounded bg-gray-100 dark:bg-slate-600" />
        </div>
        <div className="w-20 h-3.5 rounded bg-gray-200 dark:bg-slate-700" />
      </div>
    ))}
  </div>
);

const CeoDashboard = () => {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [stats,          setStats]          = useState(null);
  const [incomeData,     setIncomeData]     = useState([]);
  const [prevIncomeData, setPrevIncomeData] = useState([]);
  const [earnings,       setEarnings]       = useState([]);
  const [debtors,        setDebtors]        = useState([]);
  const [leadsCount,     setLeadsCount]     = useState(null);

  const [loadingMain,     setLoadingMain]     = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [error,     setError]     = useState(null);

  // ── Primary data (blocks render) ──────────────────────────────────────────
  useEffect(() => {
    setLoadingMain(true);
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/income-chart', { params: { year: chartYear } }),
      api.get('/analytics/income-chart', { params: { year: chartYear - 1 } }),
    ])
      .then(([s, ic, icPrev]) => {
        setStats(s.data);
        setIncomeData((ic.data || []).map((d) => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
        setPrevIncomeData(icPrev.data || []);
        setError(null);
      })
      .catch(() => setError('Failed to load dashboard data. Please refresh.'))
      .finally(() => setLoadingMain(false));
  }, [chartYear]);

  // ── Secondary data (non-blocking) ─────────────────────────────────────────
  useEffect(() => {
    setLoadingEarnings(true);
    Promise.all([
      api.get('/earnings/overview'),
      api.get('/payments/debtors'),
    ])
      .then(([e, d]) => {
        // /earnings/overview returns { period, total_income, teachers: [...] } —
        // not { data: [...] } like the paginated list endpoints — so the
        // teachers array must be read from its own key, not .data.
        setEarnings(e.data?.teachers || []);
        setDebtors(d.data?.data || d.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingEarnings(false));

    api.get('/leads').then((r) => {
      const list = r.data?.data || r.data || [];
      setLeadsCount(Array.isArray(list) ? list.length : null);
    }).catch(() => {});
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const now           = new Date();
  const currentMonth  = now.getMonth() + 1;

  const totalStudents = stats?.total_students ?? 0;
  const totalGroups   = stats?.total_groups   ?? 0;
  const totalTeachers = stats?.total_teachers ?? 0;
  const frozenCount   = stats?.frozen_count   ?? 0;
  const activeCount   = totalStudents - frozenCount;
  // Use stats.debtors (count from server) as the authoritative number
  const debtorCount   = stats?.debtors ?? 0;
  const monthRevenue  = stats?.monthly_income ?? 0;

  const payrollTotal  = earnings.reduce((sum, t) => sum + (t.month_income || 0), 0);
  const payrollMax    = Math.max(...earnings.map((t) => t.month_income || 0), 1);
  const netProfit     = monthRevenue - payrollTotal;
  const netIsPositive = netProfit >= 0;
  const profitMargin  = monthRevenue > 0 ? Math.round((netProfit   / monthRevenue) * 100) : 0;
  const payrollRatio  = monthRevenue > 0 ? Math.round((payrollTotal / monthRevenue) * 100) : 0;

  // Month-over-month revenue growth
  const lastMonthRevenue = incomeData.find((d) => d.month === currentMonth - 1)?.total ?? 0;
  const monthGrowth = lastMonthRevenue > 0
    ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  // Year totals + YoY comparison
  const yearTotal     = incomeData.reduce((s, d) => s + (d.total || 0), 0);
  const prevYearTotal = prevIncomeData.reduce((s, d) => s + (d.total || 0), 0);
  const yoyGrowth     = prevYearTotal > 0
    ? Math.round(((yearTotal - prevYearTotal) / prevYearTotal) * 100)
    : null;

  // Payment collection health
  const paidCount    = Math.max(0, totalStudents - debtorCount);
  const paidPct      = totalStudents > 0 ? Math.round((paidCount   / totalStudents) * 100) : 0;
  const debtorPct    = totalStudents > 0 ? Math.round((debtorCount / totalStudents) * 100) : 0;
  const pendingPct   = Math.max(0, 100 - paidPct - debtorPct);
  const pendingCount = Math.round((pendingPct / 100) * totalStudents);
  const collectionRate = paidPct;
  const collectionColor =
    collectionRate > 80
      ? { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
      : collectionRate > 50
      ? { bar: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400'    }
      : { bar: 'bg-red-500',     text: 'text-red-600 dark:text-red-400'        };

  const topTeachers = [...earnings].sort((a, b) => (b.month_income || 0) - (a.month_income || 0)).slice(0, 7);
  const topDebtors  = debtors.slice(0, 6);

  if (loadingMain) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="space-y-5 pb-10 animate-fadeIn">

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <Icon name="x" cls="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1"
          >
            <Icon name="refresh" cls="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ── Alert: overdue payments ────────────────────────────────────────── */}
      {debtorCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
            <Icon name="debt" cls="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {debtorCount} ta o'quvchi to'lovini amalga oshirmagan — undirilish darajasi {collectionRate}%
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
              {paidCount} / {totalStudents} nafar to'lagan
            </p>
          </div>
          <Link
            to="/payments"
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors flex-shrink-0 whitespace-nowrap"
          >
            Ko'rish →
          </Link>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">
            {now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">
            Boshqaruv paneli
            {monthGrowth !== null && (
              <span className={'ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-md ' +
                (monthGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
                {monthGrowth >= 0 ? '↑' : '↓'}{Math.abs(monthGrowth)}% o'tgan oyga nisbatan
              </span>
            )}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/analytics"      className="btn-secondary btn-sm">Hisobotlar</Link>
          <Link to="/admin-earnings" className="btn-secondary btn-sm">Maoshlar</Link>
          <Link to="/payments"       className="btn-primary  btn-sm">To'lovlar</Link>
        </div>
      </div>

      {/* ── Profit Summary (Revenue / Payroll / Net) ──────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-slate-700">

          <div className="p-5 lg:p-6">
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Daromad</p>
            <p className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none">
              {formatCurrency(monthRevenue)}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
              {yoyGrowth !== null && (
                <span className={'ml-2 font-semibold ' + (yoyGrowth >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {yoyGrowth >= 0 ? '▲' : '▼'}{Math.abs(yoyGrowth)}% YoY
                </span>
              )}
            </p>
          </div>

          <div className="p-5 lg:p-6">
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Xarajat (maosh)</p>
            <p className="text-2xl lg:text-3xl font-black text-orange-500 tabular-nums leading-none">
              {loadingEarnings
                ? <span className="inline-block w-32 h-8 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                : formatCurrency(payrollTotal)}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              {loadingEarnings ? '…' : `Daromadning ${payrollRatio}%i`}
            </p>
          </div>

          <div className={`p-5 lg:p-6 ${netIsPositive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Sof foyda</p>
            <p className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${
              netIsPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}>
              {loadingEarnings
                ? <span className="inline-block w-32 h-8 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                : formatCurrency(Math.abs(netProfit))}
            </p>
            <p className={`text-xs font-semibold mt-2 ${netIsPositive ? 'text-emerald-500' : 'text-red-400'}`}>
              {loadingEarnings ? '…' : (netIsPositive ? `▲ ${profitMargin}% marja` : '▼ Zarar')}
            </p>
          </div>

        </div>

        {/* Payroll vs profit color bar */}
        {!loadingEarnings && monthRevenue > 0 && (
          <div className="h-1.5 flex">
            <div className="bg-orange-400 transition-all duration-700" style={{ width: `${payrollRatio}%` }} />
            <div className={`flex-1 transition-all duration-700 ${netIsPositive ? 'bg-emerald-500' : 'bg-red-400'}`} />
          </div>
        )}
      </div>

      {/* ── 4 KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Monthly Revenue */}
        <button
          onClick={() => navigate('/analytics')}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 text-left hover:shadow-md transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-emerald-500" />
          <div className="flex items-start justify-between mb-3 mt-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Icon name="revenue" cls="w-[18px] h-[18px]" />
            </div>
            {monthGrowth !== null && (
              <span className={'text-[11px] font-bold px-2 py-0.5 rounded-full border ' +
                (monthGrowth >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800')}>
                {monthGrowth >= 0 ? '▲' : '▼'} {Math.abs(monthGrowth)}%
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{formatCurrency(monthRevenue)}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">Oylik daromad</p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">o'tgan oyga nisbatan</p>
        </button>

        {/* Teacher Payroll */}
        <button
          onClick={() => navigate('/admin-earnings')}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 text-left hover:shadow-md transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-orange-500" />
          <div className="flex items-start justify-between mb-3 mt-1">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Icon name="teachers" cls="w-[18px] h-[18px]" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
              {payrollRatio}%
            </span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">
            {loadingEarnings
              ? <span className="inline-block w-28 h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              : formatCurrency(payrollTotal)}
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">O'qituvchi maoshi</p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{earnings.length} nafar o'qituvchi</p>
        </button>

        {/* Net Profit */}
        <button
          onClick={() => navigate('/analytics')}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 text-left hover:shadow-md transition-all duration-200 relative overflow-hidden"
        >
          <div className={'absolute top-0 left-0 right-0 h-1 rounded-t-2xl ' + (netIsPositive ? 'bg-primary-500' : 'bg-red-500')} />
          <div className="flex items-start justify-between mb-3 mt-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              netIsPositive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              <Icon name="revenue" cls="w-[18px] h-[18px]" />
            </div>
            <span className={'text-[11px] font-bold px-2 py-0.5 rounded-full border ' +
              (netIsPositive
                ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-800'
                : 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800')}>
              {Math.abs(profitMargin)}% marja
            </span>
          </div>
          <p className={`text-xl font-bold tabular-nums leading-tight ${
            netIsPositive ? 'text-primary-700 dark:text-primary-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {loadingEarnings
              ? <span className="inline-block w-28 h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              : formatCurrency(Math.abs(netProfit))}
          </p>
          <p className={`text-xs font-medium mt-1 ${netIsPositive ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}`}>
            {netIsPositive ? '▲ Foyda' : '▼ Zarar'}
          </p>
          <p className={`text-[11px] mt-0.5 ${netIsPositive ? 'text-primary-400 dark:text-primary-500' : 'text-red-400'}`}>
            {netIsPositive ? '+' : ''}{profitMargin}% marja
          </p>
        </button>

        {/* Collection Rate */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-teal-500" />
          <div className="flex items-start justify-between mb-3 mt-1">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Icon name="present" cls="w-[18px] h-[18px]" />
            </div>
            {debtorCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800">
                {debtorCount} qarzdor
              </span>
            )}
          </div>
          <p className={`text-xl font-bold tabular-nums leading-tight ${collectionColor.text}`}>{collectionRate}%</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">Undirilish darajasi</p>
          <div className="mt-2 w-full h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div className={`${collectionColor.bar} h-full rounded-full transition-all duration-700`} style={{ width: collectionRate + '%' }} />
          </div>
        </div>

      </div>

      {/* ── Compact stats ribbon (Students / Groups / Teachers / Leads) ────── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-slate-700">

          {/* Students */}
          <button
            onClick={() => navigate('/students')}
            className="p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <Icon name="students" cls="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">O'quvchilar</span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none">{totalStudents}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCount} faol</span>
              {frozenCount > 0 && <span className="text-blue-500 dark:text-blue-400 font-semibold">{frozenCount} muzlatilgan</span>}
            </div>
            {totalStudents > 0 && (
              <div className="flex h-1 rounded-full overflow-hidden gap-px mt-2">
                <div className="bg-emerald-500 h-full" style={{ width: ((activeCount / totalStudents) * 100) + '%' }} />
                {frozenCount > 0 && <div className="bg-blue-400 h-full" style={{ width: ((frozenCount / totalStudents) * 100) + '%' }} />}
              </div>
            )}
          </button>

          {/* Groups */}
          <button
            onClick={() => navigate('/groups')}
            className="p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Icon name="groups" cls="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Guruhlar</span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none">{totalGroups}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">Faol darslar</p>
          </button>

          {/* Teachers */}
          <button
            onClick={() => navigate('/teachers')}
            className="p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Icon name="teachers" cls="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">O'qituvchilar</span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none">{totalTeachers}</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">Faol instruktorlar</p>
          </button>

          {/* Leads */}
          <button
            onClick={() => navigate('/leads')}
            className="p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Icon name="bell" cls="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Lidlar</span>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none">
              {leadsCount ?? '—'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">Potentsial o'quvchilar</p>
          </button>

        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <QuickBtn icon="plusUser"   label="O'quvchi qo'shish"   onClick={() => navigate('/students?action=add')}       variant="primary"   />
        <QuickBtn icon="payment"    label="To'lov qabul qilish" onClick={() => navigate('/payments?action=add')}                           />
        <QuickBtn icon="attendance" label="Davomat"             onClick={() => navigate('/attendance')}                                    />
        <QuickBtn icon="teachers"   label="Maoshlar"            onClick={() => navigate('/admin-earnings')}                                />
        <QuickBtn
          icon="debt"
          label={debtorCount > 0 ? `${debtorCount} qarzdor` : 'Qarzdorlar'}
          onClick={() => navigate('/payments')}
          variant={debtorCount > 0 ? 'danger' : 'secondary'}
        />
      </div>

      {/* ── Revenue Chart + Top Debtors ────────────────────────────────────── */}
      <div className="grid xl:grid-cols-5 gap-5">

        {/* Revenue Trend Chart */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Daromad trendi</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                Yillik jami:{' '}
                <span className="font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(yearTotal)}</span>
                {prevYearTotal > 0 && (
                  <span className="ml-2">{chartYear - 1}: {formatCurrency(prevYearTotal)}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((offset) => {
                const y = new Date().getFullYear() - offset;
                return (
                  <button
                    key={y}
                    onClick={() => setChartYear(y)}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                      chartYear === y
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={incomeData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="ceoRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' :
                  v >= 1000    ? Math.round(v / 1000) + 'K'     : String(v)
                }
              />
              <Tooltip content={<ChartTip fmt={formatCurrency} />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#ceoRevGrad)"
                dot={{ fill: '#2563EB', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Debtors */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col">
          <SH title="Asosiy qarzdorlar" linkTo="/payments" linkLabel="Barchasi →" />

          {topDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-2">
                <Icon name="present" cls="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Barcha to'lovlar o'z vaqtida!</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Muddati o'tgan to'lovlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-1 flex-1">
              {topDebtors.map((d, i) => (
                <button
                  key={d.student_id || i}
                  onClick={() => d.student_id && navigate(`/students/${d.student_id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                    {(d.student_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{d.student_name || 'Noma\'lum'}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                      {d.group_name || '—'}{d.teacher_name ? ` · ${d.teacher_name}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 flex-shrink-0">
                    qarzdor
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Payroll Table + Payment Status ────────────────────────────────── */}
      <div className="grid xl:grid-cols-5 gap-5">

        {/* Teacher Payroll Table */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col">
          <SH title="O'qituvchilar maoshi" linkTo="/admin-earnings" linkLabel="Barchasi →" />

          {loadingEarnings ? (
            <PayrollSkeleton />
          ) : topTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
              <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-2">
                <Icon name="teachers" cls="w-5 h-5 text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Maosh ma'lumotlari yo'q</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="space-y-1 flex-1">
                {topTeachers.map((t, i) => (
                  <div
                    key={t.teacher_id || i}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {(t.teacher_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{t.teacher_name || 'Noma\'lum'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                          {t.students_taught ?? 0} o'quvchi
                        </span>
                        <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="bg-primary-500 h-1 rounded-full transition-all duration-500"
                            style={{ width: (((t.month_income || 0) / payrollMax) * 100) + '%' }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 tabular-nums flex-shrink-0">
                      {formatCurrency(t.month_income || 0)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between px-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  Jami ({earnings.length} ta o'qituvchi)
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(payrollTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <SH title="To'lov holati" />

          {totalStudents === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Ma'lumot yo'q.</p>
          ) : (
            <>
              {/* Stacked progress bar */}
              <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5 mb-5">
                {paidPct    > 0 && <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: paidPct    + '%' }} title={`To'lagan: ${paidCount}`}    />}
                {pendingPct > 0 && <div className="bg-amber-400  h-full rounded-full transition-all duration-700" style={{ width: pendingPct + '%' }} title={`Kutilmoqda: ${pendingCount}`} />}
                {debtorPct  > 0 && <div className="bg-red-500    h-full rounded-full transition-all duration-700" style={{ width: debtorPct  + '%' }} title={`Muddati o'tgan: ${debtorCount}`} />}
              </div>

              <div className="space-y-3">
                {[
                  { icon: 'present', label: "To'lagan",       count: paidCount,    pct: paidPct,    cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                  { icon: 'clock',   label: "Kutilmoqda",     count: pendingCount, pct: pendingPct, cls: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/30'    },
                  { icon: 'absent',  label: "Muddati o'tgan", count: debtorCount,  pct: debtorPct,  cls: debtorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-500', bg: 'bg-red-50 dark:bg-red-900/30' },
                ].map(({ icon, label, count, pct, cls, bg }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon name={icon} cls={`w-3.5 h-3.5 ${cls}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300 flex-1">{label}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100 tabular-nums">{count}</span>
                    <span className={`text-xs font-semibold tabular-nums w-9 text-right ${cls}`}>{pct}%</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                  Jami {totalStudents} nafar o'quvchi
                </p>
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
};

// ── Root export ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  return user?.role === 'teacher'
    ? <TeacherDashboard />
    : user?.role === 'superadmin'
      ? <CeoDashboard />
      : <AdminDashboard />;
};

export default Dashboard;
