const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?$/;

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  raw: string;
}

export function parseSemVer(s: string): SemVer | null {
  const raw = s.startsWith("v") ? s.slice(1) : s;
  const m = SEMVER_RE.exec(raw);
  if (!m) return null;
  return {
    major: parseInt(m[1]),
    minor: parseInt(m[2]),
    patch: parseInt(m[3]),
    prerelease: m[5] ?? "",
    raw,
  };
}

export function isValidSemVer(s: string): boolean {
  return parseSemVer(s) !== null;
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === "" && b.prerelease !== "") return 1;
  if (a.prerelease !== "" && b.prerelease === "") return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

export function semVerToString(v: SemVer): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease) s += `-${v.prerelease}`;
  return s;
}
