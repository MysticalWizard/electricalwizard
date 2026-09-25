#!/usr/bin/env bash
# Dump the MongoDB database to a gzipped archive with mongodump.
#
# Reads MONGODB_* from .env (same defaults as src/config.ts); variables
# already in the environment take precedence.
#
#   BACKUP_DIR        output directory (default: <repo>/backups)
#   BACKUP_KEEP_DAYS  delete archives older than this; 0 keeps all (default: 14)
#
# Restore with:
#   mongorestore --uri <uri> --archive=<file> --gzip --drop
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$root/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    [[ -n "${!key+x}" ]] && continue
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done < "$root/.env"
fi

if ! command -v mongodump >/dev/null; then
  echo "mongodump not found; install MongoDB Database Tools" >&2
  exit 1
fi

host="${MONGODB_HOST:-localhost:27017}"
db="${MONGODB_DB:-electricalwizard}"
dir="${BACKUP_DIR:-$root/backups}"
keep_days="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$dir"
out="$dir/${db}_$(date +%Y%m%d_%H%M%S).archive.gz"

args=(--uri "mongodb://$host/$db" --archive="$out" --gzip)

# Pass credentials via a temp config file so the password stays out of ps.
if [[ -n "${MONGODB_USER:-}" && -n "${MONGODB_PASSWORD:-}" ]]; then
  cfg="$(mktemp)"
  trap 'rm -f "$cfg"' EXIT
  chmod 600 "$cfg"
  escaped="${MONGODB_PASSWORD//\\/\\\\}"
  printf 'password: "%s"\n' "${escaped//\"/\\\"}" > "$cfg"
  args+=(--username "$MONGODB_USER" --authenticationDatabase admin --config "$cfg")
fi

if ! mongodump "${args[@]}"; then
  rm -f "$out"
  exit 1
fi
echo "Backup written to $out ($(du -h "$out" | cut -f1))"

if (( keep_days > 0 )); then
  find "$dir" -maxdepth 1 -name "${db}_*.archive.gz" -mtime "+$keep_days" -print -delete
fi
