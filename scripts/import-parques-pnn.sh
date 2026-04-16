#!/usr/bin/env bash
# ================================================================
# Importa el shapefile oficial de Parques Nacionales Naturales desde
# el portal de datos abiertos (runap.parquesnacionales.gov.co) o
# cualquier .zip/.shp proporcionado. Reemplaza las geometrías buffer
# iniciales por las oficiales, preservando los ids existentes cuando
# el nombre coincide.
#
# Uso:
#   sudo ./scripts/import-parques-pnn.sh [URL_ZIP | RUTA_SHP]
#
# Por defecto descarga el dataset público RUNAP v4 (formato shapefile).
# ================================================================
set -euo pipefail

URL_DEFAULT="https://runap.parquesnacionales.gov.co/images/descargas/RUNAP_v4.zip"
SRC="${1:-$URL_DEFAULT}"
WORK=/tmp/manobi-pnn
mkdir -p "$WORK" && cd "$WORK"

for tool in unzip shp2pgsql psql; do
  if ! command -v $tool &>/dev/null; then
    echo "[*] Instalando $tool…"
    apt-get update -qq
    apt-get install -y --no-install-recommends postgis postgresql-client unzip
    break
  fi
done

if [[ "$SRC" =~ ^https?:// ]]; then
  echo "[*] Descargando $SRC"
  wget -q --show-progress -O runap.zip "$SRC"
  unzip -o runap.zip
  SHP=$(find . -maxdepth 2 -name '*.shp' | head -1)
elif [[ "$SRC" =~ \.zip$ ]]; then
  cp "$SRC" runap.zip; unzip -o runap.zip
  SHP=$(find . -maxdepth 2 -name '*.shp' | head -1)
else
  SHP="$SRC"
fi

[ -f "$SHP" ] || { echo "[!] No se encontró shapefile"; exit 1; }
echo "[*] Usando shapefile: $SHP"

# Importar a tabla temporal
shp2pgsql -I -s 4326 -W LATIN1 "$SHP" parques_import_tmp > parques_import.sql

PGENV=$(cat /opt/manobi-sentinel/.env | grep -E '^POSTGRES_' | xargs)
eval export $PGENV

echo "[*] Importando a PostgreSQL tabla temporal 'parques_import_tmp'"
docker exec -i manobi-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < parques_import.sql

echo "[*] Actualizando geometrías oficiales (match por nombre)"
docker exec -i manobi-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
-- Heurística: empareja por similitud de nombre (trigram)
UPDATE parques p
SET geometria = ST_Multi(t.geom),
    area_ha = COALESCE(t.area_ha, p.area_ha)
FROM (
  SELECT
    UPPER(TRIM(nombre)) AS n,
    ST_Union(geom) AS geom,
    SUM(ST_Area(geom::geography)) / 10000 AS area_ha
  FROM parques_import_tmp
  WHERE nombre IS NOT NULL
  GROUP BY UPPER(TRIM(nombre))
) t
WHERE similarity(UPPER(p.nombre), t.n) > 0.5
   OR UPPER(p.nombre) LIKE '%' || REPLACE(t.n, 'PNN ', '') || '%';

-- Insertar los que no existen
INSERT INTO parques (nombre, geometria, region, nivel_riesgo, area_ha, descripcion)
SELECT
  t.nombre,
  ST_Multi(ST_Union(t.geom)),
  NULL, 'medio',
  SUM(ST_Area(t.geom::geography)) / 10000,
  'Importado desde RUNAP oficial'
FROM parques_import_tmp t
LEFT JOIN parques p ON similarity(UPPER(p.nombre), UPPER(t.nombre)) > 0.5
WHERE p.id IS NULL
GROUP BY t.nombre;

-- Limpiar temporal
DROP TABLE IF EXISTS parques_import_tmp;

-- Estadísticas
SELECT COUNT(*) AS total_parques,
       COUNT(DISTINCT region) AS regiones,
       ROUND(SUM(area_ha)::numeric / 1000000, 2) AS millones_ha
FROM parques;
SQL

echo ""
echo "✓ Importación completada. Refresca el mapa en el frontend."
