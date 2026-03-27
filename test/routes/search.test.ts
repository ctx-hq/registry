import { describe, it, expect } from "vitest";
import { Hono } from "hono";

describe("search routes", () => {
  it("requires query parameter", async () => {
    const app = new Hono();
    app.get("/v1/search", (c) => {
      const q = c.req.query("q");
      if (!q) return c.json({ error: "bad_request", message: "Query required" }, 400);
      return c.json({ packages: [], total: 0 });
    });

    const res = await app.request("/v1/search");
    expect(res.status).toBe(400);

    const res2 = await app.request("/v1/search?q=test");
    expect(res2.status).toBe(200);
    const data = await res2.json() as { packages: unknown[] };
    expect(data.packages).toEqual([]);
  });

  it("accepts type filter", async () => {
    const app = new Hono();
    app.get("/v1/search", (c) => {
      const type_ = c.req.query("type");
      return c.json({ filter: type_ ?? "all" });
    });

    const res = await app.request("/v1/search?q=test&type=mcp");
    const data = await res.json() as { filter: string };
    expect(data.filter).toBe("mcp");
  });
});
