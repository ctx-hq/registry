import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { optionalAuth, authMiddleware, adminMiddleware } from "../middleware/auth";
import { badRequest, notFound } from "../utils/errors";

const app = new Hono<AppEnv>();

// POST /v1/submissions — Submit a packaging request
app.post("/v1/submissions", optionalAuth, async (c) => {
  const body = await c.req.json<{
    source_url: string;
    source_type?: string;
    package_type?: string;
    reason?: string;
  }>();

  if (!body.source_url) {
    throw badRequest("source_url is required");
  }

  // Auto-detect source_type from URL if not provided
  let sourceType = body.source_type ?? "";
  if (!sourceType) {
    if (body.source_url.startsWith("npm:")) sourceType = "npm";
    else if (body.source_url.startsWith("github:")) sourceType = "github";
    else if (body.source_url.startsWith("docker:")) sourceType = "docker";
    else if (body.source_url.includes("github.com/")) sourceType = "github";
    else if (body.source_url.includes("npmjs.com/")) sourceType = "npm";
    else sourceType = "url";
  }

  // Check for existing pending/reviewing submission with the same URL
  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM package_submissions WHERE source_url = ? AND status IN ('pending', 'reviewing')`,
  ).bind(body.source_url).first<{ id: string; status: string }>();

  if (existing) {
    return c.json({ id: existing.id, status: existing.status, source_url: body.source_url, duplicate: true }, 200);
  }

  const id = crypto.randomUUID();
  const user = c.get("user" as never) as { id: string } | undefined;

  await c.env.DB.prepare(
    `INSERT INTO package_submissions (id, source_url, source_type, package_type, submitted_by, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.source_url,
      sourceType,
      body.package_type ?? null,
      user?.id ?? null,
      body.reason ?? "",
    )
    .run();

  return c.json({ id, status: "pending", source_url: body.source_url }, 201);
});

// GET /v1/submissions — List submissions (admin only)
app.get("/v1/submissions", authMiddleware, adminMiddleware, async (c) => {
  const status = c.req.query("status") ?? "";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = parseInt(c.req.query("offset") ?? "0");

  let sql = `SELECT id, source_url, source_type, package_type, submitted_by, reason, status, created_at
             FROM package_submissions`;
  const params: unknown[] = [];

  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({ submissions: results, limit, offset });
});

// GET /v1/submissions/:id — Get submission details
app.get("/v1/submissions/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT * FROM package_submissions WHERE id = ?`,
  ).bind(id).first();

  if (!row) throw notFound("Submission not found");

  return c.json(row);
});

// PATCH /v1/submissions/:id — Update submission status
app.patch("/v1/submissions/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    status?: string;
    reviewer_notes?: string;
  }>();

  const validStatuses = ["pending", "reviewing", "approved", "rejected", "published"];
  if (body.status && !validStatuses.includes(body.status)) {
    throw badRequest(`status must be one of: ${validStatuses.join(", ")}`);
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.status) {
    updates.push("status = ?");
    params.push(body.status);
  }
  if (body.reviewer_notes !== undefined) {
    updates.push("reviewer_notes = ?");
    params.push(body.reviewer_notes);
  }

  if (updates.length === 0) {
    throw badRequest("No fields to update");
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE package_submissions SET ${updates.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  if (result.meta.changes === 0) {
    throw notFound("Submission not found");
  }

  return c.json({ id, status: body.status ?? "unchanged" });
});

export default app;
