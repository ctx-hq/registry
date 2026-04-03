// Cache API abstraction for high-frequency counters (rate limiting).
// Uses CF Cache API instead of KV to avoid KV daily write quota limits.
// Per-colo approximate counting is acceptable for rate limiting.

const CACHE_PREFIX = "https://rate-limit.internal/";

function cacheUrl(key: string): string {
  return CACHE_PREFIX + encodeURIComponent(key);
}

export async function getCacheCounter(key: string): Promise<number> {
  const cache = caches.default;
  const res = await cache.match(cacheUrl(key));
  if (!res) return 0;
  const text = await res.text();
  return parseInt(text) || 0;
}

export async function setCacheCounter(key: string, value: number, ttlSeconds: number): Promise<void> {
  const cache = caches.default;
  const res = new Response(String(value), {
    headers: { "Cache-Control": `s-maxage=${ttlSeconds}` },
  });
  await cache.put(cacheUrl(key), res);
}
