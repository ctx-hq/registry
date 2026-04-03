import type { Context, Next } from "hono";
import { isAllowedOrigin } from "../utils/constants";

export async function securityHeaders(c: Context, next: Next) {
  // Security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Content-Security-Policy", "default-src 'none'");
  c.header("Referrer-Policy", "no-referrer");

  // CORS — restrict to known origins (getctx.org + localhost dev)
  const origin = c.req.header("Origin");
  if (isAllowedOrigin(origin)) {
    c.header("Access-Control-Allow-Origin", origin!);
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    c.header("Access-Control-Max-Age", "86400");
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
}
