import { describe, it, expect } from "vitest";

/**
 * R2 key format conventions:
 *   archives/@scope/name/version.tar.gz      — package archives
 *   artifacts/@scope/name/version/platform.tar.gz — platform binaries
 */

function archiveKey(name: string, version: string): string {
  return `archives/${name}/${version}.tar.gz`;
}

function artifactKey(fullName: string, version: string, platform: string): string {
  return `artifacts/${fullName}/${version}/${platform}.tar.gz`;
}

describe("archive key format", () => {
  it("generates correct key for scoped package", () => {
    expect(archiveKey("@hong/my-skill", "1.0.0")).toBe("archives/@hong/my-skill/1.0.0.tar.gz");
  });

  it("generates correct key for nested scope", () => {
    expect(archiveKey("@anthropic/mcp-installer", "2.1.0")).toBe("archives/@anthropic/mcp-installer/2.1.0.tar.gz");
  });

  it("handles prerelease versions", () => {
    expect(archiveKey("@test/pkg", "1.0.0-beta.1")).toBe("archives/@test/pkg/1.0.0-beta.1.tar.gz");
  });

  it("preserves @ in scope", () => {
    const key = archiveKey("@scope/name", "1.0.0");
    expect(key).toContain("@scope");
    expect(key).toMatch("archives/");
  });
});

describe("artifact key format", () => {
  it("generates correct key for platform artifact", () => {
    expect(artifactKey("@hong/cli-tool", "1.0.0", "darwin-arm64")).toBe(
      "artifacts/@hong/cli-tool/1.0.0/darwin-arm64.tar.gz",
    );
  });

  it("handles all standard platforms", () => {
    const platforms = ["darwin-arm64", "darwin-amd64", "linux-amd64", "linux-arm64", "windows-amd64"];
    for (const p of platforms) {
      const key = artifactKey("@test/bin", "2.0.0", p);
      expect(key).toBe(`artifacts/@test/bin/2.0.0/${p}.tar.gz`);
    }
  });
});

describe("key path safety", () => {
  it("no path traversal in archive key", () => {
    // Names are validated before reaching R2, but verify the key itself is safe
    const key = archiveKey("@scope/name", "1.0.0");
    expect(key).not.toContain("..");
    expect(key).not.toMatch(/\/\//); // no double slashes
  });

  it("no path traversal in artifact key", () => {
    const key = artifactKey("@scope/name", "1.0.0", "darwin-arm64");
    expect(key).not.toContain("..");
    expect(key).not.toMatch(/\/\//);
  });
});

describe("key consistency", () => {
  it("same package different versions have consistent prefix", () => {
    const k1 = archiveKey("@hong/skill", "1.0.0");
    const k2 = archiveKey("@hong/skill", "2.0.0");
    const prefix = "archives/@hong/skill/";
    expect(k1).toMatch(prefix);
    expect(k2).toMatch(prefix);
  });

  it("archives and artifacts are in separate namespaces", () => {
    const archive = archiveKey("@test/pkg", "1.0.0");
    const artifact = artifactKey("@test/pkg", "1.0.0", "linux-amd64");
    expect(archive).toMatch("archives/");
    expect(artifact).toMatch("artifacts/");
    // No overlap possible
    expect(archive).not.toMatch("artifacts/");
    expect(artifact).not.toMatch("archives/");
  });
});
