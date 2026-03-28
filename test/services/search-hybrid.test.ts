import { describe, it, expect } from "vitest";
import { mergeRRF } from "../../src/services/search";

describe("hybrid search - RRF merge", () => {
  it("merges two ranked lists correctly", () => {
    const fts = [
      { id: "a", full_name: "@s/a" },
      { id: "b", full_name: "@s/b" },
      { id: "c", full_name: "@s/c" },
    ];
    const vec = [
      { id: "b", full_name: "@s/b" },
      { id: "d", full_name: "@s/d" },
      { id: "a", full_name: "@s/a" },
    ];

    const result = mergeRRF(fts, vec);

    // "b" appears rank 2 in FTS (score 1/62) + rank 1 in vec (score 1/61) = highest
    // "a" appears rank 1 in FTS (score 1/61) + rank 3 in vec (score 1/63) = second
    expect(result[0]).toBe("b");
    expect(result[1]).toBe("a");
    expect(result).toContain("c");
    expect(result).toContain("d");
    expect(result.length).toBe(4);
  });

  it("returns FTS results when vector is empty", () => {
    const fts = [
      { id: "x", full_name: "@s/x" },
      { id: "y", full_name: "@s/y" },
    ];
    const result = mergeRRF(fts, []);

    expect(result).toEqual(["x", "y"]);
  });

  it("returns vector results when FTS is empty", () => {
    const vec = [
      { id: "p", full_name: "@s/p" },
      { id: "q", full_name: "@s/q" },
    ];
    const result = mergeRRF([], vec);

    expect(result).toEqual(["p", "q"]);
  });

  it("handles both empty", () => {
    const result = mergeRRF([], []);
    expect(result).toEqual([]);
  });

  it("deduplicates IDs across lists", () => {
    const fts = [{ id: "same", full_name: "@s/same" }];
    const vec = [{ id: "same", full_name: "@s/same" }];

    const result = mergeRRF(fts, vec);
    expect(result).toEqual(["same"]);
  });

  it("preserves relative order within single source", () => {
    const fts = [
      { id: "1", full_name: "@s/1" },
      { id: "2", full_name: "@s/2" },
      { id: "3", full_name: "@s/3" },
    ];
    const result = mergeRRF(fts, []);

    expect(result).toEqual(["1", "2", "3"]);
  });
});
