import { describe, it, expect } from "vitest";
import { validatePublishInput } from "../../src/services/publish";

describe("publish validation", () => {
  it("accepts valid manifest", () => {
    const result = validatePublishInput({
      manifest: {
        name: "@hong/my-skill",
        version: "1.0.0",
        type: "skill",
        description: "test",
      },
      manifestText: "{}",
      archiveData: null,
      userId: "user1",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.parsed?.fullName).toBe("@hong/my-skill");
    expect(result.parsed?.scope).toBe("hong");
    expect(result.parsed?.version).toBe("1.0.0");
  });

  it("rejects invalid name", () => {
    const result = validatePublishInput({
      manifest: { name: "BadName", version: "1.0.0", type: "skill" },
      manifestText: "{}",
      archiveData: null,
      userId: "user1",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid version", () => {
    const result = validatePublishInput({
      manifest: { name: "@hong/test", version: "bad", type: "skill" },
      manifestText: "{}",
      archiveData: null,
      userId: "user1",
    });

    expect(result.valid).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = validatePublishInput({
      manifest: { name: "@hong/test", version: "1.0.0", type: "invalid" },
      manifestText: "{}",
      archiveData: null,
      userId: "user1",
    });

    expect(result.valid).toBe(false);
  });
});
