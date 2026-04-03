import type { Bindings } from "../bindings";
import { R2_MIGRATION_CONCURRENCY } from "../utils/constants";

/**
 * Returns the R2 bucket for a given package visibility.
 * SSOT: D1 `packages.visibility` determines bucket; this function derives the mapping.
 *
 * - "private" → PRIVATE_FORMULAS (isolated from CDN/mirrors)
 * - "public" / "unlisted" → FORMULAS (CDN-friendly, mirrorable)
 */
export function getFormulaBucket(env: Bindings, visibility: string): R2Bucket {
  return visibility === "private" ? env.PRIVATE_FORMULAS : env.FORMULAS;
}

/**
 * Migrates R2 objects between buckets when package visibility changes.
 * Uses copy-verify-delete pattern: safe on failure (file exists in both buckets).
 * Processes keys with bounded concurrency.
 * Returns list of keys that failed migration (empty = full success).
 */
export async function migrateArchives(
  source: R2Bucket,
  dest: R2Bucket,
  keys: string[],
): Promise<string[]> {
  const failures: string[] = [];

  // Process in batches with bounded concurrency
  for (let i = 0; i < keys.length; i += R2_MIGRATION_CONCURRENCY) {
    const batch = keys.slice(i, i + R2_MIGRATION_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(key => migrateOne(source, dest, key)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "rejected" || (r.status === "fulfilled" && !r.value)) {
        failures.push(batch[j]);
      }
    }
  }

  return failures;
}

/** Migrate a single key. Returns true on success, false on verification failure. */
async function migrateOne(source: R2Bucket, dest: R2Bucket, key: string): Promise<boolean> {
  const obj = await source.get(key);
  if (!obj) return true; // already gone — skip

  const body = await obj.arrayBuffer();
  await dest.put(key, body);

  const check = await dest.head(key);
  if (!check) return false;

  await source.delete(key);
  return true;
}
