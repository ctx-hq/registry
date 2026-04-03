import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { rateLimitMiddleware } from "../../src/middleware/rate-limit";
import { hashToken } from "../../src/services/auth";

// Mock Cache API (caches.default) globally
function createMockCacheStore() {
  const store = new Map<string, string>();
  return {
    _store: store,
    async match(req: string | Request) {
      const url = typeof req === "string" ? req : req.url;
      const val = store.get(url);
      if (val == null) return undefined;
      return new Response(val);
    },
    async put(req: string | Request, res: Response) {
      const url = typeof req === "string" ? req : req.url;
      const text = await res.text();
      store.set(url, text);
    },
    async delete(req: string | Request) {
      const url = typeof req === "string" ? req : req.url;
      return store.delete(url);
    },
  };
}

let mockCache: ReturnType<typeof createMockCacheStore>;

beforeEach(() => {
  mockCache = createMockCacheStore();
  (globalThis as any).caches = { default: mockCache };
});

afterEach(() => {
  delete (globalThis as any).caches;
});

function createMockDB(tokenUserId?: string) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() {
          return tokenUserId ? { user_id: tokenUserId } : null;
        },
      };
    },
  };
}

function createApp(tokenUserId?: string) {
  const mockDB = createMockDB(tokenUserId);

  const app = new Hono();
  app.use("/v1/*", async (c, next) => {
    (c as any).env = { DB: mockDB };
    await next();
  });
  app.use("/v1/*", rateLimitMiddleware);
  app.get("/v1/test", (c) => c.json({ ok: true }));
  return app;
}

describe("rate limit middleware", () => {
  it("sets rate limit headers on response", async () => {
    const app = createApp();
    const res = await app.request("/v1/test", {
      headers: { "CF-Connecting-IP": "1.2.3.4" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("180");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
  });

  it("uses IP-based key for anonymous requests", async () => {
    const app = createApp();
    await app.request("/v1/test", {
      headers: { "CF-Connecting-IP": "10.0.0.1" },
    });

    // Wait for fire-and-forget cache write to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCache._store.has("https://rate-limit.internal/rl%3Aip%3A10.0.0.1")).toBe(true);
  });

  it("uses user_id-based key for authenticated requests (not token hash)", async () => {
    const userId = "user-alice-123";
    const app = createApp(userId);

    await app.request("/v1/test", {
      headers: {
        "CF-Connecting-IP": "10.0.0.1",
        Authorization: "Bearer ctx_fake_token",
      },
    });

    // Wait for fire-and-forget cache write to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCache._store.has(`https://rate-limit.internal/rl%3Auser%3A${userId}`)).toBe(true);
    expect(mockCache._store.has("https://rate-limit.internal/rl%3Aip%3A10.0.0.1")).toBe(false);
  });

  it("multiple tokens from same user share one rate limit quota", async () => {
    const userId = "user-alice-123";

    // Pre-set counter to 500
    mockCache._store.set(`https://rate-limit.internal/rl%3Auser%3A${userId}`, "500");

    const app = createApp(userId);
    const res = await app.request("/v1/test", {
      headers: {
        "CF-Connecting-IP": "10.0.0.1",
        Authorization: "Bearer ctx_different_token",
      },
    });

    expect(res.status).toBe(200);
    // Remaining should be based on 600 (auth limit) - 500 - 1 = 99
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("returns 429 when limit exceeded", async () => {
    // Pre-set counter above anonymous limit
    mockCache._store.set("https://rate-limit.internal/rl%3Aip%3A1.2.3.4", "200");

    const app = createApp();
    const res = await app.request("/v1/test", {
      headers: { "CF-Connecting-IP": "1.2.3.4" },
    });

    expect(res.status).toBe(429);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("rate_limited");
  });

  it("fails open when Cache API is unavailable", async () => {
    // Remove caches global to simulate unavailability
    delete (globalThis as any).caches;

    const app = createApp();
    const res = await app.request("/v1/test", {
      headers: { "CF-Connecting-IP": "1.2.3.4" },
    });

    // Should pass through, not error
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("180");
  });
});
