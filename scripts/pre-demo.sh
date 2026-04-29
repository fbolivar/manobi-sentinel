#!/usr/bin/env bash
# ---------------------------------------------------------------------
# pre-demo.sh — prepara Manobi Sentinel para una presentación en vivo.
#
# Uso:
#   ./scripts/pre-demo.sh           # solo verifica (no modifica nada)
#   ./scripts/pre-demo.sh --seed    # verifica + siembra datos frescos
#   ./scripts/pre-demo.sh --full    # verifica + seed + cierra alerta demo
#
# Corre en el SERVIDOR (/opt/manobi-sentinel/scripts/pre-demo.sh).
# ---------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
# Lee solo las vars que necesitamos (evita problemas con valores con espacios sin comillas)
getenv() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- || true; }
POSTGRES_USER="$(getenv POSTGRES_USER)"
POSTGRES_DB="$(getenv POSTGRES_DB)"
REDIS_PASSWORD="$(getenv REDIS_PASSWORD)"
export REDIS_PASSWORD

MODE="${1:---check}"
PASS=0; FAIL=0; WARN=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'

ok()    { echo -e "  ${GREEN}[OK]${NC}   $*"; PASS=$((PASS+1)); }
fail()  { echo -e "  ${RED}[FAIL]${NC} $*"; FAIL=$((FAIL+1)); }
warn()  { echo -e "  ${YELLOW}[WARN]${NC} $*"; WARN=$((WARN+1)); }
info()  { echo -e "  ${BLUE}[...]${NC}  $*"; }
section(){ echo ""; echo -e "${BLUE}== $* ==${NC}"; }

# ---------------------------------------------------------------------
section "1. Contenedores Docker"
EXPECTED=(api frontend ai-service postgres redis minio nginx postfix grafana prometheus)
for svc in "${EXPECTED[@]}"; do
  status=$(docker compose ps "$svc" --format '{{.Status}}' 2>/dev/null | head -1)
  if [[ "$status" == *"healthy"* ]] || [[ "$status" == *"Up"* && "$status" != *"Exit"* ]]; then
    ok "$svc : $status"
  else
    fail "$svc : ${status:-NO CORRE}"
  fi
done

# ---------------------------------------------------------------------
section "2. Endpoints HTTP"
for path in "/" "/api/health" "/ai/health"; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' "https://localhost$path" || echo "000")
  if [ "$code" = "200" ]; then ok "GET $path -> 200"; else fail "GET $path -> $code"; fi
done

# ---------------------------------------------------------------------
section "3. Certificado SSL"
CERT="$ROOT/nginx/ssl/manobi.crt"
if [ -f "$CERT" ]; then
  END=$(openssl x509 -in "$CERT" -noout -enddate | cut -d= -f2)
  EXP=$(date -d "$END" +%s)
  NOW=$(date +%s)
  DAYS=$(( (EXP - NOW) / 86400 ))
  if [ "$DAYS" -gt 365 ]; then ok "SSL vigente $DAYS dias ($END)"
  elif [ "$DAYS" -gt 30 ]; then warn "SSL expira en $DAYS dias — planea rotacion"
  else fail "SSL expira en $DAYS dias — ROTAR YA"; fi
else fail "no existe $CERT"; fi

