-- Add new columns to mcp_metadata for multi-transport, require, and hooks support
ALTER TABLE mcp_metadata ADD COLUMN transports TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mcp_metadata ADD COLUMN require_bins TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mcp_metadata ADD COLUMN hooks TEXT NOT NULL DEFAULT '[]';

-- Upstream version tracking
CREATE TABLE IF NOT EXISTS upstream_tracking (
    package_id    TEXT PRIMARY KEY,
    tracking_type TEXT NOT NULL,
    tracking_key  TEXT NOT NULL,
    latest_known  TEXT NOT NULL DEFAULT '',
    last_checked  TEXT NOT NULL DEFAULT (datetime('now')),
    check_status  TEXT NOT NULL DEFAULT 'ok',
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

-- Upstream update records (detected version bumps)
CREATE TABLE IF NOT EXISTS upstream_updates (
    id            TEXT PRIMARY KEY,
    package_id    TEXT NOT NULL,
    old_version   TEXT NOT NULL,
    new_version   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    detected_at   TEXT NOT NULL DEFAULT (datetime('now')),
    published_at  TEXT,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_upstream_tracking_type ON upstream_tracking(tracking_type);
CREATE INDEX IF NOT EXISTS idx_upstream_updates_package ON upstream_updates(package_id);
CREATE INDEX IF NOT EXISTS idx_upstream_updates_status ON upstream_updates(status);

-- Package submission requests (user-submitted packaging leads)
CREATE TABLE IF NOT EXISTS package_submissions (
    id             TEXT PRIMARY KEY,
    source_url     TEXT NOT NULL,
    source_type    TEXT NOT NULL,
    package_type   TEXT,
    submitted_by   TEXT,
    reason         TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    auto_detected  TEXT NOT NULL DEFAULT '{}',
    reviewer_notes TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON package_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_source ON package_submissions(source_url);
