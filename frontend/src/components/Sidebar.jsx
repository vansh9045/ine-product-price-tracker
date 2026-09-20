import React from 'react';
import Button from './Button';

function NavItem({ children, active }) {
  return (
    <li>
      <button className={`w-full text-left py-2 px-3 rounded-md ${active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'} focus:outline-none focus:ring-2 focus:ring-sky-500`}>
        {children}
      </button>
    </li>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-56 md:w-64 pr-6 hidden md:block">
      <div className="sticky top-6">
        <div className="mb-6">
          <div className="text-sm font-semibold text-slate-300">INE TRACK</div>
          <h2 className="text-lg font-bold text-white">Product Price Tracker</h2>
        </div>

        <nav>
          <ul className="space-y-2">
            <NavItem active>Dashboard</NavItem>
            <NavItem>Tracked Products</NavItem>
          </ul>
        </nav>

        <div className="mt-6">
          <Button variant="neutral" size="sm">New tracked product</Button>
        </div>
      </div>
    </aside>
  );
}
