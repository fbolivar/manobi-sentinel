#!/usr/bin/env bash
# =====================================================================
# rotate-ssl-cert.sh — Genera o renueva el certificado SSL de Nginx.
#
# Modos:
#   self-signed   (default) — cert autofirmado con SAN completa.
#   letsencrypt             — usa certbot standalone (requiere dominio
#                             público y puerto 80 libre al momento).
#
# Uso:
#   ./scripts/rotate-ssl-cert.sh                               # self-signed
#   ./scripts/rotate-ssl-cert.sh self-signed sentinel.pnn.gov.co 192.168.50.5
#   ./scripts/rotate-ssl-cert.sh letsencrypt sentinel.pnn.gov.co admin@pnn.gov.co
#
# Renueva /opt/manobi-sentinel/nginx/ssl/manobi.{crt,key} y recarga nginx.
# =====================================================================
set -euo pipefail

MODE="${1:-self-signed}"
CN="${2:-192.168.50.5}"
EXTRA="${3:-}"

SSL_DIR=/opt/manobi-sentinel/nginx/ssl
mkdir -p "$SSL_DIR"

case "$MODE" in
  self-signed)
    IP_SAN="${3:-192.168.50.5}"
    SANS="DNS:${CN},IP:${IP_SAN},DNS:sentinel.parques.gov.co,DNS:manobi.local"
    echo "[*] Generando cert autofirmado (10 años) — CN=${CN}  SAN=${SANS}"
    openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
      -keyout "$SSL_DIR/manobi.key.new" \
      -out    "$SSL_DIR/manobi.crt.new" \
      -subj "/C=CO/ST=Cundinamarca/L=Bogota/O=PNN/OU=Manobi/CN=${CN}" \
      -addext "subjectAltName=${SANS}" \
      -addext "keyUsage=digitalSignature,keyEncipherment,dataEncipherment" \
      -addext "extendedKeyUsage=serverAuth"
    ;;

  letsencrypt)
    [ -z "$EXTRA" ] && { echo "[!] Email requerido como 3er arg para letsencrypt"; exit 2; }
    if ! command -v certbot &>/dev/null; then
      echo "[*] Instalando certbot…"
      apt-get update -qq && apt-get install -y --no-install-recommends certbot
    fi
    echo "[*] Parando nginx temporalmente para liberar :80"
    docker compose -f /opt/manobi-sentinel/docker-compose.yml stop nginx
    trap 'docker compose -f /opt/manobi-sentinel/docker-compose.yml start nginx' EXIT
    certbot certonly --standalone --non-interactive --agree-tos \
      -d "$CN" -m "$EXTRA" --preferred-challenges http
    cp "/etc/letsencrypt/live/${CN}/fullchain.pem" "$SSL_DIR/manobi.crt.new"
    cp "/etc/letsencrypt/live/${CN}/privkey.pem"   "$SSL_DIR/manobi.key.new"
    trap - EXIT
    ;;

  *) echo "[!] Modo desconocido: $MODE (usar self-signed|letsencrypt)"; exit 2 ;;
esac

# Backup del cert anterior y activar el nuevo atómicamente
STAMP=$(date +%Y%m%d-%H%M%S)
[ -f "$SSL_DIR/manobi.crt" ] && cp "$SSL_DIR/manobi.crt" "$SSL_DIR/manobi.crt.$STAMP.bak"
[ -f "$SSL_DIR/manobi.key" ] && cp "$SSL_DIR/manobi.key" "$SSL_DIR/manobi.key.$STAMP.bak"
mv "$SSL_DIR/manobi.crt.new" "$SSL_DIR/manobi.crt"
mv "$SSL_DIR/manobi.key.new" "$SSL_DIR/manobi.key"
chmod 600 "$SSL_DIR/manobi.key"

echo "[*] Certificado instalado. Fingerprint:"
openssl x509 -in "$SSL_DIR/manobi.crt" -noout -fingerprint -sha256 -subject -dates -ext subjectAltName

echo "[*] Recargando nginx"
docker compose -f /opt/manobi-sentinel/docker-compose.yml exec -T nginx nginx -s reload

echo ""
echo "✓ Rotación completada."
case "$MODE" in
  self-signed)
    echo "  Importa $SSL_DIR/manobi.crt como CA confiable en cada cliente"
    echo "  para eliminar warnings del browser y habilitar Service Worker."
    ;;
  letsencrypt)
    echo "  Agenda renovación: agregar al cron del host:"
    echo "  0 3 * * 1 /opt/manobi-sentinel/scripts/rotate-ssl-cert.sh letsencrypt $CN $EXTRA"
    ;;
esac
