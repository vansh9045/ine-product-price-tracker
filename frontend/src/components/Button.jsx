import React from 'react';

export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const variants = {
    primary: 'bg-sky-600 text-white hover:bg-sky-500 focus:ring-sky-500',
    subtle: 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 focus:ring-sky-500',
    neutral: 'bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-sky-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-500',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
