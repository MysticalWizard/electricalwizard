#!/usr/bin/env bash
# Install dependencies, build everything and (re)start all pm2 processes.
# Run on the server after `git pull`. Nothing is restarted if a step fails.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v pm2 >/dev/null; then
  echo "pm2 not found; install it with: pnpm add -g pm2" >&2
  exit 1
fi

pnpm install --frozen-lockfile
pnpm build:all

# Starts any process that isn't running yet and picks up .env changes.
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
