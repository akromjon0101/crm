import React, { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../services/api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ROLE_LABEL = { admin: 'Admin', superadmin: 'CEO', teacher: 'Teacher', ceo: 'CEO' };

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)        return 'Just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── sub-components ──────────────────────────────────────────────────────── */
const StudentRow = ({ name, phone, group }) => (
  <div className="px-3.5 py-2 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
    <p className="text-xs font-semibold text-gray-900 dark:text-slate-200">{name}</p>
    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
      {group}{phone ? ` · ${phone}` : ''}
    </p>
  </div>
);

const SectionHead = ({ label, count, badgeCls, textCls }) => (
  <div className="flex items-center justify-between px-3.5 pt-2 pb-1">
    <span className={`text-[10px] font-bold uppercase tracking-widest ${textCls}`}>{label}</span>
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${badgeCls}`}>{count}</span>
  </div>
);

/* ── main component ──────────────────────────────────────────────────────── */
const NotificationBell = () => {
  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState('alerts');   // 'alerts' | 'messages'
  const [alertData,  setAlertData]  = useState(null);
  const [alertLoad,  setAlertLoad]  = useState(false);
  const [inbox,      setInbox]      = useState(null);       // { messages, unread_count }
  const [msgLoad,    setMsgLoad]    = useState(false);
  const [composing,  setComposing]  = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [form,       setForm]       = useState({ recipient_id: '', subject: '', body: '' });
  const [sending,    setSending]    = useState(false);
  const [sendErr,    setSendErr]    = useState('');
  const [sendOk,     setSendOk]     = useState(false);
  const [viewMsg,    setViewMsg]    = useState(null);       // message being read
  const ref = useRef(null);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* load system alerts */
  const loadAlerts = useCallback(async () => {
    if (alertData) return;
    setAlertLoad(true);
    try {
      const r = await api.get('/notifications');
      setAlertData(r.data);
    } catch { /* ignore */ }
    finally { setAlertLoad(false); }
  }, [alertData]);

  /* load inbox */
  const loadInbox = useCallback(async () => {
    if (inbox) return;
    setMsgLoad(true);
    try {
      const r = await api.get('/messages');
      setInbox(r.data);
    } catch { /* ignore */ }
    finally { setMsgLoad(false); }
  }, [inbox]);

  /* load recipients for compose */
  const loadRecipients = useCallback(async () => {
    if (recipients.length) return;
    try {
      const r = await api.get('/messages/recipients');
      setRecipients(r.data.recipients || []);
    } catch { /* ignore */ }
  }, [recipients]);

  /* reset cache every 5 min */
  useEffect(() => {
    const id = setInterval(() => { setAlertData(null); setInbox(null); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadAlerts();
      loadInbox();
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setComposing(false);
    setViewMsg(null);
    if (t === 'messages') loadInbox();
    if (t === 'alerts')   loadAlerts();
  };

  /* open compose */
  const openCompose = () => {
    setComposing(true);
    setViewMsg(null);
    setSendErr('');
    setSendOk(false);
    setForm({ recipient_id: '', subject: '', body: '' });
    loadRecipients();
  };

  /* open a message to read it */
  const openMessage = async (msg) => {
    setViewMsg(msg);
    setComposing(false);
    if (!msg.is_read) {
      try {
        await api.patch(`/messages/${msg.id}/read`);
        setInbox(prev => prev ? {
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1),
          messages: prev.messages.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m),
        } : prev);
      } catch { /* ignore */ }
    }
  };

  /* send */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.recipient_id) return setSendErr('Please select a recipient.');
    if (!form.body.trim())  return setSendErr('Message cannot be empty.');
    setSending(true);
    setSendErr('');
    try {
      await api.post('/messages', {
        recipient_id: Number(form.recipient_id),
        subject: form.subject || undefined,
        body: form.body,
      });
      setSendOk(true);
      setTimeout(() => { setComposing(false); setSendOk(false); }, 1500);
    } catch (err) {
      setSendErr(err?.response?.data?.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  /* mark all read */
  const markAllRead = async () => {
    try {
      await api.patch('/messages/read-all');
      setInbox(prev => prev ? {
        ...prev,
        unread_count: 0,
        messages: prev.messages.map(m => ({ ...m, is_read: 1 })),
      } : prev);
    } catch { /* ignore */ }
  };

  /* badge counts */
  const totalDebtors = alertData?.debtors?.length ?? 0;
  const totalUnpaid  = alertData?.unpaid?.length  ?? 0;
  const totalAlerts  = totalDebtors + totalUnpaid;
  const unreadMsgs   = inbox?.unread_count ?? 0;
  const totalBadge   = totalAlerts + unreadMsgs;

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div ref={ref} className="relative flex-shrink-0">

      {/* Bell button */}
      <button
        onClick={handleOpen}
        title="Notifications"
        className={`w-[34px] h-[34px] rounded-lg border flex items-center justify-center relative transition-colors cursor-pointer
          ${open
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full px-[3px] flex items-center justify-center border-2 border-white dark:border-slate-900">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[min(320px,calc(100vw-1rem))] max-h-[70vh] sm:max-h-[480px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-modal z-50 overflow-hidden flex flex-col animate-fadeIn">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-slate-700">
            <button
              onClick={() => switchTab('alerts')}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer
                ${tab === 'alerts'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-px'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Alerts
              {totalAlerts > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{totalAlerts}</span>
              )}
            </button>
            <button
              onClick={() => switchTab('messages')}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer
                ${tab === 'messages'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 -mb-px'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Messages
              {unreadMsgs > 0 && (
                <span className="bg-primary-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadMsgs}</span>
              )}
            </button>
          </div>

          {/* ── ALERTS TAB ─────────────────────────────────────────────────── */}
          {tab === 'alerts' && (
            <>
              {/* date label */}
              {alertData && (
                <div className="px-3.5 py-1.5 border-b border-gray-50 dark:border-slate-700/60">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                    {MONTH_NAMES[(alertData.month || 1) - 1]} {alertData.year}
                  </span>
                </div>
              )}
              <div className="overflow-y-auto flex-1">
                {alertLoad ? (
                  <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">Loading…</p>
                ) : !alertData ? (
                  <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">Unable to load</p>
                ) : totalAlerts === 0 ? (
                  <div className="py-7 text-center">
                    <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-2.5 text-base">✓</div>
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-slate-100">All good!</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">No payment issues this month</p>
                  </div>
                ) : (
                  <>
                    {totalDebtors > 0 && (
                      <div>
                        <SectionHead label="Debtors" count={totalDebtors} textCls="text-red-500 dark:text-red-400" badgeCls="bg-red-500" />
                        {alertData.debtors.map(s => <StudentRow key={`d-${s.id}`} name={s.name} phone={s.phone} group={s.group_name} />)}
                      </div>
                    )}
                    {totalUnpaid > 0 && (
                      <div>
                        <SectionHead label={`Unpaid — ${MONTH_NAMES[(alertData.month || 1) - 1]}`} count={totalUnpaid} textCls="text-amber-500 dark:text-amber-400" badgeCls="bg-amber-500" />
                        {alertData.unpaid.map(s => <StudentRow key={`u-${s.id}`} name={s.name} phone={s.phone} group={s.group_name} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => { setAlertData(null); loadAlerts(); }}
                className="px-3.5 py-2 text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors w-full text-center cursor-pointer"
              >
                Refresh
              </button>
            </>
          )}

          {/* ── MESSAGES TAB ───────────────────────────────────────────────── */}
          {tab === 'messages' && (
            <>
              {/* Messages header toolbar */}
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100 dark:border-slate-700">
                {composing ? (
                  <button onClick={() => setComposing(false)} className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                ) : viewMsg ? (
                  <button onClick={() => setViewMsg(null)} className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Inbox
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">Inbox</span>
                )}
                <div className="flex items-center gap-1.5">
                  {!composing && !viewMsg && unreadMsgs > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {!composing && !viewMsg && (
                    <button
                      onClick={openCompose}
                      className="flex items-center gap-1 text-[11px] bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Compose
                    </button>
                  )}
                </div>
              </div>

              {/* Compose form */}
              {composing && (
                <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                    <div>
                      <label className="label">To</label>
                      <select
                        value={form.recipient_id}
                        onChange={e => setForm(f => ({ ...f, recipient_id: e.target.value }))}
                        className="input text-sm"
                        required
                      >
                        <option value="">Select recipient…</option>
                        {recipients.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({ROLE_LABEL[r.role] || r.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Subject <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                      <input
                        type="text"
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Brief subject…"
                        className="input text-sm"
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label className="label">Message</label>
                      <textarea
                        value={form.body}
                        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Write your message…"
                        className="input text-sm resize-none"
                        rows={4}
                        required
                        maxLength={2000}
                      />
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 text-right mt-0.5">{form.body.length}/2000</p>
                    </div>
                    {sendErr && <p className="text-[11px] text-red-500 dark:text-red-400">{sendErr}</p>}
                    {sendOk  && <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold">✓ Message sent!</p>}
                  </div>
                  <div className="px-3.5 py-2.5 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <button
                      type="submit"
                      disabled={sending}
                      className="btn-primary btn-sm w-full"
                    >
                      {sending ? 'Sending…' : 'Send Message'}
                    </button>
                  </div>
                </form>
              )}

              {/* View single message */}
              {!composing && viewMsg && (
                <div className="flex-1 overflow-y-auto p-3.5">
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                      {viewMsg.subject || '(no subject)'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                      From: <span className="font-medium">{viewMsg.sender_name}</span>
                      {' '}· {ROLE_LABEL[viewMsg.sender_role] || viewMsg.sender_role}
                      {' '}· {timeAgo(viewMsg.created_at)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                    {viewMsg.body}
                  </p>
                </div>
              )}

              {/* Inbox list */}
              {!composing && !viewMsg && (
                <>
                  <div className="overflow-y-auto flex-1">
                    {msgLoad ? (
                      <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">Loading…</p>
                    ) : !inbox ? (
                      <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">Unable to load</p>
                    ) : inbox.messages.length === 0 ? (
                      <div className="py-7 text-center">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400 flex items-center justify-center mx-auto mb-2.5">
                          <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-slate-100">No messages</p>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Your inbox is empty</p>
                      </div>
                    ) : (
                      inbox.messages.map(msg => (
                        <button
                          key={msg.id}
                          onClick={() => openMessage(msg)}
                          className={`w-full text-left px-3.5 py-2.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer
                            ${!msg.is_read ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0 mt-0.5" />}
                              <p className={`text-xs truncate ${!msg.is_read ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-medium text-gray-700 dark:text-slate-300'}`}>
                                {msg.sender_name}
                              </p>
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                {ROLE_LABEL[msg.sender_role] || msg.sender_role}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{timeAgo(msg.created_at)}</span>
                          </div>
                          {msg.subject && (
                            <p className="text-[11px] text-gray-600 dark:text-slate-300 mt-0.5 truncate">{msg.subject}</p>
                          )}
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{msg.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => { setInbox(null); loadInbox(); }}
                    className="px-3.5 py-2 text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors w-full text-center cursor-pointer"
                  >
                    Refresh
                  </button>
                </>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
};

export default NotificationBell;
