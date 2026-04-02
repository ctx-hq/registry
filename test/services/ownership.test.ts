import { describe, it, expect } from "vitest";
import { canManage, canManageWithOwner, canAdmin } from "../../src/services/ownership";

// --- Mock DB ---

interface MockDB {
  prepare(sql: string): MockStatement;
}

interface MockStatement {
  bind(...params: unknown[]): MockStatement;
  first<T = unknown>(): Promise<T | null>;
}

function createMockDB(overrides: {
  firstFn: (sql: string, params: unknown[]) => unknown | null;
}): MockDB {
  return {
    prepare(sql: string) {
      let boundParams: unknown[] = [];
      const stmt: MockStatement = {
        bind(...params: unknown[]) { boundParams = params; return stmt; },
        async first<T>(): Promise<T | null> {
          return (overrides.firstFn(sql, boundParams) as T) ?? null;
        },
      };
      return stmt;
    },
  };
}

// --- canManage tests ---

describe("canManage", () => {
  it("returns true for user scope owner", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "user", owner_id: "user-1" };
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-1", "hong");
    expect(result).toBe(true);
  });

  it("returns true for org owner", async () => {
    const db = createMockDB({
      firstFn: (sql, params) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "owner" };
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-1", "myorg");
    expect(result).toBe(true);
  });

  it("returns true for org admin", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "admin" };
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-2", "myorg");
    expect(result).toBe(true);
  });

  it("returns false for org member (non-admin)", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "member" };
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-3", "myorg");
    expect(result).toBe(false);
  });

  it("returns false for non-member of org", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return null; // not a member
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-outsider", "myorg");
    expect(result).toBe(false);
  });

  it("returns false for archived org", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "archived" };
        }
        return null;
      },
    });

    const result = await canManage(db as unknown as D1Database, "user-1", "myorg");
    expect(result).toBe(false);
  });
});

// --- canManageWithOwner tests ---

describe("canManageWithOwner", () => {
  it("returns OwnerRef for user scope owner", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "user", owner_id: "user-1" };
        }
        return null;
      },
    });

    const result = await canManageWithOwner(db as unknown as D1Database, "user-1", "hong");
    expect(result).toEqual({ owner_type: "user", owner_id: "user-1" });
  });

  it("returns null for non-owner user scope", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "user", owner_id: "user-1" };
        }
        return null;
      },
    });

    const result = await canManageWithOwner(db as unknown as D1Database, "user-other", "hong");
    expect(result).toBeNull();
  });
});

// --- canAdmin tests ---

describe("canAdmin", () => {
  it("returns true for user scope owner", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "user", owner_id: "user-1" };
        }
        return null;
      },
    });

    const result = await canAdmin(db as unknown as D1Database, "user-1", "hong");
    expect(result).toBe(true);
  });

  it("returns true for org owner", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "owner" };
        }
        return null;
      },
    });

    const result = await canAdmin(db as unknown as D1Database, "user-1", "myorg");
    expect(result).toBe(true);
  });

  it("returns false for org admin (not owner)", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "admin" };
        }
        return null;
      },
    });

    const result = await canAdmin(db as unknown as D1Database, "user-2", "myorg");
    expect(result).toBe(false);
  });

  it("returns false for org member", async () => {
    const db = createMockDB({
      firstFn: (sql) => {
        if (sql.includes("FROM scopes WHERE name")) {
          return { owner_type: "org", owner_id: "org-1" };
        }
        if (sql.includes("FROM orgs WHERE id")) {
          return { status: "active" };
        }
        if (sql.includes("FROM org_members")) {
          return { role: "member" };
        }
        return null;
      },
    });

    const result = await canAdmin(db as unknown as D1Database, "user-3", "myorg");
    expect(result).toBe(false);
  });

  it("returns false for non-existent scope", async () => {
    const db = createMockDB({
      firstFn: () => null,
    });

    const result = await canAdmin(db as unknown as D1Database, "user-1", "nonexistent");
    expect(result).toBe(false);
  });
});
