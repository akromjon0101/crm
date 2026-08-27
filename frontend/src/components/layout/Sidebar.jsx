import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';

// ── Micro icon ────────────────────────────────────────────────────────────────
const Ic = ({ d }) => (
  <svg
    className="w-[18px] h-[18px] flex-shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// ── Icon paths ────────────────────────────────────────────────────────────────
const ICONS = {
  dashboard:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  students:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  groups:
    'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  teachers:
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  attendance:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  schedule:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  payments:
    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  analytics:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  salary:
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  salaryAdmin:
    'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  earnings:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  lessons:
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  logout:
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  archive:
    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  leads:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  finances:
    'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

// ── Nav definitions ───────────────────────────────────────────────────────────
const TEACHER_NAV = [
  { key: 'nav_dashboard',   path: '/',          icon: 'dashboard',   end: true },
  { key: 'nav_groups',      path: '/groups',    icon: 'groups'                 },
  { key: 'nav_attendance',  path: '/attendance',icon: 'attendance'             },
  { key: 'nav_lessons',     path: '/lessons',   icon: 'lessons'                },
  { key: 'nav_my_earnings', path: '/earnings',  icon: 'earnings'               },
  { key: 'nav_settings',    path: '/settings',  icon: 'settings'               },
];

const CEO_NAV = [
  { key: 'nav_dashboard',    path: '/',               icon: 'dashboard',   end: true },
  { key: 'nav_finances',     path: '/finances',       icon: 'finances'               },
  { key: 'nav_analytics',    path: '/analytics',      icon: 'analytics'              },
  { key: 'nav_payments',     path: '/payments',       icon: 'payments'               },
  { key: 'nav_earnings',     path: '/admin-earnings', icon: 'earnings'               },
  { key: 'nav_salary_admin', path: '/salary-admin',   icon: 'salaryAdmin'            },
  { key: 'nav_leads',        path: '/leads',          icon: 'leads'                  },
  { key: 'nav_settings',     path: '/settings',       icon: 'settings'               },
];

const ADMIN_NAV = [
  { key: 'nav_dashboard',    path: '/',               icon: 'dashboard',   end: true },
  { key: 'nav_students',     path: '/students',       icon: 'students'               },
  { key: 'nav_groups',       path: '/groups',         icon: 'groups'                 },
  { key: 'nav_teachers',     path: '/teachers',       icon: 'teachers'               },
  { key: 'nav_attendance',   path: '/attendance',     icon: 'attendance'             },
  { key: 'nav_schedule',     path: '/schedule',       icon: 'schedule'               },
  { key: 'nav_lessons',      path: '/lessons',        icon: 'lessons'                },
  { key: 'nav_payments',     path: '/payments',       icon: 'payments'               },
  { key: 'nav_analytics',    path: '/analytics',      icon: 'analytics'              },
  { key: 'nav_leads',        path: '/leads',          icon: 'leads'                  },
  { key: 'nav_archive',      path: '/archive',        icon: 'archive'                },
  { key: 'nav_settings',     path: '/settings',       icon: 'settings'               },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Sidebar = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const isTeacher    = user?.role === 'teacher';
  const isSuperadmin = user?.role === 'superadmin';
  const nav = isTeacher ? TEACHER_NAV : isSuperadmin ? CEO_NAV : ADMIN_NAV;

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 lg:hidden bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col w-[220px] flex-shrink-0
          transition-transform duration-200 bg-[#0D0D1C] border-r border-white/[0.06]
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-3.5 pt-[18px] pb-3.5 border-b border-white/[0.06]">
          {/* Logo icon */}
          <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-800 shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
            <svg className="w-4 h-4" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>

          <div>
            <p className="text-[14px] font-bold leading-tight text-slate-100">
              EduCRM
            </p>
            <p className="text-[10px] leading-snug text-slate-600">
              Learning Center
            </p>
          </div>

          {/* Mobile close */}
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden ml-auto p-1 rounded text-slate-600 hover:text-slate-300 transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2 py-2.5">
          <ul className="flex flex-col gap-1 list-none m-0 p-0">
            {nav.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Ic d={ICONS[item.icon]} />
                  <span>{t(item.key)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── User footer ──────────────────────────────────────────── */}
        <div className="px-2 pb-3.5 pt-2.5 border-t border-white/[0.06]">
          {/* User row */}
          <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 mb-1">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-lg text-white text-[10px] font-bold tracking-wider flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold leading-tight text-slate-300">
                {user?.name}
              </p>
              <p className="text-[10px] leading-snug capitalize text-slate-600">
                {user?.role}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-red-400/[0.08] hover:text-red-400 transition-colors duration-150"
          >
            <Ic d={ICONS.logout} />
            <span>{t('nav_sign_out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
