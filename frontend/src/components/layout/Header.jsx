import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import NotificationBell from '../common/NotificationBell';

const ROLE_INFO = {
  superadmin: { label: 'CEO',     bg: 'bg-violet-600' },
  admin:      { label: 'Admin',   bg: 'bg-primary-600' },
  teacher:    { label: 'Teacher', bg: 'bg-emerald-600' },
};

const ProfileDropdown = ({ user, onLogout }) => {
  return (
    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-modal z-50 overflow-hidden animate-fadeIn">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{user?.name}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{user?.email}</p>
      </div>
      <div className="py-1">
        <div className="border-t border-gray-100 dark:border-slate-700 mt-1 pt-1">
          <button
            onClick={onLogout}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const Header = ({ onMenuClick, title, subtitle }) => {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const roleInfo = ROLE_INFO[user?.role] || { label: user?.role, bg: 'bg-gray-500' };

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/80 px-4 flex items-center gap-3 sticky top-0 z-10 flex-shrink-0">

      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 dark:text-slate-500 leading-tight hidden md:block">{subtitle}</p>}
      </div>

      {/* Mobile: show app name */}
      <div className="flex-1 sm:hidden">
        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">EduCRM</span>
      </div>

      {/* Language toggle */}
      <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 flex-shrink-0">
        {['en', 'uz', 'ru'].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
              lang === l
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Settings */}
      <button
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer
          ${location.pathname === '/settings'
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Notification bell */}
      <NotificationBell />

      {/* Profile */}
      <div className="relative flex-shrink-0" ref={profileRef}>
        <button
          onClick={() => setShowProfile(p => !p)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className={`w-7 h-7 rounded-lg ${roleInfo.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 leading-tight">
              {user?.name?.split(' ')[0]}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight">
              {roleInfo.label}
            </p>
          </div>
          <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {showProfile && (
          <ProfileDropdown user={user} onLogout={handleLogout} />
        )}
      </div>
    </header>
  );
};

export default Header;
