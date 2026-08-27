import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import { formatDate, formatCurrency, MONTH_NAMES } from '../utils/helpers';

// ─── constants ────────────────────────────────────────────────────────────────
const now = new Date();
const YEARS  = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const MONTHS = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Naqd',     color: 'green'  },
  { value: 'card',     label: 'Karta',    color: 'blue'   },
  { value: 'transfer', label: "O'tkazma", color: 'purple' },
];

const STATUSES = [
  { value: '',        label: 'Barchasi'   },
  { value: 'paid',    label: "To'landi"   },
  { value: 'partial', label: 'Qisman'     },
  { value: 'unpaid',  label: "To'lanmadi" },
];

const DEBTOR_SORT_OPTIONS = [
  { value: 'days_desc',   label: 'Eng ko\'p kechikkan' },
  { value: 'amount_desc', label: 'Eng katta qarz'       },
  { value: 'name_asc',    label: 'Ism bo\'yicha'        },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
const calcDaysOverdue = () => {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.floor((now - firstOfMonth) / (1000 * 60 * 60 * 24));
};

// ─── icon components ──────────────────────────────────────────────────────────
const IconCash = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconDebt = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconPaid = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconUnpaid = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconStats = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconPercent = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 7h.01M15 17h.01M7 7a2 2 0 10.001-3.999A2 2 0 007 7zm10 10a2 2 0 10.001-3.999A2 2 0 0017 17zM5 19L19 5" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSearch = () => (
  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconArrow = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ─── badge sub-components ─────────────────────────────────────────────────────
const PayStatusBadge = ({ status }) => {
  const map = {
    paid:    { label: "To'landi",   cls: 'badge-green'  },
    partial: { label: 'Qisman',     cls: 'badge-yellow' },
    unpaid:  { label: "To'lanmadi", cls: 'badge-red'    },
  };
  const b = map[status] || map.unpaid;
  return <span className={b.cls}>{b.label}</span>;
};

const PayTypeBadge = ({ type }) => {
  const map = {
    cash:     { label: 'Naqd',     cls: 'badge-green'  },
    card:     { label: 'Karta',    cls: 'badge-blue'   },
    transfer: { label: "O'tkazma", cls: 'badge-purple' },
  };
  const b = map[type] || { label: type, cls: 'badge-gray' };
  return <span className={b.cls}>{b.label}</span>;
};

// ─── method toggle ────────────────────────────────────────────────────────────
const MethodToggle = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {PAYMENT_METHODS.map((m) => (
      <button
        key={m.value}
        type="button"
        onClick={() => onChange(m.value)}
        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:focus-visible:ring-primary-600 ${
          value === m.value
            ? 'text-white bg-primary-600 border-primary-600'
            : 'text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-primary-300 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400'
        }`}
      >
        {m.label}
      </button>
    ))}
  </div>
);

// ─── tab button ───────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active
        ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
        : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-600'
    }`}
  >
    {children}
    {badge != null && badge > 0 && (
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold bg-red-500 text-white">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

// ─── student autocomplete ─────────────────────────────────────────────────────
const StudentAutocomplete = ({ value, onChange, onSelect, placeholder }) => {
  const [open,        setOpen]        = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searching,   setSearching]   = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear pending debounce on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/students', { params: { search: q, limit: 8 } });
        const list = res.data?.data || res.data || [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  const handleSelect = (s) => {
    onSelect(s);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <IconSearch />
        <input
          type="text"
          className="input pl-9"
          placeholder={placeholder || 'Talaba ismini kiriting...'}
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-slate-700/50 text-left transition-colors"
              onClick={() => handleSelect(s)}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary-600"
              >
                {(s.full_name || s.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                  {s.full_name || s.name}
                </p>
                {s.group_name && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{s.group_name}</p>
                )}
              </div>
              {s.monthly_fee && (
                <span className="ml-auto text-xs font-semibold text-primary-600 dark:text-primary-400 flex-shrink-0">
                  {formatCurrency(s.monthly_fee)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── debtor "mark as paid" inline panel ───────────────────────────────────────
const DebtorPayPanel = ({ debtor, onConfirm, onCancel, saving }) => {
  const [form, setForm] = useState({
    amount:       String(debtor.monthly_fee || ''),
    payment_type: 'cash',
    month:        now.getMonth() + 1,
    year:         now.getFullYear(),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      student_id:   debtor.student_id || debtor.id,
      amount:       Number(form.amount),
      payment_type: form.payment_type,
      month:        form.month,
      year:         form.year,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 space-y-3 animate-fadeIn"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="label">Miqdor (so'm)</label>
          <input
            type="number"
            min="1"
            className="input text-sm"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Oy</label>
          <select
            className="input text-sm"
            value={form.month}
            onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{"To'lov usuli"}</label>
        <MethodToggle value={form.payment_type} onChange={(v) => setForm({ ...form, payment_type: v })} />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn-secondary btn-sm flex-1"
          onClick={onCancel}
          disabled={saving}
        >
          Bekor
        </button>
        <button
          type="submit"
          className="btn-primary btn-sm flex-1"
          disabled={saving || !form.amount || Number(form.amount) <= 0}        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saqlanmoqda...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <IconCheck />
              Tasdiqlash
            </span>
          )}
        </button>
      </div>
    </form>
  );
};

// ─── custom recharts tooltip ──────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 dark:text-slate-100 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="tabular-nums">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────
const Payments = () => {
  const navigate  = useNavigate();
  const [tab, setTab] = useState('payments');

  const toast = useToast();

  // ── payments tab state ──────────────────────────────────────────────────────
  const [records,      setRecords]      = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterMonth,  setFilterMonth]  = useState(now.getMonth() + 1);
  const [filterYear,   setFilterYear]   = useState(now.getFullYear());
  const [filterGroup,  setFilterGroup]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [search,       setSearch]       = useState('');

  // payment history list (actual transactions, not monthly-status)
  const [payHistory,    setPayHistory]    = useState([]);
  const [histLoading,   setHistLoading]   = useState(false);

  // quick-pay modal
  const [quickPayRow,  setQuickPayRow]  = useState(null);
  const [payForm,      setPayForm]      = useState({
    studentSearch: '', student_id: '', amount: '', discount: '',
    month: now.getMonth() + 1, year: now.getFullYear(),
    payment_type: 'cash', description: '',
  });
  const [saving, setSaving] = useState(false);

  // add new payment modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    studentSearch: '', student_id: '', student_name: '',
    amount: '', discount: '',
    month: now.getMonth() + 1, year: now.getFullYear(),
    payment_type: 'cash', description: '',
  });
  const [addSaving, setAddSaving] = useState(false);

  // delete confirm
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── debtors tab state ───────────────────────────────────────────────────────
  const [debtors,       setDebtors]       = useState([]);
  const [debtorsLoading,setDebtorsLoading]= useState(false);
  const [debtorSearch,  setDebtorSearch]  = useState('');
  const [debtorSort,    setDebtorSort]    = useState('days_desc');
  const [activePay,     setActivePay]     = useState(null);  // debtor id with open panel
  const [debtorSaving,  setDebtorSaving]  = useState(false);
  const [paidIds,       setPaidIds]       = useState(new Set()); // for animation

  // ── statistics tab state ────────────────────────────────────────────────────
  const [statsYear,       setStatsYear]       = useState(now.getFullYear());
  const [monthlyStats,    setMonthlyStats]    = useState([]);
  const [statsLoading,    setStatsLoading]    = useState(false);
  const [groupStats,      setGroupStats]      = useState([]);
  const [groupStatsLoading, setGroupStatsLoading] = useState(false);

  // billing tab state
  const [billingGroup,   setBillingGroup]   = useState('');
  const [billingMonth,   setBillingMonth]   = useState(now.getMonth() + 1);
  const [billingYear,    setBillingYear]    = useState(now.getFullYear());
  const [lateWeight,     setLateWeight]     = useState(0);
  const [billingResult,  setBillingResult]  = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // ─── data fetching ──────────────────────────────────────────────────────────

  // monthly-status (for KPI cards + monthly status table)
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month: filterMonth, year: filterYear };
      if (filterGroup) params.group_id = filterGroup;
      const res = await api.get('/payments/monthly-status', { params });
      setRecords(res.data?.data || []);
    } catch {
      toast.error('Malumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterGroup, toast]);

  // actual payment transactions
  const fetchPayHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = { month: filterMonth, year: filterYear };
      if (filterGroup) params.group_id = filterGroup;
      const res = await api.get('/payments', { params });
      setPayHistory(res.data?.data || res.data || []);
    } catch {
      setPayHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [filterMonth, filterYear, filterGroup]);

  // debtors
  const fetchDebtors = useCallback(async () => {
    setDebtorsLoading(true);
    try {
      const res = await api.get('/payments/debtors');
      setDebtors(res.data?.data || res.data || []);
    } catch {
      toast.error('Qarzdorlarni yuklashda xatolik');
      setDebtors([]);
    } finally {
      setDebtorsLoading(false);
    }
  }, [toast]);

  // monthly stats
  const fetchMonthlyStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/payments/stats/monthly', { params: { year: statsYear } });
      setMonthlyStats(res.data?.data || res.data || []);
    } catch {
      setMonthlyStats([]);
    } finally {
      setStatsLoading(false);
    }
  }, [statsYear]);

  // per-group stats (uses monthly-status grouped by group)
  const fetchGroupStats = useCallback(async () => {
    setGroupStatsLoading(true);
    try {
      const params = { month: filterMonth, year: filterYear };
      const res = await api.get('/payments/monthly-status', { params });
      const rows = res.data?.data || [];
      // aggregate by group
      const map = {};
      rows.forEach((r) => {
        const gid  = r.group_id   || 'unknown';
        const gnam = r.group_name || 'No Group';
        if (!map[gid]) map[gid] = { group_name: gnam, total_fee: 0, total_paid: 0, count: 0 };
        map[gid].total_fee  += Number(r.monthly_fee) || 0;
        map[gid].total_paid += Number(r.total_paid)  || 0;
        map[gid].count      += 1;
      });
      setGroupStats(Object.values(map));
    } catch {
      setGroupStats([]);
    } finally {
      setGroupStatsLoading(false);
    }
  }, [filterMonth, filterYear]);

  // initial loads
  useEffect(() => { fetchRecords(); fetchPayHistory(); }, [fetchRecords, fetchPayHistory]);
  useEffect(() => { api.get('/groups').then((r) => setGroups(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (tab === 'debtors')    fetchDebtors();
    if (tab === 'statistics') { fetchMonthlyStats(); fetchGroupStats(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'statistics') fetchMonthlyStats();
  }, [statsYear, fetchMonthlyStats, tab]);

  // ─── KPI derivations ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let collected = 0, debt = 0, paidCount = 0, unpaidCount = 0;
    records.forEach((r) => {
      const fee  = Number(r.monthly_fee) || 0;
      const paid = Number(r.total_paid)  || 0;
      collected += paid;
      debt      += Math.max(0, fee - paid);
      if (r.status === 'paid') paidCount++;
      else unpaidCount++;
    });
    return { collected, debt, paidCount, unpaidCount };
  }, [records]);

  // ─── filtered rows (monthly-status view) ───────────────────────────────────
  const displayRows = useMemo(() => {
    return records.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [records, filterStatus, search]);

  // ─── filtered payment history ───────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return payHistory.filter((p) => {
      if (filterType && p.payment_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (p.student_name || p.name || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [payHistory, filterType, search]);

  const historyTotal = useMemo(
    () => filteredHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [filteredHistory]
  );

  // ─── filtered + sorted debtors ──────────────────────────────────────────────
  const daysOverdue = useMemo(() => calcDaysOverdue(), []);

  const displayDebtors = useMemo(() => {
    const filtered = debtors.filter((d) => {
      if (!debtorSearch) return true;
      const q = debtorSearch.toLowerCase();
      return (
        (d.student_name || d.name || '').toLowerCase().includes(q) ||
        (d.group_name   || '').toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (debtorSort === 'days_desc')   return (b.days_overdue || daysOverdue) - (a.days_overdue || daysOverdue);
      if (debtorSort === 'amount_desc') return (Number(b.monthly_fee) || 0) - (Number(a.monthly_fee) || 0);
      if (debtorSort === 'name_asc') {
        const na = a.student_name || a.name || '';
        const nb = b.student_name || b.name || '';
        return na.localeCompare(nb);
      }
      return 0;
    });
  }, [debtors, debtorSearch, debtorSort, daysOverdue]);

  const totalOutstanding = useMemo(
    () => debtors.reduce((s, d) => s + (Number(d.monthly_fee) || 0), 0),
    [debtors]
  );

  // ─── stats derivations ───────────────────────────────────────────────────────
  const statsThisMonth = useMemo(() => {
    const thisMonthIdx = now.getMonth();
    const entry = monthlyStats.find(
      (s) => (Number(s.month) - 1 === thisMonthIdx) || s.month_name === MONTH_NAMES[thisMonthIdx]
    );
    return entry || null;
  }, [monthlyStats]);

  const collectionRate = useMemo(() => {
    if (!kpis.collected && !kpis.debt) return 0;
    const total = kpis.collected + kpis.debt;
    if (total === 0) return 0;
    return Math.round((kpis.collected / total) * 100);
  }, [kpis]);

  // chart data — normalize monthly stats
  const chartData = useMemo(() => {
    return monthlyStats.map((s) => ({
      name:       s.month_name || MONTH_NAMES[(Number(s.month) - 1)] || s.month,
      collected:  Number(s.total_collected || s.collected || 0),
      outstanding:Number(s.total_outstanding || s.outstanding || 0),
    }));
  }, [monthlyStats]);

  // ─── quick-pay (from monthly-status table) ─────────────────────────────────
  const openQuickPay = (row) => {
    const remaining = Math.max(0, (Number(row.monthly_fee) || 0) - (Number(row.total_paid) || 0));
    setPayForm({
      studentSearch: row.name || '',
      student_id:    row.id,
      amount:        remaining > 0 ? String(remaining) : String(Number(row.monthly_fee) || ''),
      discount:      '',
      month:         filterMonth,
      year:          filterYear,
      payment_type:  'cash',
      description:   '',
    });
    setQuickPayRow(row);
  };

  const finalAmount = useMemo(
    () => Math.max(0, (Number(payForm.amount) || 0) - (Number(payForm.discount) || 0)),
    [payForm.amount, payForm.discount]
  );

  const handleQuickPay = async (e) => {
    e.preventDefault();
    if (finalAmount <= 0) return;
    setSaving(true);
    try {
      await api.post('/payments', {
        student_id:   payForm.student_id,
        amount:       finalAmount,
        month:        payForm.month,
        year:         payForm.year,
        payment_type: payForm.payment_type,
        description:  payForm.description,
      });
      setQuickPayRow(null);
      toast.success("To'lov muvaffaqiyatli saqlandi");
      fetchRecords();
      fetchPayHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "To'lovda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  // ─── add new payment modal ──────────────────────────────────────────────────
  const addFinalAmount = useMemo(
    () => Math.max(0, (Number(addForm.amount) || 0) - (Number(addForm.discount) || 0)),
    [addForm.amount, addForm.discount]
  );

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!addForm.student_id || addFinalAmount <= 0) return;
    setAddSaving(true);
    try {
      await api.post('/payments', {
        student_id:   addForm.student_id,
        amount:       addFinalAmount,
        month:        addForm.month,
        year:         addForm.year,
        payment_type: addForm.payment_type,
        description:  addForm.description,
      });
      setAddModalOpen(false);
      setAddForm({
        studentSearch: '', student_id: '', student_name: '',
        amount: '', discount: '',
        month: now.getMonth() + 1, year: now.getFullYear(),
        payment_type: 'cash', description: '',
      });
      toast.success("To'lov muvaffaqiyatli qo'shildi");
      fetchRecords();
      fetchPayHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "To'lovda xatolik");
    } finally {
      setAddSaving(false);
    }
  };

  // ─── delete payment ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/payments/${deleteId}`);
      setDeleteId(null);
      toast.success("To'lov o'chirildi");
      fetchPayHistory();
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "O'chirishda xatolik");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── debtor quick pay ───────────────────────────────────────────────────────
  const handleDebtorPay = async (payload) => {
    setDebtorSaving(true);
    try {
      await api.post('/payments', payload);
      const studentId = payload.student_id;
      setPaidIds((prev) => new Set([...prev, studentId]));
      toast.success("To'lov muvaffaqiyatli amalga oshirildi");
      setTimeout(() => {
        setDebtors((prev) => prev.filter(
          (d) => (d.student_id || d.id) !== studentId
        ));
        setPaidIds((prev) => { const s = new Set(prev); s.delete(studentId); return s; });
        setActivePay(null);
      }, 700);
      fetchRecords();
      fetchPayHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "To'lovda xatolik");
    } finally {
      setDebtorSaving(false);
    }
  };

  // ─── billing ─────────────────────────────────────────────────────────────────
  const handleBillingCalc = async () => {
    if (!billingGroup) { toast.error('Please select a group'); return; }
    setBillingLoading(true);
    setBillingResult(null);
    try {
      const res = await api.get('/payments/monthly-status', {
        params: { month: billingMonth, year: billingYear, group_id: billingGroup },
      });
      const rows      = res.data?.data || [];
      const totalFee  = rows.reduce((s, r) => s + (Number(r.monthly_fee) || 0), 0);
      const totalPaid = rows.reduce((s, r) => s + (Number(r.total_paid)  || 0), 0);
      const totalDebt = rows.reduce((s, r) => s + Math.max(0, (Number(r.monthly_fee) || 0) - (Number(r.total_paid) || 0)), 0);
      const lateDeduction = Math.round(totalPaid * (lateWeight / 100));
      setBillingResult({ rows, totalFee, totalPaid, totalDebt, lateDeduction });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hisoblashda xatolik');
    } finally {
      setBillingLoading(false);
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-gray-200 dark:border-slate-700 gap-1 overflow-x-auto">
        <TabBtn active={tab === 'payments'}   onClick={() => setTab('payments')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {"To'lovlar"}
        </TabBtn>

        <TabBtn
          active={tab === 'debtors'}
          onClick={() => setTab('debtors')}
          badge={debtors.length || null}
        >
          <IconDebt />
          Qarzdorlar
        </TabBtn>

        <TabBtn active={tab === 'statistics'} onClick={() => setTab('statistics')}>
          <IconStats />
          Statistika
        </TabBtn>

        <TabBtn active={tab === 'billing'}    onClick={() => setTab('billing')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Hisob-faktura
        </TabBtn>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — To'lovlar                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title={"Bu oy yig'ildi"}
              value={formatCurrency(kpis.collected)}
              icon={<IconCash />}
              color="green"
              subtitle={`${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
            />
            <StatCard
              title="Umumiy qarz"
              value={formatCurrency(kpis.debt)}
              icon={<IconDebt />}
              color="red"
              subtitle={"To'lanmagan miqdor"}
            />
            <StatCard
              title={"To'lagan talabalar"}
              value={kpis.paidCount}
              icon={<IconPaid />}
              color="blue"
              subtitle={"To'liq to'lagan"}
            />
            <StatCard
              title="Qarzdor talabalar"
              value={kpis.unpaidCount}
              icon={<IconUnpaid />}
              color="orange"
              subtitle={"To'lamagan / qisman"}
            />
          </div>

          {/* Filters + add button */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-start sm:items-center">
            <select
              className="input w-full sm:w-36"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              className="input w-full sm:w-28"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <select
              className="input w-full sm:w-44"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <select
              className="input w-full sm:w-36"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-0 max-w-xs">
              <IconSearch />
              <input
                type="text"
                className="input pl-9"
                placeholder={"Ism bo'yicha qidirish..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="btn-primary ml-auto whitespace-nowrap flex items-center gap-2"
              onClick={() => setAddModalOpen(true)}
            >
              <IconPlus />
              {"To'lov qo'shish"}
            </button>
          </div>

          {/* Monthly status table */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <LoadingSpinner text="Yuklanmoqda..." />
            ) : displayRows.length === 0 ? (
              <EmptyState
                title={"Ma'lumot topilmadi"}
                description={"Filtrlarni o'zgartirib ko'ring yoki boshqa oyni tanlang."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 w-10">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Talaba</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Group</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">{"Oylik to'lov"}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">{"To'langan"}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Qoldiq</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Holat</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">{"Oxirgi to'lov"}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                    {displayRows.map((row, idx) => {
                      const fee       = Number(row.monthly_fee) || 0;
                      const paid      = Number(row.total_paid)  || 0;
                      const remaining = Math.max(0, fee - paid);
                      const isDebtor  = row.status === 'unpaid' || row.status === 'partial';
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${isDebtor ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-primary-600"
                              >
                                {(row.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-slate-100">{row.name}</p>
                                {row.phone && (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 md:hidden">{row.phone}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden md:table-cell">
                            {row.group_name || '—'}
                          </td>

                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200 hidden lg:table-cell">
                            {formatCurrency(fee)}
                          </td>

                          <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(paid)}
                          </td>

                          <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                            <span className={remaining > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-slate-500'}>
                              {remaining > 0 ? formatCurrency(remaining) : '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <PayStatusBadge status={row.status} />
                          </td>

                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden xl:table-cell">
                            {formatDate(row.last_payment) || '—'}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openQuickPay(row)}
                              title={"Tezkor to'lov"}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white transition-opacity hover:opacity-80 bg-primary-600"
                            >
                              <IconPlus />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* totals row */}
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-t-2 border-gray-200 dark:border-slate-700">
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-slate-200">
                        Jami ({displayRows.length} talaba)
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-slate-200 hidden lg:table-cell">
                        {formatCurrency(displayRows.reduce((s, r) => s + (Number(r.monthly_fee) || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(displayRows.reduce((s, r) => s + (Number(r.total_paid) || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-red-600 dark:text-red-400 hidden lg:table-cell">
                        {formatCurrency(displayRows.reduce((s, r) => s + Math.max(0, (Number(r.monthly_fee) || 0) - (Number(r.total_paid) || 0)), 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Payment transaction history */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {"To'lovlar tarixi"}
                {filteredHistory.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">
                    ({filteredHistory.length} ta)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="input w-36 text-xs"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">Barcha usullar</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {filteredHistory.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    Jami: {formatCurrency(historyTotal)}
                  </span>
                )}
              </div>
            </div>

            {histLoading ? (
              <LoadingSpinner text="Yuklanmoqda..." />
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                title={"To'lovlar tarixi bo'sh"}
                description={"Bu oy uchun hech qanday to'lov topilmadi."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Sana</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Talaba</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Group</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Summa</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Usul</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Kim kiritdi</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                    {filteredHistory.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {formatDate(p.created_at || p.payment_date)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-slate-100">
                            {p.student_name || p.name || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300 hidden md:table-cell">
                          {p.group_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(Number(p.amount) || 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PayTypeBadge type={p.payment_type} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden lg:table-cell">
                          {p.recorded_by || p.created_by_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title={"O'chirish"}
                          >
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-t-2 border-gray-200 dark:border-slate-700">
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-slate-200">
                        Jami
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(historyTotal)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — Qarzdorlar (Debtors)                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'debtors' && (
        <div className="space-y-4">
          {/* Header + total outstanding */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                {MONTH_NAMES[now.getMonth()]} {now.getFullYear()} — Qarzdorlar
              </h2>
              {debtors.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  Jami qarz:{' '}
                  <span className="font-bold text-red-600">{formatCurrency(totalOutstanding)}</span>
                  {' '}({debtors.length} ta talaba)
                </p>
              )}
            </div>
            <button
              className="btn-secondary btn-sm flex items-center gap-2"
              onClick={fetchDebtors}
              disabled={debtorsLoading}
            >
              <svg className={`w-4 h-4 ${debtorsLoading ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yangilash
            </button>
          </div>

          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-sm">
              <IconSearch />
              <input
                type="text"
                className="input pl-9"
                placeholder="Ism yoki guruh bo'yicha..."
                value={debtorSearch}
                onChange={(e) => setDebtorSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-full sm:w-52"
              value={debtorSort}
              onChange={(e) => setDebtorSort(e.target.value)}
            >
              {DEBTOR_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {debtorsLoading ? (
            <LoadingSpinner text="Yuklanmoqda..." />
          ) : displayDebtors.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <IconPaid />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                {debtorSearch ? "Natija topilmadi" : "Barcha talabalar to'lagan!"}
              </p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                {debtorSearch
                  ? "Qidiruv so'rovini o'zgartiring"
                  : `${MONTH_NAMES[now.getMonth()]} oyi uchun qarzdor talabalar yo'q`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {displayDebtors.map((debtor) => {
                const sid        = debtor.student_id || debtor.id;
                const isPaid     = paidIds.has(sid);
                const isExpanded = activePay === sid;
                const days       = debtor.days_overdue ?? daysOverdue;
                const fee        = Number(debtor.monthly_fee) || 0;

                return (
                  <div
                    key={sid}
                    className={`card p-4 border transition-all duration-300 ${
                      isPaid
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-red-200 dark:border-red-800/60 bg-red-50/40 dark:bg-red-900/10 hover:border-red-300 dark:hover:border-red-700'
                    }`}
                  >
                    {isPaid ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-emerald-600">
                        <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <IconCheck />
                        </span>
                        <span className="font-semibold">To'lov amalga oshirildi!</span>
                      </div>
                    ) : (
                      <>
                        {/* Card header */}
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-red-500"
                          >
                            {(debtor.student_name || debtor.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left flex items-center gap-1"
                              onClick={() => navigate(`/students/${sid}`)}
                            >
                              <span className="truncate">{debtor.student_name || debtor.name}</span>
                              <IconArrow />
                            </button>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                              {debtor.group_name || '—'}
                            </p>
                          </div>
                          <span className="badge-red flex-shrink-0">
                            {"To'lanmadi"}
                          </span>
                        </div>

                        {/* Amount + days */}
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-400 dark:text-slate-500">Qarzdorlik miqdori</p>
                            <p className="text-lg font-bold text-red-600 tabular-nums">
                              {formatCurrency(fee)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-slate-500">Kechikkan</p>
                            <p className={`text-sm font-bold ${days >= 15 ? 'text-red-600 dark:text-red-400' : days >= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-slate-300'}`}>
                              {days} kun
                            </p>
                          </div>
                        </div>

                        {/* Action area */}
                        {!isExpanded ? (
                          <button
                            className="mt-3 w-full btn-primary btn-sm justify-center"
                            onClick={() => setActivePay(sid)}
                          >
                            <IconCheck />
                            {"To'lov qilish"}
                          </button>
                        ) : (
                          <DebtorPayPanel
                            debtor={debtor}
                            onConfirm={handleDebtorPay}
                            onCancel={() => setActivePay(null)}
                            saving={debtorSaving}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — Statistics                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'statistics' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title={"Bu oy yig'ildi"}
              value={formatCurrency(kpis.collected)}
              icon={<IconCash />}
              color="green"
              subtitle={`${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
            />
            <StatCard
              title="Umumiy qarz"
              value={formatCurrency(kpis.debt)}
              icon={<IconDebt />}
              color="red"
              subtitle={"To'lanmagan"}
            />
            <StatCard
              title="Undirilgan foiz"
              value={`${collectionRate}%`}
              icon={<IconPercent />}
              color={collectionRate >= 80 ? 'green' : collectionRate >= 50 ? 'orange' : 'red'}
              subtitle={"Yig'ildi / Jami"}
            />
            <StatCard
              title={"To'lagan talabalar"}
              value={`${kpis.paidCount} / ${records.length}`}
              icon={<IconPaid />}
              color="blue"
              subtitle={`${kpis.unpaidCount} ta qarzdor`}
            />
          </div>

          {/* Year selector + chart */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Oylik to'lovlar dinamikasi</p>
              <select
                className="input w-28 text-sm"
                value={statsYear}
                onChange={(e) => setStatsYear(Number(e.target.value))}
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {statsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <LoadingSpinner text="Yuklanmoqda..." />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <EmptyState title="No data" description="Bu yil uchun statistika mavjud emas." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v)}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="collected" name={"Yig'ildi"} fill="#10B981" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-collected-${index}`}
                        fill={entry.name === MONTH_NAMES[now.getMonth()] ? '#059669' : '#10B981'}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="outstanding" name={"Qarz"} fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                {"Yig'ildi"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                <span className="w-3 h-3 rounded-sm bg-red-300" />
                Qarz
              </div>
            </div>
          </div>

          {/* Per-group summary */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                By Group ({MONTH_NAMES[filterMonth - 1]} {filterYear})
              </p>
              <div className="flex items-center gap-2">
                <select
                  className="input w-28 text-xs"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {groupStatsLoading ? (
              <LoadingSpinner text="Yuklanmoqda..." />
            ) : groupStats.length === 0 ? (
              <EmptyState title="No data" description="No group statistics available." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/60">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Group</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Talabalar</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">{"Jami to'lov"}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">{"To'langan"}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Qarz</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Undirildi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                    {groupStats.map((g, idx) => {
                      const debt = Math.max(0, g.total_fee - g.total_paid);
                      const rate = g.total_fee > 0 ? Math.round((g.total_paid / g.total_fee) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{g.group_name}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-300">{g.count}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">
                            {formatCurrency(g.total_fee)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(g.total_paid)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={debt > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-slate-500'}>
                              {debt > 0 ? formatCurrency(debt) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold tabular-nums ${rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                {rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-slate-800/50 border-t-2 border-gray-200 dark:border-slate-700">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">Jami</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-slate-200">
                        {groupStats.reduce((s, g) => s + g.count, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-700 dark:text-slate-200">
                        {formatCurrency(groupStats.reduce((s, g) => s + g.total_fee, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(groupStats.reduce((s, g) => s + g.total_paid, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(groupStats.reduce((s, g) => s + Math.max(0, g.total_fee - g.total_paid), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — Hisob-faktura                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'billing' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Hisob-faktura kalkulyatori</p>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-end">
              <div>
                <label className="label">Group</label>
                <select
                  className="input w-44"
                  value={billingGroup}
                  onChange={(e) => setBillingGroup(e.target.value)}
                >
                  <option value="">Select group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Oy</label>
                <select
                  className="input w-36"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Yil</label>
                <select
                  className="input w-28"
                  value={billingYear}
                  onChange={(e) => setBillingYear(Number(e.target.value))}
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kechikish foizi (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input w-28"
                  value={lateWeight}
                  onChange={(e) => setLateWeight(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <button
                className="btn-primary whitespace-nowrap"
                onClick={handleBillingCalc}
                disabled={billingLoading || !billingGroup}
              >
                {billingLoading ? 'Hisoblanmoqda...' : 'Hisoblash'}
              </button>
            </div>
          </div>

          {billingLoading && <LoadingSpinner text="Hisoblanmoqda..." />}

          {billingResult && !billingLoading && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  title={"Jami to'lov"}
                  value={formatCurrency(billingResult.totalFee)}
                  icon={<IconCash />}
                  color="indigo"
                />
                <StatCard
                  title={"To'langan"}
                  value={formatCurrency(billingResult.totalPaid)}
                  icon={<IconPaid />}
                  color="green"
                />
                <StatCard
                  title="Qarz"
                  value={formatCurrency(billingResult.totalDebt)}
                  icon={<IconDebt />}
                  color="red"
                />
                <StatCard
                  title="Kechikish chegirmasi"
                  value={formatCurrency(billingResult.lateDeduction)}
                  icon={<IconUnpaid />}
                  color="orange"
                />
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {MONTH_NAMES[billingMonth - 1]} {billingYear} — Hisob-faktura
                  </p>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{billingResult.rows.length} ta talaba</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/60">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Talaba</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">{"Oylik to'lov"}</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">{"To'langan"}</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Qoldiq</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Holat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                      {billingResult.rows.map((row) => {
                        const fee       = Number(row.monthly_fee) || 0;
                        const paid      = Number(row.total_paid)  || 0;
                        const remaining = Math.max(0, fee - paid);
                        return (
                          <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{row.name}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-200">{formatCurrency(fee)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(paid)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={remaining > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-slate-500'}>
                                {remaining > 0 ? formatCurrency(remaining) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <PayStatusBadge status={row.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-slate-800/50 border-t-2 border-gray-200 dark:border-slate-700">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">Jami</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(billingResult.totalFee)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(billingResult.totalPaid)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(billingResult.totalDebt)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {!billingResult && !billingLoading && (
            <div className="card">
              <EmptyState
                title="Select group"
                description={"Hisob-faktura ko'rish uchun guruh va oyni tanlang, so'ng Hisoblash tugmasini bosing."}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Quick Pay Modal (from monthly-status row) ─────────────────────── */}
      <Modal
        open={!!quickPayRow}
        onClose={() => setQuickPayRow(null)}
        title={"Tezkor to'lov"}
        size="sm"
      >
        {quickPayRow && (
          <form onSubmit={handleQuickPay} className="space-y-4">
            {/* Student header */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#EEF2FF] dark:bg-primary-900/20">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-primary-600"
              >
                {(quickPayRow.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{quickPayRow.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{quickPayRow.group_name || '—'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500 dark:text-slate-400">{"Oylik to'lov"}</p>
                <p className="text-sm font-bold tabular-nums text-primary-600 dark:text-primary-400">
                  {formatCurrency(quickPayRow.monthly_fee)}
                </p>
              </div>
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Oy</label>
                <select
                  className="input"
                  value={payForm.month}
                  onChange={(e) => setPayForm({ ...payForm, month: Number(e.target.value) })}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Yil</label>
                <select
                  className="input"
                  value={payForm.year}
                  onChange={(e) => setPayForm({ ...payForm, year: Number(e.target.value) })}
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="label">Miqdor (so'm)</label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="0"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                required
              />
            </div>

            {/* Discount */}
            <div>
              <label className="label">Chegirma (so'm)</label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="0"
                value={payForm.discount}
                onChange={(e) => setPayForm({ ...payForm, discount: e.target.value })}
              />
            </div>

            {/* Final amount */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-[#BBF7D0] dark:border-emerald-700/50">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Yakuniy summa</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(finalAmount)}
              </span>
            </div>

            {/* Payment method */}
            <div>
              <label className="label">{"To'lov usuli"}</label>
              <MethodToggle
                value={payForm.payment_type}
                onChange={(v) => setPayForm({ ...payForm, payment_type: v })}
              />
            </div>

            {/* Note */}
            <div>
              <label className="label">Izoh</label>
              <input
                type="text"
                className="input"
                placeholder="Ixtiyoriy izoh..."
                value={payForm.description}
                onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setQuickPayRow(null)}>
                Bekor
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || finalAmount <= 0}              >
                {saving ? 'Saqlanmoqda...' : "To'lov qilish"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Add New Payment Modal ─────────────────────────────────────────── */}
      <Modal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); }}
        title={"Yangi to'lov qo'shish"}
        size="sm"
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          {/* Student autocomplete */}
          <div>
            <label className="label">Talaba</label>
            <StudentAutocomplete
              value={addForm.studentSearch}
              onChange={(q) => setAddForm({ ...addForm, studentSearch: q, student_id: '', amount: '' })}
              onSelect={(s) => {
                const name = s.full_name || s.name || '';
                setAddForm({
                  ...addForm,
                  studentSearch: name,
                  student_id:   String(s.id),
                  student_name: name,
                  amount:       String(s.monthly_fee || ''),
                });
              }}
              placeholder="Talaba ismini kiriting..."
            />
            {addForm.student_id && (
              <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                <IconCheck />
                Talaba tanlandi: {addForm.student_name}
              </p>
            )}
          </div>

          {/* Month / Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Oy</label>
              <select
                className="input"
                value={addForm.month}
                onChange={(e) => setAddForm({ ...addForm, month: Number(e.target.value) })}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Yil</label>
              <select
                className="input"
                value={addForm.year}
                onChange={(e) => setAddForm({ ...addForm, year: Number(e.target.value) })}
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Miqdor (so'm)</label>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="0"
              value={addForm.amount}
              onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              required
            />
          </div>

          {/* Discount */}
          <div>
            <label className="label">Chegirma (so'm)</label>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="0"
              value={addForm.discount}
              onChange={(e) => setAddForm({ ...addForm, discount: e.target.value })}
            />
          </div>

          {/* Final amount */}
          {addFinalAmount > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-[#BBF7D0] dark:border-emerald-700/50">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Yakuniy summa</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(addFinalAmount)}
              </span>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="label">{"To'lov usuli"}</label>
            <MethodToggle
              value={addForm.payment_type}
              onChange={(v) => setAddForm({ ...addForm, payment_type: v })}
            />
          </div>

          {/* Note */}
          <div>
            <label className="label">Izoh</label>
            <input
              type="text"
              className="input"
              placeholder="Ixtiyoriy izoh..."
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAddModalOpen(false)}
            >
              Bekor
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={addSaving || !addForm.student_id || addFinalAmount <= 0}            >
              {addSaving ? 'Saqlanmoqda...' : "Saqlash"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setDeleteId(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg w-full max-w-sm p-5 animate-slideIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-500">
                <IconTrash />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{"To'lovni o'chirish"}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  {"Bu to'lovni o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                className="btn-secondary"
                onClick={() => setDeleteId(null)}
                disabled={deleteLoading}
              >
                Bekor
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "O'chirilmoqda..." : "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Payments;
