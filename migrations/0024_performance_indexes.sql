-- Performance indexes for common query patterns

-- Org member listing by org
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);

-- Package access lookups by package and user
CREATE INDEX IF NOT EXISTS idx_package_access_pkg ON package_access(package_id);
CREATE INDEX IF NOT EXISTS idx_package_access_user ON package_access(user_id);

-- Notification cleanup queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
