import type { Context, Next } from "hono";
import type { Bindings } from "../bindings";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 180; // per minute for anonymous

export async function rateLimitMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `rl:${ip}`;

  const current = await c.env.CACHE.get(key);
  const count = current ? (parseInt(current) || 0) : 0;

  if (count >= MAX_REQUESTS) {
    c.header("Retry-After", "60");
    c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
    c.header("X-RateLimit-Remaining", "0");
    return c.json({ error: "rate_limited", message: "Too many requests" }, 429);
  }

  await c.env.CACHE.put(key, String(count + 1), { expirationTtl: WINDOW_MS / 1000 });

  c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
  c.header("X-RateLimit-Remaining", String(MAX_REQUESTS - count - 1));

  await next();
}
