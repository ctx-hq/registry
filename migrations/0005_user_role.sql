-- Add role column to users table for admin access control
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Create system scanner user for auto-imported packages
INSERT OR IGNORE INTO users (id, username, email, avatar_url, github_id, role)
VALUES ('system-scanner', 'scanner', '', '', 'system-scanner', 'admin');
