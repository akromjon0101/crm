import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import { formatDate, formatCurrency, MONTH_NAMES } from '../utils/helpers';

// ─── constants ─────────────────────────────────────────────────────────────────
const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));

const SALARY_METHOD_OPTIONS = [
  { value: 'percentage', label: 'Foiz'         },
  { value: 'fixed',      label: 'Belgilangan'  },
  { value: 'per_lesson', label: 'Dars uchun'   },
  { value: 'combined',   label: 'Kombinatsiya' },
];

// ─── rule display helper ───────────────────────────────────────────────────────
const getRuleDisplay = (rule) => {
  if (!rule) return null;
  switch (rule.method) {
    case 'percentage':
      return `${rule.percentage ?? 0}%`;
    case 'fixed':
      return formatCurrency(rule.fixed_amount ?? 0);
    case 'per_lesson':
      return `${formatCurrency(rule.rate_per_lesson ?? 0)} / dars`;
    case 'combined':
      return `${formatCurrency(rule.base_amount ?? 0)} + ${rule.bonus_percentage ?? 0}%`;
    default:
      return null;
  }
};

// ─── badge helpers ─────────────────────────────────────────────────────────────
const SalaryStatusBadge = ({ status }) =>
  status === 'paid'
    ? <span className="badge-green">To&apos;landi</span>
    : <span className="badge-yellow">Kutilmoqda</span>;

const MethodBadge = ({ method }) => {
  const map = {
    percentage: { label: 'Foiz',         cls: 'badge-blue'   },
    fixed:      { label: 'Belgilangan',  cls: 'badge-purple' },
    per_lesson: { label: 'Dars uchun',   cls: 'badge-green'  },
    combined:   { label: 'Kombinatsiya', cls: 'badge-orange' },
  };
  const b = map[method] || { label: method || '\u2014', cls: 'badge-gray' };
  return <span className={b.cls}>{b.label}</span>;
};

const AdvanceBadge = ({ status }) => {
  const map = {
    pending:  { label: 'Kutilmoqda',     cls: 'badge-yellow' },
    approved: { label: 'Tasdiqlandi',    cls: 'badge-green'  },
    rejected: { label: 'Rad etildi',     cls: 'badge-red'    },
    deducted: { label: 'Ushlab qolindi', cls: 'badge-gray'   },
  };
  const b = map[status] || { label: status || '\u2014', cls: 'badge-gray' };
  return <span className={b.cls}>{b.label}</span>;
};

