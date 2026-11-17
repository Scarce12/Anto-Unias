#!/usr/bin/env bash
# Crea (o recrea con --reset) la base local "manicura_dev" con el esquema completo, para pruebas sin Docker.
set -euo pipefail
PGBIN="${PGBIN:-/e/tools/pg/pgsql/bin}"
PGPORT="${PGPORT:-54329}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
export PGCLIENTENCODING=UTF8
PSQL=("$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h localhost -p "$PGPORT" -U postgres)

if [ "${1:-}" = "--reset" ]; then
  "${PSQL[@]}" -d postgres -c "drop database if exists manicura_dev with (force)"
fi
if "${PSQL[@]}" -d postgres -Atc "select 1 from pg_database where datname='manicura_dev'" | grep -q 1; then
  echo "La base manicura_dev ya existe (usá --reset para recrearla)."
  exit 0
fi
"${PSQL[@]}" -d postgres -c "create database manicura_dev"
"${PSQL[@]}" -d manicura_dev -f "$RAIZ/supabase/tests/00_stub_supabase.sql"
"${PSQL[@]}" -d manicura_dev -c "create schema if not exists extensions; grant usage on schema extensions to anon, authenticated, service_role;"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "== $(basename "$f")"
  "${PSQL[@]}" -d manicura_dev -f "$f"
done
"${PSQL[@]}" -d manicura_dev -f "$RAIZ/tools/supabase-lite/preparar-db.sql"
echo "Base manicura_dev lista."
