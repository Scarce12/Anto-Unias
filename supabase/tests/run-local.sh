#!/usr/bin/env bash
# Crea una base temporal en un PostgreSQL local, aplica stub + migraciones y corre las pruebas.
# Variables: PGBIN (carpeta bin de PostgreSQL), PGPORT (default 54329)
set -euo pipefail
PGBIN="${PGBIN:-/e/tools/pg/pgsql/bin}"
PGPORT="${PGPORT:-54329}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PGCLIENTENCODING=UTF8
PSQL=("$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h localhost -p "$PGPORT" -U postgres)

"${PSQL[@]}" -d postgres -c "drop database if exists manicura_test" -c "create database manicura_test"
"${PSQL[@]}" -d manicura_test -f "$DIR/tests/00_stub_supabase.sql"
"${PSQL[@]}" -d manicura_test -c "create schema if not exists extensions; grant usage on schema extensions to anon, authenticated, service_role;"
for f in "$DIR"/migrations/*.sql; do
  echo "== $(basename "$f")"
  "${PSQL[@]}" -d manicura_test -f "$f"
done
echo "== pruebas"
"${PSQL[@]}" -d manicura_test -f "$DIR/tests/10_pruebas.sql" -o /dev/null 2>&1 | sed -E "s/^psql:[^N]*NOTICE:  //"
