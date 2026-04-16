#!/usr/bin/env bash
# Mantenimiento diario de DB — cron a las 3 AM
set -euo pipefail
LOG=/var/log/manobi-maintenance.log
echo "[$(date)] Inicio mantenimiento" >> $LOG

# 1) Consolidar eventos de ayer en resumen
docker exec manobi-postgres psql -U manobi -d manobi -c "SELECT consolidar_eventos_diario();" >> $LOG 2>&1

# 2) Purgar eventos > 30 días
docker exec manobi-postgres psql -U manobi -d manobi -c "SELECT * FROM purge_eventos_old(30);" >> $LOG 2>&1

# 3) VACUUM ANALYZE para reclamar espacio
docker exec manobi-postgres psql -U manobi -d manobi -c "VACUUM ANALYZE eventos_climaticos;" >> $LOG 2>&1

echo "[$(date)] Fin mantenimiento" >> $LOG
