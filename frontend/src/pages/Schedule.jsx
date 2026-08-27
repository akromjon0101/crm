import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  parseSchedule,
  countLessonDays,
  formatDayLabels,
  getScheduleType,
  ODD_DAYS,
  EVEN_DAYS,
} from '../utils/schedule';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
};

const nowHHMM = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
};

const isActiveSlot = (start, end) => {
  if (!start || !end) return false;
  const now = nowHHMM();
  return now >= start && now < end;
};

const detectTodayType = () => {
  const d = new Date().getDay();
  if (ODD_DAYS.includes(d))  return 'odd';
  if (EVEN_DAYS.includes(d)) return 'even';
  return 'other';
};

// ── Stat chip ──────────────────────────────────────────────────────────────────
const StatChip = ({ label, value }) => (
  <div className="text-center leading-tight">
    <div className="text-base font-bold text-gray-900 dark:text-slate-100 tabular-nums">{value}</div>
    <div className="text-2xs text-gray-400 dark:text-slate-500 mt-0.5">{label}</div>
  </div>
);

// ── Radio button ───────────────────────────────────────────────────────────────
const Radio = ({ label, checked, onChange, isToday }) => (
  <label
    onClick={onChange}
    className="flex items-center gap-2 cursor-pointer select-none"
  >
    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 bg-white dark:bg-slate-900 ${
      checked ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-slate-600'
    }`}>
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />}
    </span>
    <span className={`text-sm transition-colors duration-150 ${
      checked
        ? 'text-gray-900 dark:text-slate-100 font-medium'
        : 'text-gray-500 dark:text-slate-400'
    }`}>
      {label}
    </span>
    {isToday && (
      <span className="text-[9px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-1.5 py-px">
        Bugun
      </span>
    )}
  </label>
);

// ── Badge ──────────────────────────────────────────────────────────────────────
const Badge = ({ text, type }) => (
  <span className={`text-[10px] font-bold rounded-full px-1.5 py-px whitespace-nowrap leading-snug ${
    type === 'red'
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
  }`}>
    {text}
  </span>
);

// ── Group card ─────────────────────────────────────────────────────────────────
const GroupCard = ({ group, today, year, month, onClick }) => {
  const lessonCount = countLessonDays(group.days, year, month);

  return (
    <div
      onClick={() => onClick(group)}
      className="bg-blue-50 dark:bg-blue-500/[0.07] border border-blue-200 dark:border-blue-900/60 rounded-md px-2.5 py-2 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-[0_2px_8px_rgba(37,99,235,0.14)] transition-all duration-150 flex flex-col gap-1"
    >
      <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight m-0">
        {group.name}
      </p>
      <div className="flex items-center flex-wrap gap-1">
        <span className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
          {fmtDate(today)}
        </span>
        <Badge text={`${lessonCount} lessons`}                   type="red"  />
        <Badge text={`${group.student_count || 0} ta o'quvchi`} type="blue" />
      </div>
      {group.teacher_name && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight m-0">
          {group.teacher_name}
        </p>
      )}
    </div>
  );
};

// ── Group detail modal ─────────────────────────────────────────────────────────
const GroupModal = ({ group, year, month, onClose }) => {
  const lessonCount = countLessonDays(group.days, year, month);
  const dayLabel    = formatDayLabels(group.days);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const InfoRow = ({ label, value }) => (
    <div className="flex gap-3 pb-2.5 border-b border-gray-100 dark:border-slate-700/60 last:border-0 last:pb-0">
      <span className="text-[11px] text-gray-400 dark:text-slate-500 w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-800 dark:text-slate-200 font-medium leading-snug">
        {value || '—'}
      </span>
    </div>
  );

  const timeValue = group.startTime
    ? (group.endTime ? `${group.startTime} – ${group.endTime}` : group.startTime)
    : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/30 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-modal w-full max-w-sm overflow-hidden animate-slideIn"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-slate-700/60 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-slate-100 m-0">
              {group.name}
            </p>
            {group.room && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {group.room} — xona
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex-shrink-0 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2.5">
          <InfoRow label="Vaqt"          value={timeValue} />
          <InfoRow label="Xona"          value={group.room} />
          <InfoRow label="O'qituvchi"    value={group.teacher_name} />
          <InfoRow label="Dars kunlari"  value={dayLabel || null} />
          <InfoRow label="O'quvchilar"   value={group.student_count ? `${group.student_count} ta` : '0 ta'} />
          <InfoRow label="Bu oy darslari" value={`${lessonCount}`} />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700/60 flex gap-2">
          <Badge text={`${lessonCount} lessons`}                   type="red"  />
          <Badge text={`${group.student_count || 0} ta o'quvchi`} type="blue" />
        </div>
      </div>
    </div>
  );
};

