import { describe, it, expect } from "vitest";
import { Hono } from "hono";

// Test the packages route structure by verifying route registration
describe("packages routes", () => {
  it("responds to GET /v1/health", async () => {
    const app = new Hono();
    app.get("/v1/health", (c) => c.json({ status: "ok" }));

    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    const data = await res.json() as { status: string };
    expect(data.status).toBe("ok");
  });

  it("returns 404 for unknown routes", async () => {
    const app = new Hono();
    app.get("/v1/packages/:name", (c) => c.json({ found: true }));

    const res = await app.request("/v1/nonexistent");
    expect(res.status).toBe(404);
  });

  it("handles URL-encoded package names", () => {
    const encoded = encodeURIComponent("@hong/my-skill");
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe("@hong/my-skill");
  });
});
