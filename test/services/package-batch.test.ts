import { describe, it, expect } from "vitest";
import { getLatestVersionsBatch } from "../../src/services/package";

function createMockDB(versionResults: Record<string, unknown>[]) {
  return {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: versionResults }),
      }),
    }),
  } as unknown as D1Database;
}

describe("getLatestVersionsBatch", () => {
  it("returns empty map for empty input", async () => {
    const db = createMockDB([]);
    const result = await getLatestVersionsBatch(db, []);
    expect(result.size).toBe(0);
  });

  it("picks highest semver per package", async () => {
    const db = createMockDB([
      { package_id: "pkg-1", version: "1.0.0" },
      { package_id: "pkg-1", version: "1.2.0" },
      { package_id: "pkg-1", version: "1.1.0" },
      { package_id: "pkg-2", version: "2.0.0" },
      { package_id: "pkg-2", version: "0.9.0" },
    ]);

    const result = await getLatestVersionsBatch(db, ["pkg-1", "pkg-2"]);
    expect(result.get("pkg-1")).toBe("1.2.0");
    expect(result.get("pkg-2")).toBe("2.0.0");
  });

  it("returns nothing for packages with no non-yanked versions", async () => {
    const db = createMockDB([]);
    const result = await getLatestVersionsBatch(db, ["pkg-1"]);
    expect(result.has("pkg-1")).toBe(false);
  });

  it("handles single version", async () => {
    const db = createMockDB([
      { package_id: "pkg-1", version: "0.1.0" },
    ]);

    const result = await getLatestVersionsBatch(db, ["pkg-1"]);
    expect(result.get("pkg-1")).toBe("0.1.0");
  });
});
