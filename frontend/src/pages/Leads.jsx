import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import { formatDate } from '../utils/helpers';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'new',            label: 'Yangi',         cls: 'badge-blue'   },
  { value: 'contacted',      label: 'Bog\'landi',    cls: 'badge-yellow' },
  { value: 'interested',     label: 'Qiziqyapti',    cls: 'badge-green'  },
  { value: 'not_interested', label: 'Qiziqmaydi',    cls: 'badge-gray'   },
  { value: 'converted',      label: 'O\'quvchi bo\'ldi', cls: 'badge-purple' },
  { value: 'lost',           label: 'Yo\'qotildi',   cls: 'badge-red'    },
];

const SOURCES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram',  label: 'Telegram'  },
  { value: 'website',   label: 'Veb-sayt'  },
  { value: 'referral',  label: 'Tavsiya'   },
  { value: 'phone',     label: 'Telefon'   },
  { value: 'walk_in',   label: 'Shaxsan'   },
  { value: 'other',     label: 'Boshqa'    },
];

const EMPTY_FORM = {
  name: '', phone: '', email: '', source: 'other',
  status: 'new', course_interest: '', notes: '', follow_up_date: '',
};

// ── Small helpers ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUSES.find((x) => x.value === status) || { label: status, cls: 'badge-gray' };
  return <span className={s.cls}>{s.label}</span>;
};

const SourceLabel = ({ source }) => {
  const s = SOURCES.find((x) => x.value === source);
  return s ? s.label : source || '—';
};

// ── SVG icons (inline, no external dep) ───────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  users:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  star:    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  check:   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  lost:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  plus:    'M12 4v16m8-8H4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  contact: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
};

// ── Main component ─────────────────────────────────────────────────────────────
const Leads = () => {
  const toast = useToast();
  const [leads,      setLeads]      = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editLead,   setEditLead]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search)        params.search = search;
      if (filterStatus)  params.status = filterStatus;
      if (filterSource)  params.source = filterSource;
      const res = await api.get('/leads', { params });
      setLeads(res.data.data || []);
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterSource]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreate = () => { setEditLead(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit   = (l) => {
    setEditLead(l);
    setForm({
      name: l.name || '', phone: l.phone || '', email: l.email || '',
      source: l.source || 'other', status: l.status || 'new',
      course_interest: l.course_interest || '',
      notes: l.notes || '',
      follow_up_date: l.follow_up_date ? l.follow_up_date.split('T')[0] : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editLead) {
        await api.put(`/leads/${editLead.id}`, form);
      } else {
        await api.post('/leads', form);
      }
      setModalOpen(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/leads/${deleteId}`);
      setDeleteId(null);
      fetchLeads();
    } catch (err) {
      toast.error("O'chirishda xatolik");
    } finally {
      setDeleting(false);
    }
  };

  // ── Stats counts ───────────────────────────────────────────────────────────
  const total      = leads.length;
  const newCount   = stats.new          || 0;
  const contacted  = stats.contacted    || 0;
  const converted  = stats.converted    || 0;
  const lost       = stats.lost         || 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Leadlar</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Potensial o'quvchilarni boshqaring</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Icon d={ICONS.plus} size={16} />
          Yangi lead
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Jami"          value={total}     color="indigo" icon={<Icon d={ICONS.users} size={18} />} />
        <StatCard title="Yangi"         value={newCount}  color="blue"   icon={<Icon d={ICONS.star}  size={18} />} />
        <StatCard title="Bog'landi"     value={contacted} color="orange" icon={<Icon d={ICONS.contact} size={18} />} />
        <StatCard title="O'quvchi bo'ldi" value={converted} color="green" icon={<Icon d={ICONS.check} size={18} />} />
        <StatCard title="Yo'qotildi"   value={lost}      color="red"    icon={<Icon d={ICONS.lost}  size={18} />} />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon d={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              placeholder="Ism yoki telefon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input min-w-36"
          >
            <option value="">Barcha statuslar</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Source filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="input min-w-36"
          >
            <option value="">Barcha manbalar</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Clear */}
          {(search || filterStatus || filterSource) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterSource(''); }}
              className="btn-ghost text-sm"
            >
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner text="Yuklanmoqda..." />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            title="Lead topilmadi"
            description="Yangi lead qo'shish uchun yuqoridagi tugmani bosing"
            action={{ label: 'Yangi lead', onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ism</th>
                  <th>Telefon</th>
                  <th>Manba</th>
                  <th>Kurs</th>
                  <th>Status</th>
                  <th>Kuzatuv sanasi</th>
                  <th>Qo'shilgan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead.id}>
                    <td className="text-gray-400 text-sm">{idx + 1}</td>
                    <td>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                    </td>
                    <td className="text-gray-600">{lead.phone}</td>
                    <td>
                      <span className="text-sm text-gray-600">
                        <SourceLabel source={lead.source} />
                      </span>
                    </td>
                    <td className="text-gray-600 text-sm">{lead.course_interest || '—'}</td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td className="text-gray-500 text-sm">
                      {lead.follow_up_date ? formatDate(lead.follow_up_date) : '—'}
                    </td>
                    <td className="text-gray-400 text-sm">{formatDate(lead.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(lead)}
                          className="p-1.5 rounded-md text-gray-400 dark:text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Tahrirlash"
                        >
                          <Icon d={ICONS.edit} size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(lead.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="O'chirish"
                        >
                          <Icon d={ICONS.trash} size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLead ? 'Leadni tahrirlash' : 'Yangi lead qo\'shish'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Row 1: Name + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Ism *</label>
              <input
                type="text"
                required
                className="input w-full"
                placeholder="To'liq ism"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Telefon *</label>
              <input
                type="text"
                required
                className="input w-full"
                placeholder="+998 90 000 00 00"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Email + Course interest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="input w-full"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Qiziqayotgan kurs</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Masalan: English, IT..."
                value={form.course_interest}
                onChange={(e) => setForm({ ...form, course_interest: e.target.value })}
              />
            </div>
          </div>

          {/* Row 3: Source + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Manba</label>
              <select
                className="input w-full"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="input w-full"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Follow-up date */}
          <div>
            <label className="form-label">Kuzatuv sanasi</label>
            <input
              type="date"
              className="input w-full"
              value={form.follow_up_date}
              onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Izoh</label>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Qo'shimcha ma'lumot..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saqlanmoqda...' : editLead ? 'Saqlash' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Leadni o'chirish"
        message="Bu leadni o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Leads;
