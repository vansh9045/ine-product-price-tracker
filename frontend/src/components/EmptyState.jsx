import React from 'react';

export default function EmptyState({ title, description }) {
  return (
    <div className="text-center py-8">
      <div className="text-lg font-semibold text-slate-100">{title}</div>
      {description && <p className="text-slate-400 mt-2">{description}</p>}
    </div>
  );
}
