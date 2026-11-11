#!/usr/bin/env bash
# Build a fresh e2e database, then run the Playwright suite. Usage: npm run test:e2e [-- playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
PEMART_DB=pemart_e2e bash scripts/db-local.sh >/dev/null
rm -rf .outbox .next/cache/fetch-cache
npx playwright test "$@"
