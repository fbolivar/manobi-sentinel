#!/usr/bin/env bash
# Backup diario de PostgreSQL + MinIO. Agendar vía cron en el host.
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
OUT=/opt/manobi/backups
mkdir -p "$OUT"

# PostgreSQL
docker exec manobi-postgres pg_dump -U "${POSTGRES_USER:-manobi}" -Fc "${POSTGRES_DB:-manobi}" \
  > "$OUT/manobi-$STAMP.dump"

# MinIO (reportes + uploads)
docker exec manobi-minio mc alias set local http://localhost:9000 \
  "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
docker exec manobi-minio mc mirror --overwrite local/reportes /tmp/reportes-backup
docker cp manobi-minio:/tmp/reportes-backup "$OUT/minio-reportes-$STAMP"

# Retención 30 días
find "$OUT" -type f -name 'manobi-*.dump' -mtime +30 -delete
find "$OUT" -type d -name 'minio-reportes-*' -mtime +30 -exec rm -rf {} +
echo "Backup completado: $STAMP"
