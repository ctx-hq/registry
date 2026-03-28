import { describe, it, expect } from "vitest";
import { CATEGORIES } from "../../src/services/categories";

describe("categories", () => {
  it("has unique slugs", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all slugs are kebab-case", () => {
    for (const cat of CATEGORIES) {
      expect(cat.slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("all have name and description", () => {
    for (const cat of CATEGORIES) {
      expect(cat.name.length).toBeGreaterThan(0);
      expect(cat.description.length).toBeGreaterThan(0);
    }
  });

  it("includes essential categories", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(slugs).toContain("programming");
    expect(slugs).toContain("ai-ml");
    expect(slugs).toContain("devops");
    expect(slugs).toContain("security");
    expect(slugs).toContain("testing");
    expect(slugs).toContain("other");
  });

  it("has at least 30 categories", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(30);
  });
});
