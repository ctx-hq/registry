import type { Context, Next } from "hono";
import type { Bindings } from "../bindings";
import { hashToken } from "../services/auth";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_ANON = 180;
const MAX_REQUESTS_AUTH = 600;

export async function rateLimitMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  let maxRequests = MAX_REQUESTS_ANON;

  // Authenticated users get a higher limit (validated via token hash)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const tokenHash = await hashToken(token);
    const valid = await c.env.DB.prepare(
      "SELECT 1 FROM api_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).bind(tokenHash).first();
    if (valid) {
      maxRequests = MAX_REQUESTS_AUTH;
    }
  }

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `rl:${ip}`;

  const current = await c.env.CACHE.get(key);
  const count = current ? (parseInt(current) || 0) : 0;

  if (count >= maxRequests) {
    c.header("Retry-After", "60");
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", "0");
    return c.json({ error: "rate_limited", message: "Too many requests" }, 429);
  }

  await c.env.CACHE.put(key, String(count + 1), { expirationTtl: WINDOW_MS / 1000 });

  c.header("X-RateLimit-Limit", String(maxRequests));
  c.header("X-RateLimit-Remaining", String(maxRequests - count - 1));

  await next();
}
