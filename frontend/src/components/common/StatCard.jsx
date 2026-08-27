import React from 'react';

const COLOR_MAP = {
  primary: {
    accent: '#2563EB',
    iconBg: 'bg-primary-100 dark:bg-primary-900/30',
    iconText: 'text-primary-600 dark:text-primary-400',
    shadow: 'rgba(37,99,235,0.15)',
    decor: 'bg-primary-400/10',
  },
  indigo: {
    accent: '#2563EB',
    iconBg: 'bg-primary-100 dark:bg-primary-900/30',
    iconText: 'text-primary-600 dark:text-primary-400',
    shadow: 'rgba(37,99,235,0.15)',
    decor: 'bg-primary-400/10',
  },
  purple: {
    accent: '#7C3AED',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconText: 'text-violet-600 dark:text-violet-400',
    shadow: 'rgba(124,58,237,0.15)',
    decor: 'bg-violet-400/10',
  },
  green: {
    accent: '#16A34A',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    shadow: 'rgba(22,163,74,0.12)',
    decor: 'bg-emerald-400/10',
  },
  blue: {
    accent: '#0284C7',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconText: 'text-sky-600 dark:text-sky-400',
    shadow: 'rgba(2,132,199,0.12)',
    decor: 'bg-sky-400/10',
  },
  orange: {
    accent: '#D97706',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    shadow: 'rgba(217,119,6,0.12)',
    decor: 'bg-amber-400/10',
  },
  red: {
    accent: '#DC2626',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
    shadow: 'rgba(220,38,38,0.12)',
    decor: 'bg-red-400/10',
  },
  teal: {
    accent: '#0D9488',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconText: 'text-teal-600 dark:text-teal-400',
    shadow: 'rgba(13,148,136,0.12)',
    decor: 'bg-teal-400/10',
  },
};

const StatCard = ({ title, value, subtitle, icon, color = 'primary', trend }) => {
  const c = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <div
      className="card p-5 relative overflow-hidden hover:-translate-y-0.5"
      style={{
        borderTop: `3px solid ${c.accent}`,
        boxShadow: `0 2px 8px ${c.shadow}, 0 1px 3px rgba(0,0,0,0.04)`,
      }}
    >
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full ${c.decor} pointer-events-none`} />

      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 leading-tight">
            {title}
          </p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums mt-1.5 leading-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend != null && (
            <p className={`text-xs font-semibold mt-1.5 ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl ${c.iconBg} ${c.iconText} flex items-center justify-center flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
