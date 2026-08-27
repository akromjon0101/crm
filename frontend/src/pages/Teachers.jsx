import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

const EMPTY_FORM = {
  name: '', email: '', password: '', phone: '', subject: '',
  role: 'teacher', is_active: 1, salary_per_student: '',
};

const fmt = (n) => n != null ? Number(n).toLocaleString('uz-UZ') : '—';

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-400'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const Teachers = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'superadmin';
  const [tab, setTab] = useState('teachers');
  const [teachers, setTeachers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teachersRes, adminsRes] = await Promise.all([
        api.get('/users/teachers'),
        isSuperAdmin ? api.get('/users?role=admin') : Promise.resolve({ data: [] }),
      ]);
      setTeachers(teachersRes.data);
      setAdmins(adminsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = (role = 'teacher') => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM, role });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name: u.name, email: u.email, password: '',
      phone: u.phone || '', subject: u.subject || '',
      role: u.role, is_active: u.is_active ?? 1,
      salary_per_student: u.salary_per_student != null ? String(u.salary_per_student) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form };
      if (editUser && !data.password) delete data.password;
      data.salary_per_student = data.salary_per_student !== '' ? Number(data.salary_per_student) : null;
      if (editUser) {
        await api.put(`/users/${editUser.id}`, data);
      } else {
        await api.post('/users', data);
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteId}`);
      setDeleteId(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting');
    } finally { setDeleting(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${resetModal.id}/reset-password`, { newPassword });
      setResetModal(null);
      setNewPassword('');
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error resetting password');
    }
  };

  const handleToggleActive = async (u) => {
    const updated = { ...u, is_active: u.is_active ? 0 : 1 };
    if (u.role === 'teacher') setTeachers(prev => prev.map(t => t.id === u.id ? updated : t));
    else setAdmins(prev => prev.map(a => a.id === u.id ? updated : a));
    try {
      await api.put(`/users/${u.id}`, {
        name: u.name, email: u.email, role: u.role,
        phone: u.phone || '', subject: u.subject || '',
        is_active: updated.is_active,
        salary_per_student: u.salary_per_student ?? null,
      });
    } catch {
      if (u.role === 'teacher') setTeachers(prev => prev.map(t => t.id === u.id ? u : t));
      else setAdmins(prev => prev.map(a => a.id === u.id ? u : a));
    }
  };

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const currentList = tab === 'teachers' ? teachers : admins;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'teachers' ? 'bg-white dark:bg-slate-800 shadow-sm text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            onClick={() => setTab('teachers')}
          >
            Teachers
            <span className="ml-1.5 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">{teachers.length}</span>
          </button>
          {isSuperAdmin && (
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'admins' ? 'bg-white dark:bg-slate-800 shadow-sm text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
              onClick={() => setTab('admins')}
            >
              Admins
              <span className="ml-1.5 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">{admins.length}</span>
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={() => openCreate(tab === 'admins' ? 'admin' : 'teacher')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{tab === 'admins' ? 'Add Admin' : 'Add Teacher'}</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text={`Loading ${tab}...`} />
      ) : currentList.length === 0 ? (
        <EmptyState
          title={`No ${tab} yet`}
          description={`Add your first ${tab === 'admins' ? 'admin' : 'teacher'} to get started.`}
          action={<button className="btn-primary" onClick={() => openCreate(tab === 'admins' ? 'admin' : 'teacher')}>Add {tab === 'admins' ? 'Admin' : 'Teacher'}</button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Subject</th>
                  {tab === 'teachers' && (
                    <>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Groups</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Students</th>
                      {isSuperAdmin && <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Rate/student</th>}
                      {isSuperAdmin && <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Total salary</th>}
                    </>
                  )}
                  <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {currentList.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-slate-100">{u.name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{u.subject || <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                    {tab === 'teachers' && (
                      <>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-gray-800 dark:text-slate-200">{u.group_count ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-gray-800 dark:text-slate-200">{u.student_count ?? 0}</span>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-300">
                            {u.salary_per_student != null ? (
                              <span>{fmt(u.salary_per_student)} <span className="text-gray-400 dark:text-slate-500 text-xs">uzs</span></span>
                            ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                          </td>
                        )}
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-right">
                            {u.total_salary != null ? (
                              <span className="font-semibold text-emerald-700">{fmt(u.total_salary)} <span className="text-gray-400 font-normal text-xs">uzs</span></span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )}
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(u)} title="Toggle active">
                        <StatusBadge active={u.is_active} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit" onClick={() => openEdit(u)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Reset password" onClick={() => { setResetModal(u); setNewPassword(''); }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        {isSuperAdmin && (
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete" onClick={() => setDeleteId(u.id)}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {tab === 'teachers' && teachers.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <td colSpan={isSuperAdmin ? 4 : 4} className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 font-medium">
                      {teachers.length} teachers · {teachers.reduce((s, t) => s + (t.student_count ?? 0), 0)} total students
                    </td>
                    {isSuperAdmin && <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-slate-400" />}
                    {isSuperAdmin && (
                      <td className="px-4 py-2.5 text-right">
                        {(() => {
                          const total = teachers.reduce((s, t) => s + (t.total_salary ?? 0), 0);
                          return total > 0 ? (
                            <span className="font-semibold text-emerald-700 text-sm">{fmt(total)} <span className="text-gray-400 font-normal text-xs">uzs</span></span>
                          ) : null;
                        })()}
                      </td>
                    )}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {currentList.map((u) => (
              <div key={u.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 ${
                      u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.subject || u.email}</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggleActive(u)}>
                    <StatusBadge active={u.is_active} />
                  </button>
                </div>

                {tab === 'teachers' && (
                  <div className={`mt-3 grid gap-2 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-200">{u.group_count ?? 0}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">Groups</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-800 dark:text-slate-200">{u.student_count ?? 0}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">Students</p>
                    </div>
                    {isSuperAdmin && (
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-emerald-700">
                          {u.total_salary != null ? fmt(u.total_salary) : '—'}
                        </p>
                        <p className="text-xs text-gray-400">Salary</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={() => openEdit(u)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors" onClick={() => { setResetModal(u); setNewPassword(''); }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                    {isSuperAdmin && (
                      <button className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => setDeleteId(u.id)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? `Edit ${form.role === 'admin' ? 'Admin' : 'Teacher'}` : `Add ${form.role === 'admin' ? 'Admin' : 'Teacher'}`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={f('name')} required placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={f('email')} required placeholder="email@crm.uz" />
            </div>
            <div>
              <label className="label">{editUser ? 'New Password (leave blank)' : 'Password *'}</label>
              <input type="password" className="input" value={form.password} onChange={f('password')} required={!editUser} placeholder="Min. 6 characters" minLength={6} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={f('phone')} placeholder="+998901234567" />
            </div>
            {form.role === 'teacher' && (
              <>
                <div>
                  <label className="label">Subject</label>
                  <input className="input" value={form.subject} onChange={f('subject')} placeholder="English, Math…" />
                </div>
                {isSuperAdmin && (
                  <div>
                    <label className="label">Salary per student <span className="text-gray-400 font-normal">(UZS)</span></label>
                    <input
                      type="number"
                      className="input"
                      value={form.salary_per_student}
                      onChange={f('salary_per_student')}
                      placeholder="e.g. 20000"
                      min="0"
                      step="1000"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : (editUser ? 'Update' : 'Add')}</button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="Reset Password" size="sm">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">Reset password for <strong>{resetModal?.name}</strong></p>
          <div>
            <label className="label">New Password *</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="Min. 6 characters" autoFocus />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setResetModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Reset</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to permanently delete this user?"
        loading={deleting}
      />
    </div>
  );
};

export default Teachers;
