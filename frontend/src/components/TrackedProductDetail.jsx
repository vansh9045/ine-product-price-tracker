import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import Button from './Button';
import Card from './Card';
import EmptyState from './EmptyState';
import Badge from './Badge';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed');
  }
  return payload;
}

function PriceChart({ data }) {
  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400">No chart data</div>;

  // Map data to chart-friendly points (ascending by time)
  const points = [...data]
    .map((d) => ({
      time: new Date(d.scraped_at).toLocaleString(),
      price: d.price,
    }))
    .reverse();

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)} />
          <Tooltip formatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)} />
          <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrackedProductDetail({ id, onClose, reloadSignal = 0, onRefresh, refreshing = false }) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState(null);
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const p = await apiFetch(`/tracked-products/${id}`);
        const h = await apiFetch(`/tracked-products/${id}/history`);
        const l = await apiFetch(`/tracked-products/${id}/logs`);
        if (!mounted) return;
        setProduct(p.data.product);
        setHistory(h.data.history);
        setLogs(l.data.logs);
      } catch (err) {
        setError(err.message || 'Failed to load product detail');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [id, reloadSignal]);

  async function handleRefresh() {
    if (!onRefresh) return;
    try {
      await onRefresh(id);
    } catch (err) {
      // onRefresh will surface errors via App error state
    }
  }

  if (loading) return <Card><div className="p-4">Loading…</div></Card>;

  if (error) return (
    <Card>
      <div className="p-4">
        <p className="text-rose-400">{error}</p>
        <div className="mt-3">
          <Button onClick={onClose}>Back</Button>
        </div>
      </div>
    </Card>
  );

  if (!product) return <Card><EmptyState title="Product not found" description="The requested tracked product does not exist." /></Card>;

  const stock = product.current_stock ? (String(product.current_stock).toLowerCase().includes('in_stock') ? 'In Stock' : 'Out of Stock') : 'Unknown';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{product.product_name}</h2>
          <div className="text-sm text-slate-400">{product.product_url}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={product.is_active ? 'success' : 'neutral'}>{product.is_active ? 'Active' : 'Paused'}</Badge>
          <Button onClick={handleRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
          <Button onClick={onClose}>Back</Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{product.current_price == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.current_price)}</div>
              <div className="text-sm text-slate-400">Last scraped • {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleString() : '—'}</div>
            </div>
            <div>
              <Badge status={product.current_stock && String(product.current_stock).toLowerCase().includes('in_stock') ? 'success' : 'danger'}>{stock}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Price History</h3>
          {history && history.length > 0 ? (
            <div>
              <PriceChart data={history} />
              <div className="mt-3 overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="pb-2">Timestamp</th>
                      <th className="pb-2">Price</th>
                      <th className="pb-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-slate-700">
                        <td className="py-2">{new Date(h.scraped_at).toLocaleString()}</td>
                        <td className="py-2">{h.price == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(h.price)}</td>
                        <td className="py-2">{h.stock_status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState title="No price history" description="This product has no recorded price history yet." />
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-2">Scrape Logs</h3>
          {logs && logs.length > 0 ? (
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-2">Started</th>
                    <th className="pb-2">Attempt</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Duration (ms)</th>
                    <th className="pb-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-700">
                      <td className="py-2">{new Date(log.started_at).toLocaleString()}</td>
                      <td className="py-2">{log.attempt_number}</td>
                      <td className={`py-2 ${log.status === 'success' ? 'text-green-400' : log.status === 'failed' ? 'text-rose-400' : 'text-yellow-300'}`}>{log.status}</td>
                      <td className="py-2">{log.duration_ms ?? '—'}</td>
                      <td className="py-2">{log.error_message ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No scrape logs" description="No scrape attempts recorded for this product yet." />
          )}
        </Card>
      </div>
    </div>
  );
}
