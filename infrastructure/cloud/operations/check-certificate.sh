#!/bin/sh

set -eu

host="${1:-${ARCMIND_PUBLIC_IP:-}}"
port="${ARCMIND_CERTIFICATE_PORT:-443}"
threshold_hours="${ARCMIND_CERTIFICATE_MIN_HOURS:-48}"

case "$port" in
  ''|*[!0-9]*) echo "certificate check: port must be an integer" >&2; exit 2 ;;
esac
case "$threshold_hours" in
  ''|*[!0-9]*) echo "certificate check: threshold hours must be an integer" >&2; exit 2 ;;
esac
if [ -z "$host" ]; then
  echo "certificate check: pass a host or set ARCMIND_PUBLIC_IP" >&2
  exit 2
fi

certificate_file="$(mktemp)"
trap 'rm -f "$certificate_file"' EXIT HUP INT TERM

if ! openssl s_client \
  -connect "${host}:${port}" \
  -servername "$host" \
  </dev/null 2>/dev/null \
  | openssl x509 -outform PEM >"$certificate_file"; then
  echo "certificate check: unable to read the certificate from ${host}:${port}" >&2
  exit 1
fi

threshold_seconds=$((threshold_hours * 60 * 60))
expiry="$(openssl x509 -in "$certificate_file" -noout -enddate)"
if ! openssl x509 -in "$certificate_file" -noout -checkend "$threshold_seconds"; then
  echo "certificate check: less than ${threshold_hours} hours remain; ${expiry}" >&2
  exit 1
fi

echo "certificate check: at least ${threshold_hours} hours remain; ${expiry}"
