#!/usr/bin/env bash
# ================================================================
# Genera colombia.mbtiles para TileServer GL on-premise.
# Descarga PBF de Geofabrik → convierte con tilemaker → instala.
# Tiempo total: 30–60 min en un servidor decente.
# Requisitos: ~8 GB libres en /tmp, internet para la descarga inicial.
# ================================================================
set -euo pipefail

WORKDIR=/tmp/manobi-tiles
TILES_DIR=/opt/manobi/tiles/mbtiles
PBF_URL="https://download.geofabrik.de/south-america/colombia-latest.osm.pbf"

mkdir -p "$WORKDIR" "$TILES_DIR"
cd "$WORKDIR"

if ! command -v tilemaker &>/dev/null; then
  echo "[*] Instalando tilemaker…"
  apt-get update -qq
  apt-get install -y --no-install-recommends tilemaker wget
fi

if [ ! -f colombia-latest.osm.pbf ]; then
  echo "[*] Descargando PBF Colombia (~500 MB)…"
  wget --show-progress -O colombia-latest.osm.pbf "$PBF_URL"
fi

if [ ! -f /usr/share/tilemaker/resources/config-openmaptiles.json ]; then
  echo "[!] Config openmaptiles no encontrada; clonando recursos oficiales…"
  git clone --depth=1 https://github.com/systemed/tilemaker.git tilemaker-src || true
  CONF=tilemaker-src/resources/config-openmaptiles.json
  PROC=tilemaker-src/resources/process-openmaptiles.lua
else
  CONF=/usr/share/tilemaker/resources/config-openmaptiles.json
  PROC=/usr/share/tilemaker/resources/process-openmaptiles.lua
fi

echo "[*] Generando colombia.mbtiles (puede tardar 30–60 min)…"
tilemaker --input colombia-latest.osm.pbf \
  --output colombia.mbtiles \
  --config "$CONF" --process "$PROC"

echo "[*] Instalando en $TILES_DIR"
cp colombia.mbtiles "$TILES_DIR/colombia.mbtiles"
chown -R 1001:1001 "$TILES_DIR" || true

echo "[*] Actualizando config TileServer GL"
cat > /opt/manobi-sentinel/tileserver-gl/config.json <<'EOF'
{
  "options": {
    "paths": {
      "root": "/data",
      "mbtiles": "/data/mbtiles"
    }
  },
  "styles": {},
  "data": {
    "colombia": { "mbtiles": "colombia.mbtiles" }
  }
}
EOF

echo "[*] Reiniciando tileserver-gl"
cd /opt/manobi-sentinel && docker compose restart tileserver-gl

echo ""
echo "✓ LISTO. Verifica en: https://TU_IP/tiles/data/colombia.json"
echo "  Activa la capa 'Base' del mapa; el frontend detectará los tiles locales."
