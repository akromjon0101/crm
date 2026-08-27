import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/common/StatCard';
import { formatCurrency, MONTH_NAMES_SHORT } from '../utils/helpers';
import useDarkMode from '../hooks/useDarkMode';

const PIE_COLORS = ['#4F46E5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06B6D4'];

const ChartTip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold text-gray-900 dark:text-slate-100">{fmt ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">{title}</h3>
    {children}
  </div>
);

const Analytics = () => {
  const isDark = useDarkMode();
  const chartGrid = isDark ? '#1e293b' : '#f3f4f6';
  const chartTick = isDark ? '#94a3b8' : '#9ca3af';

  const [year,        setYear]        = useState(new Date().getFullYear());
  const [incomeData,  setIncomeData]  = useState([]);
  const [growthData,  setGrowthData]  = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/income-chart', { params: { year } }),
      api.get('/analytics/student-growth', { params: { year } }),
      api.get('/analytics/teacher-performance'),
    ]).then(([s, ic, gr, tp]) => {
      setStats(s.data);
      setIncomeData((ic.data || []).map(d => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
      setGrowthData((gr.data || []).map(d => ({ ...d, name: MONTH_NAMES_SHORT[d.month - 1] })));
      setTeachers(tp.data || []);
    }).catch(err => console.error('[Analytics]', err.message)).finally(() => setLoading(false));
  }, [year]);

  if (loading) return <LoadingSpinner text="Loading analytics..." />;

  const totalIncome      = incomeData.reduce((s, d) => s + parseFloat(d.total || 0), 0);
  const totalNewStudents = growthData.reduce((s, d) => s + parseInt(d.count || 0), 0);
  const teacherPieData   = teachers.slice(0, 6).map(t => ({ name: t.name, value: parseInt(t.student_count || 0) }));

  return (
    <div className="space-y-5">

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-slate-400">Year</span>
        <div className="flex gap-1">
          {[2024, 2025, 2026].map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                year === y
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          subtitle={`Year ${year}`}
          color="green"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="New Students"
          value={totalNewStudents}
          subtitle={`Enrolled in ${year}`}
          color="blue"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
        />
        <StatCard
          title="Active Students"
          value={stats?.total_students ?? 0}
          subtitle="Currently enrolled"
          color="purple"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          title="Unpaid Students"
          value={stats?.debtors ?? 0}
          subtitle="Need follow-up"
          color="red"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={`Monthly Income — ${year}`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={incomeData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} />
              <Tooltip content={<ChartTip fmt={formatCurrency} />} />
              <Area type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2} fill="url(#incG)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`New Students per Month — ${year}`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={growthData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Teacher Performance">
          {!teachers.length ? (
            <p className="text-sm text-gray-400 text-center py-4">No data available</p>
          ) : (
            <div className="space-y-4">
              {(() => {
                const max = Math.max(...teachers.map(x => Number(x.student_count) || 0), 1);
                return teachers.map((t) => {
                  const pct = Math.round((Number(t.student_count || 0) / max) * 100);
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {t.name?.charAt(0)}
                          </div>
                          <span className="text-sm text-gray-800 dark:text-slate-200">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                          <span>{t.group_count} groups</span>
                          <span className="font-semibold text-gray-900 dark:text-slate-100">{t.student_count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Students by Teacher">
          {!teacherPieData.length ? (
            <p className="text-sm text-gray-400 text-center py-4">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={teacherPieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {teacherPieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [v, 'Students']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default Analytics;
