import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { formatCurrency, MONTH_NAMES_SHORT } from '../utils/helpers';
import useDarkMode from '../hooks/useDarkMode';

// ── Helpers ───────────────────────────────────────────────────────────────────
const shortNum = (n) => {
  if (!n && n !== 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(Math.round(n));
};

const TYPE_COLORS = {
  cash: '#10b981', card: '#3b82f6', transfer: '#8b5cf6', online: '#f59e0b',
};

// ── Micro components ──────────────────────────────────────────────────────────
const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
      up ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
         : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
    }`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
};

const Avatar = ({ name }) => {
  const initials = name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  return (
    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700
                    dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
      {initials}
    </div>
  );
};

const Ic = ({ d, cls = 'w-4 h-4' }) => (
  <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  revenue:  'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  payroll:  'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  profit:   'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  check:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  retry:    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  empty:    'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

const MiniBar = ({ pct, color = 'bg-blue-500' }) => (
  <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
    <div className={`h-full rounded-full transition-all duration-500 ${color}`}
         style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
  </div>
);

const Empty = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-10">
    <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-2">
      <Ic d={ICONS.empty} cls="w-5 h-5 text-gray-400 dark:text-slate-500" />
    </div>
    <p className="text-sm text-gray-400 dark:text-slate-500">{label}</p>
  </div>
);

const SalaryBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    paid:       'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    approved:   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    calculated: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    pending:    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  };
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-400 dark:text-slate-500 mb-1">{label}-kun</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const Sk = ({ cls }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-slate-700 rounded ${cls}`} />
);

