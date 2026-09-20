import React from 'react';
import Button from './Button';

export default function SearchBar({ query, setQuery, onSearch, loading }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="sr-only">Search products</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input
            className="w-full bg-transparent border border-slate-700 rounded-md px-10 py-2 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-sky-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name or SKU"
            aria-label="Search products"
          />
        </div>
      </div>

      <div>
        <Button onClick={onSearch} disabled={!query.trim() || loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>
    </div>
  );
}
