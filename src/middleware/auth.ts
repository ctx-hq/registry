import type { Context, Next } from "hono";
import type { AppEnv } from "../bindings";
import type { UserRow } from "../models/types";
import { hashToken } from "../services/auth";
import { forbidden } from "../utils/errors";

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", message: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const tokenHash = await hashToken(token);

  const result = await c.env.DB.prepare(
    "SELECT u.* FROM api_tokens t JOIN users u ON t.user_id = u.id WHERE t.token_hash = ? AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))"
  ).bind(tokenHash).first<UserRow>();

  if (!result) {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }

  // Throttle last_used_at updates to once per hour
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      "UPDATE api_tokens SET last_used_at = datetime('now') WHERE token_hash = ? AND (last_used_at IS NULL OR last_used_at < datetime('now', '-1 hour'))"
    ).bind(tokenHash).run()
  );

  c.set("user", result);
  await next();
}

export async function optionalAuth(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const tokenHash = await hashToken(token);
    const result = await c.env.DB.prepare(
      "SELECT u.* FROM api_tokens t JOIN users u ON t.user_id = u.id WHERE t.token_hash = ? AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))"
    ).bind(tokenHash).first<UserRow>();
    if (result) {
      c.set("user", result);
    }
  }
  await next();
}

export async function adminMiddleware(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    throw forbidden("Admin access required");
  }
  await next();
}

