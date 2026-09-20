import React from 'react';
import Button from './Button';
import Badge from './Badge';

function stockStatus(status) {
  if (!status) return { label: 'Unknown', kind: 'neutral' };
  const s = String(status).toLowerCase();
  if (s.includes('in_stock') || s.includes('in stock') || s === 'in_stock') return { label: 'In Stock', kind: 'success' };
  return { label: 'Out of Stock', kind: 'danger' };
}

export default function TrackedProductCard({ product, onRefresh, onRemove, onOpen, refreshing = false, deleting = false }) {
  const stock = stockStatus(product.current_stock);

  return (
    <div className="tracked-item p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            <button className="hover:underline" onClick={() => onOpen?.(product.id)}>{product.product_name}</button>
          </h3>

          <div className="mt-2 flex items-center gap-4">
            <div className="text-2xl font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.current_price)}</div>
            <Badge status={stock.kind}>{stock.label}</Badge>
          </div>

          <div className="mt-2 text-sm text-slate-400">Last scraped • {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleString() : '—'}</div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <Button variant="subtle" onClick={() => onRefresh(product.id)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
          <Button variant="danger" onClick={() => onRemove(product.id)} disabled={deleting}>{deleting ? 'Removing…' : 'Remove'}</Button>
        </div>
      </div>
    </div>
  );
}
