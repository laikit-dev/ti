#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Set DATABASE_PASSWORD, then run this command again." >&2
  exit 1
fi

# Migrate the previous root configuration once, without changing an existing value.
if ! grep -q '^DATABASE_PASSWORD=' .env; then
  legacy_password=$(sed -n 's/^MARIADB_PASSWORD=//p' .env | head -n 1)
  if [ -n "$legacy_password" ]; then
    printf '\n# Added automatically while migrating the deployment configuration.\nDATABASE_PASSWORD=%s\n' "$legacy_password" >> .env
  fi
fi

database_password=$(sed -n 's/^DATABASE_PASSWORD=//p' .env | head -n 1)
case "$database_password" in
  ""|change-this-*)
    echo "Set DATABASE_PASSWORD in .env to a long, random value." >&2
    exit 1
    ;;
esac

git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker compose -f docker-compose.prod.yml ps
