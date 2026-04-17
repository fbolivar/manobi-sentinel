#!/usr/bin/env bash
# --------------------------------------------------------------------------
# restore-pnnc.sh — restaura un archivo .pnnc desde CLI (uso de emergencia).
#
# Uso:
#   ./restore-pnnc.sh <archivo.pnnc>                   # modo TEST (DB temporal)
#   ./restore-pnnc.sh --prod <archivo.pnnc>            # modo PRODUCCION
#
# Requiere: docker, openssl, tar, python3, pg_restore (en host) o contenedor postgres.
#
# Este script es el fallback si la UI no está disponible. Usa las mismas llaves/formato
# que el módulo Node (AES-256-GCM + PBKDF2-SHA256 600k iteraciones).
# --------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="test"
FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --prod) MODE="prod"; shift ;;
    --test) MODE="test"; shift ;;
    -h|--help) sed -n '3,14p' "$0"; exit 0 ;;
    *) FILE="$1"; shift ;;
  esac
done

[ -f "$FILE" ] || { echo "[!] Archivo no encontrado: $FILE"; exit 1; }

echo "[*] Archivo: $FILE ($(du -h "$FILE" | cut -f1))"
echo "[*] Modo:    $MODE"

POSTGRES_USER=$(grep '^POSTGRES_USER=' "$ROOT/.env" | head -1 | cut -d= -f2)
POSTGRES_DB=$(grep '^POSTGRES_DB=' "$ROOT/.env" | head -1 | cut -d= -f2)

# Extraer .pnnc (tar) → manifest.json + payload.dat
WORK=$(mktemp -d -t manobi-restore-XXXXXX)
trap "rm -rf $WORK" EXIT

echo "[*] Extrayendo .pnnc..."
tar -xf "$FILE" -C "$WORK"
[ -f "$WORK/manifest.json" ] || { echo "[!] .pnnc inválido: falta manifest.json"; exit 1; }
[ -f "$WORK/payload.dat"   ] || { echo "[!] .pnnc inválido: falta payload.dat"; exit 1; }

ENCRYPTED=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['encrypted'])" | tr '[:upper:]' '[:lower:]')
TIPO=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['tipo'])")
CREADO_POR=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['creado_por'])")
CREADO_EN=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['creado_en'])")
APP_VERSION=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['app_version'])")

echo "[*] Manifest:"
echo "    tipo: $TIPO"
echo "    creado: $CREADO_EN por $CREADO_POR"
echo "    app_version: $APP_VERSION"
echo "    encrypted: $ENCRYPTED"

# Descifrar si es necesario
PAYLOAD_GZ="$WORK/payload.tar.gz"
if [ "$ENCRYPTED" = "true" ]; then
  read -s -p "[?] Contraseña del backup: " PASS; echo
  python3 - "$WORK/manifest.json" "$WORK/payload.dat" "$PAYLOAD_GZ" <<'PYEOF'
import sys, json, base64, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from getpass import getpass

manifest_path, cipher_path, out_path = sys.argv[1:4]
m = json.load(open(manifest_path))
e = m['encryption']
pwd = __import__('os').environ.get('PNNC_PASS') or sys.stdin.readline().strip()
salt = base64.b64decode(e['salt'])
iv   = base64.b64decode(e['iv'])
tag  = base64.b64decode(e['tag'])
key = hashlib.pbkdf2_hmac('sha256', pwd.encode(), salt, e['iterations'], 32)
with open(cipher_path, 'rb') as f: ct = f.read()
try:
    pt = AESGCM(key).decrypt(iv, ct + tag, None)
except Exception:
    print("[!] Contraseña incorrecta o archivo corrupto.", file=sys.stderr); sys.exit(2)
# Verificar checksum
if hashlib.sha256(pt).hexdigest() != m['sha256_payload']:
    print("[!] Checksum inválido.", file=sys.stderr); sys.exit(3)
with open(out_path, 'wb') as f: f.write(pt)
print("[*] Descifrado OK, checksum válido.", file=sys.stderr)
PYEOF
  unset PASS
else
  # Sin cifrar: payload.dat ES el tar.gz directamente
  cp "$WORK/payload.dat" "$PAYLOAD_GZ"
  # Verificar checksum
  EXPECTED=$(python3 -c "import json;print(json.load(open('$WORK/manifest.json'))['sha256_payload'])")
  ACTUAL=$(sha256sum "$PAYLOAD_GZ" | cut -d' ' -f1)
  [ "$EXPECTED" = "$ACTUAL" ] || { echo "[!] Checksum inválido."; exit 1; }
  echo "[*] Checksum OK (no cifrado)."
fi

# Descomprimir payload
EXTRACT="$WORK/extract"
mkdir -p "$EXTRACT"
tar -xzf "$PAYLOAD_GZ" -C "$EXTRACT"
[ -f "$EXTRACT/database.dump" ] || { echo "[!] Payload no contiene database.dump"; exit 1; }
echo "[*] Dump extraído: $(du -h "$EXTRACT/database.dump" | cut -f1)"

# Copiar dump al contenedor de postgres
docker cp "$EXTRACT/database.dump" manobi-postgres:/tmp/pnnc-restore.dump

if [ "$MODE" = "test" ]; then
  TARGET="manobi_pnnc_test_$(date +%s)"
  echo "[*] TEST — creando DB temporal: $TARGET"
  docker exec manobi-postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $TARGET;"
  docker exec manobi-postgres pg_restore -U "$POSTGRES_USER" -d "$TARGET" /tmp/pnnc-restore.dump 2>&1 | tail -3 || true
  echo
  echo "[*] Validando restauración..."
  docker exec manobi-postgres psql -U "$POSTGRES_USER" -d "$TARGET" -c \
    "SELECT 'parques' AS tabla, COUNT(*) AS filas FROM parques
     UNION ALL SELECT 'alertas', COUNT(*) FROM alertas
     UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
     UNION ALL SELECT 'reglas_alerta', COUNT(*) FROM reglas_alerta
     UNION ALL SELECT 'predicciones', COUNT(*) FROM predicciones
     UNION ALL SELECT 'eventos_climaticos', COUNT(*) FROM eventos_climaticos;"
  echo
  read -p "[?] Eliminar DB temporal $TARGET? (y/N) " yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    docker exec manobi-postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE $TARGET;"
    echo "[✓] DB temporal eliminada"
  else
    echo "[*] DB temporal preservada: $TARGET"
  fi
else
  echo "[!] MODO PRODUCCION — SOBRESCRIBIRÁ la DB '$POSTGRES_DB'"
  read -p "[?] Escribe CONFIRMAR PRODUCCION para proceder: " confirm
  [ "$confirm" = "CONFIRMAR PRODUCCION" ] || { echo "[!] Cancelado"; exit 0; }

  cd "$ROOT"
  echo "[*] Deteniendo API y AI-service..."
  docker compose stop api ai-service

  echo "[*] Restaurando..."
  docker exec manobi-postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/pnnc-restore.dump 2>&1 | tail -5 || true

  # TODO: también restaurar reportes si hay $EXTRACT/reportes/
  if [ -d "$EXTRACT/reportes" ]; then
    echo "[*] Restaurando reportes a MinIO (mediante mc no implementado; omitido en CLI — usar UI)"
  fi

  echo "[*] Reiniciando servicios..."
  docker compose up -d api ai-service

  echo "[✓] Restauración completa"
fi

docker exec manobi-postgres rm -f /tmp/pnnc-restore.dump
