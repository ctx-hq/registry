/**
 * Permission boundary tests — bob (org member, scoped token) cannot do admin operations.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { requireStaging } from "../config";
import { asAlice, asBob } from "../helpers";

beforeAll(() => {
  requireStaging();
});

describe("org member (bob) permission boundaries", () => {
  it("bob CANNOT yank org package (requires admin+)", async () => {
    const resp = await asBob("POST", "/v1/packages/%40e2e-org%2Forg-mcp/versions/0.1.0/yank");
    expect(resp.status).toBe(403);
  });

  it("bob CANNOT delete org package (requires admin+)", async () => {
    const resp = await asBob("DELETE", "/v1/packages/%40e2e-org%2Forg-mcp");
    expect(resp.status).toBe(403);
  });

  it("bob CANNOT change org package visibility (requires admin+)", async () => {
    const resp = await asBob("PATCH", "/v1/packages/%40e2e-org%2Forg-mcp/visibility", {
      visibility: "unlisted",
    });
    expect(resp.status).toBe(403);
  });

  it("bob CANNOT initiate package transfer (requires owner)", async () => {
    const resp = await asBob("POST", "/v1/packages/%40e2e-org%2Forg-mcp/transfer", {
      to: "@e2e-bob",
    });
    expect(resp.status).toBe(403);
  });

  it("bob CANNOT manage package access (requires admin+)", async () => {
    const resp = await asBob("GET", "/v1/packages/%40e2e-org%2Forg-mcp/access");
    expect(resp.status).toBe(403);
  });
});

describe("alice (owner) CAN do admin operations", () => {
  it("alice CAN view package access", async () => {
    const resp = await asAlice("GET", "/v1/packages/%40e2e-org%2Forg-mcp/access");
    expect(resp.status).toBe(200);
  });

  it("alice CAN change org package visibility", async () => {
    // Change to unlisted then back
    const r1 = await asAlice("PATCH", "/v1/packages/%40e2e-org%2Forg-mcp/visibility", {
      visibility: "unlisted",
    });
    expect(r1.status).toBe(200);

    const r2 = await asAlice("PATCH", "/v1/packages/%40e2e-org%2Forg-mcp/visibility", {
      visibility: "public",
    });
    expect(r2.status).toBe(200);
  });
});

describe("scoped token boundaries (bob: publish only, @e2e-bob/*)", () => {
  it("bob CAN authenticate with scoped token", async () => {
    const resp = await asBob("GET", "/v1/me");
    expect(resp.status).toBe(200);
  });

  it("bob CANNOT act on packages outside scope (@e2e-alice/*)", async () => {
    // Bob's package_scopes is ["@e2e-bob/*"], so actions on @e2e-alice/* should fail
    // Note: this depends on tokenCanActOnPackage being enforced
    const resp = await asBob("POST", "/v1/packages/%40e2e-alice%2Ftest-skill/versions/0.1.0/yank");
    expect(resp.status).toBe(403);
  });
});
