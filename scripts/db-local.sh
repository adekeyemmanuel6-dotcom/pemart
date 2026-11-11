#!/usr/bin/env bash
# Build a throwaway local Postgres database from migrations + seed.
# Usage: npm run db:local          (needs a local Postgres 15+ and the `postgres` OS user)
set -euo pipefail
DB="${PEMART_DB:-pemart_local}"
cd "$(dirname "$0")/.."
PSQL="psql -v ON_ERROR_STOP=1 -q"
run() { if [ "$(id -u)" = "0" ]; then su postgres -c "$*"; else bash -c "$*"; fi; }

run "psql -q -c 'drop database if exists $DB'" 
run "psql -q -c 'create database $DB'"
feed() { # feed a file into the database
  if [ "$(id -u)" = "0" ]; then su postgres -c "$PSQL -d $DB" < "$1"; else $PSQL -d "$DB" < "$1"; fi
}
feed supabase/local-stub.sql
for f in supabase/migrations/*.sql; do echo "-> $f"; feed "$f"; done
feed supabase/seed.sql
echo "Local database '$DB' ready."
