-- Organization and team management

CREATE TABLE orgs (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL UNIQUE,
    display_name   TEXT NOT NULL DEFAULT '',
    created_by     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE org_members (
    org_id         TEXT NOT NULL,
    user_id        TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'member',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (org_id, user_id),
    FOREIGN KEY (org_id) REFERENCES orgs(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
