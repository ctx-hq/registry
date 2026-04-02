-- E2E seed data for staging environment.
-- Token hashes are SHA-256 of known test tokens stored in .env.staging (not in this file).
-- Run after migrations: wrangler d1 execute ctx-staging --env staging --file e2e/seed.sql

-- Temporarily disable FK checks for bulk seed insert
PRAGMA foreign_keys = OFF;

-- ── Users ──
INSERT OR IGNORE INTO users (id, username, email, avatar_url, github_id, role, created_at, updated_at)
VALUES
  ('e2e-user-alice', 'e2e-alice', 'alice@e2e.test', '', 'test:alice', 'user', datetime('now'), datetime('now')),
  ('e2e-user-bob',   'e2e-bob',   'bob@e2e.test',   '', 'test:bob',   'user', datetime('now'), datetime('now'));

-- ── Organization (before scopes that reference it) ──
INSERT OR IGNORE INTO orgs (id, name, display_name, created_by, status, created_at)
VALUES ('e2e-org-1', 'e2e-org', 'E2E Test Org', 'e2e-user-alice', 'active', datetime('now'));

-- ── Scopes ──
INSERT OR IGNORE INTO scopes (name, owner_type, owner_id, created_at)
VALUES
  ('e2e-alice', 'user', 'e2e-user-alice', datetime('now')),
  ('e2e-bob',   'user', 'e2e-user-bob',   datetime('now')),
  ('e2e-org',   'org',  'e2e-org-1',      datetime('now'));

-- ── API Tokens ──
-- alice: full access (token value in .env.staging, not here)
INSERT OR IGNORE INTO api_tokens (id, user_id, token_hash, name, endpoint_scopes, package_scopes, token_type, created_at)
VALUES ('e2e-tok-alice', 'e2e-user-alice',
  'ab2fdef24120608f487aab4807390aca224f58e3254556e6d938e3584bf5cb9c',
  'e2e-full', '["*"]', '["*"]', 'personal', datetime('now'));

-- bob: publish only, scoped to @e2e-bob/*
INSERT OR IGNORE INTO api_tokens (id, user_id, token_hash, name, endpoint_scopes, package_scopes, token_type, created_at)
VALUES ('e2e-tok-bob', 'e2e-user-bob',
  'be6043eb42626f7c7141224db924b146f28f39ee020a243007e83d534b120aeb',
  'e2e-publish', '["publish"]', '["@e2e-bob/*"]', 'personal', datetime('now'));

-- ── Organization Members ──
INSERT OR IGNORE INTO org_members (org_id, user_id, role)
VALUES
  ('e2e-org-1', 'e2e-user-alice', 'owner'),
  ('e2e-org-1', 'e2e-user-bob',   'member');

-- ── Packages ──
INSERT OR IGNORE INTO packages (id, scope, name, full_name, type, description, owner_type, owner_id, visibility, created_at, updated_at)
VALUES
  ('e2e-pkg-skill', 'e2e-alice', 'test-skill', '@e2e-alice/test-skill', 'skill',
   'E2E test skill for automated testing', 'user', 'e2e-user-alice', 'public', datetime('now'), datetime('now')),
  ('e2e-pkg-cli', 'e2e-alice', 'private-tool', '@e2e-alice/private-tool', 'cli',
   'E2E private CLI tool', 'user', 'e2e-user-alice', 'private', datetime('now'), datetime('now')),
  ('e2e-pkg-mcp', 'e2e-org', 'org-mcp', '@e2e-org/org-mcp', 'mcp',
   'E2E org MCP server', 'org', 'e2e-org-1', 'public', datetime('now'), datetime('now'));

-- ── Versions ──
INSERT OR IGNORE INTO versions (id, package_id, version, manifest, readme, sha256, published_by, created_at)
VALUES
  ('e2e-ver-skill', 'e2e-pkg-skill', '0.1.0',
   '{"name":"@e2e-alice/test-skill","version":"0.1.0","type":"skill","description":"E2E test skill"}',
   '# Test Skill\n\nFor E2E testing.',
   'e2e-sha256-skill', 'e2e-user-alice', datetime('now')),
  ('e2e-ver-cli', 'e2e-pkg-cli', '0.1.0',
   '{"name":"@e2e-alice/private-tool","version":"0.1.0","type":"cli","description":"E2E private CLI"}',
   '# Private Tool',
   'e2e-sha256-cli', 'e2e-user-alice', datetime('now')),
  ('e2e-ver-mcp', 'e2e-pkg-mcp', '0.1.0',
   '{"name":"@e2e-org/org-mcp","version":"0.1.0","type":"mcp","description":"E2E org MCP","mcp":{"transport":"stdio","command":"echo"}}',
   '# Org MCP',
   'e2e-sha256-mcp', 'e2e-user-alice', datetime('now'));

-- ── Dist Tags ──
INSERT OR IGNORE INTO dist_tags (id, package_id, tag, version_id, updated_at)
VALUES
  ('e2e-dt-1', 'e2e-pkg-skill', 'latest', 'e2e-ver-skill', datetime('now')),
  ('e2e-dt-2', 'e2e-pkg-cli',   'latest', 'e2e-ver-cli',   datetime('now')),
  ('e2e-dt-3', 'e2e-pkg-mcp',   'latest', 'e2e-ver-mcp',   datetime('now'));

PRAGMA foreign_keys = ON;
