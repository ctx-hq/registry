import { generateId } from "../utils/response";

export async function createOrg(
  db: D1Database,
  name: string,
  displayName: string,
  createdBy: string
): Promise<string> {
  const orgId = generateId();

  await db.batch([
    db.prepare(
      "INSERT INTO orgs (id, name, display_name, created_by) VALUES (?, ?, ?, ?)"
    ).bind(orgId, name, displayName, createdBy),
    db.prepare(
      "INSERT INTO scopes (name, owner_type, owner_id) VALUES (?, 'org', ?)"
    ).bind(name, orgId),
    db.prepare(
      "INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, 'owner')"
    ).bind(orgId, createdBy),
  ]);

  return orgId;
}

export async function getOrgByName(db: D1Database, name: string) {
  return db.prepare("SELECT * FROM orgs WHERE name = ?").bind(name).first();
}

export async function getMemberRole(
  db: D1Database,
  orgId: string,
  userId: string
): Promise<string | null> {
  const row = await db.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, userId).first();
  return row ? (row.role as string) : null;
}

export async function addMember(
  db: D1Database,
  orgId: string,
  userId: string,
  role: string
) {
  await db.prepare(
    "INSERT OR REPLACE INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)"
  ).bind(orgId, userId, role).run();
}

export async function removeMember(
  db: D1Database,
  orgId: string,
  userId: string
) {
  await db.prepare(
    "DELETE FROM org_members WHERE org_id = ? AND user_id = ?"
  ).bind(orgId, userId).run();
}
