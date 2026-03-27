// Shared types for the ctx registry API

export type PackageType = "skill" | "mcp" | "cli";

export interface PackageRow {
  id: string;
  scope: string;
  name: string;
  full_name: string;
  type: PackageType;
  description: string;
  repository: string;
  license: string;
  keywords: string; // JSON array
  platforms: string; // JSON array
  owner_id: string;
  downloads: number;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  id: string;
  package_id: string;
  version: string;
  manifest: string;
  readme: string;
  formula_key: string;
  sha256: string;
  yanked: number;
  published_by: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  github_id: string;
  api_key_hash: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface OrgRow {
  id: string;
  name: string;
  display_name: string;
  created_by: string;
  created_at: string;
}

export interface ScannerCandidateRow {
  id: string;
  source_id: string;
  external_id: string;
  external_url: string;
  detected_type: PackageType;
  detected_name: string;
  generated_manifest: string | null;
  status: "pending" | "approved" | "rejected" | "imported";
  confidence: number;
  stars: number;
  license: string;
  last_checked: string;
}
