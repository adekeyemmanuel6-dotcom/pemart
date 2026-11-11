#!/usr/bin/env bash
# Rebuild lib/catalogue/fixture.json from the local database (run `npm run db:local` first).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${PEMART_DB:-pemart_local}"
OUT=lib/catalogue/fixture.json
if [ "$(id -u)" = "0" ]; then su postgres -c "psql -d $DB -t -A -f $PWD/scripts/export-fixture.sql" > "$OUT"; else psql -d "$DB" -t -A -f scripts/export-fixture.sql > "$OUT"; fi
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
