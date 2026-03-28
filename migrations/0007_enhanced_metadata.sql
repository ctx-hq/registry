-- Enhanced package metadata for enrichment, vector search, and import tracking

ALTER TABLE packages ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN capabilities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN homepage TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN author TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN author_url TEXT NOT NULL DEFAULT '';

-- Enrichment tracking
ALTER TABLE packages ADD COLUMN enrichment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE packages ADD COLUMN enriched_at TEXT;

-- Vector search tracking
ALTER TABLE packages ADD COLUMN vectorized_at TEXT;
ALTER TABLE packages ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';

-- Import provenance
ALTER TABLE packages ADD COLUMN import_source TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN import_external_id TEXT NOT NULL DEFAULT '';

-- Rebuild FTS5 index with new columns
DROP TRIGGER IF EXISTS pkg_fts_ai;
DROP TRIGGER IF EXISTS pkg_fts_au;
DROP TRIGGER IF EXISTS pkg_fts_ad;
DROP TABLE IF EXISTS packages_fts;

CREATE VIRTUAL TABLE packages_fts USING fts5(
    full_name, description, summary, keywords, capabilities, type,
    content='packages', content_rowid='rowid'
);

CREATE TRIGGER pkg_fts_ai AFTER INSERT ON packages BEGIN
    INSERT INTO packages_fts(rowid, full_name, description, summary, keywords, capabilities, type)
    VALUES (new.rowid, new.full_name, new.description, new.summary,
            new.keywords, new.capabilities, new.type);
END;

CREATE TRIGGER pkg_fts_au AFTER UPDATE ON packages BEGIN
    INSERT INTO packages_fts(packages_fts, rowid, full_name, description, summary, keywords, capabilities, type)
    VALUES ('delete', old.rowid, old.full_name, old.description, old.summary,
            old.keywords, old.capabilities, old.type);
    INSERT INTO packages_fts(rowid, full_name, description, summary, keywords, capabilities, type)
    VALUES (new.rowid, new.full_name, new.description, new.summary,
            new.keywords, new.capabilities, new.type);
END;

CREATE TRIGGER pkg_fts_ad AFTER DELETE ON packages BEGIN
    INSERT INTO packages_fts(packages_fts, rowid, full_name, description, summary, keywords, capabilities, type)
    VALUES ('delete', old.rowid, old.full_name, old.description, old.summary,
            old.keywords, old.capabilities, old.type);
END;

-- Rebuild FTS index from existing data
INSERT INTO packages_fts(packages_fts) VALUES ('rebuild');

-- Indexes for import dedup and enrichment queries
CREATE INDEX idx_packages_import ON packages(import_source, import_external_id);
CREATE INDEX idx_packages_enrichment ON packages(enrichment_status);
CREATE INDEX idx_packages_content_hash ON packages(content_hash);
