# ctx Web API

Hono + Cloudflare Workers API for getctx.org registry.

## Dev & Test

```bash
pnpm dev          # Local dev server
pnpm test         # Run vitest
pnpm typecheck    # TypeScript check
pnpm db:migrate   # Apply D1 migrations locally
bash scripts/deploy.sh  # Deploy to CF Workers
```

## Architecture

- `src/routes/` — Hono route handlers (packages, search, publish, resolve, auth, scanner, orgs, agent, download)
- `src/services/` — Business logic (scanner, importer)
- `src/middleware/` — Auth, CORS, rate limiting
- `src/utils/` — Naming validation, semver, error types, response helpers
- `migrations/` — D1 SQL migrations (0001-0004)

## CF Bindings

- **DB** (D1) — Package metadata, users, orgs
- **FORMULAS** (R2) — Formula archives
- **CACHE** (KV) — Rate limiting, device flow state
