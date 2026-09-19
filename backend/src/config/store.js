export const storeConfig = {
  baseUrl: (process.env.STORE_BASE_URL ?? 'https://demo.inelabteamdev.com').replace(/\/$/, ''),
  catalogCacheTtlMs: 5 * 60 * 1000,
  requestTimeoutMs: 15_000,
};
