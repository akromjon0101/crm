import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { printElement } from '../utils/export';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';

const Icon = ({ path, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  print: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  location: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
};

const Dot = () => <span className="text-gray-200 dark:text-slate-700 mx-2 select-none text-xs font-light">|</span>;

const Kbd = ({ children }) => (
  <kbd className="font-mono bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-[10px] font-semibold text-gray-700 dark:text-slate-300 shadow-sm">
    {children}
  </kbd>
);

const MarkAllBtn = ({ onClick, label }) => {
  return (
    <button
      onClick={onClick}
      title={label}
      className="mt-1.5 block mx-auto px-1.5 py-0.5 text-[9px] font-bold border border-gray-200 dark:border-slate-600 rounded text-gray-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700 transition-all font-sans"
    >
      ✓✓
    </button>
  );
};

const AttCell = ({ status, onSet, onDragStart, onDragEnter, isDragging, onFocus, disabled }) => {
  const isPresent = status === 'present';
  const isAbsent  = status === 'absent';

  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const didDrag    = useRef(false);

  const handleClick = () => {
    if (disabled || didDrag.current) return;
    
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);

    clickTimer.current = setTimeout(() => {
      const n = clickCount.current;
      clickCount.current = 0;
      if (n === 1) onSet('present');
      else if (n === 2) onSet('absent');
      else onSet(null);
    }, 280);
  };

  const baseCls = "w-10 h-7 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-150 select-none";

  if (disabled) {
    return (
      <div className={`${baseCls} bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed`} title="O'zgartirish mumkin emas">
        {isPresent ? <Icon path={ICONS.check} className="w-3.5 h-3.5" /> : isAbsent ? <Icon path={ICONS.x} className="w-3.5 h-3.5" /> : '—'}
      </div>
    );
  }

  let stateCls = isPresent
    ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm shadow-emerald-200 hover:scale-105 transform"
    : isAbsent
      ? "bg-gradient-to-br from-red-400 to-rose-500 text-white shadow-sm shadow-red-200 hover:scale-105 transform"
      : "bg-white dark:bg-slate-800 border border-dashed border-gray-200 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20";

  return (
    <div
      onClick={handleClick}
      onMouseDown={(e) => {
        didDrag.current = false;
        if (!disabled) {
          // Store starting status for dragging
          const apply = isPresent ? null : 'present';
          onDragStart(apply);
        }
      }}
      onMouseEnter={() => {
        if (!disabled) {
          if (isDragging) didDrag.current = true;
          onDragEnter(); 
          onFocus?.();
        }
      }}
      className={`${baseCls} ${stateCls} group`}
    >
      {isPresent && <Icon path={ICONS.check} className="w-4 h-4" />}
      {isAbsent  && <Icon path={ICONS.x} className="w-3.5 h-3.5" />}
      {!status && (
        <Icon path={ICONS.check} className="w-4 h-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
};


const Empty = ({ text, sub }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 p-10 text-center m-4">
    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 flex items-center justify-center text-3xl mb-4 shadow-sm">📋</div>
    <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">{text}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
  </div>
);

const Attendance = () => {
  const { t } = useLang();
  const DAY_SHORT = t('days_short');
  const MONTHS    = t('months');
  const MONTHS_S  = t('months_short');

  const { user } = useAuth();
  const toast    = useToast();
  const isAdmin = user?.role !== 'teacher';
  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [groups,        setGroups]        = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [month,         setMonth]         = useState(now.getMonth() + 1);
  const [year,          setYear]          = useState(now.getFullYear());
  const [journal,       setJournal]       = useState(null);
  const [localRecords,  setLocalRecords]  = useState({});
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [savedMsg,      setSavedMsg]      = useState(false);
  const [isDragging,    setIsDragging]    = useState(false);
  const [focusedCell,   setFocusedCell]   = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);

  const dragRef          = useRef({ active: false, status: null });
  const saveTimerRef     = useRef(null);
  const localRecordsRef  = useRef({});
  const journalRef       = useRef(null);
  const selectedGroupRef = useRef('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => { localRecordsRef.current  = localRecords;  }, [localRecords]);
  useEffect(() => { journalRef.current       = journal;       }, [journal]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  useEffect(() => {
    const stop = () => { dragRef.current.active = false; setIsDragging(false); };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!focusedCell) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (focusedCell.disabled) return;
      if (e.key === 'p' || e.key === 'P') setCell(focusedCell.sid, focusedCell.date, 'present');
      if (e.key === 'a' || e.key === 'A') setCell(focusedCell.sid, focusedCell.date, 'absent');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusedCell]);

  useEffect(() => {
    api.get('/groups').then((r) => {
      setGroups(r.data || []);
      if (r.data?.length) setSelectedGroup(String(r.data[0].id));
    }).catch(() => toast.error("Guruhlar yuklanmadi"));
  }, []);

  // Clear pending auto-save timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const loadJournal = useCallback(async () => {
    if (!selectedGroup) return;
    const reqId = ++loadRequestIdRef.current;
    setLoading(true);
    try {
      const r = await api.get('/attendance/journal', { params: { group_id: selectedGroup, month, year } });
      if (reqId !== loadRequestIdRef.current) return; // stale response — a newer request is in flight
      setJournal(r.data);
      setLocalRecords(r.data.records || {});
    } catch {
      if (reqId !== loadRequestIdRef.current) return;
      setJournal(null);
      toast.error(t('att_loading_error') || 'Xatolik yuz berdi');
    }
    finally  { if (reqId === loadRequestIdRef.current) setLoading(false); }
  }, [selectedGroup, month, year]);

  useEffect(() => { loadJournal(); }, [loadJournal]);

  const doAutoSave = useCallback(async () => {
    const jrnl = journalRef.current;
    const recs  = localRecordsRef.current;
    const grpId = selectedGroupRef.current;
    if (!jrnl) return;
    setSaving(true);
    try {
      const records = [];
      jrnl.students.forEach((s) => {
        jrnl.dates.forEach((d) => {
          const st = recs[s.id]?.[d];
          if (st) records.push({ student_id: s.id, group_id: parseInt(grpId), date: d, status: st });
        });
      });
      if (records.length) await api.post('/attendance', { records });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1800);
    } catch {
      toast.error('Saqlashda xatolik');
    }
    finally  { setSaving(false); }
  }, []);

  const setCell = (sid, date, newStatus) => {
    setLocalRecords((p) => ({ ...p, [sid]: { ...(p[sid] || {}), [date]: newStatus } }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doAutoSave, 800);
  };

  const handleDragStart = (sid, date, cur) => {
    dragRef.current = { active: true, status: cur, startSid: sid, startDate: date };
    setIsDragging(true);
  };

  const handleDragEnter = (sid, date) => {
    if (dragRef.current.active) {
      setCell(sid, date, dragRef.current.status);
    }
  };

  const markAllPresent = (date) => {
    const jrnl = journalRef.current;
    if (!jrnl) return;
    setLocalRecords((p) => {
      const u = { ...p };
      jrnl.students.forEach((s) => { u[s.id] = { ...(u[s.id] || {}), [date]: 'present' }; });
      return u;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doAutoSave, 800);
  };

  const grp      = journal?.group;
  const time     = grp?.schedule?.split('|')[1]?.split('-')[0] ?? '';
  const isFuture = (i) => year === now.getFullYear() && i + 1 > now.getMonth() + 1;

  return (
    <div className="flex flex-1 min-h-[calc(100vh-56px)] overflow-hidden bg-gray-50/30 dark:bg-slate-950/30 relative">

      {/* ── Mobile sidebar overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-14 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed top-14 bottom-0 left-0 z-40 lg:static lg:top-auto lg:bottom-auto lg:z-auto
        w-64 lg:w-56 flex-shrink-0
        bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700
        flex flex-col overflow-hidden shadow-[2px_0_16px_rgba(0,0,0,0.06)]
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-3.5 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
            {t('att_groups')}
          </span>
          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-[1px] rounded-full">
                {groups.length}
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Icon path={ICONS.x} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {groups.length === 0 && (
            <p className="text-xs text-gray-500 p-2">{t('att_loading')}</p>
          )}
          {groups.map((g) => {
            const isActive = String(g.id) === selectedGroup;
            const words    = g.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, ' ').trim().split(/\s+/);
            const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || g.name[0]?.toUpperCase();
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(String(g.id))}
                className={`flex items-center gap-2.5 w-full p-2 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40'
                    : 'hover:bg-blue-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold tracking-wider transition-colors ${
                  isActive ? 'bg-white/20 text-white border border-white/30' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-transparent group-hover:bg-white dark:group-hover:bg-slate-600 group-hover:border-blue-100 dark:group-hover:border-slate-500 group-hover:shadow-sm'
                }`}>
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>
                    {g.name}
                  </div>
                  {g.student_count != null && (
                    <div className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive ? 'text-indigo-200' : 'text-gray-400 dark:text-slate-500'}`}>
                      {g.student_count} {t('att_student_count')}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto flex flex-col p-4 md:p-6 lg:p-8 space-y-4 lg:ml-2">

          {/* Top Bar containing Months and Group Info */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

            {/* Mobile: group toggle + month row */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-slate-300 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex-shrink-0"
              >
                <Icon path="M4 6h16M4 12h16M4 18h16" className="w-4 h-4" />
                <span className="max-w-[120px] truncate">
                  {groups.find(g => String(g.id) === selectedGroup)?.name || t('att_groups')}
                </span>
              </button>
            </div>

            {/* Months — scrollable on mobile */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm w-max">
                {MONTHS_S.map((label, i) => {
                  const isActive = month === i + 1;
                  const disabled = isFuture(i);
                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => setMonth(i + 1)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/40'
                          : 'text-gray-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <div className="w-px h-5 bg-gray-200 dark:bg-slate-600 mx-1 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 px-3 py-1.5 flex-shrink-0">{year}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {saving ? (
                <span className="text-xs font-medium text-amber-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  {t('att_saving')}
                </span>
              ) : savedMsg ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Icon path={ICONS.check} className="w-3.5 h-3.5" />
                  {t('att_saved')}
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-400 hidden sm:inline">{t('att_auto_saved')}</span>
              )}

              {journal && (
                <button
                  onClick={() => printElement('att-print-area', `Attendance — ${grp?.name} — ${MONTHS[month - 1]} ${year}`)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-slate-300 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary-200"
                >
                  <Icon path={ICONS.print} className="w-4 h-4" />
                  {t('att_print')}
                </button>
              )}
            </div>
          </div>

          {/* Group Details Header */}
          {grp && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-3.5 sm:p-5 shadow-[0_2px_12px_rgb(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">{grp.name}</h2>
                <div className="flex items-center mt-1.5 flex-wrap gap-1.5">
                  {time && (
                    <div className="flex items-center text-gray-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-gray-100 dark:border-slate-600 text-xs">
                      <Icon path={ICONS.clock} className="w-3 h-3 mr-1 text-gray-400 dark:text-slate-500" />
                      {time}
                    </div>
                  )}
                  {grp.room && (
                    <div className="flex items-center text-gray-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-gray-100 dark:border-slate-600 text-xs">
                      <Icon path={ICONS.location} className="w-3 h-3 mr-1 text-gray-400 dark:text-slate-500" />
                      {grp.room}
                    </div>
                  )}
                </div>
              </div>

              {grp.teacher_name && (
                <div className="flex items-center gap-2.5 bg-white/60 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 px-3 py-2 rounded-xl">
                  <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <Icon path={ICONS.user} className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-bold text-blue-400 dark:text-blue-500">{t('att_teacher')}</p>
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200">{grp.teacher_name}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          {loading ? (
             <div className="flex-1 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 p-10"><LoadingSpinner text={t('att_loading')} /></div>
          ) : !selectedGroup ? (
            <Empty text={t('att_no_group')} />
          ) : !journal || !journal.students?.length ? (
            <Empty text={t('att_no_students')} />
          ) : !journal.dates?.length ? (
            <Empty
              text={`${MONTHS[month - 1]} ${year} — ${t('att_no_lesson_days')}`}
              sub={grp?.schedule ? `Schedule: ${grp.schedule}` : ''}
            />
          ) : (
            <div id="att-print-area" className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden">
              {/* print-only header */}
              <div className="hidden att-print-header p-4">
                <h2 className="text-xl font-bold">{grp?.name} — {MONTHS[month - 1]} {year}</h2>
                {grp?.teacher_name && <p className="text-sm">{t('att_teacher')}: {grp.teacher_name}</p>}
              </div>

              {/* Table wrapper */}
              <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="sticky top-0 z-20 bg-gray-50 dark:bg-slate-900/60 border-b-2 border-gray-200 dark:border-slate-700 shadow-sm outline-none">
                      <th className="sticky left-0 z-30 bg-gray-50 dark:bg-slate-900/60 p-3 text-left min-w-[200px] border-r border-gray-200 dark:border-slate-700 shadow-[2px_0_8px_rgb(0,0,0,0.04)] outline-none">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t('att_student_name')}</span>
                      </th>

                      {journal.dates.map((date) => {
                        const d       = new Date(date);
                        const isToday = date === todayStr;
                        return (
                          <th key={date} className={`p-2 min-w-[60px] w-[60px] text-center border-l border-r border-gray-100 dark:border-slate-700/50 font-normal align-top outline-none ${
                            isToday ? 'bg-violet-50/80 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/50 shadow-[inset_0_2px_0_#7C3AED]' : ''
                          }`}>
                            <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isToday ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'}`}>
                              {DAY_SHORT[d.getDay()]}
                            </div>
                            <div className={`text-base font-black ${isToday ? 'text-violet-900 dark:text-violet-200' : 'text-gray-900 dark:text-slate-100'}`}>
                              {d.getDate()}
                            </div>
                            <MarkAllBtn onClick={() => markAllPresent(date)} label={t('att_mark_all')} />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {journal.students.map((student, idx) => {
                      const isActive = student.status === 'active' || !student.status;
                      const isFrozen = student.status === 'frozen';
                      const rowBg = idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-slate-800/80' : 'bg-white dark:bg-slate-800';
                      return (
                        <tr key={student.id} className={`${rowBg} border-b border-gray-100 dark:border-slate-700/50 transition-colors outline-none ${isFrozen ? 'opacity-50 grayscale' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 group'}`}>

                          {/* Student Name */}
                          <td className={`sticky left-0 z-10 ${rowBg} border-r border-gray-200 dark:border-slate-700 p-2.5 shadow-[2px_0_12px_rgb(0,0,0,0.03)] outline-none cursor-default ${!isFrozen && 'group-hover:bg-gray-50 dark:group-hover:bg-slate-700/50 transition-colors'}`}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-4 text-right text-[10px] font-bold text-gray-400 dark:text-slate-600 select-none">
                                {idx + 1}
                              </div>
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : isFrozen ? 'bg-blue-400' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} title={isActive ? 'Faol' : isFrozen ? 'Muzlatilgan' : 'Nofaol'} />
                              <span className="text-[13px] font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                                {student.name}
                              </span>
                              {isFrozen && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">Muzlatilgan</span>}
                            </div>
                          </td>

                          {/* Attendance Cells */}
                          {journal.dates.map((date) => {
                            const status  = localRecords[student.id]?.[date] ?? null;
                            const isToday = date === todayStr;
                            
                            const beforeStart = student.start_date && date < student.start_date;
                            const isPast = date < todayStr;
                            const cellDisabled = isFrozen || beforeStart || (!isAdmin && isPast);

                            return (
                              <td key={date} className={`px-2 py-3 text-center border-l border-r border-gray-100 dark:border-slate-700/50 outline-none ${
                                isToday ? 'bg-violet-50/40 dark:bg-violet-900/10 border-violet-100/60 dark:border-violet-800/30' : ''
                              }`}>
                                <div className="flex justify-center outline-none">
                                  <AttCell
                                    status={status}
                                    onSet={(st) => setCell(student.id, date, st)}
                                    onDragStart={(st) => handleDragStart(student.id, date, st)}
                                    onDragEnter={() => handleDragEnter(student.id, date)}
                                    isDragging={isDragging}
                                    onFocus={() => setFocusedCell({ sid: student.id, date: date, disabled: cellDisabled })}
                                    disabled={cellDisabled}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Hints */}
              <div className="bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-2.5 flex items-center flex-wrap gap-3 text-xs font-medium text-gray-500 dark:text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center text-[10px] shadow-sm">👆</span> {t('att_hint_tap')}</div>
                <Dot />
                <div className="hidden sm:flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center text-[10px] shadow-sm">🖱️</span> {t('att_hint_drag')}</div>
                <Dot className="hidden sm:inline" />
                <div className="flex items-center gap-1.5"><Kbd>P</Kbd> {t('att_hint_present')}</div>
                <Dot />
                <div className="flex items-center gap-1.5"><Kbd>A</Kbd> {t('att_hint_absent')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
