#!/usr/bin/env bash
# Build a fresh e2e database, then run the Playwright suite. Usage: npm run test:e2e [-- playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
PEMART_DB=pemart_e2e bash scripts/db-local.sh >/dev/null
# Delivery rates and day estimates ship unconfirmed (the owner enters them); the buying flows need verified rates and a 3-5 day estimate.
psql "postgres://postgres:postgres@localhost:5432/pemart_e2e" -qc "update delivery_zones set rate_verified = true, min_days = 3, max_days = 5" >/dev/null
rm -rf .outbox .next/cache/fetch-cache
npx playwright test "$@"
