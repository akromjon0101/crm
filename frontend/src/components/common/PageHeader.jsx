import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Reusable page header with title, subtitle, back button, and actions slot.
 *
 * Props:
 *  title       — main heading (required)
 *  subtitle    — secondary line (optional)
 *  back        — if provided, renders a back arrow button; can be a path string or true (uses navigate(-1))
 *  backLabel   — label next to back arrow (default: 'Back')
 *  actions     — React node rendered on the right side (buttons, filters, etc.)
 *  border      — show bottom border (default: true)
 */
const PageHeader = ({ title, subtitle, back, backLabel = 'Back', actions, border = true }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof back === 'string') navigate(back);
    else navigate(-1);
  };

  return (
    <div className={`flex items-start justify-between gap-4 mb-5 ${border ? 'pb-4 border-b border-gray-100 dark:border-slate-700/60' : ''}`}>
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <button
            onClick={handleBack}
            className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
