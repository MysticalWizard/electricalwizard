#!/usr/bin/env bash
# Export every collection to <dir>/<timestamp>/<collection>.json as
# pretty-printed Extended JSON with mongoexport. Connection settings come
# from .env (see scripts/lib/mongo.sh).
#
#   EXPORT_DIR  output directory (default: <repo>/exports)
#
# Re-import a collection with:
#   mongoimport --uri <uri> --collection <name> --jsonArray --file <file>
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/mongo.sh"
require_cmd mongosh mongoexport

out="${EXPORT_DIR:-$root/exports}/$(date +%Y%m%d_%H%M%S)"

# Skips the internal change feed (src/services/changeFeed.ts) and system
# collections. Credentials are read from the environment, not argv.
collections="$(MONGO_HOST="$host" MONGO_DB="$db" mongosh --nodb --quiet --eval '
  const { MONGO_HOST, MONGO_DB, MONGODB_USER, MONGODB_PASSWORD } = process.env;
  const conn = new Mongo(`mongodb://${MONGO_HOST}`);
  if (MONGODB_USER && MONGODB_PASSWORD) {
    conn.getDB("admin").auth(MONGODB_USER, MONGODB_PASSWORD);
  }
  conn.getDB(MONGO_DB).getCollectionNames()
    .filter((n) => n !== "changefeed" && !n.startsWith("system."))
    .forEach((n) => print(n));
')"

if [[ -z "$collections" ]]; then
  echo "No collections found in $db" >&2
  exit 1
fi

mkdir -p "$out"
while IFS= read -r name; do
  mongoexport --uri "mongodb://$host/$db" --collection "$name" \
    --jsonArray --pretty --out "$out/$name.json" "${auth_args[@]}"
done <<< "$collections"

echo "Exported to $out"
