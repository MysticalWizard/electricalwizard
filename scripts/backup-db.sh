#!/usr/bin/env bash
# Dump the MongoDB database to a gzipped archive with mongodump.
# Connection settings come from .env (see scripts/lib/mongo.sh).
#
#   BACKUP_DIR        output directory (default: <repo>/backups)
#   BACKUP_KEEP_DAYS  delete archives older than this; 0 keeps all (default: 14)
#
# Restore with:
#   mongorestore --uri <uri> --archive=<file> --gzip --drop
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/mongo.sh"
require_cmd mongodump

dir="${BACKUP_DIR:-$root/backups}"
keep_days="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$dir"
out="$dir/${db}_$(date +%Y%m%d_%H%M%S).archive.gz"

if ! mongodump --uri "mongodb://$host/$db" --archive="$out" --gzip "${auth_args[@]}"; then
  rm -f "$out"
  exit 1
fi
echo "Backup written to $out ($(du -h "$out" | cut -f1))"

if (( keep_days > 0 )); then
  find "$dir" -maxdepth 1 -name "${db}_*.archive.gz" -mtime "+$keep_days" -print -delete
fi
