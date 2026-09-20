import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout';
import Card from './components/Card';
import EmptyState from './components/EmptyState';
import SearchBar from './components/SearchBar';
import TrackedProductCard from './components/TrackedProductCard';
import Button from './components/Button';
import Badge from './components/Badge';
import TrackedProductDetail from './components/TrackedProductDetail';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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
  const [trackingIds, setTrackingIds] = useState([]);
  const [refreshingIds, setRefreshingIds] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);

  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [detailReloadSignal, setDetailReloadSignal] = useState(0);
  const [openDetailId, setOpenDetailId] = useState(null);

  const [view, setView] = useState('dashboard');

  const hasQuery = useMemo(
    () => query.trim().length > 0,
    [query]
  );

  useEffect(() => {
    if (!status) return;

    const timer = setTimeout(() => {
      setStatus('');
    }, 3500);

    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
    }
  }, [hasQuery]);

  async function searchProducts() {
    if (!hasQuery) {
      setResults([]);
      setView('dashboard');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = await apiFetch(
        `/products/search?q=${encodeURIComponent(query)}`
      );

      setResults(payload.data.products ?? []);
      setView('search');
      setOpenDetailId(null);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
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
    setStatus('');

    const already = trackedProducts.some(
      (product) =>
        Number(product.store_product_id) === Number(productId)
    );

    if (already) {
      setError('This product is already tracked.');
      return;
    }

    setTrackingIds((ids) => [...ids, productId]);

    try {
      await apiFetch('/tracked-products', {
        method: 'POST',
        body: JSON.stringify({
          storeProductId: productId,
        }),
      });

      await loadTrackedProducts();

      setResults((current) =>
        current.filter((product) => product.id !== productId)
      );

      setStatus('Tracked product successfully');
    } catch (requestError) {
      setError(
        requestError.message || 'Failed to track product.'
      );
      setStatus('');
    } finally {
      setTrackingIds((ids) =>
        ids.filter((id) => id !== productId)
      );
    }
  }

  async function refreshProduct(productId) {
    setError('');
    setStatus('');

    if (refreshingIds.includes(productId)) return;

    setRefreshingIds((ids) => [...ids, productId]);

    try {
      await apiFetch(
        `/tracked-products/${productId}/refresh`,
        {
          method: 'POST',
        }
      );

      await loadTrackedProducts();

      if (openDetailId === productId) {
        setDetailReloadSignal((signal) => signal + 1);
      }

      setStatus('Refresh complete');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('Refresh failed');

      throw requestError;
    } finally {
      setRefreshingIds((ids) =>
        ids.filter((id) => id !== productId)
      );
    }
  }

  async function removeProduct(productId) {
    setError('');
    setStatus('');

    if (deletingIds.includes(productId)) return;

    const ok = window.confirm(
      'Remove this tracked product? This will stop tracking and delete stored data.'
    );

    if (!ok) return;

    setDeletingIds((ids) => [...ids, productId]);

    try {
      await apiFetch(`/tracked-products/${productId}`, {
        method: 'DELETE',
      });

      await loadTrackedProducts();

      if (openDetailId === productId) {
        setOpenDetailId(null);
      }

      setStatus('Removed tracked product');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('Remove failed');

      throw requestError;
    } finally {
      setDeletingIds((ids) =>
        ids.filter((id) => id !== productId)
      );
    }
  }

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  // -------------------------
  // Navigation
  // -------------------------

  function goToDashboard() {
    setQuery('');
    setResults([]);
    setError('');
    setOpenDetailId(null);
    setStatus('');
    setView('dashboard');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function goToTrackedProducts() {
    setQuery('');
    setResults([]);
    setError('');
    setOpenDetailId(null);
    setStatus('');
    setView('tracked');

    setTimeout(() => {
      document
        .querySelector('.tracked-panel')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 50);
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setError('');
    setOpenDetailId(null);
    setStatus('');
    setView('dashboard');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function openProductDetail(productId) {
    setOpenDetailId(productId);

    setTimeout(() => {
      document
        .querySelector('.detail-panel')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 50);
  }

  return (
    <Layout
      onDashboard={goToDashboard}
      onTrackedProducts={goToTrackedProducts}
    >
      {/* =========================
          SEARCH
      ========================== */}
      <section className="search-panel">
        <Card>
          <SearchBar
            query={query}
            setQuery={setQuery}
            onSearch={searchProducts}
            loading={loading}
          />

          {error && (
            <p className="error mt-3 text-rose-400">
              {error}
            </p>
          )}
        </Card>

        {/* =========================
            SEARCH RESULTS
        ========================== */}
        {view === 'search' && results.length > 0 ? (
          <Card className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                ← Back to Dashboard
              </button>

              <span className="text-sm text-slate-400">
                {results.length}{' '}
                {results.length === 1
                  ? 'product'
                  : 'products'}{' '}
                found
              </span>
            </div>

            <div className="results-list">
              {results.map((product) => (
                <div
                  key={product.id}
                  className="result-card"
                >
                  <div className="flex items-center gap-4">
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-16 w-16 rounded-md object-cover"
                      />
                    )}

                    <div>
                      <div className="font-semibold">
                        {product.name}
                      </div>

                      {product.brand && (
                        <div className="text-sm text-slate-400">
                          {product.brand}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        {typeof product.price !==
                          'undefined' && (
                            <div className="text-lg font-bold">
                              {formatPrice(product.price)}
                            </div>
                          )}

                        {product.stock ||
                          product.current_stock ? (
                          <Badge
                            status={
                              (product.stock &&
                                product.stock > 0) ||
                                product.current_stock ===
                                'in_stock'
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {String(
                              product.stock ??
                              product.current_stock
                            )}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() =>
                        trackProduct(product.id)
                      }
                      variant="primary"
                      disabled={trackingIds.includes(
                        product.id
                      )}
                    >
                      {trackingIds.includes(product.id)
                        ? 'Tracking…'
                        : 'Track'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : view === 'dashboard' ? (
          <Card className="mt-4">
            <EmptyState
              title="Search for products"
              description="Use the search box above to find store products to track."
            />
          </Card>
        ) : null}
      </section>

      {/* =========================
          PRODUCT DETAIL
          Moved ABOVE tracked products
      ========================== */}
      {openDetailId && (
        <section className="detail-panel mt-6">
          <Card>
            <TrackedProductDetail
              id={openDetailId}
              onClose={() => {
                setOpenDetailId(null);
                loadTrackedProducts();

                setTimeout(() => {
                  document
                    .querySelector('.tracked-panel')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                }, 50);
              }}
              reloadSignal={detailReloadSignal}
              onRefresh={refreshProduct}
              refreshing={refreshingIds.includes(
                openDetailId
              )}
            />
          </Card>
        </section>
      )}

      {/* =========================
          TRACKED PRODUCTS
      ========================== */}
      <section className="tracked-panel mt-6">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Tracked products
            </h2>

            {query && (
              <button
                type="button"
                onClick={goToTrackedProducts}
                className="text-sm text-slate-400 transition hover:text-white"
              >
                Clear search
              </button>
            )}
          </div>

          {trackedProducts.length === 0 ? (
            <EmptyState
              title="No tracked products"
              description="You haven't added any products to track yet."
            />
          ) : (
            <div className="tracked-list">
              {trackedProducts.map((product) => (
                <TrackedProductCard
                  key={product.id}
                  product={product}
                  onRefresh={refreshProduct}
                  onRemove={removeProduct}
                  onOpen={openProductDetail}
                  refreshing={refreshingIds.includes(
                    product.id
                  )}
                  deleting={deletingIds.includes(
                    product.id
                  )}
                />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* =========================
          STATUS TOAST
      ========================== */}
      {status && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-slate-800 px-4 py-2 text-white shadow-lg">
          {status}
        </div>
      )}
    </Layout>
  );
}