const SkeletonPage = () => (
  <div className="space-y-4">
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
        {[1,2,3].map(i => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2"><Sk cls="w-7 h-7 rounded-lg" /><Sk cls="h-3 w-16" /></div>
            <Sk cls="h-8 w-28" />
            <Sk cls="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          <Sk cls="h-3 w-24" /><Sk cls="h-7 w-20" /><Sk cls="h-3 w-16" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1,2].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <Sk cls="h-3 w-32 mb-4" /><Sk cls="h-40 w-full rounded-lg" />
        </div>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
const CeoFinances = () => {
  const isDark = useDarkMode();
  const chartGrid  = isDark ? '#1e293b' : '#f1f5f9';
  const chartTick  = isDark ? '#94a3b8' : '#9ca3af';

  const now   = new Date();
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async (m, y) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/analytics/financial-summary?month=${m}&year=${y}`);
      setData(res.data);
    } catch {
      setError("Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month, year); }, [month, year, load]);

  const years = [now.getFullYear() - 1, now.getFullYear()];

  // ── Period bar (always rendered) ────────────────────────────────────────────
  const PeriodBar = () => (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {MONTH_NAMES_SHORT.map((m, i) => {
          const active = month === i + 1;
          return (
            <button key={i} onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}>
              {m}
            </button>
          );
        })}
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="ml-1 text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1
                     bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-pointer">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {data && !loading && (
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
          data.expenses.source === 'salary_records'
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
        }`}>
          {data.expenses.source === 'salary_records' ? '✓ Tasdiqlangan maosh' : '~ Dars asosida hisob'}
        </span>
      )}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto">
      <PeriodBar />
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <Ic d={ICONS.warning} cls="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400">{error}</p>
        <button onClick={() => load(month, year)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          <Ic d={ICONS.retry} cls="w-3.5 h-3.5" /> Qayta urinish
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="max-w-6xl mx-auto"><PeriodBar /><SkeletonPage /></div>
  );

  if (!data) return null;

  const { income, expenses, summary, period } = data;
  const netPositive = summary.net_profit >= 0;
  const payrollPct  = Math.min(Math.max(summary.payroll_ratio || 0, 0), 100);
  const profitPct   = Math.min(Math.max(summary.profit_margin || 0, 0), 100 - payrollPct);

  // Daily chart
  const dailyData = income.by_day.map((d) => ({
    day:    (d.date || '').slice(8) || d.date,
    income: d.total,
  }));

  // Payment types
  const typeTotal = income.by_type.reduce((s, t) => s + (t.total || 0), 0);
  const typeData  = income.by_type.map((t) => ({
    name:  t.payment_type || 'other',
    value: t.total || 0,
    count: t.count || 0,
    color: TYPE_COLORS[t.payment_type] ?? '#6b7280',
    pct:   typeTotal > 0 ? +((t.total / typeTotal) * 100).toFixed(1) : 0,
  }));

  // Teacher bar widths
  const maxPay = Math.max(...expenses.by_teacher.map((t) => t.final_salary ?? t.earned), 1);

  return (
    <div className="max-w-6xl mx-auto">
      <PeriodBar />

      {/* ── Hero profit card ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-slate-700">

          {/* Revenue */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                <Ic d={ICONS.revenue} cls="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Daromad</span>
            </div>
            <p className="text-[26px] font-bold text-gray-900 dark:text-slate-100 leading-none tabular-nums">
              {shortNum(income.total)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 mb-2">
              UZS &nbsp;·&nbsp; oldingi: {shortNum(income.prev_total)}
            </p>
            <GrowthBadge value={income.growth} />
          </div>

          {/* Payroll */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                <Ic d={ICONS.payroll} cls="w-4 h-4 text-orange-500 dark:text-orange-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Xarajat</span>
            </div>
            <p className="text-[26px] font-bold text-orange-500 dark:text-orange-400 leading-none tabular-nums">
              {shortNum(expenses.total)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 mb-3">
              UZS &nbsp;·&nbsp; daromadning {payrollPct.toFixed(1)}%
            </p>
            <MiniBar pct={payrollPct} color="bg-orange-400" />
          </div>

          {/* Net profit */}
          <div className={`p-5 ${netPositive ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : 'bg-red-50/60 dark:bg-red-900/10'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                netPositive ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'
              }`}>
                <Ic d={ICONS.profit} cls={`w-4 h-4 ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Sof foyda</span>
            </div>
            <p className={`text-[26px] font-bold leading-none tabular-nums ${
              netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}>
              {netPositive ? '+' : ''}{shortNum(summary.net_profit)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 mb-2">
              UZS &nbsp;·&nbsp; margin {summary.profit_margin}%
            </p>
            <GrowthBadge value={summary.profit_growth} />
          </div>
        </div>

        {/* Color strip */}
        <div className="h-[3px] flex">
          <div className="bg-orange-400" style={{ width: `${payrollPct}%` }} />
          <div className={netPositive ? 'bg-emerald-500' : 'bg-red-400'} style={{ width: `${profitPct}%` }} />
          <div className="flex-1 bg-gray-100 dark:bg-slate-700" />
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">To'lov darajasi</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums leading-none mb-1">
            {income.collection_rate}%
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-2">
            {income.paid_students} / {income.total_students} o'quvchi
          </p>
          <MiniBar
            pct={income.collection_rate}
            color={income.collection_rate >= 80 ? 'bg-emerald-500' : income.collection_rate >= 60 ? 'bg-amber-400' : 'bg-red-400'}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">To'lagan</p>
          <div className="flex items-end gap-2 mb-1">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{income.paid_students}</p>
            <Ic d={ICONS.check} cls="w-4 h-4 text-emerald-500 mb-0.5" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">o'quvchi to'ladi</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Qarzdor</p>
          <div className="flex items-end gap-2 mb-1">
            <p className={`text-2xl font-bold tabular-nums leading-none ${income.unpaid_students > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
              {income.unpaid_students}
            </p>
            {income.unpaid_students > 0 && <Ic d={ICONS.warning} cls="w-4 h-4 text-red-400 mb-0.5" />}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">to'lamagan o'quvchi</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Foyda marjasi</p>
          <p className={`text-2xl font-bold tabular-nums leading-none mb-1 ${
            netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}>
            {summary.profit_margin}%
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">daromaddan foyda</p>
        </div>
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">

        {/* Daily income — wider */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">Kunlik daromad</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
            {MONTH_NAMES_SHORT[period.month - 1]} {period.year} — to'lovlar grafigi
          </p>
          {dailyData.length === 0 ? <Empty label="Bu oyda to'lov yo'q" /> : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finDayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} strokeOpacity={0.8} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: chartTick }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={shortNum} tick={{ fontSize: 9, fill: chartTick }} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="income" name="Daromad"
                  stroke="#3b82f6" strokeWidth={2} fill="url(#finDayGrad)"
                  dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment methods — narrower */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">To'lov usullari</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Qanday usulda to'lashmoqda</p>
          {typeData.length === 0 ? <Empty label="Ma'lumot yo'q" /> : (
            <div className="space-y-4">
              {typeData.map((t) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                      <span className="font-medium text-gray-700 dark:text-slate-300 capitalize">{t.name}</span>
                      <span className="text-gray-400 dark:text-slate-500 text-[10px]">{t.count} ta</span>
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-slate-200 tabular-nums">{t.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                         style={{ width: `${t.pct}%`, background: t.color }} />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 text-right">
                    {shortNum(t.value)} UZS
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex justify-between text-xs">
                <span className="text-gray-400 dark:text-slate-500 font-medium">Jami</span>
                <span className="font-bold text-gray-800 dark:text-slate-200">{formatCurrency(typeTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Income by group ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-7 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Guruhlar bo'yicha daromad</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Har bir guruhdan yig'ilgan to'lov</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {income.by_group.length === 0 ? <Empty label="Guruhlar ma'lumoti yo'q" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  {['Guruh', "O'qituvchi", 'Jami', "To'ladi", 'Tarif/oy', 'Yig\'ildi', 'Holat'].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide ${i >= 2 && i <= 4 ? 'text-center' : i >= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {income.by_group.map((g) => {
                  const expected = (g.monthly_fee || 0) * (g.student_count || 0);
                  const collPct  = expected > 0 ? Math.min((g.total_income / expected) * 100, 100) : 0;
                  const payPct   = g.student_count > 0 ? (g.paid_count / g.student_count) * 100 : 0;
                  const barCol   = collPct >= 80 ? 'bg-emerald-500' : collPct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                  const paidCol  = payPct  >= 80 ? 'text-emerald-600 dark:text-emerald-400' : payPct >= 50 ? 'text-amber-500' : 'text-red-500';
                  return (
                    <tr key={g.group_id}
                      className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap">{g.group_name}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap">{g.teacher_name || '—'}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600 dark:text-slate-300">{g.student_count}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-semibold ${paidCol}`}>{g.paid_count}/{g.student_count}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-400 dark:text-slate-500">
                        {g.monthly_fee > 0 ? shortNum(g.monthly_fee) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {formatCurrency(g.total_income)}
                      </td>
                      <td className="px-4 py-2.5 w-28">
                        <MiniBar pct={collPct} color={barCol} />
                        <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">{Math.round(collPct)}% yig'ildi</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40">
                  <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-slate-400">Jami yig'ildi:</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(income.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Teacher payroll ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-7 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">O'qituvchilar maoshi</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {expenses.source === 'salary_records' ? 'Tasdiqlangan maosh yozuvlari' : 'Dars asosida hisoblangan'}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6">
        {expenses.by_teacher.length === 0 ? <Empty label="O'qituvchilar ma'lumoti yo'q" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  {["O'qituvchi", 'Darslar', 'Keldi / Kelmadi', 'Daromad', 'Maosh', 'Ulush'].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide ${i === 0 ? 'text-left' : i >= 3 ? 'text-right' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.by_teacher.map((t) => {
                  const displayVal = t.final_salary ?? t.earned;
                  const barPct     = maxPay > 0 ? (displayVal / maxPay) * 100 : 0;
                  const totalSlots = (t.attended_slots + t.missed_slots) || 1;
                  const attPct     = Math.round((t.attended_slots / totalSlots) * 100);
                  return (
                    <tr key={t.teacher_id}
                      className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={t.teacher_name} />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{t.teacher_name}</p>
                            {t.subject && <p className="text-[10px] text-gray-400 dark:text-slate-500">{t.subject}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-medium text-gray-700 dark:text-slate-300">{t.lessons_count}</span>
                        <span className="text-gray-400 dark:text-slate-500"> · {t.students_taught} ta</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.attended_slots}</span>
                        <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
                        <span className="text-red-400">{t.missed_slots}</span>
                        <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">{attPct}% davomat</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 dark:text-slate-500 tabular-nums">
                        {formatCurrency(t.earned)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {t.final_salary !== null ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(t.final_salary)}</span>
                            <SalaryBadge status={t.salary_status} />
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 italic text-[10px]">hisoblanmagan</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 w-28">
                        <MiniBar pct={barPct} color="bg-orange-400" />
                        <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">{Math.round(barPct)}% ulush</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-slate-400">Jami maosh:</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-500 dark:text-orange-400 tabular-nums">{formatCurrency(expenses.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CeoFinances;
