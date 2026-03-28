#!/bin/bash
# Show ctx registry status — single D1 query via wrangler
set -euo pipefail

npx wrangler d1 execute ctx-registry --remote --json --command="
  SELECT
    -- D1 core
    (SELECT COUNT(*) FROM packages) as packages,
    (SELECT COUNT(*) FROM versions) as versions,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM orgs) as orgs,
    (SELECT COUNT(*) FROM org_members) as org_members,
    (SELECT COUNT(*) FROM scopes) as scopes,
    (SELECT COUNT(*) FROM api_tokens) as api_tokens,
    (SELECT COUNT(*) FROM categories) as categories,
    (SELECT COUNT(*) FROM vector_chunks) as vector_chunks,
    (SELECT COUNT(*) FROM audit_events) as audit_events,

    -- Package types
    (SELECT COUNT(*) FROM packages WHERE type='skill') as type_skill,
    (SELECT COUNT(*) FROM packages WHERE type='mcp') as type_mcp,
    (SELECT COUNT(*) FROM packages WHERE type='cli') as type_cli,

    -- Versions
    (SELECT COUNT(*) FROM versions WHERE yanked=1) as versions_yanked,
    (SELECT COUNT(DISTINCT package_id) FROM versions) as packages_with_versions,

    -- Downloads
    (SELECT COALESCE(SUM(downloads),0) FROM packages) as total_downloads,
    (SELECT COALESCE(MAX(downloads),0) FROM packages) as max_downloads,

    -- Enrichment
    (SELECT COUNT(*) FROM packages WHERE enrichment_status='enriched') as enriched,
    (SELECT COUNT(*) FROM packages WHERE enrichment_status='failed') as enrich_failed,
    (SELECT COUNT(*) FROM packages WHERE enrichment_status='pending') as enrich_pending,
    (SELECT COUNT(*) FROM packages WHERE enrichment_status='queued') as enrich_queued,

    -- Vectorization
    (SELECT COUNT(*) FROM packages WHERE vectorized_at IS NOT NULL) as vectorized,

    -- Import sources
    (SELECT COUNT(*) FROM packages WHERE import_source='skillsgate') as src_skillsgate,
    (SELECT COUNT(*) FROM packages WHERE import_source='lobehub') as src_lobehub,
    (SELECT COUNT(*) FROM packages WHERE import_source='' OR import_source IS NULL) as src_native,

    -- Scanner
    (SELECT COUNT(*) FROM scanner_sources) as scanner_sources,
    (SELECT COUNT(*) FROM scanner_sources WHERE enabled=1) as scanner_enabled,
    (SELECT COUNT(*) FROM scanner_candidates) as scanner_candidates,
    (SELECT COUNT(*) FROM scanner_candidates WHERE status='pending') as scanner_pending,
    (SELECT COUNT(*) FROM scanner_candidates WHERE status='imported') as scanner_imported,
    (SELECT COUNT(*) FROM scanner_candidates WHERE status='rejected') as scanner_rejected,

    -- FTS health
    (SELECT COUNT(*) FROM packages_fts) as fts_rows,

    -- Recent activity
    (SELECT COUNT(*) FROM packages WHERE created_at > datetime('now','-24 hours')) as pkg_last_24h,
    (SELECT COUNT(*) FROM packages WHERE created_at > datetime('now','-7 days')) as pkg_last_7d,
    (SELECT COUNT(*) FROM audit_events WHERE created_at > datetime('now','-24 hours')) as audit_last_24h
" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const r = d[0]?.results?.[0];
if (!r) { console.log('No data'); process.exit(1); }

const G = '\x1b[32m', D = '\x1b[2m', Y = '\x1b[33m', R = '\x1b[0m';

console.log(G + '━━━ ctx registry status ━━━' + R + '\n');

console.log(G + 'Packages' + R);
console.log('  total:     ' + r.packages + D + '  (skill:' + r.type_skill + ' mcp:' + r.type_mcp + ' cli:' + r.type_cli + ')' + R);
console.log('  versions:  ' + r.versions + (r.versions_yanked > 0 ? Y + '  (' + r.versions_yanked + ' yanked)' + R : ''));
console.log('  downloads: ' + r.total_downloads + D + '  (max single: ' + r.max_downloads + ')' + R);
console.log('');

console.log(G + 'Users & Orgs' + R);
console.log('  users:       ' + r.users);
console.log('  orgs:        ' + r.orgs + D + '  (members: ' + r.org_members + ')' + R);
console.log('  scopes:      ' + r.scopes);
console.log('  api_tokens:  ' + r.api_tokens);
console.log('');

console.log(G + 'Enrichment' + R);
const eTotal = r.enriched + r.enrich_failed + r.enrich_pending + r.enrich_queued;
const ePct = eTotal > 0 ? Math.round(r.enriched / eTotal * 100) : 0;
console.log('  enriched:  ' + r.enriched + '/' + eTotal + ' (' + ePct + '%)');
if (r.enrich_failed > 0)  console.log('  failed:    ' + Y + r.enrich_failed + R);
if (r.enrich_pending > 0) console.log('  pending:   ' + r.enrich_pending);
if (r.enrich_queued > 0)  console.log('  queued:    ' + r.enrich_queued);
console.log('');

console.log(G + 'Vectorization' + R);
const vPct = r.packages > 0 ? Math.round(r.vectorized / r.packages * 100) : 0;
console.log('  vectorized:    ' + r.vectorized + '/' + r.packages + ' (' + vPct + '%)');
console.log('  vector_chunks: ' + r.vector_chunks);
console.log('');

console.log(G + 'Import Sources' + R);
if (r.src_native > 0)     console.log('  native:     ' + r.src_native);
if (r.src_skillsgate > 0) console.log('  external-a: ' + r.src_skillsgate);
if (r.src_lobehub > 0)    console.log('  external-b: ' + r.src_lobehub);
console.log('');

console.log(G + 'Scanner' + R);
console.log('  sources:    ' + r.scanner_sources + D + '  (enabled: ' + r.scanner_enabled + ')' + R);
console.log('  candidates: ' + r.scanner_candidates + D + '  (pending:' + r.scanner_pending + ' imported:' + r.scanner_imported + ' rejected:' + r.scanner_rejected + ')' + R);
console.log('');

console.log(G + 'Search Index' + R);
console.log('  fts_rows:   ' + r.fts_rows + (r.fts_rows !== r.packages ? Y + '  (mismatch!)' + R : D + '  (synced)' + R));
console.log('  categories: ' + r.categories);
console.log('');

console.log(G + 'Recent Activity' + R);
console.log('  packages (24h): ' + r.pkg_last_24h);
console.log('  packages (7d):  ' + r.pkg_last_7d);
console.log('  audit (24h):    ' + r.audit_last_24h);
"
