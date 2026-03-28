import { describe, it, expect } from "vitest";
import type { EnrichmentMessage, EnrichmentMessageType } from "../../src/models/types";

describe("enrichment types", () => {
  it("supports all message types", () => {
    const types: EnrichmentMessageType[] = ["vectorize", "enrich", "vectorize_and_enrich"];
    for (const t of types) {
      const msg: EnrichmentMessage = { type: t, packageId: "test-id" };
      expect(msg.type).toBe(t);
      expect(msg.packageId).toBe("test-id");
    }
  });

  it("message serializes to valid JSON", () => {
    const msg: EnrichmentMessage = { type: "vectorize_and_enrich", packageId: "pkg-123" };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as EnrichmentMessage;
    expect(parsed.type).toBe("vectorize_and_enrich");
    expect(parsed.packageId).toBe("pkg-123");
  });
});

describe("content hash idempotency", () => {
  async function computeHash(text: string): Promise<string> {
    const buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  it("same content produces same hash", async () => {
    const h1 = await computeHash("test content");
    const h2 = await computeHash("test content");
    expect(h1).toBe(h2);
  });

  it("different content produces different hash", async () => {
    const h1 = await computeHash("content a");
    const h2 = await computeHash("content b");
    expect(h1).not.toBe(h2);
  });

  it("hash is 64 hex chars", async () => {
    const h = await computeHash("anything");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
