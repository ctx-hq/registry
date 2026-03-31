-- MCP Hub: add category column for fast sidebar filtering
ALTER TABLE mcp_metadata ADD COLUMN category TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_mcp_category ON mcp_metadata(category);
