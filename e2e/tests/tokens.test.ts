/**
 * Token management — create, list, revoke.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { requireStaging } from "../config";
import { asAlice } from "../helpers";

beforeAll(() => {
  requireStaging();
});

describe("token CRUD", () => {
  let createdTokenId: string;

  afterAll(async () => {
    if (createdTokenId) await asAlice("DELETE", `/v1/me/tokens/${createdTokenId}`);
  });

  it("create a scoped token", async () => {
    const resp = await asAlice("POST", "/v1/me/tokens", {
      name: "e2e-test-token",
      endpoint_scopes: ["publish"],
      package_scopes: ["@e2e-alice/*"],
      expires_in_days: 1,
    });
    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty("token");
    expect((resp.body.token as string).startsWith("ctx_")).toBe(true);
    createdTokenId = resp.body.id as string;
  });

  it("list tokens includes the new one", async () => {
    const resp = await asAlice("GET", "/v1/me/tokens");
    expect(resp.status).toBe(200);
    const tokens = resp.body.tokens as Array<{ id: string; name: string }>;
    expect(tokens.some((t) => t.id === createdTokenId)).toBe(true);
  });

  it("revoke the token", async () => {
    if (!createdTokenId) return;
    const resp = await asAlice("DELETE", `/v1/me/tokens/${createdTokenId}`);
    expect(resp.status).toBeLessThan(300);
    createdTokenId = ""; // prevent afterAll from double-deleting
  });
});

describe("deploy token scope override", () => {
  let deployTokenId: string;

  afterAll(async () => {
    if (deployTokenId) await asAlice("DELETE", `/v1/me/tokens/${deployTokenId}`);
  });

  it("create deploy token forces read-private scope", async () => {
    const resp = await asAlice("POST", "/v1/me/tokens", {
      name: "e2e-deploy",
      token_type: "deploy",
      endpoint_scopes: ["publish"], // should be overridden
      expires_in_days: 1,
    });
    expect(resp.status).toBe(201);

    const list = await asAlice("GET", "/v1/me/tokens");
    const tokens = list.body.tokens as Array<{ id: string; name: string; endpoint_scopes: string[] }>;
    const deploy = tokens.find((t) => t.name === "e2e-deploy");
    expect(deploy?.endpoint_scopes).toEqual(["read-private"]);
    deployTokenId = deploy?.id ?? "";
  });
});
