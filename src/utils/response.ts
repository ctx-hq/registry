import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonResponse(c: Context, data: unknown, status: ContentfulStatusCode = 200) {
  return c.json(data, status);
}

export function errorResponse(c: Context, status: ContentfulStatusCode, message: string, code?: string) {
  return c.json({ error: code ?? "error", message }, status);
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
