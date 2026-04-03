/**
 * Static security scanner for package content.
 * Mirrors the detection rules in ctx CLI's internal/securityscan/scanner.go.
 */

export type Severity = "critical" | "high" | "medium";

export interface ScanFinding {
  file: string;
  line: number;
  rule: string;
  severity: Severity;
  message: string;
  match: string;
}

export interface ScanResult {
  findings: ScanFinding[];
  scanned: number;
  passed: boolean;
  hasCritical: boolean;
}

interface Rule {
  id: string;
  pattern: RegExp;
  severity: Severity;
  message: string;
}

const rules: Rule[] = [
  // Remote code execution
  { id: "RCE001", pattern: /curl\s.*\|\s*(ba)?sh/, severity: "critical", message: "Remote code execution: curl piped to shell" },
  { id: "RCE002", pattern: /wget\s.*\|\s*(ba)?sh/, severity: "critical", message: "Remote code execution: wget piped to shell" },
  { id: "RCE003", pattern: /base64\s+(-d|--decode).*\|\s*(ba)?sh/, severity: "critical", message: "Obfuscated payload execution: base64 decode piped to shell" },

  // Code injection
  { id: "INJ001", pattern: /eval\s*\(.*\$/, severity: "high", message: "Code injection: eval with variable interpolation" },
  { id: "INJ002", pattern: /exec\s*\(.*\$/, severity: "high", message: "Code injection: exec with variable interpolation" },

  // Credential theft
  { id: "CRED001", pattern: /(cat|<)\s*~\/\.ssh\//, severity: "high", message: "SSH key access detected" },
  { id: "CRED002", pattern: /(^|\s)(printenv|\/proc\/self\/environ)/, severity: "high", message: "Environment variable enumeration detected" },

  // Reverse shell
  { id: "SHELL001", pattern: /\/dev\/tcp\//, severity: "critical", message: "Reverse shell: /dev/tcp connection" },
  { id: "SHELL002", pattern: /mkfifo.*\bnc\b/, severity: "critical", message: "Reverse shell: mkfifo with netcat" },

  // Data exfiltration
  { id: "EXFIL001", pattern: /curl.*-d.*\$\(/, severity: "high", message: "Potential data exfiltration: curl POST with command substitution" },

  // Excessive permissions
  { id: "PERM001", pattern: /chmod\s+777/, severity: "medium", message: "Excessive file permissions: chmod 777" },
];

const scannableExts = new Set([
  ".sh", ".bash", ".zsh",
  ".py", ".rb", ".pl",
  ".js", ".ts", ".mjs", ".cjs",
  ".yaml", ".yml",
]);

/**
 * Scan a single file's content for security issues.
 */
export function scanContent(filename: string, content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      const match = rule.pattern.exec(line);
      if (match) {
        let matchStr = match[0];
        if (matchStr.length > 80) matchStr = matchStr.slice(0, 80) + "...";
        findings.push({
          file: filename,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          message: rule.message,
          match: matchStr,
        });
      }
    }
  }

  return findings;
}

/**
 * Determine if a filename should be scanned based on extension.
 */
export function isScannable(filename: string): boolean {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const ext = filename.slice(dotIdx).toLowerCase();
  return scannableExts.has(ext);
}

/**
 * Compute scan status from findings.
 */
export function computeScanStatus(findings: ScanFinding[]): "clean" | "suspicious" | "malicious" {
  let hasCritical = false;
  let hasHigh = false;

  for (const f of findings) {
    if (f.severity === "critical") hasCritical = true;
    if (f.severity === "high") hasHigh = true;
  }

  if (hasCritical) return "malicious";
  if (hasHigh) return "suspicious";
  if (findings.length > 0) return "suspicious";
  return "clean";
}

/**
 * Build a ScanResult from findings.
 */
export function buildResult(findings: ScanFinding[], scanned: number): ScanResult {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const passed = !findings.some((f) => f.severity === "critical" || f.severity === "high");
  return { findings, scanned, passed, hasCritical };
}
