/**
 * Builds SQL conditions and params for package visibility filtering.
 * NOTE: The generated SQL references `packages.id` — must be used in a context
 * where `packages` is the table name or alias.
 *
 * Rules:
 * - Public packages visible to all
 * - User-owned packages visible to their owner
 * - Org packages visible to org members, with private package_access restrictions
 *   (org owner/admin bypasses package_access)
 */
export function visibilityCondition(userId: string | null): {
  sql: string;
  params: unknown[];
} {
  if (!userId) {
    return { sql: "visibility = 'public'", params: [] };
  }

  return {
    sql: `(visibility = 'public' OR (
      (owner_type = 'user' AND owner_id = ?)
      OR (owner_type = 'org' AND owner_id IN (
        SELECT org_id FROM org_members WHERE user_id = ?
      ) AND (
        visibility != 'private'
        OR NOT EXISTS (SELECT 1 FROM package_access WHERE package_id = packages.id)
        OR EXISTS (SELECT 1 FROM package_access WHERE package_id = packages.id AND user_id = ?)
        OR owner_id IN (
          SELECT org_id FROM org_members WHERE user_id = ? AND role IN ('owner', 'admin')
        )
      ))
    ))`,
    params: [userId, userId, userId, userId],
  };
}
