import type { Context, Next } from "hono";
import type { Bindings } from "../bindings";
import { hashToken } from "../services/auth";
import { getCacheCounter, setCacheCounter } from "../utils/cache";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ANON, RATE_LIMIT_MAX_AUTH } from "../utils/constants";

export async function rateLimitMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let maxRequests = RATE_LIMIT_MAX_ANON;
    let rateLimitKey: string;

    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    rateLimitKey = `rl:ip:${ip}`;

    // Authenticated users get a higher limit, keyed by user_id (not token)
    // to prevent quota amplification via multiple tokens
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenHash = await hashToken(token);
      const row = await c.env.DB.prepare(
        "SELECT user_id FROM api_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
      ).bind(tokenHash).first<{ user_id: string }>();
      if (row) {
        maxRequests = RATE_LIMIT_MAX_AUTH;
        rateLimitKey = `rl:user:${row.user_id}`;
      }
    }

    const count = await getCacheCounter(rateLimitKey);

    if (count >= maxRequests) {
      c.header("Retry-After", "60");
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      return c.json({ error: "rate_limited", message: "Too many requests" }, 429);
    }

    void setCacheCounter(rateLimitKey, count + 1, RATE_LIMIT_WINDOW_MS / 1000);

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(maxRequests - count - 1));
  } catch (err) {
    // Fail-open: if Cache API/DB is unavailable, skip rate limiting rather than
    // blocking all requests. Set conservative headers so clients stay informed.
    console.error("Rate limit middleware error (fail-open):", err);
    c.header("X-RateLimit-Limit", String(RATE_LIMIT_MAX_ANON));
    c.header("X-RateLimit-Remaining", String(RATE_LIMIT_MAX_ANON));
  }

  await next();
}
