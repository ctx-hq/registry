import { describe, it, expect } from "vitest";
import { isValidFullName, isValidScope, parseFullName, formatFullName } from "../../src/utils/naming";

describe("naming", () => {
  describe("isValidFullName", () => {
    it("accepts valid names", () => {
      expect(isValidFullName("@hong/my-skill")).toBe(true);
      expect(isValidFullName("@openelf/code-review")).toBe(true);
      expect(isValidFullName("@community/ripgrep")).toBe(true);
      expect(isValidFullName("@a/b")).toBe(true);
      expect(isValidFullName("@test123/pkg-name")).toBe(true);
    });

    it("rejects invalid names", () => {
      expect(isValidFullName("")).toBe(false);
      expect(isValidFullName("bare-name")).toBe(false);
      expect(isValidFullName("@/name")).toBe(false);
      expect(isValidFullName("@scope/")).toBe(false);
      expect(isValidFullName("@UPPER/case")).toBe(false);
      expect(isValidFullName("@scope/name_underscore")).toBe(false);
      expect(isValidFullName("@-leading/name")).toBe(false);
      expect(isValidFullName("@scope/-leading")).toBe(false);
      expect(isValidFullName("@scope/trailing-")).toBe(false);
    });
  });

  describe("isValidScope", () => {
    it("accepts valid scopes", () => {
      expect(isValidScope("hong")).toBe(true);
      expect(isValidScope("open-elf")).toBe(true);
      expect(isValidScope("a1b2c3")).toBe(true);
    });

    it("rejects invalid scopes", () => {
      expect(isValidScope("")).toBe(false);
      expect(isValidScope("-leading")).toBe(false);
      expect(isValidScope("trailing-")).toBe(false);
      expect(isValidScope("UPPER")).toBe(false);
    });
  });

  describe("parseFullName", () => {
    it("parses valid names", () => {
      expect(parseFullName("@hong/my-skill")).toEqual({ scope: "hong", name: "my-skill" });
      expect(parseFullName("@community/ripgrep")).toEqual({ scope: "community", name: "ripgrep" });
    });

    it("returns null for invalid", () => {
      expect(parseFullName("invalid")).toBe(null);
    });
  });

  describe("formatFullName", () => {
    it("formats correctly", () => {
      expect(formatFullName("hong", "my-skill")).toBe("@hong/my-skill");
    });
  });
});
