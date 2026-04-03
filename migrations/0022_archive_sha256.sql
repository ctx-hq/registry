-- Add archive_sha256 to store the SHA256 hash of the actual archive blob (not the manifest).
-- This enables clients to verify download integrity.
ALTER TABLE versions ADD COLUMN archive_sha256 TEXT NOT NULL DEFAULT '';
