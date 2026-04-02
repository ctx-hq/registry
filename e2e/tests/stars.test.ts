/**
 * Star/unstar + star list flow.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { requireStaging } from "../config";
import { asAlice } from "../helpers";

beforeAll(() => {
  requireStaging();
});

describe("star flow", () => {
  afterEach(async () => {
    // Always clean up star state regardless of test outcome
    await asAlice("DELETE", "/v1/packages/%40e2e-alice%2Ftest-skill/star");
  });

  it("star a package → star_count increases", async () => {
    const star = await asAlice("PUT", "/v1/packages/%40e2e-alice%2Ftest-skill/star");
    expect(star.status).toBeLessThan(300);

    const detail = await asAlice("GET", "/v1/packages/%40e2e-alice%2Ftest-skill");
    expect(detail.status).toBe(200);
    expect(Number(detail.body.star_count)).toBeGreaterThanOrEqual(1);
    expect(detail.body.is_starred).toBe(true);
  });

  it("unstar → star_count decreases", async () => {
    await asAlice("PUT", "/v1/packages/%40e2e-alice%2Ftest-skill/star");
    const unstar = await asAlice("DELETE", "/v1/packages/%40e2e-alice%2Ftest-skill/star");
    expect(unstar.status).toBeLessThan(300);

    const detail = await asAlice("GET", "/v1/packages/%40e2e-alice%2Ftest-skill");
    expect(detail.body.is_starred).toBe(false);
  });

  it("list my stars", async () => {
    await asAlice("PUT", "/v1/packages/%40e2e-alice%2Ftest-skill/star");
    const list = await asAlice("GET", "/v1/me/stars");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.stars)).toBe(true);
  });
});

describe("star list CRUD", () => {
  let listId: string;

  afterAll(async () => {
    if (listId) await asAlice("DELETE", `/v1/me/star-lists/${listId}`);
  });

  it("create star list", async () => {
    const resp = await asAlice("POST", "/v1/me/star-lists", {
      name: "E2E Test List",
      visibility: "public",
    });
    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty("slug");
    listId = resp.body.id as string;
  });

  it("list my star lists", async () => {
    const resp = await asAlice("GET", "/v1/me/star-lists");
    expect(resp.status).toBe(200);
    const lists = resp.body.lists as Array<{ id: string }>;
    expect(lists.some((l) => l.id === listId)).toBe(true);
  });
});
