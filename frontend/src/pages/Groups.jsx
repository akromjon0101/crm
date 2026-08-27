import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/helpers';

// ── Schedule helpers ───────────────────────────────────────────────────────
const DAYS = [
  { id: 1, short: 'Mon' }, { id: 2, short: 'Tue' }, { id: 3, short: 'Wed' },
  { id: 4, short: 'Thu' }, { id: 5, short: 'Fri' }, { id: 6, short: 'Sat' },
];

function parseSchedule(schedule) {
  if (!schedule) return { days: [], startTime: '', endTime: '' };
  const [daysStr, timeStr] = schedule.split('|');
  const days = daysStr ? daysStr.split(',').map(Number).filter(Boolean) : [];
  const [startTime = '', endTime = ''] = timeStr ? timeStr.split('-') : [];
  return { days, startTime, endTime };
}

function buildSchedule(days, startTime, endTime) {
  if (!days.length) return '';
  const dStr = [...days].sort((a, b) => a - b).join(',');
  const tStr = startTime && endTime ? `|${startTime}-${endTime}` : startTime ? `|${startTime}` : '';
  return dStr + tStr;
}

function formatScheduleShort(schedule) {
  if (!schedule) return null;
  const { days, startTime, endTime } = parseSchedule(schedule);
  const dayNames = days.map(d => DAYS.find(x => x.id === d)?.short).filter(Boolean).join('/');
  const time = startTime ? ` ${startTime}${endTime ? '–' + endTime : ''}` : '';
  return dayNames + time;
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:    { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',  label: 'Active' },
  inactive:  { dot: 'bg-gray-400 dark:bg-slate-500', badge: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300', label: 'Inactive' },
  completed: { dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',             label: 'Completed' },
};

// ── SchedulePicker ─────────────────────────────────────────────────────────
const SchedulePicker = ({ days, startTime, endTime, onChange }) => {
  const toggleDay = (id) => {
    const next = days.includes(id) ? days.filter(d => d !== id) : [...days, id];
    onChange({ days: next, startTime, endTime });
  };
  const setOdd = () => onChange({ days: [1, 3, 5], startTime, endTime });
  const setEven = () => onChange({ days: [2, 4, 6], startTime, endTime });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 mb-1">
        <button type="button" onClick={setOdd} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-colors">Odd days (Mo/We/Fr)</button>
        <button type="button" onClick={setEven} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-colors">Even days (Tu/Th/Sa)</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAYS.map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggleDay(d.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              days.includes(d.id)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-indigo-300'
            }`}
          >
            {d.short}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          className="input flex-1"
          value={startTime}
          onChange={e => onChange({ days, startTime: e.target.value, endTime })}
        />
        <span className="text-gray-400 dark:text-slate-500 text-sm">to</span>
        <input
          type="time"
          className="input flex-1"
          value={endTime}
          onChange={e => onChange({ days, startTime, endTime: e.target.value })}
        />
      </div>
    </div>
  );
};

const EMPTY_FORM = {
  name: '', course_id: '', teacher_id: '', room: '',
  start_date: '', end_date: '', max_students: 20, status: 'active',
  _days: [], _start_time: '09:00', _end_time: '11:00',
  selected_students: []
};

// ── Main Component ─────────────────────────────────────────────────────────
const Groups = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [groups, setGroups]       = useState([]);
  const [teachers, setTeachers]   = useState([]);
  const [courses, setCourses]     = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searchStudent, setSearchStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  const [modalOpen, setModalOpen]   = useState(false);
  const [editGroup, setEditGroup]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState(null);
  const [deleting, setDeleting]     = useState(false);
  const [viewGroup, setViewGroup]   = useState(null);

  const isAdmin = user?.role !== 'teacher';

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch {
      toast.error("Guruhlar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    if (isAdmin) {
      api.get('/users/teachers').then(r => setTeachers(r.data)).catch(() => setTeachers([]));
      api.get('/courses').then(r => setCourses(r.data)).catch(() => setCourses([]));
      api.get('/students?limit=2000').then(r => setAllStudents(r.data.data || [])).catch(() => setAllStudents([]));
    }
  }, [fetchGroups, isAdmin]);

  useEffect(() => {
    // Auto-suggest group name
    const courseStr = courses.find(c => String(c.id) === String(form.course_id))?.name || 'Group';
    let dayType = '';
    const daysStr = [...form._days].sort().join(',');
    if (daysStr === '1,3,5') dayType = 'Odd';
    else if (daysStr === '2,4,6') dayType = 'Even';
    else if (daysStr.length > 0) dayType = 'Custom';
    const timeStr = form._start_time ? ` ${form._start_time}` : '';
    const suggestedName = `${courseStr} ${dayType}${timeStr}`.trim();
    if (form.name !== suggestedName && !editGroup) {
      setForm(p => ({ ...p, name: suggestedName }));
    }
  }, [form.course_id, form._days, form._start_time, courses, editGroup]);

  const openCreate = () => { setEditGroup(null); setForm(EMPTY_FORM); setSearchStudent(''); setModalOpen(true); };

  const openEdit = (g) => {
    const { days, startTime, endTime } = parseSchedule(g.schedule || '');
    setEditGroup(g);
    setForm({
      name: g.name, course_id: g.course_id || '', teacher_id: g.teacher_id || '',
      room: g.room || '', start_date: g.start_date ? g.start_date.split('T')[0] : '',
      end_date: g.end_date ? g.end_date.split('T')[0] : '',
      max_students: g.max_students || 20, status: g.status || 'active',
      _days: days, _start_time: startTime || '09:00', _end_time: endTime || '11:00',
      selected_students: [], // Reset for edit mode, or handle differently
    });
    setModalOpen(true);
  };

  const openView = async (id) => {
    try {
      const res = await api.get(`/groups/${id}`);
      setViewGroup(res.data);
    } catch {
      toast.error("Guruh ma'lumotlari yuklanmadi");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const schedule = buildSchedule(form._days, form._start_time, form._end_time);
    const payload = {
      name: form.name, course_id: form.course_id || null,
      teacher_id: form.teacher_id || null, schedule,
      room: form.room, start_date: form.start_date,
      end_date: form.end_date, max_students: form.max_students, status: form.status,
    };
    try {
      let savedGroup;
      if (editGroup) {
        const res = await api.put(`/groups/${editGroup.id}`, payload);
        savedGroup = res.data;
      } else {
        const res = await api.post('/groups', payload);
        savedGroup = res.data;
      }

      if (form.selected_students?.length > 0) {
        await api.post('/students/bulk-action', {
          action: 'transfer',
          student_ids: form.selected_students,
          group_id: savedGroup.id
        });
      }

      setModalOpen(false);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving group');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/groups/${deleteId}`);
      setDeleteId(null);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting group');
    } finally { setDeleting(false); }
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));
  const filtered = filterStatus === 'all' ? groups : groups.filter(g => g.status === filterStatus);

  return (
    <div className="space-y-4">

      {/* ── Teacher heading (shown only to teachers) ─────────────── */}
      {!isAdmin && (
        <div className="mb-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Mening Guruhlarim</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Sizga biriktirilgan guruhlar</p>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-700/60 rounded-xl p-1 gap-0.5">
          {[
            { id: 'active',    label: 'Active' },
            { id: 'inactive',  label: 'Inactive' },
            { id: 'completed', label: 'Done' },
            { id: 'all',       label: 'All' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterStatus(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === id ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {label}
              <span className="ml-1 text-[10px] text-gray-400 dark:text-slate-500">
                {id === 'all' ? groups.length : groups.filter(g => g.status === id).length}
              </span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <button className="btn-primary ml-auto" onClick={openCreate}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        )}
      </div>

      {/* ── Groups Table ─────────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner text="Loading groups…" />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-gray-500">No groups found.</p>
          {isAdmin && (
            <button className="btn-primary mt-3" onClick={openCreate}>Create Group</button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Schedule</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-24">Students</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map((g) => {
                const st = STATUS_CFG[g.status] || STATUS_CFG.active;
                const schedText = formatScheduleShort(g.schedule);

                return (
                  <tr key={g.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    {/* Group name + status badge inline */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{g.name}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                    </td>

                    {/* Teacher */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-gray-700 dark:text-slate-200">{g.teacher_name || <span className="text-gray-300 dark:text-slate-600">—</span>}</span>
                    </td>

                    {/* Schedule */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {schedText ? (
                        <span className="text-gray-600 dark:text-slate-300 text-xs font-medium">{schedText}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Students count */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{g.student_count}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">/{g.max_students}</span>
                    </td>

                    {/* Actions — icon buttons with tooltips */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openView(g.id)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
                          title="View students"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <Link
                          to="/attendance"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Mark attendance"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </Link>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(g)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit group"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteId(g.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete group"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── View students modal ──────────────────────────────────── */}
      <Modal open={!!viewGroup} onClose={() => setViewGroup(null)} title={viewGroup?.name} size="lg">
        {viewGroup && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Teacher',    value: viewGroup.teacher_name },
                { label: 'Course',     value: viewGroup.course_name },
                { label: 'Room',       value: viewGroup.room },
                { label: 'Start Date', value: formatDate(viewGroup.start_date) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{value || '—'}</p>
                </div>
              ))}
            </div>

            <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center justify-between">
              Students
              <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">{viewGroup.students?.length || 0} total</span>
            </h4>
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {viewGroup.students?.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/30 px-2 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/students/${s.id}`} className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block">
                      {s.name}
                    </Link>
                    {s.phone && <p className="text-xs text-gray-400 dark:text-slate-500">{s.phone}</p>}
                  </div>
                  {s.is_debtor ? <span className="badge-red flex-shrink-0">Debtor</span> : null}
                </div>
              ))}
              {(!viewGroup.students || viewGroup.students.length === 0) && (
                <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No students in this group</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create / Edit modal ──────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editGroup ? 'Edit Group' : 'New Group'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Group Name *</label>
              <input className="input bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 font-semibold cursor-not-allowed" value={form.name} readOnly placeholder="Auto-generated base on selection" />
            </div>
            <div>
              <label className="label">Course</label>
              <select className="input" value={form.course_id} onChange={f('course_id')}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Teacher</label>
              <select className="input" value={form.teacher_id} onChange={f('teacher_id')}>
                <option value="">Assign teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Lesson Schedule</label>
            <SchedulePicker
              days={form._days}
              startTime={form._start_time}
              endTime={form._end_time}
              onChange={({ days, startTime, endTime }) =>
                setForm(p => ({ ...p, _days: days, _start_time: startTime, _end_time: endTime }))
              }
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Room</label>
              <input className="input" value={form.room} onChange={f('room')} placeholder="Room 101" />
            </div>
            <div>
              <label className="label">Max Students</label>
              <input type="number" className="input" value={form.max_students} onChange={f('max_students')} min={1} />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date} onChange={f('start_date')} />
            </div>
          </div>

          {editGroup && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={f('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          {!editGroup && (
            <div className="sm:col-span-2 mt-2 pt-4 border-t border-gray-100 dark:border-slate-700/50">
              <label className="label">Add Students to Group (Optional)</label>
              <input
                className="input mb-3 bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600"
                placeholder="Search students by name or phone..." 
                value={searchStudent} 
                onChange={e => setSearchStudent(e.target.value)} 
              />
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-xl divide-y divide-gray-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
                {allStudents
                  .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.phone?.includes(searchStudent))
                  .map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-2.5 hover:bg-indigo-50/50 cursor-pointer transition-colors block">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      checked={form.selected_students.includes(s.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm(p => ({
                          ...p,
                          selected_students: checked 
                            ? [...p.selected_students, s.id] 
                            : p.selected_students.filter(id => id !== s.id)
                        }));
                      }}
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-slate-100">{s.name}</p>
                      <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400">{s.phone || 'No phone'} • {s.group_name || 'No group'}</p>
                    </div>
                  </label>
                ))}
                {allStudents.filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.phone?.includes(searchStudent)).length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 p-4 text-center">No matching students found.</p>
                )}
              </div>
              <p className="text-xs text-indigo-600 font-medium mt-2">
                {form.selected_students.length} student(s) selected
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700/50">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editGroup ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Group"
        message="Groups with active students cannot be deleted. Are you sure?"
        loading={deleting}
      />
    </div>
  );
};

export default Groups;
