import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import useDarkMode from '../hooks/useDarkMode';

// --- Utils ---
const formatCurrency = (val) => new Intl.NumberFormat('uz-UZ').format(val || 0) + " so'm";
const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

// --- Icons ---
const Icon = ({ name, cls = "w-5 h-5" }) => {
  const paths = {
    chevronLeft:  "M15 19l-7-7 7-7",
    chevronRight: "M9 5l7 7-7 7",
    calendar:     "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    money:        "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    users:        "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    book:         "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    check:        "M5 13l4 4L19 7",
    chart:        "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  };
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
};

// --- Custom Recharts Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-xl rounded-2xl p-3">
      <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">Kun {label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

// --- KPI Stat Card (flat, clean) ---
const StatCard = ({ label, value, iconName, gradient, loading }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] flex flex-col gap-4">
    {loading ? (
      <>
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-7 w-28 rounded-lg" />
          <div className="skeleton h-3 w-18 rounded-lg" />
        </div>
      </>
    ) : (
      <>
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
            <Icon name={iconName} cls="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-tight">{value}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">{label}</p>
        </div>
      </>
    )}
  </div>
);

// --- Main Component ---
export default function TeacherEarnings() {
  const { user } = useAuth();
  const toast = useToast();
  const isDark = useDarkMode();
  const chartTick = isDark ? '#94a3b8' : '#A1A1AA';
  const dateObj = new Date();

  const [month, setMonth] = useState(dateObj.getMonth() + 1);
  const [year, setYear] = useState(dateObj.getFullYear());

  const [earnings, setEarnings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = month === dateObj.getMonth() + 1 && year === dateObj.getFullYear();
  const todayDay = isCurrentMonth ? dateObj.getDate() : -1;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [earnRes, histRes] = await Promise.all([
        api.get('/earnings/my', { params: { month, year } }),
        api.get('/earnings/history', { params: { month, year, limit: 50 } })
      ]);
      setEarnings(earnRes.data);
      setHistory(histRes.data?.data || []);
    } catch {
      toast.error("Ma'lumotlar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMonthChange = (dir) => {
    if (dir === -1) {
      if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
    } else {
      if (isCurrentMonth) return;
      if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
    }
  };

  const chartData = useMemo(() => {
    if (!earnings?.daily_chart) return [];
    return earnings.daily_chart.map(d => ({
      ...d,
      isToday: d.day === todayDay,
    }));
  }, [earnings, todayDay]);

  // Format date for history table nicely
  const formatHistoryDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn text-gray-900 dark:text-slate-100 pb-12">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">Daromadlar</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 font-medium">{user?.name}</p>
        </div>

        {/* Month nav pill */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full px-2 py-2 shadow-sm w-fit">
          <button
            onClick={() => handleMonthChange(-1)}
            className="w-8 h-8 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/30 flex items-center justify-center transition-colors text-gray-500 dark:text-slate-400"
            aria-label="Oldingi oy"
          >
            <Icon name="chevronLeft" cls="w-4 h-4" />
          </button>
          <span className="w-28 text-center text-sm font-semibold select-none text-gray-800 dark:text-slate-200 px-1">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={() => handleMonthChange(1)}
            disabled={isCurrentMonth}
            className="w-8 h-8 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/30 flex items-center justify-center transition-colors text-gray-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Keyingi oy"
          >
            <Icon name="chevronRight" cls="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Bugun"
          value={loading ? '—' : formatCurrency(earnings?.today_income)}
          iconName="money"
          gradient="from-violet-500 to-purple-600"
          loading={loading}
        />
        <StatCard
          label="Bu oy"
          value={loading ? '—' : formatCurrency(earnings?.month_income)}
          iconName="calendar"
          gradient="from-blue-500 to-indigo-600"
          loading={loading}
        />
        <StatCard
          label="Jami"
          value={loading ? '—' : formatCurrency(earnings?.total_income)}
          iconName="chart"
          gradient="from-emerald-400 to-teal-500"
          loading={loading}
        />
        <StatCard
          label="Darslar soni"
          value={loading ? '—' : `${earnings?.lessons_this_month ?? 0} ta`}
          iconName="book"
          gradient="from-orange-400 to-amber-500"
          loading={loading}
        />
      </div>

      {!loading && (
        <>
          {/* ── Chart ─────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-widest">Kunlik Daromad</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{MONTHS[month - 1]} {year}</p>
              </div>
              {isCurrentMonth && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Bugun</span>
                </div>
              )}
            </div>
            <div className="h-56 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: chartTick }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: chartTick }}
                      tickFormatter={(val) =>
                        val >= 1000000
                          ? (val / 1000000).toFixed(1) + 'M'
                          : val >= 1000
                            ? Math.round(val / 1000) + 'K'
                            : val
                      }
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.05)', radius: 8 }} />
                    <Bar dataKey="income" radius={[6, 6, 0, 0]} maxBarSize={32}>
                      {chartData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.isToday
                              ? '#7C3AED'
                              : d.income > 0
                                ? '#E4E4F0'
                                : '#F3F2FB'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center">
                    <Icon name="chart" cls="w-6 h-6 text-gray-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-slate-500">Ma&apos;lumot yo&apos;q</p>
                </div>
              )}
            </div>
          </div>

          {/* ── History table ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700/50">
              <h2 className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-widest">Tarix</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{MONTHS[month - 1]} {year} — o'tkazilgan darslar</p>
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center">
                  <Icon name="book" cls="w-6 h-6 text-gray-300 dark:text-slate-600" />
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-500">Tarix topilmadi</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-slate-700/30">
                      <th className="py-3.5 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Sana</th>
                      <th className="py-3.5 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Guruh</th>
                      <th className="py-3.5 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-center">Davomat</th>
                      <th className="py-3.5 px-6 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-right">Daromad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                    {history.map((h, i) => (
                      <tr
                        key={i}
                        className="hover:bg-violet-50/30 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-4 px-6 text-sm font-medium text-gray-600 dark:text-slate-300">
                          {formatHistoryDate(h.date)}
                        </td>
                        <td className="py-4 px-6 text-sm font-semibold text-gray-900 dark:text-slate-100">{h.group_name}</td>
                        <td className="py-4 px-6 text-sm text-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{h.attended}</span>
                          <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
                          <span className="text-gray-500 dark:text-slate-400">{h.total_students}</span>
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                          +{formatCurrency(h.lesson_income)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Loading skeleton for stats+chart+history */}
      {loading && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-6 sm:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
            <div className="skeleton h-4 w-32 rounded-lg mb-8" />
            <div className="skeleton h-56 w-full rounded-xl" />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/60 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
            <div className="skeleton h-4 w-24 rounded-lg mb-6" />
            <div className="space-y-3">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-4 w-20 rounded-lg" />
                  <div className="skeleton h-4 w-32 rounded-lg" />
                  <div className="skeleton h-4 w-16 rounded-lg ml-auto" />
                  <div className="skeleton h-4 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
