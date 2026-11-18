#!/usr/bin/env bash
# Build a fresh e2e database, then run the Playwright suite. Usage: npm run test:e2e [-- playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
PEMART_DB=pemart_e2e bash scripts/db-local.sh >/dev/null
# Delivery rates ship unverified (the owner confirms them); the buying flows need them verified.
psql "postgres://postgres:postgres@localhost:5432/pemart_e2e" -qc "update delivery_zones set rate_verified = true" >/dev/null
rm -rf .outbox .next/cache/fetch-cache
npx playwright test "$@"
