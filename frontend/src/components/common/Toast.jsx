import React, { useEffect } from 'react';

const COLORS = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50   border-red-200   text-red-800',
  info:    'bg-blue-50  border-blue-200  text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const ICONS = {
  success: 'M5 13l4 4L19 7',
  error:   'M6 18L18 6M6 6l12 12',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

/**
 * Toast notification component.
 * Auto-dismisses after `duration` ms (default 3500).
 *
 * Props:
 *   message  {string}   - Text to display
 *   type     {string}   - 'success' | 'error' | 'info' | 'warning'
 *   onClose  {function} - Called when toast should be dismissed
 *   duration {number}   - Auto-dismiss delay in ms (default 3500)
 *
 * Usage with useToast hook:
 *   const { toast, showToast, clearToast } = useToast();
 *   {toast && <Toast {...toast} onClose={clearToast} />}
 */
const Toast = ({ message, type = 'success', onClose, duration = 3500 }) => {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  if (!message) return null;

  const colorCls = COLORS[type] || COLORS.info;
  const iconPath = ICONS[type] || ICONS.info;

  return (
    <div
      className={`fixed bottom-6 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-fadeIn max-w-sm ${colorCls}`}
      role="alert"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
      </svg>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button
        onClick={onClose}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
