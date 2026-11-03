#!/bin/sh
# Starts the Revive ST server. With `S3_BUCKET` set, Litestream also ships the
# database to that bucket (see litestream.yml): its changes every hour, a full
# snapshot once a day, and a last sync when the server stops. A failed backup
# is logged and retried an hour later. The server's exit ends the container.
set -u

if [ -z "${S3_BUCKET:-}" ]; then
  echo "Database backups off: S3_BUCKET is not set"
  exec node dist/main.mjs
fi
: "${DATABASE_PATH:?DATABASE_PATH is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required with S3_BUCKET}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required with S3_BUCKET}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required with S3_BUCKET}"

# The UTC day of the last snapshot, kept beside the database.
snapshot_day="$(dirname "$DATABASE_PATH")/.revivest-snapshot-day"

backup() {
  today=$(date -u +%F)
  if [ "$(cat "$snapshot_day" 2>/dev/null)" = "$today" ]; then
    litestream replicate -once
  else
    litestream replicate -once -force-snapshot -enforce-retention &&
      echo "$today" >"$snapshot_day"
  fi || echo "Database backup failed, next try in an hour" >&2
}

node dist/main.mjs &
server=$!
stopping=
trap 'stopping=1; kill -TERM "$server" 2>/dev/null' TERM INT

# The first backup a minute after start, once the server has migrated the
# database, then every hour.
next=$(($(date +%s) + 60))
while [ -z "$stopping" ] && kill -0 "$server" 2>/dev/null; do
  if [ "$(date +%s)" -ge "$next" ]; then
    backup
    next=$(($(date +%s) + 3600))
  fi
  # In the background, so a signal interrupts the wait right away.
  sleep 5 &
  wait $!
done
# A signal also interrupts this wait: wait until the server has exited.
wait "$server"
status=$?
while kill -0 "$server" 2>/dev/null; do
  wait "$server"
  status=$?
done

litestream replicate -once || echo "Database backup failed at shutdown" >&2
exit "$status"
