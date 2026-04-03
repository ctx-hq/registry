/**
 * Backfill archive_sha256 for existing versions.
 *
 * Reads archives from R2, computes SHA256, and updates the versions table.
 * Processes in batches of 100 to avoid memory pressure.
 *
 * Usage (via wrangler):
 *   npx wrangler d1 execute ctx-db --command "SELECT count(*) FROM versions WHERE archive_sha256 = '' AND formula_key != ''"
 *   # Then run this script via a one-off worker or local script
 */

interface Env {
  DB: D1Database;
  FORMULAS: R2Bucket;
}

const BATCH_SIZE = 100;

async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function backfillArchiveSHA256(env: Env): Promise<{ updated: number; errors: number; skipped: number }> {
  let updated = 0;
  let errors = 0;
  let skipped = 0;
  let processed = 0;
  const errorIds = new Set<string>();

  while (true) {
    // Successful rows disappear from the result set (archive_sha256 no longer ''),
    // so always fetch the first batch of unprocessed rows without OFFSET.
    const batch = await env.DB.prepare(
      `SELECT id, formula_key FROM versions
       WHERE archive_sha256 = '' AND formula_key != ''
       ORDER BY id ASC
       LIMIT ?`,
    ).bind(BATCH_SIZE).all();

    const rows = (batch.results ?? []).filter((r) => !errorIds.has(r.id as string));
    if (rows.length === 0) break;

    let progressThisBatch = 0;
    for (const row of rows) {
      const formulaKey = row.formula_key as string;
      const versionId = row.id as string;

      try {
        const obj = await env.FORMULAS.get(formulaKey);
        if (!obj) {
          skipped++;
          // Clear formula_key since the archive doesn't exist in R2.
          // archive_sha256 stays '' — no sentinel values in hash fields.
          await env.DB.prepare(
            "UPDATE versions SET formula_key = '' WHERE id = ? AND formula_key != ''",
          ).bind(versionId).run();
          progressThisBatch++;
          continue;
        }

        const buffer = await obj.arrayBuffer();
        const sha256 = await computeSHA256(buffer);

        await env.DB.prepare(
          "UPDATE versions SET archive_sha256 = ? WHERE id = ?",
        ).bind(sha256, versionId).run();

        updated++;
        progressThisBatch++;
      } catch (e) {
        console.error(`Failed to backfill ${versionId} (${formulaKey}):`, e);
        errors++;
        errorIds.add(versionId);
        progressThisBatch++;
      }
    }

    processed += rows.length;
    // Safety: if no rows were modified this batch, break to avoid infinite loop
    if (progressThisBatch === 0) break;
    console.log(`Progress: ${processed} processed, ${updated} updated, ${errors} errors, ${skipped} skipped`);
  }

  return { updated, errors, skipped };
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const result = await backfillArchiveSHA256(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
