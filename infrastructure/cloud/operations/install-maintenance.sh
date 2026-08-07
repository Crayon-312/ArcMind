#!/bin/sh

set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "maintenance install: run as root" >&2
  exit 1
fi

source_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
deploy_dir="/opt/arcmind"
operations_dir="${deploy_dir}/operations"

if [ ! -f "${deploy_dir}/compose.yml" ] || [ ! -f "${deploy_dir}/.env" ]; then
  echo "maintenance install: ArcMind deployment is missing from ${deploy_dir}" >&2
  exit 1
fi

install -d -o root -g root -m 755 "$operations_dir"
install -o root -g root -m 755 \
  "${source_dir}/operations/check-certificate.sh" \
  "${source_dir}/operations/check-postgres-backup.sh" \
  "${source_dir}/operations/backup-postgres.sh" \
  "$operations_dir"
install -o root -g root -m 644 \
  "${source_dir}/systemd/arcmind-certificate-check.service" \
  "${source_dir}/systemd/arcmind-certificate-check.timer" \
  "${source_dir}/systemd/arcmind-postgres-backup.service" \
  "${source_dir}/systemd/arcmind-postgres-backup.timer" \
  /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now arcmind-certificate-check.timer arcmind-postgres-backup.timer

echo "maintenance install: ArcMind certificate and backup timers are enabled"
