import { describe, it, expect } from "vitest";
import { visibilityCondition } from "../../src/services/visibility";

describe("visibilityCondition", () => {
  it("returns public-only filter for anonymous users", () => {
    const result = visibilityCondition(null);
    expect(result.sql).toBe("visibility = 'public'");
    expect(result.params).toEqual([]);
  });

  it("returns full visibility filter for authenticated users", () => {
    const result = visibilityCondition("user-123");
    expect(result.sql).toContain("visibility = 'public'");
    expect(result.sql).toContain("owner_type = 'user'");
    expect(result.sql).toContain("org_members");
    expect(result.sql).toContain("package_access");
    expect(result.params).toEqual(["user-123", "user-123", "user-123", "user-123"]);
  });

  it("includes owner/admin bypass for private org packages", () => {
    const result = visibilityCondition("user-456");
    expect(result.sql).toContain("role IN ('owner', 'admin')");
  });
});
