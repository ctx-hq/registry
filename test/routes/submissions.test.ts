import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../src/bindings";
import { AppError } from "../../src/utils/errors";
import submissions from "../../src/routes/submissions";

function createSubmissionsApp(user?: { id: string; role: string }) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const rows: unknown[] = [];

  const db = {
    _executed: executed,
    prepare(sql: string) {
      let boundParams: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },
        async first() {
          executed.push({ sql, params: boundParams });
          // Auth middleware looks up user by token
          if (sql.includes("tokens") || sql.includes("users")) {
            return user ? { ...user, username: user.id } : null;
          }
          if (sql.includes("package_submissions WHERE id")) {
            return rows.length > 0 ? rows[0] : null;
          }
          return null;
        },
        async all() {
          executed.push({ sql, params: boundParams });
          return { results: rows };
        },
        async run() {
          executed.push({ sql, params: boundParams });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };

  const app = new Hono<AppEnv>();

  // Inject mock DB before routes process
  app.use("*", async (c, next) => {
    (c as any).env = { DB: db };
    await next();
  });

  app.onError((err: any, c) => {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode as any);
    }
    return c.json({ error: "internal_error", message: err.message }, 500);
  });

  app.route("/", submissions);

  const mockExecCtx = { waitUntil: () => {}, passThroughOnException: () => {} };
  const request: typeof app.request = (input, init, env) =>
    app.request(input, init, env, mockExecCtx as any);

  return { app, db, request, rows };
}

describe("submissions routes", () => {
  describe("POST /v1/submissions", () => {
    it("creates a submission with auto-detected source_type", async () => {
      const { request, db } = createSubmissionsApp({ id: "user-1", role: "user" });

      const res = await request("/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: "github:github/github-mcp-server",
          reason: "Official GitHub MCP server",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.status).toBe("pending");
      expect(body.source_url).toBe("github:github/github-mcp-server");

      // Verify DB insert
      const insert = db._executed.find((e) => e.sql.includes("INSERT INTO package_submissions"));
      expect(insert).toBeDefined();
      // source_type should be auto-detected as "github"
      expect(insert!.params[2]).toBe("github");
    });

    it("auto-detects npm source type", async () => {
      const { request, db } = createSubmissionsApp();

      const res = await request("/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: "npm:@playwright/mcp" }),
      });

      expect(res.status).toBe(201);
      const insert = db._executed.find((e) => e.sql.includes("INSERT INTO package_submissions"));
      expect(insert!.params[2]).toBe("npm");
    });

    it("rejects missing source_url", async () => {
      const { request } = createSubmissionsApp();

      const res = await request("/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("allows anonymous submission (no user)", async () => {
      const { request, db } = createSubmissionsApp(); // no user

      const res = await request("/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: "docker:ghcr.io/org/image" }),
      });

      expect(res.status).toBe(201);
      const insert = db._executed.find((e) => e.sql.includes("INSERT INTO package_submissions"));
      // submitted_by should be null
      expect(insert!.params[4]).toBeNull();
      // source_type should be "docker"
      expect(insert!.params[2]).toBe("docker");
    });

    it("returns existing submission if duplicate pending URL", async () => {
      const { request, db } = createSubmissionsApp();

      // Override first() to return a match for the duplicate check
      const origPrepare = db.prepare.bind(db);
      db.prepare = (sql: string) => {
        const stmt = origPrepare(sql);
        if (sql.includes("source_url") && sql.includes("status IN")) {
          return {
            bind: (..._params: unknown[]) => ({
              first: async () => ({ id: "existing-1", status: "pending" }),
              all: stmt.all,
              run: stmt.run,
            }),
          } as any;
        }
        return stmt;
      };

      const res = await request("/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: "github:duplicate/repo" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.duplicate).toBe(true);
      expect(body.id).toBe("existing-1");
    });
  });

  describe("PATCH /v1/submissions/:id", () => {
    it("rejects invalid status", async () => {
      const { request } = createSubmissionsApp({ id: "admin-1", role: "admin" });

      const res = await request("/v1/submissions/sub-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ status: "invalid-status" }),
      });

      expect(res.status).toBe(400);
    });

    it("updates submission status for admin", async () => {
      const { request, db } = createSubmissionsApp({ id: "admin-1", role: "admin" });

      const res = await request("/v1/submissions/sub-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ status: "approved", reviewer_notes: "Looks good" }),
      });

      expect(res.status).toBe(200);
      const update = db._executed.find((e) => e.sql.includes("UPDATE package_submissions"));
      expect(update).toBeDefined();
      expect(update!.params).toContain("approved");
      expect(update!.params).toContain("Looks good");
    });

    it("rejects non-admin user", async () => {
      const { request } = createSubmissionsApp({ id: "user-1", role: "user" });

      const res = await request("/v1/submissions/sub-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(403);
    });
  });
});
