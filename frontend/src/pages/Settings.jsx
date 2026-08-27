import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import api from '../services/api';

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  user:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  lock:    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  eye:     'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:  'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  money:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  bell:    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  palette: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.172a2 2 0 00.586 1.414l3.828 3.828A2 2 0 0116 13.828V17a4 4 0 01-4 4H7z M16 5l3 3-3 3',
  sun:     'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon:    'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  globe:   'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  check:   'M5 13l4 4L19 7',
  alert:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ iconKey, title, children }) => (
  <div className="card overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-slate-700">
      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
        <Ic d={ICONS[iconKey]} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
    </div>
    {children}
  </div>
);

// ── Alert banner ──────────────────────────────────────────────────────────────
const Alert = ({ type, msg }) => {
  if (!msg) return null;
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium mb-3 ${
      type === 'success'
        ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
        : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
    }`}>
      <Ic d={type === 'success' ? ICONS.check : ICONS.alert} className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0 border-0 cursor-pointer ${
      checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'
    }`}
  >
    <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
      checked ? 'left-[22px]' : 'left-[3px]'
    }`} />
  </button>
);

// ── Toggle row ────────────────────────────────────────────────────────────────
const ToggleRow = ({ label, desc, checked, onChange, last }) => (
  <div className={`flex items-center justify-between gap-4 px-5 py-3.5 ${!last ? 'border-b border-gray-50 dark:border-slate-700/50' : ''}`}>
    <div>
      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{label}</p>
      {desc && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{desc}</p>}
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

// ── Password field with toggle ────────────────────────────────────────────────
const PasswordField = ({ value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
      >
        <Ic d={show ? ICONS.eyeOff : ICONS.eye} />
      </button>
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const Settings = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLang();

  // Profile
  const [name,           setName]           = useState(user?.name  || '');
  const [email,          setEmail]          = useState(user?.email || '');
  const [phone,          setPhone]          = useState(user?.phone || '');
  const [profileMsg,     setProfileMsg]     = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confPw,    setConfPw]    = useState('');
  const [pwMsg,     setPwMsg]     = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  // System
  const [ratePerLesson, setRatePerLesson] = useState(() => localStorage.getItem('rate_per_lesson') || '50000');
  const [centerName,    setCenterName]    = useState(() => localStorage.getItem('center_name') || 'EduCRM Learning Center');
  const [sysMsg,        setSysMsg]        = useState(null);

  // Notifications
  const [notif,    setNotif]    = useState(() => { try { return JSON.parse(localStorage.getItem('notif_prefs')) || {}; } catch { return {}; } });
  const [notifMsg, setNotifMsg] = useState(null);
  const setN = (key, val) => setNotif(p => ({ ...p, [key]: val }));

  const flash = (setter, type, text, ms = 3000) => {
    setter({ type, text });
    setTimeout(() => setter(null), ms);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return flash(setProfileMsg, 'error', 'Name is required');
    setProfileLoading(true);
    try {
      await api.put(`/users/${user.id}`, { name: name.trim(), email: email.trim(), phone: phone.trim() || null, role: user.role, is_active: 1 });
      const updated = { ...user, name: name.trim(), email: email.trim(), phone: phone.trim() };
      localStorage.setItem('user', JSON.stringify(updated));
      flash(setProfileMsg, 'success', 'Profile updated successfully');
    } catch (err) {
      flash(setProfileMsg, 'error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!curPw) return flash(setPwMsg, 'error', 'Current password is required');
    if (newPw.length < 6) return flash(setPwMsg, 'error', 'New password must be at least 6 characters');
    if (newPw !== confPw) return flash(setPwMsg, 'error', 'Passwords do not match');
    setPwLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword: curPw, newPassword: newPw });
      setCurPw(''); setNewPw(''); setConfPw('');
      flash(setPwMsg, 'success', 'Password changed successfully');
    } catch (err) {
      flash(setPwMsg, 'error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const saveSystem = (e) => {
    e.preventDefault();
    const rate = parseInt(ratePerLesson);
    if (!rate || rate < 1000) return flash(setSysMsg, 'error', 'Rate must be at least 1,000');
    localStorage.setItem('rate_per_lesson', String(rate));
    localStorage.setItem('center_name', centerName.trim());
    flash(setSysMsg, 'success', 'System settings saved');
  };

  const saveNotif = () => {
    localStorage.setItem('notif_prefs', JSON.stringify(notif));
    flash(setNotifMsg, 'success', 'Preferences saved');
  };

  const roleCls = {
    superadmin: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    admin:      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    teacher:    'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Appearance ── */}
      <Section iconKey="palette" title={t('set_appearance')}>
        <div className="p-5 space-y-4">
          {/* Dark mode */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Ic d={isDark ? ICONS.moon : ICONS.sun} className="w-4 h-4 text-gray-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{t('set_dark_mode')}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{t('set_dark_mode_desc')}</p>
              </div>
            </div>
            <Toggle checked={isDark} onChange={toggleTheme} />
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
            {/* Language */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Ic d={ICONS.globe} className="w-4 h-4 text-gray-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{t('set_language')}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('set_lang_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                {['en', 'uz', 'ru'].map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      lang === l
                        ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Profile ── */}
      <Section iconKey="user" title={t('set_profile')}>
        <div className="p-5">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{user?.name}</p>
              <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleCls[user?.role] || 'bg-gray-100 text-gray-600'}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <Alert type={profileMsg?.type} msg={profileMsg?.text} />
          <form onSubmit={saveProfile}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">{t('set_full_name')}</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="label">{t('set_email')}</label>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label className="label">{t('set_phone')}</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 000 00 00" />
              </div>
              <div>
                <label className="label">{t('set_role')}</label>
                <input className="input opacity-60 cursor-not-allowed capitalize" value={user?.role} disabled />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={profileLoading}>
                {profileLoading ? t('set_saving') : t('set_save')}
              </button>
            </div>
          </form>
        </div>
      </Section>

      {/* ── Password ── */}
      <Section iconKey="lock" title={t('set_password')}>
        <div className="p-5">
          <Alert type={pwMsg?.type} msg={pwMsg?.text} />
          <form onSubmit={changePassword}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">{t('set_cur_password')}</label>
                <PasswordField value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••" />
              </div>
              <div>
                <label className="label">{t('set_new_password')}</label>
                <PasswordField value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="min 6 chars" />
              </div>
              <div>
                <label className="label">{t('set_confirm_password')}</label>
                <PasswordField value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="repeat new" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={pwLoading}>
                {pwLoading ? t('set_saving') : t('set_update_password')}
              </button>
            </div>
          </form>
        </div>
      </Section>

      {/* ── System Settings ── */}
      {(user?.role === 'superadmin' || user?.role === 'admin') && (
        <Section iconKey="money" title={t('set_system')}>
          <div className="p-5">
            <Alert type={sysMsg?.type} msg={sysMsg?.text} />
            <form onSubmit={saveSystem}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">{t('set_rate_per_lesson')}</label>
                  <input type="number" className="input" value={ratePerLesson} onChange={e => setRatePerLesson(e.target.value)} placeholder="50000" />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('set_rate_hint')}</p>
                </div>
                <div>
                  <label className="label">{t('set_center_name')}</label>
                  <input className="input" value={centerName} onChange={e => setCenterName(e.target.value)} placeholder="EduCRM Learning Center" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary">{t('set_save_system')}</button>
              </div>
            </form>
          </div>
        </Section>
      )}

      {/* ── Notifications ── */}
      <Section iconKey="bell" title={t('set_notifications')}>
        <ToggleRow label={t('set_notif_payment')}    desc={t('set_notif_payment_desc')}    checked={!!notif.paymentDue}   onChange={v => setN('paymentDue', v)}   />
        <ToggleRow label={t('set_notif_student')}    desc={t('set_notif_student_desc')}    checked={!!notif.newStudent}   onChange={v => setN('newStudent', v)}   />
        <ToggleRow label={t('set_notif_attendance')} desc={t('set_notif_attendance_desc')} checked={!!notif.attendance}   onChange={v => setN('attendance', v)}   />
        <ToggleRow label={t('set_notif_weekly')}     desc={t('set_notif_weekly_desc')}     checked={!!notif.weeklyReport} onChange={v => setN('weeklyReport', v)} last />
        <div className="px-5 py-3 flex items-center justify-between border-t border-gray-50 dark:border-slate-700/50">
          {notifMsg && <Alert type={notifMsg.type} msg={notifMsg.text} />}
          <button type="button" onClick={saveNotif} className="btn-primary ml-auto">
            {t('set_save_prefs')}
          </button>
        </div>
      </Section>

    </div>
  );
};

export default Settings;
