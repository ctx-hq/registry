import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { notFound } from "../utils/errors";

const app = new Hono<AppEnv>();

// Download formula archive
app.get("/v1/download/:fullName/:version", async (c) => {
  const fullName = decodeURIComponent(c.req.param("fullName"));
  const version = c.req.param("version");

  const pkg = await c.env.DB.prepare(
    "SELECT id FROM packages WHERE full_name = ?"
  ).bind(fullName).first();

  if (!pkg) throw notFound(`Package ${fullName} not found`);

  const ver = await c.env.DB.prepare(
    "SELECT formula_key FROM versions WHERE package_id = ? AND version = ?"
  ).bind(pkg.id, version).first();

  if (!ver || !ver.formula_key) throw notFound(`Version ${version} not found`);

  const obj = await c.env.FORMULAS.get(ver.formula_key as string);
  if (!obj) throw notFound("Formula archive not found");

  // Increment download count
  await c.env.DB.prepare(
    "UPDATE packages SET downloads = downloads + 1 WHERE id = ?"
  ).bind(pkg.id).run();

  const safeFilename = `${fullName}-${version}.tar.gz`.replace(/["\\\r\n]/g, "_");
  c.header("Content-Type", "application/gzip");
  c.header("Content-Disposition", `attachment; filename="${safeFilename}"`);
  return c.body(obj.body as ReadableStream);
});

export default app;
