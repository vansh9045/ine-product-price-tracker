import React from 'react';

export default function Card({ children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {children}
    </div>
  );
}
