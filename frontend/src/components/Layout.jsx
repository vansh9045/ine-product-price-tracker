import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="app-shell flex gap-6">
        <Sidebar />

        <div className="flex-1">
          <div className="container">
            <div className="topbar">
              <Header title="Product Price Tracker" subtitle="Monitor product prices and availability over time." />
            </div>

            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