# ---------------------------------------------------------------------
section "4. Backups"
LAST=$(ls -t /opt/manobi/backups/*.dump 2>/dev/null | head -1)
if [ -n "$LAST" ]; then
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LAST") ) / 3600 ))
  SIZE=$(du -h "$LAST" | cut -f1)
  if [ "$AGE_H" -lt 26 ]; then ok "ultimo dump: ${AGE_H}h, ${SIZE} — $(basename "$LAST")"
  else warn "ultimo dump hace ${AGE_H}h — correr backup.sh manualmente"; fi
else fail "no hay backups en /opt/manobi/backups/"; fi

CRON=$(crontab -l 2>/dev/null | grep -c backup.sh || true)
if [ "$CRON" -gt 0 ]; then ok "cron de backup activo"; else warn "sin cron de backup"; fi

# ---------------------------------------------------------------------
section "5. Datos en DB"
PSQL="docker exec manobi-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -tAc"
count_row() { $PSQL "$1" 2>/dev/null | tr -d ' '; }
N_PARQUES=$(count_row "SELECT COUNT(*) FROM parques")
N_USR=$(count_row "SELECT COUNT(*) FROM usuarios WHERE activo")
N_REG=$(count_row "SELECT COUNT(*) FROM reglas_alerta WHERE activa")
N_AL=$(count_row "SELECT COUNT(*) FROM alertas WHERE estado='activa'")
N_SUB=$(count_row "SELECT COUNT(*) FROM suscripciones_notificacion WHERE activa")
N_EV24=$(count_row "SELECT COUNT(*) FROM eventos_climaticos WHERE fecha >= NOW() - INTERVAL '24 hours'")

[ "$N_PARQUES" -ge 70 ] && ok "parques: $N_PARQUES" || fail "parques: $N_PARQUES (esperado >=70)"
[ "$N_USR" -ge 1 ]      && ok "usuarios activos: $N_USR" || fail "sin usuarios activos"
[ "$N_REG" -ge 1 ]      && ok "reglas activas: $N_REG" || fail "sin reglas activas"
[ "$N_SUB" -ge 1 ]      && ok "suscripciones activas: $N_SUB" || warn "sin suscripciones activas"
[ "$N_AL" -ge 1 ]       && ok "alertas activas: $N_AL" || warn "sin alertas activas (normal si recien arrancado)"
[ "$N_EV24" -ge 100 ]   && ok "eventos climaticos 24h: $N_EV24" || warn "eventos 24h: $N_EV24 — sembrar datos (--seed)"

# ---------------------------------------------------------------------
section "6. Motor de alertas (ultimo ciclo)"
LAST_CYCLE=$(docker compose logs api --since 20m 2>&1 | grep 'AlertEngine.*terminada' | tail -1)
if [ -n "$LAST_CYCLE" ]; then
  ok "ultimo ciclo registrado: $(echo "$LAST_CYCLE" | sed 's/.*AlertEngine] //' | sed 's/\x1b\[[0-9;]*m//g')"
else warn "no hay logs del motor en los ultimos 20 min"; fi

# ---------------------------------------------------------------------
section "7. Email SMTP (opcional: prueba real)"
info "para probar en vivo: publicar a Redis y revisar logs"
info '  docker exec manobi-redis redis-cli -a "$REDIS_PASSWORD" PUBLISH manobi:alertas ...'

# ---------------------------------------------------------------------
# Modo --seed : fuerza polling IDEAM + NASA FIRMS
# ---------------------------------------------------------------------
if [[ "$MODE" == "--seed" || "$MODE" == "--full" ]]; then
  section "8. Seed de datos frescos"
  read -p "  Email admin [admin@manobi.local]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@manobi.local}"
  read -s -p "  Password: " ADMIN_PASS; echo ""

  TOKEN=$(curl -sk -X POST https://localhost/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("access_token",""))')

  if [ -z "$TOKEN" ]; then
    fail "login fallido — no se pudo sembrar"
  else
    ok "login ok"
    info "forzando polling IDEAM..."
    curl -sk -X POST -H "Authorization: Bearer $TOKEN" https://localhost/api/ideam/poll -o /dev/null -w "   ideam: %{http_code}\n"
    info "forzando polling NASA FIRMS..."
    curl -sk -X POST -H "Authorization: Bearer $TOKEN" https://localhost/api/hotspots/poll -o /dev/null -w "   firms: %{http_code}\n"
    ok "seed disparado (toma 1-2 min en completar la ingesta)"
  fi
fi

# ---------------------------------------------------------------------
# Modo --full : cierra una alerta amarilla para que el proximo ciclo
# la regenere como NUEVA y dispare el email (demo "wow" en vivo)
# ---------------------------------------------------------------------
if [[ "$MODE" == "--full" ]]; then
  section "9. Alerta de demo (cierra 1 amarilla)"
  ID=$($PSQL "UPDATE alertas SET estado='cerrada', fecha_fin=NOW()
              WHERE id=(SELECT id FROM alertas WHERE estado='activa' AND nivel='amarillo'
                        ORDER BY creado_en ASC LIMIT 1)
              RETURNING id")
  if [ -n "$ID" ]; then
    ok "alerta cerrada: $ID"
    NEXT_MIN=$(( 15 - ( $(date +%M) % 15 ) ))
    ok "proximo ciclo del motor en ~${NEXT_MIN} min — el email llegara entonces"
  else
    warn "no habia amarillas activas para cerrar"
  fi
fi

# ---------------------------------------------------------------------
section "Resumen"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}${PASS} ok${NC}  |  ${YELLOW}${WARN} warn${NC}  |  ${RED}${FAIL} fail${NC}  (de $TOTAL checks)"
if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo -e "${GREEN}>>> Listo para presentar <<<${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}>>> Hay $FAIL check(s) en rojo — revisar antes de presentar <<<${NC}"
  exit 1
fi
