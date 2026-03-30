import { describe, it, expect } from "vitest";
import { extractTypeMetadata } from "../../src/services/publish";

// Minimal mock DB that tracks SQL executions
function createTrackingDB() {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    _executed: executed,
    prepare(sql: string) {
      let boundParams: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },
        async run() {
          executed.push({ sql, params: boundParams });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return db as unknown as D1Database & { _executed: typeof executed };
}

describe("extractTypeMetadata", () => {
  it("extracts CLI auth field into cli_metadata", async () => {
    const db = createTrackingDB();
    await extractTypeMetadata(db, "v1", {
      type: "cli",
      cli: {
        binary: "fizzy",
        verify: "fizzy --version",
        auth: "Run 'fizzy setup' to configure your API token",
      },
      install: {
        script: "https://example.com/install.sh",
      },
    });

    const cliInsert = db._executed.find((e) =>
      e.sql.includes("cli_metadata"),
    );
    expect(cliInsert).toBeDefined();
    expect(cliInsert!.sql).toContain("auth");
    // cli_metadata bind order: versionId, binary, verify, compatible, require_bins, require_env, auth
    expect(cliInsert!.params[6]).toBe(
      "Run 'fizzy setup' to configure your API token",
    );
  });

  it("extracts gem field into install_metadata", async () => {
    const db = createTrackingDB();
    await extractTypeMetadata(db, "v1", {
      type: "cli",
      cli: {
        binary: "gem-tool",
      },
      install: {
        gem: "gem-tool-cli",
      },
    });

    const installInsert = db._executed.find((e) =>
      e.sql.includes("install_metadata"),
    );
    expect(installInsert).toBeDefined();
    expect(installInsert!.sql).toContain("gem");
    // install_metadata bind order: versionId, source, brew, npm, pip, gem, cargo, script, platforms
    expect(installInsert!.params[5]).toBe("gem-tool-cli");
  });

  it("defaults auth to empty string when not provided", async () => {
    const db = createTrackingDB();
    await extractTypeMetadata(db, "v1", {
      type: "cli",
      cli: {
        binary: "no-auth-tool",
      },
    });

    const cliInsert = db._executed.find((e) =>
      e.sql.includes("cli_metadata"),
    );
    expect(cliInsert).toBeDefined();
    // cli_metadata bind order: versionId, binary, verify, compatible, require_bins, require_env, auth
    expect(cliInsert!.params[6]).toBe("");
  });

  it("defaults gem to empty string when not provided", async () => {
    const db = createTrackingDB();
    await extractTypeMetadata(db, "v1", {
      type: "cli",
      cli: { binary: "test" },
      install: {
        brew: "test-formula",
      },
    });

    const installInsert = db._executed.find((e) =>
      e.sql.includes("install_metadata"),
    );
    expect(installInsert).toBeDefined();
    // install_metadata bind order: versionId, source, brew, npm, pip, gem, cargo, script, platforms
    expect(installInsert!.params[5]).toBe("");
  });
});
