import { parseSemVer, compareSemVer } from "../utils/semver";

export async function getPackageByName(db: D1Database, fullName: string) {
  return db.prepare("SELECT * FROM packages WHERE full_name = ?").bind(fullName).first();
}

export async function getLatestVersion(db: D1Database, packageId: string) {
  const result = await db.prepare(
    "SELECT version, manifest FROM versions WHERE package_id = ? AND yanked = 0"
  ).bind(packageId).all();

  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  let latest = rows[0] as Record<string, unknown>;
  let latestSv = parseSemVer(latest.version as string);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const sv = parseSemVer(row.version as string);
    if (sv && (!latestSv || compareSemVer(sv, latestSv) > 0)) {
      latest = row;
      latestSv = sv;
    }
  }

  return latest;
}

// D1 has a per-query binding limit; chunk IN clauses to stay safe
const BATCH_CHUNK_SIZE = 50;

/**
 * Batch-fetch latest version string for multiple packages.
 * Uses the same semantics as getLatestVersion(): highest non-yanked semver.
 * This avoids divergence with dist_tags (which may point to yanked versions
 * or be absent for prerelease-only packages).
 */
export async function getLatestVersionsBatch(
  db: D1Database,
  packageIds: string[]
): Promise<Map<string, string>> {
  if (packageIds.length === 0) return new Map();

  const map = new Map<string, string>();

  for (let i = 0; i < packageIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = packageIds.slice(i, i + BATCH_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db.prepare(
      `SELECT package_id, version FROM versions
       WHERE package_id IN (${placeholders}) AND yanked = 0`
    ).bind(...chunk).all();

    // Group by package and pick highest semver (same logic as getLatestVersion)
    const byPkg = new Map<string, string[]>();
    for (const row of result.results ?? []) {
      const pid = row.package_id as string;
      if (!byPkg.has(pid)) byPkg.set(pid, []);
      byPkg.get(pid)!.push(row.version as string);
    }
    for (const [pid, versions] of byPkg) {
      let best = versions[0];
      let bestSv = parseSemVer(best);
      for (let j = 1; j < versions.length; j++) {
        const sv = parseSemVer(versions[j]);
        if (sv && (!bestSv || compareSemVer(sv, bestSv) > 0)) {
          best = versions[j];
          bestSv = sv;
        }
      }
      map.set(pid, best);
    }
  }

  return map;
}

export async function incrementDownloads(db: D1Database, packageId: string) {
  return db.prepare(
    "UPDATE packages SET downloads = downloads + 1 WHERE id = ?"
  ).bind(packageId).run();
}
