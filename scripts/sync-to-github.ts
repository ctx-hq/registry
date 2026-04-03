/**
 * Sync R2 archives to GitHub backup repository (ctx-hq/registry-archive).
 *
 * For each version with an archive in R2:
 *   1. Check if already synced (via _meta.json marker in repo)
 *   2. Download from R2
 *   3. Upload to GitHub repo at @scope/name/version.tar.gz
 *   4. Write _meta.json with package metadata
 *
 * Designed to be run periodically (cron or manual).
 * Requires GITHUB_TOKEN env var with repo write access.
 *
 * Usage:
 *   Run as a Cloudflare Worker or locally with wrangler.
 */

interface Env {
  DB: D1Database;
  FORMULAS: R2Bucket;
  GITHUB_TOKEN?: string;
}

const GITHUB_OWNER = "ctx-hq";
const GITHUB_REPO = "registry-archive";
const BATCH_SIZE = 50;

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubFileExists(token: string, path: string): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": "ctx-sync" } },
  );
  return res.status === 200;
}

/**
 * Get the sha of an existing file in the repo. Returns null if not found.
 */
async function githubFileSha(token: string, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": "ctx-sync" } },
  );
  if (res.status !== 200) return null;
  const data = (await res.json()) as { sha?: string };
  return data.sha ?? null;
}

async function githubUpload(token: string, path: string, content: ArrayBuffer, message: string, sha?: string | null): Promise<void> {
  // Chunked base64 encoding to avoid max call stack with spread operator
  const bytes = new Uint8Array(content);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  const base64 = btoa(binary);

  const body: Record<string, string> = { message, content: base64 };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ctx-sync",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const resBody = await res.text();
    throw new Error(`GitHub upload failed (${res.status}): ${resBody}`);
  }
}

export async function syncToGitHub(env: Env): Promise<SyncResult> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return { synced: 0, skipped: 0, errors: 1 };
  }

  let synced = 0, skipped = 0, errors = 0;
  let lastId = "";

  while (true) {
    const batch = await env.DB.prepare(
      `SELECT v.id, v.version, v.formula_key, v.archive_sha256, v.created_at,
              p.full_name, p.type, p.description
       FROM versions v JOIN packages p ON v.package_id = p.id
       WHERE v.formula_key != '' AND v.formula_key LIKE 'archives/%' AND v.id > ?
       ORDER BY v.created_at ASC, v.id ASC LIMIT ?`,
    ).bind(lastId, BATCH_SIZE).all();

    const rows = batch.results ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const fullName = row.full_name as string;
      const version = row.version as string;
      const formulaKey = row.formula_key as string;
      const sha256 = row.archive_sha256 as string;
      const publishedAt = row.created_at as string;
      const type = row.type as string;
      const description = row.description as string;

      const repoPath = `${fullName}/${version}.tar.gz`;
      const metaPath = `${fullName}/_meta.json`;

      try {
        // Check if already synced
        if (await githubFileExists(token, repoPath)) {
          skipped++;
          continue;
        }

        // Download from R2
        const obj = await env.FORMULAS.get(formulaKey);
        if (!obj) { skipped++; continue; }

        const buffer = await obj.arrayBuffer();

        // Upload archive
        await githubUpload(token, repoPath, buffer, `sync: ${fullName}@${version}`);

        // Upload/update _meta.json (fetch existing sha for update)
        const existingSha = await githubFileSha(token, metaPath);
        const meta = JSON.stringify({
          name: fullName,
          type,
          description,
          latest_version: version,
          archive_sha256: sha256 && sha256.length === 64 ? sha256 : "",
          published_at: publishedAt,
          synced_at: new Date().toISOString(),
        }, null, 2);
        const metaBuffer = new TextEncoder().encode(meta).buffer;
        await githubUpload(token, metaPath, metaBuffer, `meta: ${fullName}@${version}`, existingSha);

        synced++;
      } catch (e) {
        console.error(`Sync failed ${fullName}@${version}:`, e);
        errors++;
      }
    }

    lastId = rows[rows.length - 1].id as string;
    console.log(`Sync: ${synced} synced, ${skipped} skipped, ${errors} errors`);
  }

  return { synced, skipped, errors };
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const result = await syncToGitHub(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
