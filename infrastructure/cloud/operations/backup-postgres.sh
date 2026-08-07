#!/bin/sh

set -eu
umask 077

deploy_dir="${ARCMIND_DEPLOY_DIR:-/opt/arcmind}"
backup_dir="${ARCMIND_BACKUP_DIR:-${deploy_dir}/backups}"
retention_days="${ARCMIND_BACKUP_RETENTION_DAYS:-14}"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

case "$retention_days" in
  ''|*[!0-9]*) echo "database backup: retention days must be an integer" >&2; exit 2 ;;
esac
if [ ! -f "${deploy_dir}/compose.yml" ] || [ ! -f "${deploy_dir}/.env" ]; then
  echo "database backup: ArcMind deployment files are missing from ${deploy_dir}" >&2
  exit 1
fi

install -d -m 700 "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_file="${backup_dir}/arcmind-${timestamp}.dump"
temporary_file="${final_file}.partial"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

docker compose \
  --project-directory "$deploy_dir" \
  --env-file "${deploy_dir}/.env" \
  -f "${deploy_dir}/compose.yml" \
  exec -T postgres \
  pg_dump \
  --username=arcmind \
  --dbname=arcmind \
  --format=custom \
  --no-owner \
  --no-privileges >"$temporary_file"

chmod 600 "$temporary_file"
"${script_dir}/check-postgres-backup.sh" "$temporary_file"
mv "$temporary_file" "$final_file"
trap - EXIT HUP INT TERM

find "$backup_dir" \
  -maxdepth 1 \
  -type f \
  -name 'arcmind-*.dump' \
  -mtime "+${retention_days}" \
  -delete

echo "database backup: created and checked ${final_file}"
