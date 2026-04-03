import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { securityHeaders } from "../../src/middleware/security-headers";

describe("securityHeaders middleware", () => {
  function createApp() {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/test", (c) => c.json({ ok: true }));
    app.delete("/test", (c) => c.json({ deleted: true }));
    return app;
  }

  it("sets security headers on all responses", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("sets CORS headers for allowed origin", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Origin: "https://getctx.org" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://getctx.org");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("sets CORS headers for www subdomain", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Origin: "https://www.getctx.org" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://www.getctx.org");
  });

  it("sets CORS headers for localhost development", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("sets CORS headers for 127.0.0.1 development", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Origin: "http://127.0.0.1:5173" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
  });

  it("omits CORS headers for unknown origin", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Origin: "https://evil.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });

  it("omits CORS headers when no Origin header present", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    // Security headers should still be present
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("returns 204 for OPTIONS preflight with allowed origin", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: { Origin: "https://getctx.org" },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://getctx.org");
  });

  it("returns 204 for OPTIONS preflight without CORS when origin not allowed", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com" },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not interfere with downstream route responses", async () => {
    const app = createApp();
    const res = await app.request("/test", { method: "DELETE" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true });
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
