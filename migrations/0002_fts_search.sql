-- Full-text search index

CREATE VIRTUAL TABLE packages_fts USING fts5(
    full_name, description, keywords, type,
    content='packages', content_rowid='rowid'
);

CREATE TRIGGER pkg_fts_ai AFTER INSERT ON packages BEGIN
    INSERT INTO packages_fts(rowid, full_name, description, keywords, type)
    VALUES (new.rowid, new.full_name, new.description, new.keywords, new.type);
END;

CREATE TRIGGER pkg_fts_au AFTER UPDATE ON packages BEGIN
    INSERT INTO packages_fts(packages_fts, rowid, full_name, description, keywords, type)
    VALUES ('delete', old.rowid, old.full_name, old.description, old.keywords, old.type);
    INSERT INTO packages_fts(rowid, full_name, description, keywords, type)
    VALUES (new.rowid, new.full_name, new.description, new.keywords, new.type);
END;

CREATE TRIGGER pkg_fts_ad AFTER DELETE ON packages BEGIN
    INSERT INTO packages_fts(packages_fts, rowid, full_name, description, keywords, type)
    VALUES ('delete', old.rowid, old.full_name, old.description, old.keywords, old.type);
END;
