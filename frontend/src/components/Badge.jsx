import React from 'react';

export default function Badge({ children, status = 'neutral', className = '' }) {
  const base = 'inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full';
  const styles = {
    success: 'bg-emerald-600 text-emerald-50',
    danger: 'bg-rose-600 text-rose-50',
    neutral: 'bg-slate-700 text-slate-100',
  };

  return <span className={`${base} ${styles[status] ?? styles.neutral} ${className}`}>{children}</span>;
}
