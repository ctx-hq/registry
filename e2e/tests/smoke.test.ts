/**
 * Smoke tests — verify staging is alive and seed data exists.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { requireStaging } from "../config";
import { asAlice, asBob, anonymous } from "../helpers";

beforeAll(() => {
  requireStaging();
});

describe("staging health", () => {
  it("API is reachable", async () => {
    const resp = await anonymous("GET", "/");
    expect(resp.status).toBe(200);
  });

  it("alice can authenticate", async () => {
    const resp = await asAlice("GET", "/v1/me");
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty("username", "e2e-alice");
  });

  it("bob can authenticate", async () => {
    const resp = await asBob("GET", "/v1/me");
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty("username", "e2e-bob");
  });

  it("seed packages exist", async () => {
    const resp = await anonymous("GET", `/v1/packages/${encodeURIComponent("@e2e-alice/test-skill")}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty("full_name", "@e2e-alice/test-skill");
  });
});
