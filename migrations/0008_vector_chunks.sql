-- Track vectorized chunks per package for re-indexing

CREATE TABLE vector_chunks (
    id             TEXT PRIMARY KEY,
    package_id     TEXT NOT NULL,
    chunk_index    INTEGER NOT NULL,
    chunk_text     TEXT NOT NULL,
    content_hash   TEXT NOT NULL,
    vectorized_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    UNIQUE(package_id, chunk_index)
);
CREATE INDEX idx_vector_chunks_pkg ON vector_chunks(package_id);
