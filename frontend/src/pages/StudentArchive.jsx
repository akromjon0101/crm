import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatDate } from '../utils/helpers';

const StudentArchive = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role !== 'teacher';

  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [restoring, setRestoring] = useState(null); // id being restored
  const [confirmId, setConfirmId] = useState(null); // id pending restore confirm

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: 'archived' };
      if (search) params.search = search;
      const res = await api.get('/students', { params });
      setStudents(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleRestore = async () => {
    const id = confirmId;
    setConfirmId(null);
    setRestoring(id);
    try {
      await api.put(`/students/${id}/restore`);
      fetchArchived();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error restoring student');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="input pl-9" placeholder="Search archived…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Link to="/students" className="btn-secondary whitespace-nowrap">
          ← Active Students
        </Link>
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-lg px-4 py-2.5 text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
        Archived students are not deleted — all attendance, payment, and history data is preserved.
        Restore a student to make them active again (without a group assignment).
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading archive…" />
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 font-medium">No archived students</p>
            {search && <p className="text-xs text-gray-400 mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Last Group</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden lg:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Link to={`/students/${s.id}`}
                            className="font-medium text-gray-700 dark:text-slate-200 hover:text-primary-600 transition-colors">
                            {s.name}
                          </Link>
                          <p className="text-xs text-gray-400 dark:text-slate-500 md:hidden">{s.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden lg:table-cell">{s.group_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden lg:table-cell">{formatDate(s.created_at)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/students/${s.id}`}
                          className="text-xs text-gray-500 hover:text-primary-600 transition-colors">
                          View
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmId(s.id)}
                            disabled={restoring === s.id}
                            className="btn-primary btn-sm text-xs px-3 py-1"
                          >
                            {restoring === s.id ? 'Restoring…' : 'Restore'}
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

      {/* Count */}
      {!loading && students.length > 0 && (
        <p className="text-xs text-gray-400 text-right">{students.length} archived student{students.length !== 1 ? 's' : ''}</p>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleRestore}
        title="Restore Student"
        message="Restore this student? They will become active again without a group assignment."
        confirmText="Restore"
        variant="primary"
      />
    </div>
  );
};

export default StudentArchive;
