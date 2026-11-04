#!/usr/bin/env bash
# Prueba las migraciones + escenarios contra un Postgres local temporal.
# Requiere binarios de PostgreSQL (initdb, pg_ctl, psql). Uso:
#   PG_BIN=/usr/lib/postgresql/16/bin ./supabase/tests/run_local.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
trap '"$PG_BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PG_BIN/initdb" -D "$DATA" -U postgres >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$HERE/00_supabase_stub.sql"
for f in "$HERE"/../migrations/*.sql; do echo "▶ $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
echo "▶ escenarios"; "${PSQL[@]}" -o /dev/null -f "$HERE/10_scenarios.sql"
echo "✔ OK"
