-- Core tables for ctx registry

CREATE TABLE users (
    id             TEXT PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    email          TEXT NOT NULL DEFAULT '',
    avatar_url     TEXT NOT NULL DEFAULT '',
    github_id      TEXT NOT NULL UNIQUE,
    api_key_hash   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE scopes (
    name           TEXT PRIMARY KEY,
    owner_type     TEXT NOT NULL DEFAULT 'user',
    owner_id       TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE packages (
    id             TEXT PRIMARY KEY,
    scope          TEXT NOT NULL,
    name           TEXT NOT NULL,
    full_name      TEXT NOT NULL UNIQUE,
    type           TEXT NOT NULL CHECK (type IN ('skill', 'mcp', 'cli')),
    description    TEXT NOT NULL DEFAULT '',
    repository     TEXT NOT NULL DEFAULT '',
    license        TEXT NOT NULL DEFAULT '',
    keywords       TEXT NOT NULL DEFAULT '[]',
    platforms      TEXT NOT NULL DEFAULT '[]',
    owner_id       TEXT NOT NULL,
    downloads      INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (scope) REFERENCES scopes(name),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX idx_packages_type ON packages(type);
CREATE INDEX idx_packages_owner ON packages(owner_id);
CREATE INDEX idx_packages_downloads ON packages(downloads DESC);

CREATE TABLE versions (
    id             TEXT PRIMARY KEY,
    package_id     TEXT NOT NULL,
    version        TEXT NOT NULL,
    manifest       TEXT NOT NULL,
    readme         TEXT NOT NULL DEFAULT '',
    formula_key    TEXT NOT NULL DEFAULT '',
    sha256         TEXT NOT NULL DEFAULT '',
    yanked         INTEGER NOT NULL DEFAULT 0,
    published_by   TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (package_id) REFERENCES packages(id),
    UNIQUE(package_id, version)
);
CREATE INDEX idx_versions_pkg ON versions(package_id);

CREATE TABLE api_tokens (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    token_hash     TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL DEFAULT '',
    scopes         TEXT NOT NULL DEFAULT '["*"]',
    expires_at     TEXT,
    last_used_at   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_events (
    id             TEXT PRIMARY KEY,
    actor_id       TEXT NOT NULL,
    action         TEXT NOT NULL,
    target_type    TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    metadata       TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_target ON audit_events(target_type, target_id);
