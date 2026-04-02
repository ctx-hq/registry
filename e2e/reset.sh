#!/bin/bash
# Reset staging database: apply all migrations + seed data.
# Usage: bash e2e/reset.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Applying migrations to ctx-staging..."
wrangler d1 migrations apply ctx-staging --env staging --remote

echo "Seeding test data..."
wrangler d1 execute ctx-staging --env staging --remote --file e2e/seed.sql

echo "✓ Staging database reset complete."
