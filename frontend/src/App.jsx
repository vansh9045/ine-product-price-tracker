import { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message ?? 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

function formatPrice(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasQuery = useMemo(() => query.trim().length > 0, [query]);

  async function searchProducts() {
    if (!hasQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = await apiFetch(`/products/search?q=${encodeURIComponent(query)}`);
      setResults(payload.data.products ?? []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrackedProducts() {
    try {
      const payload = await apiFetch('/tracked-products');
      setTrackedProducts(payload.data.products ?? []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function trackProduct(productId) {
    setError('');
    try {
      await apiFetch('/tracked-products', {
        method: 'POST',
        body: JSON.stringify({ storeProductId: productId }),
      });
      await loadTrackedProducts();
      setResults((current) => current.filter((product) => product.id !== productId));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshProduct(productId) {
    setError('');
    try {
      await apiFetch(`/tracked-products/${productId}/refresh`, { method: 'POST' });
      await loadTrackedProducts();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeProduct(productId) {
    setError('');
    try {
      await apiFetch(`/tracked-products/${productId}`, { method: 'DELETE' });
      await loadTrackedProducts();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">INE track</p>
          <h1>Product price tracker</h1>
        </div>
      </header>

      <section className="panel search-panel">
        <div className="search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
          />
          <button onClick={searchProducts} disabled={!hasQuery || loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {results.length > 0 && (
          <div className="results-list">
            {results.map((product) => (
              <div key={product.id} className="result-card">
                <div>
                  <strong>{product.name}</strong>
                  <p>{product.brand}</p>
                </div>
                <button onClick={() => trackProduct(product.id)}>Track</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel tracked-panel">
        <h2>Tracked products</h2>

        {trackedProducts.length === 0 ? (
          <p className="empty">No products tracked yet.</p>
        ) : (
          <div className="tracked-list">
            {trackedProducts.map((product) => (
              <article key={product.id} className="tracked-card">
                <div>
                  <h3>{product.product_name}</h3>
                  <p>Current price: {formatPrice(product.current_price)}</p>
                  <p>Stock: {product.current_stock ?? 'unknown'}</p>
                </div>

                <div className="actions">
                  <button onClick={() => refreshProduct(product.id)}>Refresh</button>
                  <button className="danger" onClick={() => removeProduct(product.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
