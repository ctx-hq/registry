import { parseSemVer, compareSemVer, type SemVer } from "../utils/semver";

export interface VersionRow {
  version: string;
  manifest: string;
  sha256: string;
  formula_key: string;
  yanked: number;
}

// Resolve a version constraint against available versions.
export function resolveVersion(versions: VersionRow[], constraint: string): VersionRow | null {
  const nonYanked = versions.filter((v) => !v.yanked);
  if (nonYanked.length === 0) return null;

  // Sort by semver descending so [0] is the highest version
  nonYanked.sort((a, b) => {
    const svA = parseSemVer(a.version);
    const svB = parseSemVer(b.version);
    if (!svA && !svB) return 0;
    if (!svA) return 1;
    if (!svB) return -1;
    return compareSemVer(svB, svA);
  });

  // Wildcard / latest
  if (!constraint || constraint === "*" || constraint === "latest") {
    return nonYanked[0]; // highest semver after sort above
  }

  // Exact match
  const exact = nonYanked.find((v) => v.version === constraint);
  if (exact) return exact;

  // Caret constraint: ^1.2.3
  if (constraint.startsWith("^")) {
    const target = parseSemVer(constraint.slice(1));
    if (!target) return nonYanked[0];

    const matching = nonYanked.filter((v) => {
      const sv = parseSemVer(v.version);
      if (!sv) return false;
      if (compareSemVer(sv, target) < 0) return false;
      if (target.major === 0) return sv.major === 0 && sv.minor === target.minor;
      return sv.major === target.major;
    });

    return matching.length > 0 ? matching[0] : null;
  }

  // Tilde constraint: ~1.2.3
  if (constraint.startsWith("~")) {
    const target = parseSemVer(constraint.slice(1));
    if (!target) return nonYanked[0];

    const matching = nonYanked.filter((v) => {
      const sv = parseSemVer(v.version);
      if (!sv) return false;
      if (compareSemVer(sv, target) < 0) return false;
      return sv.major === target.major && sv.minor === target.minor;
    });

    return matching.length > 0 ? matching[0] : null;
  }

  // >= constraint
  if (constraint.startsWith(">=")) {
    const target = parseSemVer(constraint.slice(2));
    if (!target) return nonYanked[0];
    const matching = nonYanked.filter((v) => {
      const sv = parseSemVer(v.version);
      return sv ? compareSemVer(sv, target) >= 0 : false;
    });
    return matching.length > 0 ? matching[0] : null;
  }

  // Fallback: return latest
  return nonYanked[0];
}
