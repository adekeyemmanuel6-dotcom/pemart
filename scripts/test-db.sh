#!/usr/bin/env bash
# Build a throwaway test database from the migrations and run the integration tests against it.
# Needs a local Postgres. Set TEST_DB_URL to a superuser connection string for the *server* (database name is added).
#   e.g. TEST_DB_URL=postgres://postgres:postgres@localhost:5432 npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${TEST_DB_URL:-postgres://postgres:postgres@localhost:5432}"
PEMART_DB=pemart_test bash scripts/db-local.sh >/dev/null
# The app must price from the same catalogue (same UUIDs) as the database it writes to.
PEMART_DB=pemart_test OUT=/tmp/pemart-test-fixture.json bash scripts/export-fixture.sh >/dev/null
TEST_DATABASE_URL="$BASE/pemart_test" PEMART_FIXTURE_PATH=/tmp/pemart-test-fixture.json npx vitest run tests/integration "$@"
