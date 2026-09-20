import React from 'react';

export default function Header({ title, subtitle }) {
  return (
    <header className="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 mt-1 text-sm">{subtitle}</p>}
      </div>

      <div className="hidden sm:flex items-center gap-3">
        {/* reserved for future actions */}
      </div>
    </header>
  );
}
