import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(v || 0) + " so'm";

// ─── Props ────────────────────────────────────────────────────────────────────
// lesson: { id, group_name, date, students: [{id, name}], price_per_student }
// onClose: () => void
// onSuccess: () => void  — caller handles toast + refetch
// ─────────────────────────────────────────────────────────────────────────────

const statusCfg = {
  attended: {
    label: 'Keldi',
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    activeCls: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200',
  },
  missed: {
    label: 'Kelmadi',
    cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    activeCls: 'bg-red-500 text-white border-red-500 shadow-sm shadow-red-200',
  },
  excused: {
    label: 'Uzr',
    cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    activeCls: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200',
  },
};

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-400 to-teal-500',
  'from-orange-400 to-amber-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-sky-500',
];

export default function ConductModal({ lesson, onClose, onSuccess }) {
  const toast = useToast();

  const [attendance, setAttendance] = useState(() =>
    (lesson.students || []).map((s) => ({
      student_id: s.id,
      name: s.name,
      status: 'attended',
    }))
  );
  const [saving, setSaving] = useState(false);

  const attended = attendance.filter((a) => a.status === 'attended').length;
  const income = attended * (lesson.price_per_student || 0);

  const setStatus = (id, status) =>
    setAttendance((prev) =>
      prev.map((a) => (a.student_id === id ? { ...a, status } : a))
    );

  const markAll = () =>
    setAttendance((a) => a.map((x) => ({ ...x, status: 'attended' })));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/lessons/${lesson.id}/conduct`, { attendance });
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const displayDate = lesson.date
    ? (() => {
        try {
          return new Date(lesson.date).toLocaleDateString('uz-UZ', {
            day: 'numeric',
            month: 'long',
          });
        } catch {
          return lesson.date;
        }
      })()
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-slideIn overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border-b border-violet-100/80 dark:border-slate-700/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 bg-violet-500 rounded-full" />
                <p className="font-bold text-gray-900 dark:text-slate-100 truncate">{lesson.group_name}</p>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 pl-4">
                {displayDate ? `${displayDate} — ` : ''}Davomat belgilash
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {attendance.length > 0 && (
                <button
                  onClick={markAll}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-semibold bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 px-3 py-1.5 rounded-xl transition-all border border-violet-100 dark:border-violet-800/50"
                >
                  Barchasi keldi
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-500 transition-all shadow-sm"
                aria-label="Yopish"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Income preview bar */}
        <div className="mx-6 mt-5 mb-3">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums leading-tight">{fmt(income)}</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-0.5">{attended} ta talaba keldi</p>
            </div>
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1">
          {attendance.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
              Talabalar topilmadi
            </p>
          ) : (
            attendance.map((a, idx) => {
              const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
              return (
                <div
                  key={a.student_id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  {/* Avatar initial */}
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm`}>
                    {(a.name || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 flex-1 truncate">
                    {a.name}
                  </p>

                  {/* Status buttons */}
                  <div className="flex gap-1">
                    {(['attended', 'missed', 'excused']).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(a.student_id, s)}
                        className={`px-2.5 py-1 text-xs rounded-xl border font-semibold transition-all ${
                          a.status === s
                            ? statusCfg[s].activeCls
                            : 'bg-gray-50 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        {statusCfg[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700/50 flex gap-3 bg-gray-50/50 dark:bg-slate-800/80">
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl">
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !attendance.length}
            className="btn-primary flex-1 rounded-xl"
          >
            {saving ? 'Saqlanmoqda...' : 'Tasdiqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
