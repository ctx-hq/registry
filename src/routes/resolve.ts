import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { badRequest } from "../utils/errors";

const app = new Hono<AppEnv>();

// Resolve version constraints
app.post("/v1/resolve", async (c) => {
  let body: { packages: Record<string, string> };
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }

  if (!body.packages || typeof body.packages !== "object") {
    throw badRequest("Request body must contain a 'packages' object");
  }

  const resolved: Record<string, unknown> = {};

  for (const [fullName, constraint] of Object.entries(body.packages)) {
    const pkg = await c.env.DB.prepare(
      "SELECT id FROM packages WHERE full_name = ?"
    ).bind(fullName).first();

    if (!pkg) {
      resolved[fullName] = { error: "not_found" };
      continue;
    }

    // Get all non-yanked versions
    const versions = await c.env.DB.prepare(
      "SELECT version, manifest, sha256, formula_key FROM versions WHERE package_id = ? AND yanked = 0 ORDER BY created_at DESC"
    ).bind(pkg.id).all();

    const rows = versions.results ?? [];
    if (rows.length === 0) {
      resolved[fullName] = { error: "no_versions" };
      continue;
    }

    // Simple resolution: if constraint is "*" or "latest", return latest
    // For semver constraints, match against available versions
    let matched: Record<string, unknown> | null = null;

    if (constraint === "*" || constraint === "latest" || constraint === "") {
      matched = rows[0] as Record<string, unknown>;
    } else {
      // Basic semver matching (exact version)
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        if (r.version === constraint) {
          matched = r;
          break;
        }
      }
      if (!matched) {
        resolved[fullName] = { error: "no_matching_version", constraint };
        continue;
      }
    }

    if (matched) {
      const downloadUrl = matched.formula_key
        ? `https://api.getctx.org/v1/download/${encodeURIComponent(fullName)}/${matched.version}`
        : "";

      resolved[fullName] = {
        version: matched.version,
        manifest: matched.manifest,
        download_url: downloadUrl,
        sha256: matched.sha256,
      };
    }
  }

  return c.json({ resolved });
});

export default app;
