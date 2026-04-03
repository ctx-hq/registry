-- Add security scan status and findings to versions.
-- scan_status: 'pending' (not yet scanned), 'clean', 'suspicious', 'malicious'
-- scan_findings: JSON array of findings
ALTER TABLE versions ADD COLUMN scan_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE versions ADD COLUMN scan_findings TEXT NOT NULL DEFAULT '[]';
