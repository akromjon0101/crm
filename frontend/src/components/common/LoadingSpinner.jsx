import React from 'react';

const LoadingSpinner = ({ size = 'md', text }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className={`${sizes[size]} border-4 border-gray-200 dark:border-slate-700 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin`} />
      {text && <p className="text-sm text-gray-500 dark:text-slate-400">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
