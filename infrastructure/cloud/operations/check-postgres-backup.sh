#!/bin/sh

set -eu

deploy_dir="${ARCMIND_DEPLOY_DIR:-/opt/arcmind}"
backup_file="${1:-}"

if [ -z "$backup_file" ]; then
  echo "backup check: pass the backup file path" >&2
  exit 2
fi
if [ ! -f "$backup_file" ]; then
  echo "backup check: file does not exist: ${backup_file}" >&2
  exit 1
fi
if [ ! -s "$backup_file" ]; then
  echo "backup check: file is empty: ${backup_file}" >&2
  exit 1
fi
if [ ! -f "${deploy_dir}/compose.yml" ] || [ ! -f "${deploy_dir}/.env" ]; then
  echo "backup check: ArcMind deployment files are missing from ${deploy_dir}" >&2
  exit 1
fi

docker compose \
  --project-directory "$deploy_dir" \
  --env-file "${deploy_dir}/.env" \
  -f "${deploy_dir}/compose.yml" \
  exec -T postgres pg_restore --list <"$backup_file" >/dev/null

echo "backup check: PostgreSQL archive structure is readable: ${backup_file}"
