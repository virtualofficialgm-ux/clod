#!/usr/bin/env bash
# Локальный Postgres без Docker, совместимый по портам с `supabase start` (54322, postgres/postgres).
# Использование: supabase/local/db.sh start|stop|reset [--no-seed]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/tmp/parri-pgdata}"
PORT="${PGPORT:-54322}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); fi

psql_db() { PGPASSWORD=postgres "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

start() {
  if [ ! -d "$PGDATA" ]; then
    mkdir -p "$PGDATA"; [ "${#RUN_AS[@]}" -gt 0 ] && chown postgres "$PGDATA"
    local pw; pw="$(mktemp)"; echo postgres > "$pw"; chmod 644 "$pw"
    "${RUN_AS[@]}" "$PGBIN/initdb" -D "$PGDATA" -U postgres --pwfile="$pw" --auth=scram-sha-256 -E UTF8 --locale=C.UTF-8 >/dev/null
    rm -f "$pw"
  fi
  if ! "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -w \
      -o "-p $PORT -c listen_addresses=127.0.0.1 -k /tmp" start >/dev/null
  fi
  echo "postgres: postgresql://postgres:postgres@127.0.0.1:$PORT/postgres"
}

stop() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null || true; }

reset() {
  start
  psql_db -d template1 -c "drop database if exists postgres with (force)" -c "create database postgres"
  psql_db -d postgres -f "$HERE/stub.sql" >/dev/null
  for f in "$ROOT"/migrations/*.sql; do psql_db -d postgres -f "$f" >/dev/null; done
  if [ "${1:-}" != "--no-seed" ]; then
    # Порядок как в config.toml [db.seed]: справочники, затем демо-данные
    for f in "$ROOT"/seed/*.sql; do [ -e "$f" ] && psql_db -d postgres -f "$f" >/dev/null; done
    psql_db -d postgres -f "$ROOT/seed.sql" >/dev/null
  fi
  echo "database reset: $(ls "$ROOT"/migrations/*.sql | wc -l) migrations applied"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  reset) shift; reset "${1:-}" ;;
  *) echo "usage: $0 start|stop|reset [--no-seed]"; exit 1 ;;
esac
