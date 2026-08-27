import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import ConfirmDialog from './ConfirmDialog';

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, size = 15 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  plus:     'M12 4v16m8-8H4',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  edit:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  book:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

// ── Add/Edit form ─────────────────────────────────────────────────────────────
const HomeworkForm = ({ groupId, onSaved, editItem, onCancel }) => {
  const [title,   setTitle]   = useState(editItem?.title       || '');
  const [desc,    setDesc]    = useState(editItem?.description || '');
  const [dueDate, setDueDate] = useState(editItem?.due_date    || '');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setSaving(true); setErr('');
    try {
      if (editItem) {
        await api.put(`/homework/${editItem.id}`, { title, description: desc, due_date: dueDate || null });
      } else {
        await api.post('/homework', { group_id: groupId, title, description: desc, due_date: dueDate || null });
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4">
      <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 mb-3">
        {editItem ? 'Edit homework' : 'New homework'}
      </p>

      {err && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-2.5 py-1.5 rounded">
          {err}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Homework title *"
          className="input text-sm"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="input text-sm resize-y"
        />
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 flex-1 text-gray-500 dark:text-slate-400">
            <Ic d={ICONS.calendar} size={13} />
            <span className="text-xs">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input text-xs py-1 px-2"
            />
          </div>
          <div className="flex gap-1.5">
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Saving…' : editItem ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

// ── Homework item card ────────────────────────────────────────────────────────
const HwCard = ({ item, onDelete, onEdit }) => {
  const [deleting,     setDeleting]     = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try { await api.delete(`/homework/${item.id}`); onDelete(item.id); }
    catch { setDeleting(false); }
  };

  const isPast = item.due_date && new Date(item.due_date) < new Date();

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-3 flex gap-3 items-start">
      <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Ic d={ICONS.book} size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-0.5">{item.title}</p>
        {item.description && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 leading-snug">{item.description}</p>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          {item.due_date && (
            <span className={`text-[10px] font-medium rounded-full px-2 py-px border ${
              isPast
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600'
            }`}>
              Due {item.due_date}
            </span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            by {item.teacher_name || 'Teacher'}
          </span>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(item)}
          aria-label="Edit homework"
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors duration-150"
        >
          <Ic d={ICONS.edit} size={13} />
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
          aria-label="Delete homework"
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 flex items-center justify-center transition-colors duration-150 disabled:opacity-50"
        >
          <Ic d={ICONS.trash} size={13} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Homework"
        message="Delete this homework assignment? This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

// ── Main Homework Tab ─────────────────────────────────────────────────────────
const HomeworkTab = ({ groupId }) => {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const r = await api.get('/homework', { params: { group_id: groupId } });
      setItems(r.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleSaved  = () => { setShowForm(false); setEditItem(null); load(); };
  const handleDelete = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const handleEdit   = (item) => { setEditItem(item); setShowForm(false); };

  if (!groupId) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 py-10 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">Select a group to view homework</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {loading ? 'Loading…' : `${items.length} assignment${items.length !== 1 ? 's' : ''}`}
        </p>
        {!showForm && !editItem && (
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm flex items-center gap-1.5">
            <Ic d={ICONS.plus} size={12} />
            Add homework
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <HomeworkForm groupId={groupId} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}

      {/* Edit form */}
      {editItem && (
        <HomeworkForm groupId={groupId} editItem={editItem} onSaved={handleSaved} onCancel={() => setEditItem(null)} />
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 py-10 text-center">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2.5">
            <Ic d={ICONS.book} size={18} />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">No homework assigned yet</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Click "Add homework" to create the first assignment
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <HwCard key={item.id} item={item} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeworkTab;
