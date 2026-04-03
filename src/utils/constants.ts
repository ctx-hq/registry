// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_ANON = 180;
export const RATE_LIMIT_MAX_AUTH = 600;

// Sort field whitelist (query param → DB column)
// Use Map to avoid prototype pollution (e.g. "constructor", "__proto__")
export const SORT_FIELDS = new Map<string, string>([
  ["created", "created_at"],
  ["downloads", "downloads"],
  ["updated", "updated_at"],
  ["stars", "star_count"],
]);

// Pagination defaults
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
// Default high enough to avoid breaking clients that expect full member lists
export const DEFAULT_MEMBER_LIMIT = 200;
export const MAX_MEMBER_LIMIT = 200;

// CORS
export const CORS_ALLOWED_ORIGINS = new Set([
  "https://getctx.org",
  "https://www.getctx.org",
]);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (CORS_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// R2 migration
export const R2_MIGRATION_CONCURRENCY = 8;
