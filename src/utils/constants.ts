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
