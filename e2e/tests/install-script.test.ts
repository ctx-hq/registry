/**
 * Install script generation tests.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { requireStaging, STAGING } from "../config";

beforeAll(() => {
  requireStaging();
});

describe("install script", () => {
  it("generates script for public package", async () => {
    const resp = await fetch(`${STAGING.API_URL}/v1/install/e2e-alice/test-skill`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(resp.status).toBe(200);
    const script = await resp.text();
    expect(script).toContain("#!/bin/sh");
    expect(script).toContain("@e2e-alice/test-skill");
    expect(script).toContain("uname -s");
    expect(script).toContain("sha256sum");
  });

  it("generates script for private package with token requirement", async () => {
    const resp = await fetch(`${STAGING.API_URL}/v1/install/e2e-alice/private-tool`, {
      headers: { Authorization: `Bearer ${STAGING.ALICE_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(resp.status).toBe(200);
    const script = await resp.text();
    expect(script).toContain("CTX_TOKEN is required");
  });

  it("returns 404 for non-existent package", async () => {
    const resp = await fetch(`${STAGING.API_URL}/v1/install/nobody/nothing`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(resp.status).toBe(404);
  });
});