// ── Empty state ────────────────────────────────────────────────────────────────
const Empty = ({ text, sub }) => (
  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl py-14 px-6 text-center">
    <p className="text-sm text-gray-500 dark:text-slate-400">{text}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">{sub}</p>}
  </div>
);

// ── Schedule grid ──────────────────────────────────────────────────────────────
const Grid = ({ groups, today, year, month, onCardClick }) => {
  const rooms = useMemo(() => {
    const r = [...new Set(groups.map((g) => g.room).filter(Boolean))];
    return r.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [groups]);

  const times = useMemo(() => {
    const t = [...new Set(groups.map((g) => g.startTime).filter(Boolean))];
    return t.sort();
  }, [groups]);

  const endMap = useMemo(() => {
    const m = {};
    groups.forEach((g) => {
      if (g.startTime && g.endTime && !m[g.startTime]) m[g.startTime] = g.endTime;
    });
    return m;
  }, [groups]);

  const cellMap = useMemo(() => {
    const m = {};
    groups.forEach((g) => {
      if (g.room && g.startTime) {
        const k = `${g.room}|${g.startTime}`;
        (m[k] = m[k] || []).push(g);
      }
    });
    return m;
  }, [groups]);

  const noRoom = groups.filter((g) => !g.room);

  if (rooms.length === 0 && noRoom.length === 0) {
    return <Empty text="No lessons found for today" />;
  }

  if (rooms.length === 0) {
    return (
      <div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2.5">
          Xona belgilanmagan — {noRoom.length} ta guruh
        </p>
        <div className="flex flex-wrap gap-2">
          {noRoom.map((g) => (
            <GroupCard key={g.id} group={g} today={today} year={year} month={month} onClick={onCardClick} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              {/* Corner */}
              <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-slate-800/70 min-w-[72px] w-[72px] p-3 border-b border-r border-gray-200 dark:border-slate-700" />

              {times.map((t) => {
                const end    = endMap[t];
                const active = isActiveSlot(t, end);
                return (
                  <th
                    key={t}
                    className={`sticky top-0 z-20 min-w-[120px] w-[120px] sm:min-w-[160px] sm:w-[160px] px-2 py-2 sm:px-2.5 sm:py-2.5 text-center whitespace-nowrap border-b border-r border-gray-200 dark:border-slate-700 transition-colors ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-500/[0.06] border-b-blue-200 dark:border-b-blue-800'
                        : 'bg-gray-50 dark:bg-slate-800/70'
                    }`}
                  >
                    <div className={`text-sm font-bold ${
                      active ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-slate-200'
                    }`}>
                      {t}
                    </div>
                    {end && (
                      <div className={`text-[10px] mt-0.5 ${
                        active ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'
                      }`}>
                        → {end}
                      </div>
                    )}
                    {active && (
                      <span className="inline-block text-[9px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 rounded-full px-1.5 py-px mt-1">
                        Hozir
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rooms.map((room, ri) => {
              const isLast = ri === rooms.length - 1;
              return (
                <tr key={room}>
                  {/* Room label */}
                  <td className={`sticky left-0 z-10 bg-gray-50 dark:bg-slate-800/70 px-3.5 py-2.5 border-r border-gray-200 dark:border-slate-700 text-center text-sm font-bold text-gray-800 dark:text-slate-200 whitespace-nowrap align-middle ${
                    isLast ? '' : 'border-b border-gray-200 dark:border-slate-700'
                  }`}>
                    {room}
                  </td>

                  {times.map((time) => {
                    const end        = endMap[time];
                    const active     = isActiveSlot(time, end);
                    const cellGroups = cellMap[`${room}|${time}`] || [];

                    return (
                      <td
                        key={time}
                        className={`border-r border-gray-200 dark:border-slate-700 p-1.5 sm:p-2 align-top h-[80px] sm:h-[100px] min-w-[120px] w-[120px] sm:min-w-[160px] sm:w-[160px] transition-colors ${
                          isLast ? '' : 'border-b border-gray-200 dark:border-slate-700'
                        } ${
                          active ? 'bg-blue-50/40 dark:bg-blue-500/[0.04]' : 'bg-transparent'
                        }`}
                      >
                        {cellGroups.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {cellGroups.map((g) => (
                              <GroupCard
                                key={g.id}
                                group={g}
                                today={today}
                                year={year}
                                month={month}
                                onClick={onCardClick}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Groups without room */}
      {noRoom.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
            Xona belgilanmagan — {noRoom.length} ta guruh
          </p>
          <div className="flex flex-wrap gap-2">
            {noRoom.map((g) => (
              <GroupCard key={g.id} group={g} today={today} year={year} month={month} onClick={onCardClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const Schedule = () => {
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState(() => detectTodayType());
  const [selected, setSelected] = useState(null);

  const today     = useMemo(() => new Date(), []);
  const year      = today.getFullYear();
  const month     = today.getMonth() + 1;
  const todayType = detectTodayType();

  useEffect(() => {
    api.get('/groups', { params: { status: 'active' } })
      .then((r) => setGroups(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enriched = useMemo(() =>
    groups.map((g) => ({ ...g, ...parseSchedule(g.schedule) })),
    [groups]
  );

  const filtered = useMemo(() => {
    if (filter === 'odd')  return enriched.filter((g) => getScheduleType(g.schedule) === 'odd');
    if (filter === 'even') return enriched.filter((g) => getScheduleType(g.schedule) === 'even');
    return enriched.filter((g) => {
      const t = getScheduleType(g.schedule);
      return t === 'mixed' || t === 'none';
    });
  }, [enriched, filter]);

  const stats = useMemo(() => ({
    rooms:    new Set(filtered.map((g) => g.room).filter(Boolean)).size,
    groups:   filtered.length,
    students: filtered.reduce((s, g) => s + (g.student_count || 0), 0),
  }), [filtered]);

  if (loading) return <LoadingSpinner text="Jadval yuklanmoqda…" />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Filter row ────────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-6">
        <Radio
          label="Toq kunlar"
          checked={filter === 'odd'}
          onChange={() => setFilter('odd')}
          isToday={todayType === 'odd'}
        />
        <Radio
          label="Juft kunlar"
          checked={filter === 'even'}
          onChange={() => setFilter('even')}
          isToday={todayType === 'even'}
        />
        <Radio
          label="Boshqa"
          checked={filter === 'other'}
          onChange={() => setFilter('other')}
          isToday={todayType === 'other'}
        />

        {/* Stats */}
        <div className="ml-auto flex items-center gap-5">
          <StatChip label="xona"     value={stats.rooms}    />
          <div className="w-px h-7 bg-gray-200 dark:bg-slate-700" />
          <StatChip label="guruh"    value={stats.groups}   />
          <div className="w-px h-7 bg-gray-200 dark:bg-slate-700" />
          <StatChip label="o'quvchi" value={stats.students} />
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <Grid
        groups={filtered}
        today={today}
        year={year}
        month={month}
        onCardClick={setSelected}
      />

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {selected && (
        <GroupModal
          group={selected}
          year={year}
          month={month}
          onClose={() => setSelected(null)}
        />
      )}

    </div>
  );
};

export default Schedule;
