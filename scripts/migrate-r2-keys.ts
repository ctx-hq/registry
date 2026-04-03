/**
 * Migrate R2 keys from old format to new format.
 *
 * Old: @scope/name/version/formula.tar.gz
 * New: archives/@scope/name/version.tar.gz
 *
 * Old: @scope/name/version/platform.tar.gz
 * New: artifacts/@scope/name/version/platform.tar.gz
 *
 * Steps per record:
 *   1. Read object from old key
 *   2. Write to new key
 *   3. Update DB formula_key
 *   4. Delete old key
 *
 * Usage: deploy as one-off worker or run via wrangler
 */

interface Env {
  DB: D1Database;
  FORMULAS: R2Bucket;
}

const BATCH_SIZE = 100;

interface MigrateResult {
  archives: { migrated: number; skipped: number; errors: number };
  artifacts: { migrated: number; skipped: number; errors: number };
}

function newArchiveKey(name: string, version: string): string {
  return `archives/${name}/${version}.tar.gz`;
}

function newArtifactKey(fullName: string, version: string, platform: string): string {
  return `artifacts/${fullName}/${version}/${platform}.tar.gz`;
}

async function migrateArchives(env: Env): Promise<MigrateResult["archives"]> {
  let migrated = 0, skipped = 0, errors = 0;
  let lastId = "";

  while (true) {
    const batch = await env.DB.prepare(
      `SELECT v.id, v.formula_key, v.version, p.full_name
       FROM versions v JOIN packages p ON v.package_id = p.id
       WHERE v.formula_key != '' AND v.formula_key NOT LIKE 'archives/%' AND v.id > ?
       ORDER BY v.id ASC LIMIT ?`,
    ).bind(lastId, BATCH_SIZE).all();

    const rows = batch.results ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const oldKey = row.formula_key as string;
      const fullName = row.full_name as string;
      const version = row.version as string;
      const versionId = row.id as string;
      const newKey = newArchiveKey(fullName, version);

      if (oldKey === newKey) { skipped++; continue; }

      try {
        const obj = await env.FORMULAS.get(oldKey);
        if (!obj) { skipped++; continue; }

        await env.FORMULAS.put(newKey, await obj.arrayBuffer());
        await env.DB.prepare("UPDATE versions SET formula_key = ? WHERE id = ?").bind(newKey, versionId).run();
        await env.FORMULAS.delete(oldKey);
        migrated++;
      } catch (e) {
        console.error(`Failed archive ${versionId}: ${oldKey} → ${newKey}`, e);
        errors++;
      }
    }

    lastId = rows[rows.length - 1].id as string;
    console.log(`Archives: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  }

  return { migrated, skipped, errors };
}

async function migrateArtifacts(env: Env): Promise<MigrateResult["artifacts"]> {
  let migrated = 0, skipped = 0, errors = 0;
  let lastId = "";

  while (true) {
    const batch = await env.DB.prepare(
      `SELECT a.id, a.formula_key, a.platform, v.version, p.full_name
       FROM version_artifacts a
       JOIN versions v ON a.version_id = v.id
       JOIN packages p ON v.package_id = p.id
       WHERE a.formula_key != '' AND a.formula_key NOT LIKE 'artifacts/%' AND a.id > ?
       ORDER BY a.id ASC LIMIT ?`,
    ).bind(lastId, BATCH_SIZE).all();

    const rows = batch.results ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const oldKey = row.formula_key as string;
      const fullName = row.full_name as string;
      const version = row.version as string;
      const platform = row.platform as string;
      const artifactId = row.id as string;
      const newKey = newArtifactKey(fullName, version, platform);

      if (oldKey === newKey) { skipped++; continue; }

      try {
        const obj = await env.FORMULAS.get(oldKey);
        if (!obj) { skipped++; continue; }

        await env.FORMULAS.put(newKey, await obj.arrayBuffer());
        await env.DB.prepare("UPDATE version_artifacts SET formula_key = ? WHERE id = ?").bind(newKey, artifactId).run();
        await env.FORMULAS.delete(oldKey);
        migrated++;
      } catch (e) {
        console.error(`Failed artifact ${artifactId}: ${oldKey} → ${newKey}`, e);
        errors++;
      }
    }

    lastId = rows[rows.length - 1].id as string;
    console.log(`Artifacts: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  }

  return { migrated, skipped, errors };
}

export async function migrateR2Keys(env: Env): Promise<MigrateResult> {
  const archives = await migrateArchives(env);
  const artifacts = await migrateArtifacts(env);
  return { archives, artifacts };
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const result = await migrateR2Keys(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
