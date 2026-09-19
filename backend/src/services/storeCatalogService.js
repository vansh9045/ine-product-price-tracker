import axios from 'axios';

import { storeConfig } from '../config/store.js';

const storeClient = axios.create({
  baseURL: storeConfig.baseUrl,
  timeout: storeConfig.requestTimeoutMs,
});

let catalogCache = null;

async function getCatalogPage(page) {
  const { data } = await storeClient.get('/api/catalog', {
    params: { page, pageSize: 60 },
  });

  if (!Array.isArray(data?.items) || !Number.isInteger(data?.pages)) {
    throw new Error('The store catalog response has an unexpected format.');
  }

  return data;
}

async function getFullCatalog() {
  const now = Date.now();

  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.items;
  }

  const firstPage = await getCatalogPage(1);
  const remainingPages = Array.from({ length: firstPage.pages - 1 }, (_, index) => index + 2);
  const remainingItems = [];

  // A small batch size avoids overwhelming an intentionally unreliable demo store.
  for (let index = 0; index < remainingPages.length; index += 3) {
    const pageBatch = remainingPages.slice(index, index + 3);
    const pages = await Promise.all(pageBatch.map(getCatalogPage));
    remainingItems.push(...pages.flatMap((page) => page.items));
  }

  const itemsById = new Map(
    [...firstPage.items, ...remainingItems].map((product) => [product.id, product]),
  );
  const items = [...itemsById.values()];
  catalogCache = {
    items,
    expiresAt: now + storeConfig.catalogCacheTtlMs,
  };

  return items;
}

export async function searchStoreProducts(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const products = await getFullCatalog();

  return products
    .filter((product) => product.name.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, 20)
    .map((product) => ({
      ...product,
      productUrl: `${storeConfig.baseUrl}/product/${product.id}`,
    }));
}

export async function getStoreProductById(productId) {
  const { data } = await storeClient.get(`/api/product/${productId}`);

  if (!Number.isInteger(data?.id) || typeof data?.name !== 'string') {
    throw new Error('The store product response has an unexpected format.');
  }

  return {
    ...data,
    productUrl: `${storeConfig.baseUrl}/product/${data.id}`,
  };
}
