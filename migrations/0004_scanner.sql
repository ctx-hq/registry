-- Content ecosystem scanner state tracking

CREATE TABLE scanner_sources (
    id             TEXT PRIMARY KEY,
    type           TEXT NOT NULL,
    source_key     TEXT NOT NULL UNIQUE,
    last_scanned   TEXT,
    cursor_state   TEXT NOT NULL DEFAULT '',
    total_found    INTEGER NOT NULL DEFAULT 0,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE scanner_candidates (
    id             TEXT PRIMARY KEY,
    source_id      TEXT NOT NULL,
    external_id    TEXT NOT NULL,
    external_url   TEXT NOT NULL,
    detected_type  TEXT NOT NULL,
    detected_name  TEXT NOT NULL DEFAULT '',
    generated_manifest TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    confidence     REAL NOT NULL DEFAULT 0.0,
    stars          INTEGER NOT NULL DEFAULT 0,
    license        TEXT NOT NULL DEFAULT '',
    last_checked   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, external_id),
    FOREIGN KEY (source_id) REFERENCES scanner_sources(id)
);
CREATE INDEX idx_candidates_status ON scanner_candidates(status);
CREATE INDEX idx_candidates_type ON scanner_candidates(detected_type);
CREATE INDEX idx_candidates_confidence ON scanner_candidates(confidence DESC);
