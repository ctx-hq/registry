/**
 * Upstream version tracking service.
 * Checks npm, GitHub releases, and Docker tags for new versions.
 */

const USER_AGENT = "ctx-registry/1.0 (https://getctx.org)";
const UPSTREAM_CHECK_BATCH_SIZE = 50;

export interface UpstreamOptions {
  githubToken?: string;
}

/**
 * Check a single upstream source for a new version.
 */
export async function checkUpstreamVersion(
  trackingType: string,
  trackingKey: string,
  opts?: UpstreamOptions,
): Promise<{ version: string | null; error?: string }> {
  switch (trackingType) {
    case "npm":
      return checkNPMVersion(trackingKey);
    case "github-release":
      return checkGitHubRelease(trackingKey, opts?.githubToken);
    case "docker":
      return { version: null, error: "docker tracking not yet implemented" };
    default:
      return { version: null, error: `unknown tracking type: ${trackingType}` };
  }
}

async function checkNPMVersion(pkg: string): Promise<{ version: string | null; error?: string }> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return { version: null, error: `npm returned ${res.status}` };

    const data = (await res.json()) as { "dist-tags"?: Record<string, string> };
    const latest = data["dist-tags"]?.latest;
    return { version: latest ?? null };
  } catch (err) {
    return { version: null, error: `npm fetch failed: ${(err as Error).message}` };
  }
}

async function checkGitHubRelease(repo: string, token?: string): Promise<{ version: string | null; error?: string }> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": USER_AGENT,
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (!res.ok) return { version: null, error: `GitHub returned ${res.status}` };

    const data = (await res.json()) as { tag_name?: string };
    const tag = data.tag_name;
    if (!tag) return { version: null };

    // Strip leading 'v' prefix
    const version = tag.startsWith("v") ? tag.slice(1) : tag;
    return { version };
  } catch (err) {
    return { version: null, error: `GitHub fetch failed: ${(err as Error).message}` };
  }
}

/**
 * Run upstream checks for all tracked packages.
 * Called by the scheduled cron handler.
 */
export async function checkAllUpstreams(
  db: D1Database,
  opts?: UpstreamOptions,
): Promise<{ checked: number; updated: number; errors: number }> {
  const { results: tracked } = await db
    .prepare(
      `SELECT ut.package_id, ut.tracking_type, ut.tracking_key, ut.latest_known,
              p.full_name
       FROM upstream_tracking ut
       JOIN packages p ON p.id = ut.package_id
       ORDER BY ut.last_checked ASC
       LIMIT ?`,
    )
    .bind(UPSTREAM_CHECK_BATCH_SIZE)
    .all();

  let checked = 0;
  let updated = 0;
  let errors = 0;

  for (const row of tracked) {
    checked++;
    const result = await checkUpstreamVersion(
      row.tracking_type as string,
      row.tracking_key as string,
      opts,
    );

    if (result.error) {
      errors++;
      await db
        .prepare(`UPDATE upstream_tracking SET check_status = ?, last_checked = datetime('now') WHERE package_id = ?`)
        .bind(`error: ${result.error}`, row.package_id)
        .run();
      continue;
    }

    if (result.version && result.version !== row.latest_known) {
      updated++;
      // Record the update
      await db
        .prepare(
          `INSERT INTO upstream_updates (id, package_id, old_version, new_version) VALUES (?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), row.package_id, row.latest_known ?? "", result.version)
        .run();
    }

    await db
      .prepare(
        `UPDATE upstream_tracking SET latest_known = ?, last_checked = datetime('now'), check_status = 'ok' WHERE package_id = ?`,
      )
      .bind(result.version ?? row.latest_known, row.package_id)
      .run();
  }

  return { checked, updated, errors };
}
