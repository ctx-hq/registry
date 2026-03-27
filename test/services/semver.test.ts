import { describe, it, expect } from "vitest";
import { parseSemVer, isValidSemVer, compareSemVer, semVerToString } from "../../src/utils/semver";

describe("semver", () => {
  describe("parseSemVer", () => {
    it("parses valid versions", () => {
      expect(parseSemVer("1.0.0")).toEqual({
        major: 1, minor: 0, patch: 0, prerelease: "", raw: "1.0.0",
      });
      expect(parseSemVer("14.1.0")).toEqual({
        major: 14, minor: 1, patch: 0, prerelease: "", raw: "14.1.0",
      });
      expect(parseSemVer("1.0.0-beta.1")).toEqual({
        major: 1, minor: 0, patch: 0, prerelease: "beta.1", raw: "1.0.0-beta.1",
      });
      expect(parseSemVer("v2.3.4")).toEqual({
        major: 2, minor: 3, patch: 4, prerelease: "", raw: "2.3.4",
      });
    });

    it("returns null for invalid", () => {
      expect(parseSemVer("invalid")).toBe(null);
      expect(parseSemVer("1.0")).toBe(null);
      expect(parseSemVer("")).toBe(null);
    });
  });

  describe("isValidSemVer", () => {
    it("validates correctly", () => {
      expect(isValidSemVer("1.0.0")).toBe(true);
      expect(isValidSemVer("0.0.1-alpha")).toBe(true);
      expect(isValidSemVer("nope")).toBe(false);
    });
  });

  describe("compareSemVer", () => {
    it("compares versions", () => {
      const a = parseSemVer("1.0.0")!;
      const b = parseSemVer("1.0.1")!;
      expect(compareSemVer(a, b)).toBeLessThan(0);
      expect(compareSemVer(b, a)).toBeGreaterThan(0);
      expect(compareSemVer(a, a)).toBe(0);
    });

    it("prerelease sorts before release", () => {
      const release = parseSemVer("1.0.0")!;
      const pre = parseSemVer("1.0.0-beta")!;
      expect(compareSemVer(release, pre)).toBeGreaterThan(0);
    });

    it("compares major versions", () => {
      const v1 = parseSemVer("1.9.9")!;
      const v2 = parseSemVer("2.0.0")!;
      expect(compareSemVer(v1, v2)).toBeLessThan(0);
    });
  });

  describe("semVerToString", () => {
    it("formats without prerelease", () => {
      expect(semVerToString({ major: 1, minor: 2, patch: 3, prerelease: "", raw: "" })).toBe("1.2.3");
    });

    it("formats with prerelease", () => {
      expect(semVerToString({ major: 1, minor: 0, patch: 0, prerelease: "rc.1", raw: "" })).toBe("1.0.0-rc.1");
    });
  });
});
