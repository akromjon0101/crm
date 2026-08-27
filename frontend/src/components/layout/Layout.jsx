import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLang } from '../../context/LangContext';

const PAGE_META = {
  '/':               { titleKey: 'page_dashboard',    subtitleKey: 'page_dashboard_sub'    },
  '/students':       { titleKey: 'page_students',     subtitleKey: 'page_students_sub'     },
  '/groups':         { titleKey: 'page_groups',       subtitleKey: 'page_groups_sub'       },
  '/teachers':       { titleKey: 'page_teachers',     subtitleKey: 'page_teachers_sub'     },
  '/payments':       { titleKey: 'page_payments',     subtitleKey: 'page_payments_sub'     },
  '/attendance':     { titleKey: 'page_attendance',   subtitleKey: 'page_attendance_sub'   },
  '/schedule':       { titleKey: 'page_schedule',     subtitleKey: 'page_schedule_sub'     },
  '/analytics':      { titleKey: 'page_analytics',   subtitleKey: 'page_analytics_sub'    },
  '/salary':         { titleKey: 'page_salary',       subtitleKey: 'page_salary_sub'       },
  '/salary-admin':   { titleKey: 'page_salary_admin', subtitleKey: 'page_salary_admin_sub' },
  '/settings':       { titleKey: 'page_settings',    subtitleKey: 'page_settings_sub'     },
  '/archive':        { titleKey: 'page_archive',      subtitleKey: 'page_archive_sub'      },
  '/leads':          { titleKey: 'page_leads',        subtitleKey: 'page_leads_sub'        },
  '/earnings':       { titleKey: 'page_earnings',     subtitleKey: 'page_earnings_sub'     },
  '/admin-earnings': { titleKey: 'page_admin_earnings',subtitleKey: 'page_admin_earnings_sub'},
  '/lessons':        { titleKey: 'page_lessons',      subtitleKey: 'page_lessons_sub'      },
  '/finances':       { titleKey: 'page_finances',     subtitleKey: 'page_finances_sub'     },
};

const ATTENDANCE_PATH = '/attendance';

// ── Top progress bar ──────────────────────────────────────────────────────────
const ProgressBar = ({ active }) => {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden pointer-events-none">
      <div
        className="h-full animate-progress-bar"
        style={{ background: 'linear-gradient(90deg, #2563EB, #1D4ED8, #2563EB)' }}
      />
    </div>
  );
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [progressing, setProgressing]   = useState(false);
  const prevPath = useRef(null);
  const location = useLocation();
  const { t }    = useLang();

  const meta     = PAGE_META[location.pathname];
  const title    = meta ? t(meta.titleKey)    : 'EduCRM';
  const subtitle = meta ? t(meta.subtitleKey) : '';
  const isAttendance = location.pathname === ATTENDANCE_PATH;

  // Trigger progress bar on every route change
  useEffect(() => {
    if (prevPath.current !== null && prevPath.current !== location.pathname) {
      setProgressing(true);
      const t = setTimeout(() => setProgressing(false), 460);
      return () => clearTimeout(t);
    }
    prevPath.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface dark:bg-slate-950">
      <ProgressBar active={progressing} />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
          subtitle={subtitle}
        />
        <main
          key={location.key}
          className={
            isAttendance
              ? 'flex-1 overflow-hidden flex flex-col'
              : 'flex-1 overflow-y-auto p-4 lg:p-5 animate-pageIn'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
