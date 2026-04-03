import { describe, it, expect } from "vitest";
import {
  RATE_LIMIT_MAX_ANON,
  RATE_LIMIT_MAX_AUTH,
  SORT_FIELDS,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_MEMBER_LIMIT,
  MAX_MEMBER_LIMIT,
} from "../../src/utils/constants";

describe("constants", () => {
  it("auth rate limit is higher than anon", () => {
    expect(RATE_LIMIT_MAX_AUTH).toBeGreaterThan(RATE_LIMIT_MAX_ANON);
  });

  it("sort fields contains expected entries", () => {
    expect(SORT_FIELDS.get("created")).toBe("created_at");
    expect(SORT_FIELDS.get("downloads")).toBe("downloads");
    expect(SORT_FIELDS.get("updated")).toBe("updated_at");
    expect(SORT_FIELDS.get("stars")).toBe("star_count");
  });

  it("sort fields rejects prototype keys", () => {
    expect(SORT_FIELDS.get("constructor")).toBeUndefined();
    expect(SORT_FIELDS.get("__proto__")).toBeUndefined();
    expect(SORT_FIELDS.get("toString")).toBeUndefined();
  });

  it("pagination limits are consistent", () => {
    expect(DEFAULT_PAGE_LIMIT).toBeLessThanOrEqual(MAX_PAGE_LIMIT);
    expect(DEFAULT_MEMBER_LIMIT).toBeLessThanOrEqual(MAX_MEMBER_LIMIT);
  });
});
