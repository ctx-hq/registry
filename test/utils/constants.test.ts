import { describe, it, expect } from "vitest";
import {
  RATE_LIMIT_MAX_ANON,
  RATE_LIMIT_MAX_AUTH,
  SORT_FIELDS,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_MEMBER_LIMIT,
  MAX_MEMBER_LIMIT,
  CORS_ALLOWED_ORIGINS,
  isAllowedOrigin,
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

  describe("CORS", () => {
    it("allows getctx.org origins", () => {
      expect(isAllowedOrigin("https://getctx.org")).toBe(true);
      expect(isAllowedOrigin("https://www.getctx.org")).toBe(true);
    });

    it("allows localhost for development", () => {
      expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
      expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
      expect(isAllowedOrigin("http://127.0.0.1:8080")).toBe(true);
    });

    it("rejects unknown origins", () => {
      expect(isAllowedOrigin("https://evil.com")).toBe(false);
      expect(isAllowedOrigin("https://getctx.org.evil.com")).toBe(false);
      expect(isAllowedOrigin("http://getctx.org")).toBe(false); // http not https
    });

    it("rejects undefined/empty", () => {
      expect(isAllowedOrigin(undefined)).toBe(false);
      expect(isAllowedOrigin("")).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(isAllowedOrigin("not-a-url")).toBe(false);
    });

    it("rejects non-http(s) protocols on localhost", () => {
      expect(isAllowedOrigin("capacitor://localhost")).toBe(false);
      expect(isAllowedOrigin("file://localhost")).toBe(false);
      expect(isAllowedOrigin("ftp://localhost")).toBe(false);
    });
  });
});
