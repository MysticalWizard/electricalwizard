# Shared setup for the MongoDB scripts; source it, don't run it.
#
# Loads .env (variables already in the environment take precedence) and sets:
#   root       repo root
#   host, db   MONGODB_HOST and MONGODB_DB, with the same defaults as src/config.ts
#   auth_args  credential flags for mongodump/mongoexport (empty without auth)

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

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

host="${MONGODB_HOST:-localhost:27017}"
db="${MONGODB_DB:-electricalwizard}"

require_cmd() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null; then
      echo "$cmd not found; install MongoDB Database Tools / mongosh" >&2
      exit 1
    fi
  done
}

# Pass the password via a temp config file so it stays out of ps.
auth_args=()
if [[ -n "${MONGODB_USER:-}" && -n "${MONGODB_PASSWORD:-}" ]]; then
  auth_cfg="$(mktemp)"
  trap 'rm -f "$auth_cfg"' EXIT
  chmod 600 "$auth_cfg"
  escaped="${MONGODB_PASSWORD//\\/\\\\}"
  printf 'password: "%s"\n' "${escaped//\"/\\\"}" > "$auth_cfg"
  auth_args=(--username "$MONGODB_USER" --authenticationDatabase admin --config "$auth_cfg")
fi
