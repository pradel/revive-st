#!/bin/sh
# Starts the Revive ST server. With `S3_BUCKET` set, Litestream runs it and
# ships the database to that bucket as it changes (see litestream.yml),
# forwarding stop signals to the server and syncing once more when it exits.
set -u

if [ -z "${S3_BUCKET:-}" ]; then
  echo "Database backups off: S3_BUCKET is not set"
  exec node dist/main.mjs
fi
: "${DATABASE_PATH:?DATABASE_PATH is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required with S3_BUCKET}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required with S3_BUCKET}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required with S3_BUCKET}"

exec litestream replicate -exec "node dist/main.mjs"
