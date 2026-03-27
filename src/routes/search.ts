import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { badRequest } from "../utils/errors";
import { getLatestVersion } from "../services/package";

const app = new Hono<AppEnv>();

app.get("/v1/search", async (c) => {
  const query = c.req.query("q")?.trim();
  const type_ = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20") || 20, 100);

  if (!query) {
    throw badRequest("Query parameter 'q' is required");
  }

  // Use FTS5 for search
  let sql = `
    SELECT p.full_name, p.type, p.description, p.downloads, p.repository
    FROM packages_fts f
    JOIN packages p ON p.rowid = f.rowid
    WHERE packages_fts MATCH ?
  `;
  const sanitized = '"' + query.replace(/"/g, '""') + '"';
  const params: unknown[] = [sanitized];

  if (type_) {
    sql += " AND p.type = ?";
    params.push(type_);
  }

  sql += " ORDER BY rank LIMIT ?";
  params.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  // Get latest version for each result
  // Get package IDs for version lookup
  const pkgResults = await Promise.all(
    (result.results ?? []).map(async (pkg: Record<string, unknown>) => {
      const p = await c.env.DB.prepare("SELECT id FROM packages WHERE full_name = ?").bind(pkg.full_name).first();
      const ver = p ? await getLatestVersion(c.env.DB, p.id as string) : null;
      return {
        full_name: pkg.full_name,
        type: pkg.type,
        description: pkg.description,
        version: (ver?.version as string) ?? "",
        downloads: pkg.downloads,
        repository: pkg.repository ?? "",
      };
    })
  );
  const packages = pkgResults;

  return c.json({ packages, total: packages.length });
});

export default app;
