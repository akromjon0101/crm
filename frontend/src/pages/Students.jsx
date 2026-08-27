import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { downloadCSV } from '../utils/export';
import { formatDate } from '../utils/helpers';
import useDebounce from '../hooks/useDebounce';

// ─── Constants ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', phone: '', parent_phone: '', email: '', birth_date: '',
  address: '', group_id: '', start_date: '', notes: '',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDaysRemaining = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status, freezeUntil }) => {
  if (status === 'frozen') {
    const days = getDaysRemaining(freezeUntil);
    return (
      <span className="badge badge-blue gap-1">
        <span>❄</span>
        <span>Frozen</span>
        {days !== null && days > 0 && (
          <span className="text-[10px] opacity-75">({days}d)</span>
        )}
      </span>
    );
  }
  if (status === 'archived') {
    return <span className="badge badge-gray">Archived</span>;
  }
  return <span className="badge badge-green">Active</span>;
};

// ─── Stats Strip ─────────────────────────────────────────────────────────────

const StatsStrip = ({ students, activeFilter, onFilterChange }) => {
  const stats = useMemo(() => {
    return {
      active:   students.filter(s => (s.status || 'active') === 'active').length,
      frozen:   students.filter(s => s.status === 'frozen').length,
      archived: students.filter(s => s.status === 'archived').length,
      debtors:  students.filter(s => s.is_debtor).length,
    };
  }, [students]);

  const items = [
    { key: 'active',   label: 'Active',   value: stats.active,   color: 'text-green-700 bg-green-50 border-green-200',   dot: 'bg-green-500'  },
    { key: 'frozen',   label: 'Frozen',   value: stats.frozen,   color: 'text-blue-700 bg-blue-50 border-blue-200',       dot: 'bg-blue-500'   },
    { key: 'archived', label: 'Archived', value: stats.archived, color: 'text-gray-700 bg-gray-100 border-gray-200',      dot: 'bg-gray-400'   },
    { key: 'debtor',   label: 'Debtors',  value: stats.debtors,  color: 'text-amber-700 bg-amber-50 border-amber-200',    dot: 'bg-amber-500'  },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onFilterChange(item.key === activeFilter ? '' : item.key)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${item.color} ${item.key === activeFilter ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
          {item.label}: <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    <td className="px-4 py-3"><div className="skeleton w-4 h-4 rounded" /></td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-8 h-8 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-28 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      </div>
    </td>
    <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-3.5 w-24 rounded" /></td>
    <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
    <td className="px-4 py-3 hidden xl:table-cell"><div className="skeleton h-5 w-12 rounded-full" /></td>
    <td className="px-4 py-3 hidden xl:table-cell"><div className="skeleton h-3.5 w-20 rounded" /></td>
    <td className="px-4 py-3"><div className="skeleton h-6 w-20 rounded-lg ml-auto" /></td>
  </tr>
);

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

const BulkActionBar = ({ count, onTransfer, onFreeze, onArchive, onUnfreeze, onCancel }) => (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-slideIn w-[calc(100%-2rem)] sm:w-auto max-w-full">
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 flex-wrap justify-center sm:justify-start">
      <span className="text-sm font-semibold bg-primary-600 px-2.5 py-1 rounded-lg mr-1">
        {count} selected
      </span>
      <button
        onClick={onTransfer}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        title="Transfer to group"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Transfer
      </button>
      <button
        onClick={onFreeze}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
        title="Freeze selected"
      >
        <span className="text-sm leading-none">❄</span>
        Freeze
      </button>
      <button
        onClick={onUnfreeze}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors"
        title="Unfreeze selected"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Unfreeze
      </button>
      <button
        onClick={onArchive}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-colors"
        title="Archive selected"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        Archive
      </button>
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors ml-1"
      >
        Cancel
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Students = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groupSearch, setGroupSearch] = useState('');

  // ── Core data ──
  const [students,     setStudents]     = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [totalCount,   setTotalCount]   = useState(0);

  // ── Filters ──
  const [searchInput,  setSearchInput]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGroup,  setFilterGroup]  = useState('');
  const [filterDebtor, setFilterDebtor] = useState(false);
  const debouncedSearch = useDebounce(searchInput, 350);

  // ── Pagination ──
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(25);

  // ── Add / Edit modal ──
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editStudent,  setEditStudent]  = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);

  // ── Delete ──
  const [deleteId,     setDeleteId]     = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Transfer ──
  const [transferModal,     setTransferModal]     = useState(null);
  const [transferGroupId,   setTransferGroupId]   = useState('');
  const [transferNotes,     setTransferNotes]     = useState('');
  const [transferring,      setTransferring]      = useState(false);

  // ── Freeze ──
  const [freezeModal,   setFreezeModal]   = useState(null);
  const [freezeUntil,   setFreezeUntil]   = useState('');
  const [freezeReason,  setFreezeReason]  = useState('');
  const [freezing,      setFreezing]      = useState(false);

  // ── Archive / Restore ──
  const [archiveId,    setArchiveId]    = useState(null);
  const [restoreId,    setRestoreId]    = useState(null);
  const [actioning,    setActioning]    = useState(false);
  const [debtorToggleId, setDebtorToggleId] = useState(null);
  const [debtorToggling, setDebtorToggling] = useState(false);

  // ── Bulk selection ──
  const [selectedIds,  setSelectedIds]  = useState(new Set());

  // ── Bulk modals ──
  const [bulkTransferOpen,  setBulkTransferOpen]  = useState(false);
  const [bulkFreezeOpen,    setBulkFreezeOpen]    = useState(false);
  const [bulkArchiveOpen,   setBulkArchiveOpen]   = useState(false);
  const [bulkGroupId,       setBulkGroupId]       = useState('');
  const [bulkFreezeUntil,   setBulkFreezeUntil]   = useState('');
  const [bulkActioning,     setBulkActioning]     = useState(false);

  // ── SMS modal ──
  const [smsOpen,          setSmsOpen]          = useState(false);
  const [smsTab,           setSmsTab]           = useState('compose'); // 'compose' | 'logs'
  const [smsType,          setSmsType]          = useState('all');
  const [smsGroupId,       setSmsGroupId]       = useState('');
  const [smsMessage,       setSmsMessage]       = useState('');
  const [smsPreview,       setSmsPreview]       = useState(null);
  const [smsSending,       setSmsSending]       = useState(false);
  const [smsResult,        setSmsResult]        = useState(null);
  const [smsLogs,          setSmsLogs]          = useState([]);
  const [smsLogsLoading,   setSmsLogsLoading]   = useState(false);

  const isAdmin = user?.role !== 'teacher';
  const toast = useToast();

  // ─── Fetch students ────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterGroup)     params.group_id = filterGroup;
      if (filterDebtor)    params.is_debtor = 'true';

      if (filterStatus === 'debtor') {
        params.is_debtor = 'true';
      } else if (filterStatus) {
        params.status = filterStatus;
      }

      const res = await api.get('/students', { params });
      const data = res.data.data || res.data || [];
      setStudents(Array.isArray(data) ? data : []);
      setTotalCount(res.data.total || (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterGroup, filterStatus, filterDebtor, page, pageSize, toast]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filterGroup, filterStatus, filterDebtor, pageSize]);
  useEffect(() => {
    api.get('/groups').then(r => setGroups(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { setSelectedIds(new Set()); }, [page, pageSize]);

  // ─── Pagination helpers ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ─── Open modals ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditStudent(null);
    setForm(EMPTY_FORM);
    setGroupSearch('');
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditStudent(s);
    setForm({
      name:         s.name         || '',
      phone:        s.phone        || '',
      parent_phone: s.parent_phone || '',
      email:        s.email        || '',
      birth_date:   s.birth_date   ? s.birth_date.split('T')[0]   : '',
      address:      s.address      || '',
      group_id:     s.group_id     || '',
      start_date:   s.start_date   ? s.start_date.split('T')[0]   : '',
      notes:        s.notes        || '',
    });
    setModalOpen(true);
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editStudent) {
        await api.put(`/students/${editStudent.id}`, {
          ...form,
          is_active: true,
          is_debtor: editStudent.is_debtor,
        });
        toast.success('Student updated successfully');
      } else {
        await api.post('/students', form);
        toast.success('Student added successfully');
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteId}`);
      setDeleteId(null);
      toast.success('Student deleted');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting student');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleDebtor = async () => {
    if (!debtorToggleId) return;
    setDebtorToggling(true);
    try {
      await api.put(`/students/${debtorToggleId}/toggle-debtor`);
      setDebtorToggleId(null);
      fetchStudents();
    } catch {
      toast.error('Error updating debtor status');
    } finally {
      setDebtorToggling(false);
    }
  };

  // ─── Transfer ─────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferGroupId) return;
    setTransferring(true);
    try {
      await api.put(`/students/${transferModal.id}/transfer`, {
        group_id: transferGroupId,
        notes:    transferNotes,
      });
      setTransferModal(null);
      setTransferGroupId('');
      setTransferNotes('');
      toast.success(`${transferModal.name} transferred successfully`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error transferring student');
    } finally {
      setTransferring(false);
    }
  };

  // ─── Freeze / Unfreeze ────────────────────────────────────────────────────
  const handleFreeze = async () => {
    if (!freezeModal) return;
    setFreezing(true);
    try {
      await api.put(`/students/${freezeModal.id}/freeze`, {
        freeze_until: freezeUntil || undefined,
        notes:        freezeReason || undefined,
      });
      setFreezeModal(null);
      setFreezeUntil('');
      setFreezeReason('');
      toast.success(`${freezeModal.name} has been frozen`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error freezing student');
    } finally {
      setFreezing(false);
    }
  };

  const handleUnfreeze = async (s) => {
    setActioning(true);
    try {
      await api.put(`/students/${s.id}/unfreeze`);
      toast.success(`${s.name} has been unfrozen`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error unfreezing student');
    } finally {
      setActioning(false);
    }
  };

  // ─── Archive / Restore ────────────────────────────────────────────────────
  const handleArchive = async () => {
    setActioning(true);
    try {
      await api.put(`/students/${archiveId}/archive`);
      setArchiveId(null);
      toast.success('Student archived');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error archiving student');
    } finally {
      setActioning(false);
    }
  };

  const handleRestore = async () => {
    setActioning(true);
    try {
      await api.put(`/students/${restoreId}/restore`);
      setRestoreId(null);
      toast.success('Student restored');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error restoring student');
    } finally {
      setActioning(false);
    }
  };

  // ─── Bulk selection ───────────────────────────────────────────────────────
  const allVisibleIds = students.map(s => s.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const someSelected  = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ─── Bulk actions ─────────────────────────────────────────────────────────
  const handleBulkTransfer = async () => {
    if (!bulkGroupId) return;
    setBulkActioning(true);
    try {
      await api.post('/students/bulk-action', {
        action:      'transfer',
        student_ids: Array.from(selectedIds),
        group_id:    bulkGroupId,
      });
      setBulkTransferOpen(false);
      setBulkGroupId('');
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} students transferred`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk transfer failed');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkFreeze = async () => {
    setBulkActioning(true);
    try {
      await api.post('/students/bulk-action', {
        action:       'freeze',
        student_ids:  Array.from(selectedIds),
        freeze_until: bulkFreezeUntil || undefined,
      });
      setBulkFreezeOpen(false);
      setBulkFreezeUntil('');
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} students frozen`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk freeze failed');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkArchive = async () => {
    setBulkActioning(true);
    try {
      await api.post('/students/bulk-action', {
        action:      'archive',
        student_ids: Array.from(selectedIds),
      });
      setBulkArchiveOpen(false);
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} students archived`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk archive failed');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkUnfreeze = async () => {
    setBulkActioning(true);
    try {
      await api.post('/students/bulk-action', {
        action:      'unfreeze',
        student_ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} students unfrozen`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk unfreeze failed');
    } finally {
      setBulkActioning(false);
    }
  };

  // ─── Filter helpers ───────────────────────────────────────────────────────
  const hasActiveFilters = searchInput || filterGroup || filterStatus || filterDebtor;

  const clearAllFilters = () => {
    setSearchInput('');
    setFilterGroup('');
    setFilterStatus('');
    setFilterDebtor(false);
    setPage(1);
  };

  // ─── Freeze countdown display ─────────────────────────────────────────────
  const freezeDaysDisplay = useMemo(() => {
    if (!freezeUntil) return null;
    const days = getDaysRemaining(freezeUntil);
    if (days === null) return null;
    if (days <= 0) return 'Date is in the past';
    return `Will be frozen for ${days} day${days !== 1 ? 's' : ''}`;
  }, [freezeUntil]);

  // ─── SMS handlers ─────────────────────────────────────────────────────────
  const openSms = () => {
    setSmsOpen(true);
    setSmsTab('compose');
    setSmsResult(null);
    setSmsPreview(null);
    setSmsMessage('');
    setSmsType('all');
    setSmsGroupId('');
  };

  const loadSmsLogs = useCallback(async () => {
    setSmsLogsLoading(true);
    try {
      const r = await api.get('/sms/logs');
      setSmsLogs(r.data || []);
    } catch { setSmsLogs([]); }
    finally { setSmsLogsLoading(false); }
  }, []);

  const fetchSmsPreview = useCallback(async (type, gid) => {
    try {
      const params = { recipient_type: type };
      if (type === 'group' && gid) params.group_id = gid;
      if (type === 'selected') params.student_ids = Array.from(selectedIds).join(',');
      const r = await api.get('/sms/preview', { params });
      setSmsPreview(r.data);
    } catch { setSmsPreview(null); }
  }, [selectedIds]);

  useEffect(() => {
    if (smsOpen && smsTab === 'compose') fetchSmsPreview(smsType, smsGroupId);
  }, [smsOpen, smsTab, smsType, smsGroupId, fetchSmsPreview]);

  useEffect(() => {
    if (smsOpen && smsTab === 'logs') loadSmsLogs();
  }, [smsOpen, smsTab, loadSmsLogs]);

  const handleSmsSend = async () => {
    if (!smsMessage.trim()) return;
    setSmsSending(true);
    setSmsResult(null);
    try {
      const body = { message: smsMessage.trim(), recipient_type: smsType };
      if (smsType === 'group') body.group_id = smsGroupId;
      if (smsType === 'selected') body.student_ids = Array.from(selectedIds);
      const r = await api.post('/sms/send', body);
      setSmsResult(r.data);
      setSmsMessage('');
    } catch (err) {
      setSmsResult({ error: err.response?.data?.message || "Xabar yuborib bo'lmadi" });
    } finally {
      setSmsSending(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading\u2026' : `${totalCount} student${totalCount !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={openSms}
              title="SMS yuborish"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              SMS
            </button>
          )}
          <button
            className="btn-secondary whitespace-nowrap"
            title="Export to CSV"
            onClick={() => downloadCSV(
              students.map(s => ({
                Name:    s.name,
                Phone:   s.phone        || '',
                Parent:  s.parent_phone || '',
                Group:   s.group_name   || '',
                Status:  s.status       || 'active',
                Debtor:  s.is_debtor    ? 'Yes' : 'No',
                Joined:  s.created_at?.split('T')[0] || '',
              })),
              `students_${new Date().toISOString().split('T')[0]}.csv`
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          {isAdmin && (
            <button className="btn-primary whitespace-nowrap" onClick={openCreate}>
              + Add Student
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {!loading && students.length > 0 && (
        <StatsStrip
          students={students}
          activeFilter={filterStatus}
          onFilterChange={(key) => {
            if (key === 'debtor') {
              setFilterStatus('debtor');
              setFilterDebtor(false);
            } else {
              setFilterStatus(key);
            }
          }}
        />
      )}

      {/* Filters bar */}
      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input pl-9"
              placeholder="Search name, phone\u2026"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
            {[
              { value: '',         label: 'All'      },
              { value: 'active',   label: 'Active'   },
              { value: 'frozen',   label: 'Frozen'   },
              { value: 'archived', label: 'Archived' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilterStatus(opt.value); setFilterDebtor(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-100 whitespace-nowrap ${
                  filterStatus === opt.value && !filterDebtor
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Group filter */}
          <select
            className="input w-full sm:w-44"
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
          >
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {/* Debtor checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 whitespace-nowrap select-none">
            <input
              type="checkbox"
              checked={filterDebtor}
              onChange={e => {
                setFilterDebtor(e.target.checked);
                if (e.target.checked) setFilterStatus('');
              }}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Debtors only
          </label>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}

          {/* Per-page selector */}
          <div className="sm:ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">Per page:</span>
            <select
              className="input w-16 text-xs"
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Group</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">Payment</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">Last Payment</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-1">No students match your filters</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Try adjusting your search or filter criteria.</p>
                <button className="btn-secondary btn-sm" onClick={clearAllFilters}>Clear all filters</button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-1">No students yet</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Get started by adding your first student.</p>
                {isAdmin && <button className="btn-primary" onClick={openCreate}>Add your first student</button>}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  {isAdmin && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        title="Select all"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden md:table-cell">Group</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">Payment</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400 hidden xl:table-cell">Last Payment</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {students.map(s => {
                  const isSelected = selectedIds.has(s.id);
                  const status = s.status || 'active';
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors ${isSelected ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}
                    >
                      {isAdmin && (
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(s.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Name + phone */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                to={`/students/${s.id}`}
                                className="font-medium text-gray-900 hover:text-primary-600 transition-colors truncate max-w-[140px]"
                                title={s.name}
                              >
                                {s.name}
                              </Link>
                              {s.is_debtor && (
                                <span className="badge-red text-[10px]">Debtor</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{s.phone || s.parent_phone || '\u2014'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {s.group_name ? (
                          <span className="badge badge-blue">{s.group_name}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">\u2014</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={status} freezeUntil={s.freeze_until} />
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {s.is_debtor !== undefined ? (
                          s.is_debtor
                            ? <span className="badge badge-red">Unpaid</span>
                            : <span className="badge badge-green">Paid</span>
                        ) : (
                          <span className="text-gray-400 text-xs">\u2014</span>
                        )}
                      </td>

                      {/* Last payment date */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-gray-500 text-xs">
                          {formatDate(s.last_payment_date)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* View profile */}
                          <Link
                            to={`/students/${s.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View profile"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>

                          {isAdmin && (
                            <>
                              {/* Edit */}
                              <button
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit student"
                                onClick={() => openEdit(s)}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>

                              {/* Transfer */}
                              <button
                                className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                title="Transfer to group"
                                onClick={() => {
                                  setTransferModal(s);
                                  setTransferGroupId(s.group_id || '');
                                  setTransferNotes('');
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              </button>

                              {/* Freeze / Unfreeze toggle */}
                              {status === 'frozen' ? (
                                <button
                                  className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                                  title="Unfreeze student"
                                  onClick={() => handleUnfreeze(s)}
                                  disabled={actioning}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              ) : (
                                status !== 'archived' && (
                                  <button
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Freeze student"
                                    onClick={() => {
                                      setFreezeModal(s);
                                      setFreezeUntil('');
                                      setFreezeReason('');
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                )
                              )}

                              {/* Debtor toggle */}
                              <button
                                className={`p-1.5 rounded-lg transition-colors ${s.is_debtor ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                                title={s.is_debtor ? 'Remove debtor mark' : 'Mark as debtor'}
                                onClick={() => setDebtorToggleId(s.id)}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </button>

                              {/* Archive / Restore */}
                              {status === 'archived' ? (
                                <button
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                  title="Restore student"
                                  onClick={() => setRestoreId(s.id)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                  title="Archive student"
                                  onClick={() => setArchiveId(s.id)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </button>
                              )}

                              {/* Hard delete */}
                              <button
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Permanently delete"
                                onClick={() => setDeleteId(s.id)}
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

        {/* Pagination footer */}
        {!loading && students.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700/50 flex-wrap gap-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Showing <strong>{(page - 1) * pageSize + 1}</strong>\u2013<strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> students
            </p>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary btn-sm px-2 py-1"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="First page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="btn-secondary btn-sm px-2 py-1"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Previous page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-3 py-1 text-xs text-gray-600 font-medium">
                {page} / {totalPages}
              </span>
              <button
                className="btn-secondary btn-sm px-2 py-1"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Next page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                className="btn-secondary btn-sm px-2 py-1"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Last page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action floating bar */}
      {someSelected && isAdmin && (
        <BulkActionBar
          count={selectedIds.size}
          onTransfer={() => { setBulkGroupId(''); setBulkTransferOpen(true); }}
          onFreeze={() => { setBulkFreezeUntil(''); setBulkFreezeOpen(true); }}
          onArchive={() => setBulkArchiveOpen(true)}
          onUnfreeze={handleBulkUnfreeze}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}

      {/* Add / Edit Student Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editStudent ? 'Edit Student' : 'Add Student'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">

          {/* ── Step 1: Group selection (new students only) ── */}
          {!editStudent && (
            <div>
              <label className="label text-[13px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Assign to Group
                {!form.group_id && <span className="text-[10px] text-gray-400 font-normal">(optional)</span>}
              </label>

              {/* Quick search */}
              <input
                className="input mb-2 bg-gray-50 dark:bg-slate-800/50 text-sm"
                placeholder="Search group by name..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
              />

              {/* Group cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
                {/* No group option */}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, group_id: '' }))}
                  className={`text-left rounded-xl border-2 px-3 py-2.5 transition-all duration-100 ${
                    !form.group_id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/40'
                  }`}
                >
                  <p className="text-[13px] font-semibold">— No group</p>
                  <p className="text-[10px] opacity-60">Assign later</p>
                </button>

                {groups
                  .filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                  .map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, group_id: String(g.id) }))}
                      className={`text-left rounded-xl border-2 px-3 py-2.5 transition-all duration-100 ${
                        String(form.group_id) === String(g.id)
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                          : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold truncate max-w-[140px]">{g.name}</p>
                        {String(form.group_id) === String(g.id) && (
                          <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{g.schedule || 'No schedule'}</p>
                    </button>
                  ))
                }
              </div>
            </div>
          )}

          {/* ── Step 2: Student info ── */}
          <div className="border-t border-gray-100 dark:border-slate-700/50 pt-4">
            <p className="text-[13px] font-bold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Student Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Student name"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+998901234567"
                />
              </div>
              <div>
                <label className="label">Parent Phone</label>
                <input
                  className="input"
                  value={form.parent_phone}
                  onChange={e => setForm({ ...form, parent_phone: e.target.value })}
                  placeholder="+998901234567"
                />
              </div>
              <div>
                <label className="label">Birth Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.birth_date}
                  onChange={e => setForm({ ...form, birth_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              {editStudent && (
                <div>
                  <label className="label">Group</label>
                  <select
                    className="input"
                    value={form.group_id}
                    onChange={e => setForm({ ...form, group_id: e.target.value })}
                  >
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Home address"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Notes</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any notes…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (editStudent ? 'Update Student' : 'Add Student')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal (single) */}
      <Modal
        open={!!transferModal}
        onClose={() => setTransferModal(null)}
        title={`Transfer ${transferModal?.name || 'Student'}`}
        size="sm"
      >
        {transferModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {transferModal.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{transferModal.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Current group: <strong>{transferModal.group_name || 'None'}</strong>
                </p>
              </div>
            </div>
            <div>
              <label className="label">Transfer to group *</label>
              <select
                className="input"
                value={transferGroupId}
                onChange={e => setTransferGroupId(e.target.value)}
              >
                <option value="">Select group\u2026</option>
                {groups
                  .filter(g => String(g.id) !== String(transferModal.group_id))
                  .map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                }
              </select>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                placeholder="Reason for transfer\u2026"
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button className="btn-secondary" onClick={() => setTransferModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleTransfer}
                disabled={transferring || !transferGroupId}
              >
                {transferring ? 'Transferring\u2026' : 'Transfer'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Freeze Modal (single) */}
      <Modal
        open={!!freezeModal}
        onClose={() => setFreezeModal(null)}
        title={`Freeze ${freezeModal?.name || 'Student'}`}
        size="sm"
      >
        {freezeModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <span className="text-xl">\u2744</span>
              <p className="text-sm text-blue-800">
                <strong>{freezeModal.name}</strong> will be frozen and won't appear in active attendance lists.
              </p>
            </div>
            <div>
              <label className="label">Freeze until (optional \u2014 leave empty for indefinite)</label>
              <input
                type="date"
                className="input"
                value={freezeUntil}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setFreezeUntil(e.target.value)}
              />
              {freezeDaysDisplay && (
                <p className="text-xs mt-1.5 text-blue-600 font-medium">{freezeDaysDisplay}</p>
              )}
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input
                className="input"
                placeholder="e.g. Medical leave, travelling\u2026"
                value={freezeReason}
                onChange={e => setFreezeReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button className="btn-secondary" onClick={() => setFreezeModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleFreeze}
                disabled={freezing}
              >
                {freezing ? 'Freezing\u2026' : '\u2744 Freeze'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Transfer Modal */}
      <Modal
        open={bulkTransferOpen}
        onClose={() => setBulkTransferOpen(false)}
        title={`Transfer ${selectedIds.size} Students`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Move <strong>{selectedIds.size}</strong> selected students to a new group.
          </p>
          <div>
            <label className="label">Target group *</label>
            <select
              className="input"
              value={bulkGroupId}
              onChange={e => setBulkGroupId(e.target.value)}
            >
              <option value="">Select group\u2026</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button className="btn-secondary" onClick={() => setBulkTransferOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleBulkTransfer}
              disabled={bulkActioning || !bulkGroupId}
            >
              {bulkActioning ? 'Transferring\u2026' : 'Transfer All'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Freeze Modal */}
      <Modal
        open={bulkFreezeOpen}
        onClose={() => setBulkFreezeOpen(false)}
        title={`Freeze ${selectedIds.size} Students`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <span className="text-xl">\u2744</span>
            <p className="text-sm text-blue-800">
              <strong>{selectedIds.size}</strong> students will be frozen.
            </p>
          </div>
          <div>
            <label className="label">Freeze until (optional)</label>
            <input
              type="date"
              className="input"
              value={bulkFreezeUntil}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setBulkFreezeUntil(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button className="btn-secondary" onClick={() => setBulkFreezeOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleBulkFreeze}
              disabled={bulkActioning}
            >
              {bulkActioning ? 'Freezing\u2026' : '\u2744 Freeze All'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Archive Confirm (single) */}
      <ConfirmDialog
        open={!!archiveId}
        onClose={() => setArchiveId(null)}
        onConfirm={handleArchive}
        title="Archive Student"
        message="Archive this student? All history, payments, and attendance are preserved. You can restore them later."
        confirmText="Archive"
        loading={actioning}
      />

      {/* Restore Confirm */}
      <ConfirmDialog
        open={!!restoreId}
        onClose={() => setRestoreId(null)}
        onConfirm={handleRestore}
        title="Restore Student"
        message="Restore this student to active status?"
        confirmText="Restore"
        loading={actioning}
      />

      {/* Bulk Archive Confirm */}
      <ConfirmDialog
        open={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        onConfirm={handleBulkArchive}
        title={`Archive ${selectedIds.size} Students`}
        message={`Archive ${selectedIds.size} selected students? All their data will be preserved and you can restore them later.`}
        confirmText="Archive All"
        loading={bulkActioning}
      />

      {/* Debtor Toggle Confirm */}
      <ConfirmDialog
        open={!!debtorToggleId}
        onClose={() => setDebtorToggleId(null)}
        onConfirm={handleToggleDebtor}
        title="Update Debtor Status"
        message={
          students.find(s => s.id === debtorToggleId)?.is_debtor
            ? `Remove the debtor mark from ${students.find(s => s.id === debtorToggleId)?.name || 'this student'}?`
            : `Mark ${students.find(s => s.id === debtorToggleId)?.name || 'this student'} as a debtor? This affects billing calculations.`
        }
        confirmText={students.find(s => s.id === debtorToggleId)?.is_debtor ? 'Remove Mark' : 'Mark as Debtor'}
        loading={debtorToggling}
      />

      {/* Hard Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Student"
        message="Permanently delete this student? This cannot be undone and all data will be lost."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* ── SMS Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={smsOpen}
        onClose={() => { setSmsOpen(false); setSmsResult(null); }}
        title="SMS Xabar Yuborish"
        size="lg"
      >
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-5 -mt-1">
          {[
            { key: 'compose', label: 'Xabar yozish' },
            { key: 'logs',    label: 'Yuborish tarixi' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setSmsTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                smsTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Compose tab ── */}
        {smsTab === 'compose' && (
          <div className="space-y-4">

            {/* Recipient type */}
            <div>
              <label className="label mb-2">Kimga yuborish</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'all',      label: 'Barcha aktiv',  icon: '👥' },
                  { key: 'debtors',  label: 'Qarzdorlar',    icon: '⚠️' },
                  { key: 'group',    label: 'Guruh',         icon: '📚' },
                  { key: 'selected', label: `Tanlangan (${selectedIds.size})`, icon: '✓' },
                ].map(opt => (
                  <button key={opt.key} type="button"
                    disabled={opt.key === 'selected' && selectedIds.size === 0}
                    onClick={() => setSmsType(opt.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium transition-all cursor-pointer
                      disabled:opacity-40 disabled:cursor-not-allowed ${
                      smsType === opt.key
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group picker */}
            {smsType === 'group' && (
              <div>
                <label className="label mb-1">Guruhni tanlang</label>
                <select
                  value={smsGroupId}
                  onChange={e => setSmsGroupId(e.target.value)}
                  className="input"
                >
                  <option value="">— Guruh tanlang —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview count */}
            {smsPreview !== null && (
              <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
                smsPreview.count > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>{smsPreview.count}</strong> ta o'quvchiga yuboriladi
                  {smsPreview.preview?.length > 0 && (
                    <span className="text-xs ml-1 opacity-70">
                      ({smsPreview.preview.map(p => p.name).join(', ')}{smsPreview.count > 5 ? '…' : ''})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Message textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label">Xabar matni</label>
                <span className={`text-[11px] font-medium ${
                  smsMessage.length > 320 ? 'text-red-500' : smsMessage.length > 160 ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {smsMessage.length} belgi · {Math.ceil(smsMessage.length / 160) || 1} SMS
                </span>
              </div>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder="Xabar matnini kiriting..."
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                maxLength={640}
              />
              <p className="text-[11px] text-gray-400 mt-1">160 belgi = 1 SMS · har bir qo'shimcha 160 belgi = +1 SMS narxi</p>
            </div>

            {/* Result block */}
            {smsResult && !smsResult.error && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">Yuborildi!</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">✓ Muvaffaqiyatli: <strong>{smsResult.sent}</strong></span>
                  {smsResult.failed > 0 && (
                    <span className="text-red-600">✗ Xatolik: <strong>{smsResult.failed}</strong></span>
                  )}
                </div>
              </div>
            )}
            {smsResult?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                {smsResult.error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button className="btn-secondary" onClick={() => setSmsOpen(false)}>Bekor qilish</button>
              <button
                className="btn-primary"
                disabled={smsSending || !smsMessage.trim() || (smsType === 'group' && !smsGroupId) || (smsPreview?.count === 0)}
                onClick={handleSmsSend}
              >
                {smsSending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Yuborilmoqda…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    SMS Yuborish
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Logs tab ── */}
        {smsTab === 'logs' && (
          <div>
            {smsLogsLoading ? (
              <div className="flex items-center justify-center py-10">
                <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : smsLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm text-gray-400 dark:text-slate-500">Hali hech qanday SMS yuborilmagan</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {smsLogs.map(log => (
                  <div key={log.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug flex-1">{log.message}</p>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          ✓ {log.total_sent}
                        </span>
                        {log.total_failed > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                            ✗ {log.total_failed}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-slate-500">
                      <span className="capitalize">{
                        log.recipient_type === 'all' ? '👥 Barchasi' :
                        log.recipient_type === 'debtors' ? '⚠️ Qarzdorlar' :
                        log.recipient_type === 'group' ? `📚 ${log.group_name || 'Guruh'}` :
                        '✓ Tanlangan'
                      }</span>
                      <span>·</span>
                      <span>{log.sent_by_name || 'Admin'}</span>
                      <span>·</span>
                      <span>{new Date(log.created_at).toLocaleString('uz-UZ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Students;
