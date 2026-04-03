#!/bin/bash
# Deploy Registry (Hono + CF Workers → registry.getctx.org)
# Usage: bash scripts/deploy.sh [--skip-test] [--no-cache]

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZONE_ID="REDACTED_ZONE_ID"

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
DIM=$'\033[2m'
RESET=$'\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}!${RESET} $*"; }
err()  { echo -e "${RED}✗${RESET} $*"; }
dim()  { echo -e "${DIM}$*${RESET}"; }

SKIP_CACHE="false"
SKIP_TEST="false"

for arg in "$@"; do
  case "$arg" in
    --no-cache)  SKIP_CACHE="true" ;;
    --skip-test) SKIP_TEST="true" ;;
    --help|-h)
      echo "Usage: bash scripts/deploy.sh [--skip-test] [--no-cache]"
      exit 0
      ;;
    *) err "Unknown argument: $arg"; exit 1 ;;
  esac
done

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  err "CLOUDFLARE_API_TOKEN is not set"
  exit 1
fi

echo -e "${GREEN}━━━ Deploying API ━━━${RESET}"

cd "$DIR"

if [ "$SKIP_TEST" != "true" ]; then
  dim "  Running tests..."
  test_output=$(pnpm test 2>&1)
  if echo "$test_output" | grep -q "Tests.*passed"; then
    ok "API tests passed"
  else
    err "API tests failed — aborting"
    echo "$test_output" | tail -10
    exit 1
  fi
fi

dim "  Deploying to CF Workers..."
output=$(npx wrangler deploy 2>&1)
if echo "$output" | grep -q "Deployed"; then
  version=$(echo "$output" | grep "Version ID" | sed 's/.*: //')
  ok "API deployed → registry.getctx.org"
  dim "  Version: $version"
else
  err "API deploy failed"
  echo "$output" | tail -5
  exit 1
fi

if [ "$SKIP_CACHE" != "true" ]; then
  dim "  Purging CDN cache..."
  result=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"purge_everything":true}' 2>&1)
  if echo "$result" | grep -q '"success":true'; then
    ok "CDN cache purged"
  else
    warn "Cache purge may have failed"
  fi
else
  dim "  Cache purge skipped (--no-cache)"
fi

echo ""
ok "Done!"
