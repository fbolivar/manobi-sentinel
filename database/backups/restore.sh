#!/usr/bin/env bash
# Restauración de PostgreSQL desde dump.
# Uso:
#   ./restore.sh                          # usa el dump más reciente
#   ./restore.sh /path/to/backup.dump     # usa dump específico
#   ./restore.sh --test                   # restaura en DB temporal para verificar
#
# PRECAUCIÓN: sin --test, SOBRESCRIBE la DB en producción (manobi).
set -euo pipefail
set -a; source /opt/manobi-sentinel/.env; set +a

MODE="prod"
DUMP=""

if [ "${1:-}" = "--test" ]; then
  MODE="test"
  DUMP="${2:-$(ls -t /opt/manobi/backups/*.dump 2>/dev/null | head -1)}"
elif [ -n "${1:-}" ]; then
  DUMP="$1"
else
  DUMP=$(ls -t /opt/manobi/backups/*.dump 2>/dev/null | head -1)
fi

[ -f "$DUMP" ] || { echo "[!] No se encontró dump: $DUMP"; exit 1; }
echo "[*] Dump seleccionado: $DUMP ($(du -h "$DUMP" | cut -f1))"

docker cp "$DUMP" manobi-postgres:/tmp/restore.dump

if [ "$MODE" = "test" ]; then
  TARGET="manobi_restore_test_$(date +%s)"
  echo "[*] Modo TEST — restaurando en DB temporal: $TARGET"
  docker exec manobi-postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $TARGET;"
  docker exec manobi-postgres pg_restore -U "$POSTGRES_USER" -d "$TARGET" /tmp/restore.dump 2>&1 | tail -3 || true
  echo ""
  echo "[*] Verificando restauración…"
  docker exec manobi-postgres psql -U "$POSTGRES_USER" -d "$TARGET" -c \
    "SELECT 'parques' AS tabla, COUNT(*) AS filas FROM parques
     UNION ALL SELECT 'alertas', COUNT(*) FROM alertas
     UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
     UNION ALL SELECT 'reglas_alerta', COUNT(*) FROM reglas_alerta
     UNION ALL SELECT 'predicciones', COUNT(*) FROM predicciones
     UNION ALL SELECT 'eventos_climaticos', COUNT(*) FROM eventos_climaticos;"
  echo ""
  read -p "[?] Eliminar DB temporal $TARGET? (y/N) " yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    docker exec manobi-postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE $TARGET;"
    echo "[✓] DB temporal eliminada"
  else
    echo "[*] DB temporal preservada: $TARGET"
  fi
else
  echo "[!] MODO PRODUCCIÓN — SOBRESCRIBIRÁ la DB '$POSTGRES_DB'"
  read -p "[?] Confirmar restauración en PRODUCCIÓN (type 'CONFIRM'): " confirm
  [ "$confirm" = "CONFIRM" ] || { echo "[!] Cancelado"; exit 0; }

  echo "[*] Deteniendo servicios que usan la DB…"
  cd /opt/manobi-sentinel && docker compose stop api ai-service

  echo "[*] Restaurando…"
  docker exec -i manobi-postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump 2>&1 | tail -5 || true

  echo "[*] Reiniciando servicios…"
  docker compose up -d api ai-service

  echo "[✓] Restauración completa"
fi

docker exec manobi-postgres rm -f /tmp/restore.dump
