import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate, formatCurrency, MONTH_NAMES } from '../utils/helpers';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = {
  active:   { label: 'Active',   cls: 'badge-green' },
  frozen:   { label: 'Frozen',   cls: 'badge-blue'  },
  archived: { label: 'Archived', cls: 'badge-gray'  },
};

// ── Timeline event config (Tailwind classes) ───────────────────────────────────
const HISTORY_STATUS = {
  active:      { label: 'Joined group', dotCls: 'bg-green-500 border-green-500',   badgeCls: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' },
  transferred: { label: 'Transferred',  dotCls: 'bg-amber-400 border-amber-400',   badgeCls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  frozen:      { label: 'Frozen',       dotCls: 'bg-blue-500 border-blue-500',     badgeCls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'    },
};

// ── Small reusable components ──────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mt-0.5">{value || '—'}</p>
  </div>
);

// ── Timeline entry ─────────────────────────────────────────────────────────────
const TimelineEntry = ({ record, isFirst }) => {
  const cfg   = HISTORY_STATUS[record.status] || HISTORY_STATUS.active;
  const isOpen = !record.end_date;

  return (
    <div className="flex gap-3">
      {/* Line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
          isOpen ? cfg.dotCls : 'bg-gray-300 dark:bg-slate-600 border-gray-300 dark:border-slate-600'
        }`} />
        {!isFirst && (
          <div className="w-0.5 flex-1 bg-gray-100 dark:bg-slate-700/60 min-h-5 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold rounded-full px-2 py-px ${cfg.badgeCls}`}>
            {cfg.label}
          </span>
          {isOpen && (
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-full px-1.5 py-px">
              Current
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-1 mb-0.5">
          {record.group_name || 'Unknown group'}
        </p>
        {record.teacher_name && (
          <p className="text-[11px] text-gray-500 dark:text-slate-400">{record.teacher_name}</p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
          {formatDate(record.start_date)}
          {record.end_date ? ` → ${formatDate(record.end_date)}` : ' → today'}
        </p>
        {record.notes && (
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 italic">
            "{record.notes}"
          </p>
        )}
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const StudentProfile = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const toast      = useToast();
  const isAdmin    = user?.role !== 'teacher';

  const [student,      setStudent]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [actioning,    setActioning]    = useState(false);
  const [noteModal,    setNoteModal]    = useState(false);
  const [note,         setNote]         = useState('');
  const [paymentModal, setPaymentModal] = useState(false);
  const [payment,      setPayment]      = useState({
    amount: '', month: new Date().getMonth() + 1,
    year: new Date().getFullYear(), payment_type: 'cash', description: '',
  });
  const [transferModal,   setTransferModal]   = useState(false);
  const [transferGroupId, setTransferGroupId] = useState('');
  const [groups,           setGroups]          = useState([]);
  const [freezeModal,     setFreezeModal]     = useState(false);
  const [freezeNotes,     setFreezeNotes]     = useState('');
  const [archiveConfirm,  setArchiveConfirm]  = useState(false);

  const fetchStudent = async () => {
    try {
      const res = await api.get(`/students/${id}`);
      setStudent(res.data);
    } catch { navigate('/students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudent(); }, [id]);
  useEffect(() => {
    if (isAdmin) api.get('/groups').then((r) => setGroups(r.data || [])).catch(() => {});
  }, [isAdmin]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    setActioning(true);
    try {
      await api.post(`/students/${id}/notes`, { note });
      setNote(''); setNoteModal(false); fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error adding note'); }
    finally { setActioning(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setActioning(true);
    try {
      await api.post('/payments', { ...payment, student_id: id });
      toast.success('Payment recorded successfully');
      setPaymentModal(false); fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
    finally { setActioning(false); }
  };

  const handleFreeze = async () => {
    setActioning(true);
    try {
      await api.put(`/students/${id}/freeze`, { notes: freezeNotes });
      setFreezeModal(false); setFreezeNotes('');
      fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActioning(false); }
  };

  const handleUnfreeze = async () => {
    setActioning(true);
    try {
      await api.put(`/students/${id}/unfreeze`);
      fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActioning(false); }
  };

  const handleArchive = async () => {
    setArchiveConfirm(false);
    setActioning(true);
    try {
      await api.put(`/students/${id}/archive`);
      fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActioning(false); }
  };

  const handleRestore = async () => {
    setActioning(true);
    try {
      await api.put(`/students/${id}/restore`);
      fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActioning(false); }
  };

  const handleTransfer = async () => {
    if (!transferGroupId) return;
    setActioning(true);
    try {
      await api.put(`/students/${id}/transfer`, { group_id: transferGroupId });
      setTransferModal(false);
      fetchStudent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActioning(false); }
  };

  if (loading) return <LoadingSpinner text="Loading student..." />;
  if (!student) return null;

  const status = student.status || 'active';
  const statusCfg = STATUS[status] || STATUS.active;

  const stats = { present: 0, absent: 0, late: 0, freeze: 0 };
  student.attendance_stats?.forEach((s) => { stats[s.status] = parseInt(s.count) || 0; });
  const totalClasses   = stats.present + stats.absent + stats.late;
  const attendanceRate = totalClasses > 0 ? Math.round((stats.present / totalClasses) * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back */}
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Students
      </Link>

      {/* ── Header Card ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{student.name}</h2>
                <span className={statusCfg.cls}>{statusCfg.label}</span>
                {student.is_debtor && <span className="badge-red">Debtor</span>}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {student.group_name || 'No group'} · {student.teacher_name || 'No teacher'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {status === 'active' && (
                <>
                  <button className="btn-primary btn-sm" onClick={() => setPaymentModal(true)}>
                    + Payment
                  </button>
                  <button className="btn-secondary btn-sm"
                    onClick={() => { setTransferModal(true); setTransferGroupId(student.group_id || ''); }}>
                    Transfer
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => { setFreezeModal(true); setFreezeNotes(''); }}>
                    Freeze
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setArchiveConfirm(true)} disabled={actioning}>
                    Archive
                  </button>
                </>
              )}
              {status === 'frozen' && (
                <>
                  <button className="btn-primary btn-sm" onClick={handleUnfreeze} disabled={actioning}>
                    {actioning ? 'Unfreezing…' : 'Unfreeze'}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setArchiveConfirm(true)} disabled={actioning}>
                    Archive
                  </button>
                </>
              )}
              {status === 'archived' && (
                <button className="btn-primary btn-sm" onClick={handleRestore} disabled={actioning}>
                  {actioning ? 'Restoring…' : 'Restore'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: info + payments + timeline ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Student Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <InfoRow label="Phone"        value={student.phone} />
              <InfoRow label="Parent Phone" value={student.parent_phone} />
              <InfoRow label="Email"        value={student.email} />
              <InfoRow label="Birth Date"   value={formatDate(student.birth_date)} />
              <InfoRow label="Start Date"   value={formatDate(student.start_date)} />
              <InfoRow label="Group"        value={student.group_name} />
              <InfoRow label="Teacher"      value={student.teacher_name} />
              <InfoRow label="Course"       value={student.course_name} />
              <InfoRow label="Monthly Fee"  value={student.monthly_fee ? formatCurrency(student.monthly_fee) : null} />
              <InfoRow label="Address"      value={student.address} />
            </div>
            {student.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/60">
                <p className="text-xs text-gray-400 dark:text-slate-500">Notes</p>
                <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">{student.notes}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-5">History Timeline</h3>
            {!student.group_history?.length ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No group history yet</p>
            ) : (
              <div className="flex flex-col">
                {student.group_history.map((record, i) => (
                  <TimelineEntry
                    key={record.id}
                    record={record}
                    isFirst={i === student.group_history.length - 1}
                  />
                ))}
                {/* Joined center dot */}
                <div className="flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 bg-gray-300 dark:bg-slate-600 border-2 border-gray-300 dark:border-slate-600" />
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                    Joined center — {formatDate(student.created_at)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Payment History</h3>
            {!student.payments?.length ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No payments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700/60">
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Month</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Amount</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Type</th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
                    {student.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 text-gray-700 dark:text-slate-300">{MONTH_NAMES[p.month - 1]} {p.year}</td>
                        <td className="py-2 font-medium text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</td>
                        <td className="py-2 capitalize text-gray-600 dark:text-slate-400">{p.payment_type}</td>
                        <td className="py-2 text-gray-500 dark:text-slate-500">{formatDate(p.payment_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: attendance + notes ──────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Attendance */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Attendance</h3>
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400">{attendanceRate}%</div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Attendance rate</p>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Present', count: stats.present, cls: 'badge-green'  },
                { label: 'Absent',  count: stats.absent,  cls: 'badge-red'    },
                { label: 'Late',    count: stats.late,    cls: 'badge-yellow' },
                { label: 'Freeze',  count: stats.freeze,  cls: 'badge-blue'   },
              ].map(({ label, count, cls }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className={cls}>{label}</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Notes</h3>
              <button className="text-xs text-primary-600 dark:text-primary-400 hover:underline" onClick={() => setNoteModal(true)}>+ Add</button>
            </div>
            {!student.notes?.length ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {student.notes?.map((n) => (
                  <div key={n.id} className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 dark:text-slate-300">{n.note}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">— {n.teacher_name}, {formatDate(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Note Modal ────────────────────────────────────────────────────── */}
      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add Note" size="sm">
        <form onSubmit={handleAddNote}>
          <textarea className="input resize-none" rows={4} value={note}
            onChange={(e) => setNote(e.target.value)} placeholder="Write a note..." required />
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setNoteModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add Note</button>
          </div>
        </form>
      </Modal>

      {/* ── Add Payment Modal ─────────────────────────────────────────────────── */}
      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Add Payment" size="sm">
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="label">Amount *</label>
            <input type="number" className="input" value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required min="0" placeholder="500000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month *</label>
              <select className="input" value={payment.month}
                onChange={(e) => setPayment({ ...payment, month: e.target.value })}>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year *</label>
              <input type="number" className="input" value={payment.year}
                onChange={(e) => setPayment({ ...payment, year: e.target.value })} min="2020" max="2030" />
            </div>
          </div>
          <div>
            <label className="label">Payment Type</label>
            <select className="input" value={payment.payment_type}
              onChange={(e) => setPayment({ ...payment, payment_type: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={payment.description}
              onChange={(e) => setPayment({ ...payment, description: e.target.value })} placeholder="Optional note" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setPaymentModal(false)}>Cancel</button>
            <button type="submit" className="btn-success">Add Payment</button>
          </div>
        </form>
      </Modal>

      {/* ── Freeze Modal ──────────────────────────────────────────────────────── */}
      <Modal open={freezeModal} onClose={() => setFreezeModal(false)} title="Freeze Student" size="sm">
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          Freeze <strong className="text-gray-900 dark:text-slate-100">{student.name}</strong>? They won't appear in active attendance.
        </p>
        <div className="mb-4">
          <label className="label">Reason (optional)</label>
          <input className="input" placeholder="e.g. Medical leave, travelling…"
            value={freezeNotes} onChange={(e) => setFreezeNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setFreezeModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleFreeze} disabled={actioning}>
            {actioning ? 'Freezing…' : 'Freeze'}
          </button>
        </div>
      </Modal>

      {/* ── Transfer Modal ────────────────────────────────────────────────────── */}
      <Modal open={transferModal} onClose={() => setTransferModal(false)} title="Transfer Student" size="sm">
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          Move <strong className="text-gray-900 dark:text-slate-100">{student.name}</strong> to a different group:
        </p>
        <select className="input" value={transferGroupId} onChange={(e) => setTransferGroupId(e.target.value)}>
          <option value="">Select group…</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-secondary" onClick={() => setTransferModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleTransfer} disabled={actioning || !transferGroupId}>
            {actioning ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveConfirm}
        onClose={() => setArchiveConfirm(false)}
        onConfirm={handleArchive}
        title="Archive Student"
        message="Archive this student? All data is preserved and can be restored later."
        confirmText="Archive"
        variant="danger"
      />
    </div>
  );
};

export default StudentProfile;
