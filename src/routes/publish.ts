import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { authMiddleware } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { isValidFullName, parseFullName } from "../utils/naming";
import { isValidSemVer } from "../utils/semver";
import { generateId } from "../utils/response";
import { computeSHA256 } from "../services/publish";
import { parse as parseYAML } from "yaml";

const app = new Hono<AppEnv>();

// Publish a package
app.post("/v1/publish", authMiddleware, async (c) => {
  const user = c.get("user");
  const formData = await c.req.formData();
  const manifestFile = formData.get("manifest");

  if (!manifestFile || !(manifestFile instanceof File)) {
    throw badRequest("Missing manifest file");
  }

  const manifestText = await manifestFile.text();
  let manifest: Record<string, unknown>;
  try {
    // Try JSON first, fall back to YAML
    manifest = JSON.parse(manifestText);
  } catch {
    try {
      manifest = parseYAML(manifestText) as Record<string, unknown>;
    } catch {
      throw badRequest("Invalid manifest format (expected JSON or YAML)");
    }
  }

  const name = manifest.name as string;
  const version = manifest.version as string;
  const type_ = manifest.type as string;
  const description = (manifest.description as string) ?? "";

  if (!name || !isValidFullName(name)) {
    throw badRequest(`Invalid package name: ${name}`);
  }
  if (!version || !isValidSemVer(version)) {
    throw badRequest(`Invalid version: ${version}`);
  }
  if (!["skill", "mcp", "cli"].includes(type_)) {
    throw badRequest(`Invalid type: ${type_}`);
  }

  const parsed = parseFullName(name)!;

  // Ensure scope exists or create it
  const existingScope = await c.env.DB.prepare(
    "SELECT * FROM scopes WHERE name = ?"
  ).bind(parsed.scope).first();

  if (!existingScope) {
    await c.env.DB.prepare(
      "INSERT INTO scopes (name, owner_type, owner_id) VALUES (?, 'user', ?)"
    ).bind(parsed.scope, user.id).run();
  } else if (existingScope.owner_type === "org") {
    // Verify user is a member with publish privileges (owner, admin, or member)
    const membership = await c.env.DB.prepare(
      "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
    ).bind(existingScope.owner_id, user.id).first();
    if (!membership) {
      throw forbidden(`You are not a member of organization @${parsed.scope}`);
    }
  } else if (existingScope.owner_id !== user.id) {
    throw forbidden(`Scope @${parsed.scope} is owned by another user`);
  }

  // Find or create package
  let pkg = await c.env.DB.prepare(
    "SELECT * FROM packages WHERE full_name = ?"
  ).bind(name).first();

  const pkgId = pkg?.id ?? generateId();
  if (pkg && pkg.owner_id !== user.id) {
    throw forbidden("You don't have permission to publish to this package");
  }
  if (!pkg) {
    await c.env.DB.prepare(
      `INSERT INTO packages (id, scope, name, full_name, type, description, keywords, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      pkgId, parsed.scope, parsed.name, name, type_, description,
      JSON.stringify(manifest.keywords ?? []), user.id
    ).run();
  } else {
    // Update description/keywords
    await c.env.DB.prepare(
      "UPDATE packages SET description = ?, keywords = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(description, JSON.stringify(manifest.keywords ?? []), pkgId).run();
  }

  // Check version doesn't already exist
  const existingVersion = await c.env.DB.prepare(
    "SELECT id FROM versions WHERE package_id = ? AND version = ?"
  ).bind(pkgId, version).first();

  if (existingVersion) {
    throw conflict(`Version ${version} already exists for ${name}`);
  }

  // Store formula archive in R2 if provided
  const archive = formData.get("archive");
  let formulaKey = "";
  if (archive instanceof File) {
    formulaKey = `${name}/${version}/formula.tar.gz`;
    await c.env.FORMULAS.put(formulaKey, await archive.arrayBuffer());
  }

  // Compute manifest hash
  const manifestHash = await computeSHA256(manifestText);

  // Create version
  const versionId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO versions (id, package_id, version, manifest, formula_key, sha256, published_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(versionId, pkgId, version, manifestText, formulaKey, manifestHash, user.id).run();

  // Audit event
  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
     VALUES (?, ?, 'publish', 'version', ?, ?)`
  ).bind(generateId(), user.id, versionId, JSON.stringify({ version, package: name })).run();

  return c.json({
    full_name: name,
    version,
    url: `https://getctx.org/${name}`,
  }, 201);
});

// Yank a version
app.post("/v1/yank/:fullName/:version", authMiddleware, async (c) => {
  const user = c.get("user");
  const fullName = decodeURIComponent(c.req.param("fullName")!);
  const version = c.req.param("version")!;

  const pkg = await c.env.DB.prepare(
    "SELECT * FROM packages WHERE full_name = ? AND owner_id = ?"
  ).bind(fullName, user.id).first();

  if (!pkg) {
    throw badRequest("Package not found or you don't have permission");
  }

  const result = await c.env.DB.prepare(
    "UPDATE versions SET yanked = 1 WHERE package_id = ? AND version = ?"
  ).bind(pkg.id, version).run();

  if (!result.meta.changes) {
    throw notFound(`Version ${version} not found for ${fullName}`);
  }

  return c.json({ yanked: true, full_name: fullName, version });
});

export default app;