// ─── icons ────────────────────────────────────────────────────────────────────
const IconSalary = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconClock = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconAdvance = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// ─── SalaryAdmin page ─────────────────────────────────────────────────────────
const SalaryAdmin = () => {
  const toast = useToast();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [records,        setRecords]        = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [calculating,    setCalculating]    = useState(false);

  const [detailRecord, setDetailRecord] = useState(null);
  const [detailForm,   setDetailForm]   = useState({ note: '', deductions: '', bonus_amount: '' });
  const [savingDetail, setSavingDetail] = useState(false);
  const [markingPaid,  setMarkingPaid]  = useState(false);

  const [rules,        setRules]        = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleModal,    setRuleModal]    = useState(null);
  const [ruleForm,     setRuleForm]     = useState({
    method: 'percentage', percentage: '', fixed_amount: '',
    rate_per_lesson: '', base_amount: '', bonus_percentage: '',
  });
  const [savingRule, setSavingRule] = useState(false);

  const [advances,         setAdvances]        = useState([]);
  const [advancesLoading,  setAdvancesLoading] = useState(false);
  const [advanceModal,     setAdvanceModal]    = useState(false);
  const [advanceForm,      setAdvanceForm]     = useState({
    teacher_id: '', amount: '', reason: '',
    deduct_from_month: now.getMonth() + 1,
    deduct_from_year:  now.getFullYear(),
  });
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [teachers,      setTeachers]     = useState([]);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await api.get('/salary/records', { params: { month, year } });
      setRecords(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRecordsLoading(false);
    }
  }, [month, year]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await api.get('/salary/rules');
      setRules(res.data || []);
    } catch { /* noop */ } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchAdvances = useCallback(async () => {
    setAdvancesLoading(true);
    try {
      const res = await api.get('/salary/advances');
      setAdvances(res.data?.data || []);
    } catch { /* noop */ } finally {
      setAdvancesLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords();  }, [fetchRecords]);
  useEffect(() => { fetchRules();    }, [fetchRules]);
  useEffect(() => { fetchAdvances(); }, [fetchAdvances]);
  useEffect(() => {
    api.get('/users/teachers').then((r) => setTeachers(r.data || [])).catch(() => {});
  }, []);

  const kpis = useMemo(() => {
    let total = 0, paidCount = 0, pendingCount = 0, totalAdvances = 0;
    records.forEach((r) => {
      total         += Number(r.final_salary)  || 0;
      totalAdvances += Number(r.advance_paid)  || 0;
      if (r.status === 'paid') paidCount++;
      else pendingCount++;
    });
    return { total, paidCount, pendingCount, totalAdvances };
  }, [records]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await api.post('/salary/calculate', { month, year });
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hisoblashda xatolik');
    } finally {
      setCalculating(false);
    }
  };

  const openDetail = (rec) => {
    setDetailRecord(rec);
    setDetailForm({
      note:         rec.note         || '',
      deductions:   rec.deductions   !== undefined ? String(rec.deductions)   : '',
      bonus_amount: rec.bonus_amount !== undefined ? String(rec.bonus_amount) : '',
    });
  };

  const detailFinalPreview = useMemo(() => {
    if (!detailRecord) return 0;
    const base   = Number(detailRecord.base_amount)  || 0;
    const bonus  = Number(detailForm.bonus_amount)   || 0;
    const deduct = Number(detailForm.deductions)     || 0;
    const adv    = Number(detailRecord.advance_paid) || 0;
    return Math.max(0, base + bonus - deduct - adv);
  }, [detailRecord, detailForm.bonus_amount, detailForm.deductions]);

  const handleSaveDetail = async (e) => {
    e.preventDefault();
    setSavingDetail(true);
    try {
      await api.put(`/salary/records/${detailRecord.id}`, {
        note:         detailForm.note,
        deductions:   Number(detailForm.deductions)   || 0,
        bonus_amount: Number(detailForm.bonus_amount) || 0,
        final_salary: detailFinalPreview,
      });
      setDetailRecord(null);
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleMarkPaid = async (id) => {
    setMarkingPaid(true);
    try {
      await api.put(`/salary/records/${id}`, {
        status:    'paid',
        paid_date: new Date().toISOString().split('T')[0],
      });
      setDetailRecord(null);
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "To'lashda xatolik");
    } finally {
      setMarkingPaid(false);
    }
  };

  const openRuleModal = (teacher) => {
    // /salary/rules returns users merged with rules — `id` field = teacher's user id
    const ex = rules.find((r) => r.id === teacher.id);
    setRuleModal(teacher);
    setRuleForm({
      method:           ex?.method            || 'percentage',
      percentage:       ex?.percentage        !== undefined ? String(ex.percentage)        : '',
      fixed_amount:     ex?.fixed_amount      !== undefined ? String(ex.fixed_amount)      : '',
      rate_per_lesson:  ex?.rate_per_lesson   !== undefined ? String(ex.rate_per_lesson)   : '',
      base_amount:      ex?.base_amount       !== undefined ? String(ex.base_amount)       : '',
      bonus_percentage: ex?.bonus_percentage  !== undefined ? String(ex.bonus_percentage)  : '',
    });
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setSavingRule(true);
    try {
      await api.post('/salary/rules', {
        teacher_id:       ruleModal.id,
        method:           ruleForm.method,
        percentage:       Number(ruleForm.percentage)       || 0,
        fixed_amount:     Number(ruleForm.fixed_amount)     || 0,
        rate_per_lesson:  Number(ruleForm.rate_per_lesson)  || 0,
        base_amount:      Number(ruleForm.base_amount)      || 0,
        bonus_percentage: Number(ruleForm.bonus_percentage) || 0,
      });
      setRuleModal(null);
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSavingRule(false);
    }
  };

  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    setSavingAdvance(true);
    try {
      await api.post('/salary/advances', {
        teacher_id:        advanceForm.teacher_id,
        amount:            Number(advanceForm.amount),
        reason:            advanceForm.reason,
        deduct_from_month: advanceForm.deduct_from_month,
        deduct_from_year:  advanceForm.deduct_from_year,
      });
      setAdvanceModal(false);
      setAdvanceForm({
        teacher_id: '', amount: '', reason: '',
        deduct_from_month: now.getMonth() + 1,
        deduct_from_year:  now.getFullYear(),
      });
      fetchAdvances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleAdvanceAction = async (id, status) => {
    try {
      await api.put(`/salary/advances/${id}`, {
        status,
        approved_date: new Date().toISOString().split('T')[0],
      });
      fetchAdvances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xatolik');
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          className="btn-primary whitespace-nowrap"
        >
          {calculating ? 'Hisoblanmoqda...' : 'Avtomatik hisoblash'}
        </button>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Salary This Month"
          value={formatCurrency(kpis.total)}
          icon={<IconSalary />}
          color="purple"
          subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
        />
        <StatCard
          title="To'langan"
          value={kpis.paidCount}
          icon={<IconCheck />}
          color="green"
          subtitle="o'qituvchi"
        />
        <StatCard
          title="Kutilmoqda"
          value={kpis.pendingCount}
          icon={<IconClock />}
          color="orange"
          subtitle="o'qituvchi"
        />
        <StatCard
          title="Jami avanslar"
          value={formatCurrency(kpis.totalAdvances)}
          icon={<IconAdvance />}
          color="indigo"
          subtitle="Ushlab qolindi"
        />
      </div>

      {/* ── Salary Rules (prominent card) ────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">O&apos;qituvchilar oyligi</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Har bir o&apos;qituvchi uchun hisoblash usulini belgilang
            </p>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white bg-primary-500"
          >
            {teachers.length} ta o&apos;qituvchi
          </span>
        </div>

        {rulesLoading ? (
          <LoadingSpinner text="Yuklanmoqda..." />
        ) : teachers.length === 0 ? (
          <EmptyState title="O'qituvchilar topilmadi" description="" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">O&apos;qituvchi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Hisoblash usuli</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Miqdor / Stavka</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {teachers.map((t) => {
                  const rule = rules.find((r) => r.id === t.id);
                  const display = getRuleDisplay(rule);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary-500"
                          >
                            {(t.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-slate-100">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {rule
                          ? <MethodBadge method={rule.method} />
                          : <span className="text-gray-400 dark:text-slate-500 text-xs">Belgilanmagan</span>}
                      </td>
                      <td className="px-4 py-3">
                        {display
                          ? (
                            <span className="font-semibold text-gray-800 dark:text-slate-200 tabular-nums">
                              {display}
                            </span>
                          )
                          : (
                            <span className="text-gray-400 dark:text-slate-500 text-xs">Belgilanmagan</span>
                          )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openRuleModal(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Qoidani tahrirlash"
                        >
                          <IconEdit />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Salary records table ─────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {MONTH_NAMES[month - 1]} {year} &mdash; Salary Schedule
          </p>
          <span className="text-xs text-gray-400 dark:text-slate-500">{records.length} ta o&apos;qituvchi</span>
        </div>

        {recordsLoading ? (
          <LoadingSpinner text="Yuklanmoqda..." />
        ) : records.length === 0 ? (
          <EmptyState
            title="No salary records found"
            description="Click the calculate button to compute salaries."
            action={
              <button className="btn-primary" onClick={handleCalculate} disabled={calculating}>
                {calculating ? 'Hisoblanmoqda...' : 'Hisoblash'}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">O&apos;qituvchi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Usul</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Asosiy</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Bonus</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Ushlamalar</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">Avans</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Final Salary</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Holat</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary-500">
                          {(rec.teacher_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-slate-100">{rec.teacher_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><MethodBadge method={rec.method} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200 hidden lg:table-cell">{formatCurrency(rec.base_amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 hidden lg:table-cell">
                      {(rec.bonus_amount || 0) > 0 ? formatCurrency(rec.bonus_amount) : <span className="text-gray-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500 hidden lg:table-cell">
                      {(rec.deductions || 0) > 0 ? formatCurrency(rec.deductions) : <span className="text-gray-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-500 hidden xl:table-cell">
                      {(rec.advance_paid || 0) > 0 ? formatCurrency(rec.advance_paid) : <span className="text-gray-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-slate-100">{formatCurrency(rec.final_salary)}</td>
                    <td className="px-4 py-3 text-center"><SalaryStatusBadge status={rec.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Batafsil / tahrirlash">
                          <IconEdit />
                        </button>
                        {rec.status !== 'paid' && (
                          <button onClick={() => handleMarkPaid(rec.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="To'landi deb belgilash">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Advances section ────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Avanslar</p>
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setAdvanceModal(true)}>
            + Yangi avans
          </button>
        </div>
        {advancesLoading ? (
          <LoadingSpinner text="Yuklanmoqda..." />
        ) : advances.length === 0 ? (
          <EmptyState title="Avanslar topilmadi" description="Avans berish uchun Yangi avans tugmasini bosing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">O&apos;qituvchi</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Miqdor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Sabab</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Holat</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {advances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{adv.teacher_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 dark:text-slate-100">{formatCurrency(adv.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden md:table-cell">
                      <span className="truncate block max-w-xs">{adv.reason || '\u2014'}</span>
                    </td>
                    <td className="px-4 py-3 text-center"><AdvanceBadge status={adv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {adv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleAdvanceAction(adv.id, 'approved')}
                            className="px-2 py-1 rounded text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                            Tasdiqlash
                          </button>
                          <button onClick={() => handleAdvanceAction(adv.id, 'rejected')}
                            className="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                            Rad etish
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      <Modal open={!!detailRecord} onClose={() => setDetailRecord(null)} title="Salary Details" size="md">
        {detailRecord && (
          <form onSubmit={handleSaveDetail} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-primary-500">
                {(detailRecord.teacher_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-slate-100">{detailRecord.teacher_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <MethodBadge method={detailRecord.method} />
                  <SalaryStatusBadge status={detailRecord.status} />
                </div>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-slate-700/50">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">Base Salary</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-slate-100 tabular-nums">{formatCurrency(detailRecord.base_amount)}</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-slate-700/50 bg-emerald-50/50 dark:bg-emerald-900/10">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">Bonus</td>
                    <td className="px-4 py-2.5 text-right">
                      <input type="number" min="0" className="input text-right w-36 py-1 text-sm" placeholder="0"
                        value={detailForm.bonus_amount}
                        onChange={(e) => setDetailForm({ ...detailForm, bonus_amount: e.target.value })} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-slate-700/50 bg-red-50/50 dark:bg-red-900/10">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">Ushlamalar</td>
                    <td className="px-4 py-2.5 text-right">
                      <input type="number" min="0" className="input text-right w-36 py-1 text-sm" placeholder="0"
                        value={detailForm.deductions}
                        onChange={(e) => setDetailForm({ ...detailForm, deductions: e.target.value })} />
                    </td>
                  </tr>
                  {(Number(detailRecord.advance_paid) || 0) > 0 && (
                    <tr className="border-b border-gray-100 dark:border-slate-700/50 bg-orange-50/50 dark:bg-orange-900/10">
                      <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">Avans (ushlab qolindi)</td>
                      <td className="px-4 py-2.5 text-right font-medium text-orange-600 tabular-nums">- {formatCurrency(detailRecord.advance_paid)}</td>
                    </tr>
                  )}
                  <tr className="bg-violet-50 dark:bg-violet-900/20">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-slate-100 text-base">= Final Salary</td>
                    <td className="px-4 py-3 text-right font-bold text-lg tabular-nums text-primary-500">
                      {formatCurrency(detailFinalPreview)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 text-xs text-gray-500 dark:text-slate-400">
              {detailRecord.lessons_count !== undefined && (
                <span>Darslar: <strong className="text-gray-700 dark:text-slate-200">{detailRecord.lessons_count}</strong></span>
              )}
              {detailRecord.students_total_paid !== undefined && (
                <span>Talabalar to&apos;lovi: <strong className="text-gray-700 dark:text-slate-200">{formatCurrency(detailRecord.students_total_paid)}</strong></span>
              )}
            </div>

            <div>
              <label className="label">Izoh</label>
              <input type="text" className="input" placeholder="Ixtiyoriy izoh..."
                value={detailForm.note}
                onChange={(e) => setDetailForm({ ...detailForm, note: e.target.value })} />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setDetailRecord(null)}>Bekor</button>
              <button type="submit" className="btn-primary" disabled={savingDetail}>
                {savingDetail ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              {detailRecord.status !== 'paid' && (
                <button type="button" className="btn-primary" disabled={markingPaid}
                  onClick={() => handleMarkPaid(detailRecord.id)}>
                  {markingPaid ? 'Belgilanmoqda...' : "To'landi deb belgilash"}
                </button>
              )}
            </div>
          </form>
        )}
      </Modal>

      {/* ── Rule Edit Modal ───────────────────────────────────────────────────── */}
      <Modal open={!!ruleModal} onClose={() => setRuleModal(null)} title="Hisoblash qoidasi" size="sm">
        {ruleModal && (
          <form onSubmit={handleSaveRule} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary-500">
                {(ruleModal.name || '?').charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-gray-900 dark:text-slate-100">{ruleModal.name}</p>
            </div>

            <div>
              <label className="label">Hisoblash usuli</label>
              <div className="grid grid-cols-2 gap-2">
                {SALARY_METHOD_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setRuleForm({ ...ruleForm, method: opt.value })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors duration-150 ${ruleForm.method === opt.value ? 'text-white bg-primary-500 border-primary-500' : 'text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-primary-300 hover:text-primary-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {ruleForm.method === 'percentage' && (
              <div>
                <label className="label">Foiz (%)</label>
                <input type="number" min="0" max="100" className="input" placeholder="e.g. 30"
                  value={ruleForm.percentage}
                  onChange={(e) => setRuleForm({ ...ruleForm, percentage: e.target.value })} required />
              </div>
            )}
            {ruleForm.method === 'fixed' && (
              <div>
                <label className="label">Belgilangan summa (so&apos;m)</label>
                <input type="number" min="0" className="input" placeholder="e.g. 3000000"
                  value={ruleForm.fixed_amount}
                  onChange={(e) => setRuleForm({ ...ruleForm, fixed_amount: e.target.value })} required />
              </div>
            )}
            {ruleForm.method === 'per_lesson' && (
              <div>
                <label className="label">Dars uchun to&apos;lov (so&apos;m)</label>
                <input type="number" min="0" className="input" placeholder="e.g. 50000"
                  value={ruleForm.rate_per_lesson}
                  onChange={(e) => setRuleForm({ ...ruleForm, rate_per_lesson: e.target.value })} required />
              </div>
            )}
            {ruleForm.method === 'combined' && (
              <>
                <div>
                  <label className="label">Asosiy summa (so&apos;m)</label>
                  <input type="number" min="0" className="input" placeholder="e.g. 1500000"
                    value={ruleForm.base_amount}
                    onChange={(e) => setRuleForm({ ...ruleForm, base_amount: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Bonus foiz (%)</label>
                  <input type="number" min="0" max="100" className="input" placeholder="e.g. 10"
                    value={ruleForm.bonus_percentage}
                    onChange={(e) => setRuleForm({ ...ruleForm, bonus_percentage: e.target.value })} required />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setRuleModal(null)}>Bekor</button>
              <button type="submit" className="btn-primary" disabled={savingRule}>
                {savingRule ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Advance Modal ─────────────────────────────────────────────────────── */}
      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title="Yangi avans" size="sm">
        <form onSubmit={handleSaveAdvance} className="space-y-4">
          <div>
            <label className="label">O&apos;qituvchi</label>
            <select className="input" value={advanceForm.teacher_id}
              onChange={(e) => setAdvanceForm({ ...advanceForm, teacher_id: e.target.value })} required>
              <option value="">O&apos;qituvchi tanlang</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Miqdor (so&apos;m)</label>
            <input type="number" min="0" className="input" placeholder="0"
              value={advanceForm.amount}
              onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} required />
          </div>
          <div>
            <label className="label">Sabab</label>
            <input type="text" className="input" placeholder="Avans sababi..."
              value={advanceForm.reason}
              onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} />
          </div>
          <div>
            <label className="label">Qaysi oydan ushlab qolish</label>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={advanceForm.deduct_from_month}
                onChange={(e) => setAdvanceForm({ ...advanceForm, deduct_from_month: Number(e.target.value) })}>
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className="input" value={advanceForm.deduct_from_year}
                onChange={(e) => setAdvanceForm({ ...advanceForm, deduct_from_year: Number(e.target.value) })}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setAdvanceModal(false)}>Bekor</button>
            <button type="submit" className="btn-primary" disabled={savingAdvance}>
              {savingAdvance ? 'Saqlanmoqda...' : 'Avans berish'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default SalaryAdmin;
