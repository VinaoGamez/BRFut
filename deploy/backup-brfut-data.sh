#!/usr/bin/env bash
# Backup diário dos dados da API (perfis, sessões, saves).
# Instalado em /usr/local/sbin/backup-brfut-data.sh via apply-vps-security.sh
set -euo pipefail

DATA_ROOT="${BRFUT_DATA_DIR:-/var/lib/brfut/data}"
BACKUP_DIR="${BRFUT_BACKUP_DIR:-/var/backups/brfut}"
KEEP_DAYS="${BRFUT_BACKUP_KEEP_DAYS:-14}"

if [[ ! -d "$DATA_ROOT" ]]; then
  echo "backup-brfut: pasta inexistente: $DATA_ROOT" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%F-%H%M)"
ARCHIVE="$BACKUP_DIR/brfut-data-${STAMP}.tar.gz"

tar -czf "$ARCHIVE" -C "$(dirname "$DATA_ROOT")" "$(basename "$DATA_ROOT")"
chmod 640 "$ARCHIVE"
find "$BACKUP_DIR" -name 'brfut-data-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup-brfut: ok $ARCHIVE"
