# Manual de operación — Manobi Sentinel

> Guía técnica para operar la plataforma en Debian 12 con Docker Compose.
> Server de referencia: `192.168.50.5`, ruta `/opt/manobi-sentinel`.

## 1. Tareas rutinarias

| Acción | Comando |
|---|---|
| Ver estado general | `docker compose ps` |
| Logs en vivo | `docker compose logs -f --tail=200 <servicio>` |
| Reiniciar servicio | `docker compose restart <servicio>` |
| Reconstruir tras cambio | `docker compose up -d --build <servicio>` |
| Actualizar imágenes base | `docker compose pull && docker compose up -d` |
| Verificar backups | `ls -lh /opt/manobi/backups/` |

## 2. Servicios y puertos internos

| Servicio | Puerto interno | Rol |
|---|---|---|
| nginx | 80/443 | Reverse proxy + SSL |
| frontend | 80 (nginx interno) | React/Vite |
| api | 3000 | NestJS |
| ai-service | 8000 | FastAPI + scikit-learn (4 workers uvicorn) |
| postgres | 5432 | PostGIS 16-3.4 |
| redis | 6379 | Cache + pub/sub |
| minio | 9000 | Storage de reportes |
| geoserver | 8080 | WMS/WFS |
| pg_tileserv / pg_featureserv | 7800 / 9000 | Tiles vectoriales |
| tileserver-gl | 8080 | Tiles base OSM |
| grafana | 3000 | Dashboards (`/grafana`) |
| prometheus | 9090 | Métricas |
| loki / promtail | 3100 / – | Logs |
| postgres/redis/node exporter | 9187 / 9121 / 9100 | Exporters Prometheus |
| postfix | 25/587 | SMTP para alertas |

## 3. Health checks y URLs

- `https://192.168.50.5/` — dashboard operador
- `https://192.168.50.5/api/docs` — Swagger (31 endpoints)
- `https://192.168.50.5/api/health` — API health
- `https://192.168.50.5/api/metrics` — Prometheus métricas del API
- `https://192.168.50.5/grafana/` — dashboards + alerting
- `https://192.168.50.5/geoserver/web/` — GeoServer
- `https://192.168.50.5/tiles/` — TileServer GL

## 4. Backup y restauración

### Backup manual
```bash
bash /opt/manobi-sentinel/database/backups/backup.sh
ls -lh /opt/manobi/backups/
```

### Cron del host (ya activo)
```bash
crontab -l
# 0 2 * * * /opt/manobi-sentinel/database/backups/backup.sh >> /var/log/manobi-backup.log 2>&1
```
Retención: 30 días (dumps PostgreSQL + mirror de MinIO).

### Restaurar PostgreSQL
```bash
docker exec -i manobi-postgres pg_restore -U manobi -d manobi --clean < \
  /opt/manobi/backups/manobi-YYYYMMDD-HHMMSS.dump
```

### Restaurar MinIO (reportes)
```bash
docker cp /opt/manobi/backups/minio-reportes-YYYYMMDD-HHMMSS manobi-minio:/tmp/restore
docker exec manobi-minio mc mirror --overwrite /tmp/restore local/reportes
```

## 5. Cargar shapefile oficial PNN (RUNAP)

El dataset oficial viene de la API ArcGIS de Parques Nacionales Naturales.

```bash
# Descargar GeoJSON oficial (65 áreas protegidas)
curl -sk -m 60 -o /tmp/pnn_official.geojson \
  'https://mapas.parquesnacionales.gov.co/arcgis/rest/services/pnn/Limites_oficiales_Poligono/FeatureServer/0/query?where=1%3D1&outFields=ap_nombre,ap_categoria,territorial,area_calculada_ha,ap_sigla&resultRecordCount=1000&f=geojson&outSR=4326'

# Importar a tabla temporal con ogr2ogr
source /opt/manobi-sentinel/.env
docker run --rm --network manobi-sentinel_backend-net \
  -v /tmp/pnn_official.geojson:/data/pnn.geojson \
  ghcr.io/osgeo/gdal:alpine-small-3.9.2 \
  ogr2ogr -f PostgreSQL \
    "PG:host=postgres port=5432 dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD" \
    /data/pnn.geojson -nln parques_import_tmp -nlt MULTIPOLYGON \
    -lco GEOMETRY_NAME=geom -overwrite -t_srs EPSG:4326

# Merge por similitud de nombre
docker exec -i manobi-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
UPDATE parques p
SET geometria = t.geom,
    area_ha   = COALESCE(NULLIF(t.area_calculada_ha, 0), p.area_ha),
    region    = COALESCE(t.territorial, p.region)
FROM parques_import_tmp t
WHERE similarity(UPPER(p.nombre), UPPER(t.ap_nombre)) > 0.6;

INSERT INTO parques (nombre, geometria, region, nivel_riesgo, area_ha, descripcion)
SELECT t.ap_nombre, t.geom, t.territorial, 'medio',
       NULLIF(t.area_calculada_ha, 0), 'Importado desde RUNAP oficial'
FROM parques_import_tmp t
WHERE NOT EXISTS (
  SELECT 1 FROM parques p
  WHERE similarity(UPPER(p.nombre), UPPER(t.ap_nombre)) > 0.6
);
DROP TABLE parques_import_tmp;
SQL
```

Al cierre de 2026-04-15 la tabla tiene **73 parques** (37 con geometría oficial, 28 nuevos, 8 legacy seed pendientes de matching manual).

## 6. Rotar certificado SSL

```bash
# Autofirmado (10 años)
/opt/manobi-sentinel/scripts/rotate-ssl-cert.sh self-signed 192.168.50.5 192.168.50.5

# Let's Encrypt (requiere dominio público + puerto 80 libre)
/opt/manobi-sentinel/scripts/rotate-ssl-cert.sh letsencrypt sentinel.pnn.gov.co admin@pnn.gov.co
```
Para quitar warnings del browser y habilitar Service Worker: importar `/opt/manobi-sentinel/nginx/ssl/manobi.crt` como CA confiable en cada equipo cliente.

## 7. Rotar secretos

1. Actualizar `.env`.
2. `docker compose up -d --force-recreate api ai-service`.
3. Revocar sesiones en Redis:
   ```bash
   docker exec manobi-redis redis-cli -a $REDIS_PASSWORD FLUSHDB
   ```

## 8. IDEAM

### Cambiar de simulado a real (y viceversa)
Editar `IDEAM_MODE=real|simulado` en `.env`, luego:
```bash
docker compose up -d --force-recreate api
```

### Datasets SODA usados (modo real)
| ID | Tipo |
|---|---|
| sbwg-7ju4 | Temperatura ambiente (°C) |
| uext-mhny | Humedad del aire (%) |
| s54a-sgyg | Precipitación (mm) |
| sgfv-3yp8 | Velocidad viento (m/s → km/h ×3.6) |
| 62tk-nxj5 | Presión atmosférica (hPa) |

Poll cada 30 min vía cron del servicio `api`. Fallback automático a simulado si la API SODA está caída.

### Poll manual a demanda
```bash
TOKEN=$(curl -sk -X POST https://192.168.50.5/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@manobi.local","password":"..."}' | jq -r .access_token)

curl -sk -X POST -H "Authorization: Bearer $TOKEN" https://192.168.50.5/api/ideam/poll
```

## 9. Motor de alertas

- Corre cada 15 min (`0 */15 * * * *`, zona `America/Bogota`).
- Para 73 parques y 5 reglas toma ~5-7 min. Procesa secuencialmente (`BATCH = 1` en [alert-engine.service.ts](../backend/src/alertas/alert-engine.service.ts)) para no saturar Postgres con `ST_DWithin` concurrentes.
- **Si un ciclo se queda colgado** y saturan el Postgres:
  ```bash
  # Ver queries activas
  docker exec manobi-postgres psql -U manobi -d manobi -c \
    "SELECT pid, age(now(), query_start), left(query,80) FROM pg_stat_activity WHERE state='active' AND pid <> pg_backend_pid() ORDER BY query_start;"

  # Matar queries ST_DWithin viejas (>30 s)
  docker exec manobi-postgres psql -U manobi -d manobi -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='active' AND query ILIKE '%ST_DWithin%' AND age(now(), query_start) > interval '30 seconds';"

  # Restart api para limpiar promesas pendientes
  docker compose restart api
  ```
- `statement_timeout` global: 60 s (se aplicó vía `ALTER DATABASE manobi SET statement_timeout = 60000`). Queries pesadas se abortan solas.

### Reglas
Ver/editar vía:
- `GET  /api/reglas` (cualquier rol autenticado)
- `POST /api/reglas` (admin)
- `PATCH /api/reglas/:id` (admin)
- `DELETE /api/reglas/:id` (admin)

## 10. Modelos IA (ai-service)

- Versión actual: **v2** (reentrenados 2026-04-15 con scores centrados en climas de Colombia).
- Modelos viejos v1 se mantienen en disco para rollback: `/app/models/incendio_v1.joblib`, `/app/models/inundacion_v1.joblib`.
- **Reentrenar manual:**
  ```bash
  curl -sk -X POST -H "Authorization: Bearer $TOKEN" \
    https://192.168.50.5/api/predicciones/retrain/incendio
  ```
- **Rollback a v1:** cambiar `VERSION = 'v1'` en [training.py](../ai-service/app/services/training.py), rebuild + up.

## 11. Grafana alerting

- Dashboards: folder "Manobi Sentinel / Overview" (11 paneles PostgreSQL + Prometheus + Loki).
- Alertas provisionadas: 7 reglas (API/AI down, CPU, disco, Postgres, IDEAM, engine).
- Contact point: email → `alertas@parques.gov.co` vía postfix:25.
- **Para que los emails salgan al internet real:** configurar `SMTP_RELAY_HOST` en `.env` (SMTP de la organización) y recrear postfix.
- **Ver emails en cola:**
  ```bash
  docker exec manobi-postfix mailq
  ```
- **Validación de alerting (drill manual):**
  ```bash
  docker compose stop ai-service
  # esperar 3 min -> regla "AI Service caído" debe estar en estado Alerting
  # email encolado en postfix
  docker compose up -d ai-service
  # en ~1 min la alerta pasa a estado OK
  ```

## 12. Troubleshooting rápido

| Síntoma | Primera acción |
|---|---|
| Frontend no carga | `docker compose logs nginx frontend` |
| Login da 504 o timeout | Engine saturado; ver sección 9, matar queries y reiniciar api |
| `ERR_TOO_MANY_REDIRECTS` en `/grafana/` | Revisar que `proxy_pass http://grafana_backend;` (sin `/` final) en `nginx/conf.d/manobi.conf` |
| Heatmap vacío | Verificar tabla `predicciones` tiene datos de las últimas 24 h; revisar `IDEAM_MODE` |
| Alertas repetitivas por regla IA | Subir umbral vía `PATCH /api/reglas/<uid>` con `{"condicion":{...,"valor":85}}` |
| PostgreSQL al 900% CPU | Ver queries colgadas (sección 9) |
| Grafana paneles vacíos | `docker compose logs grafana \| grep -i provision` — validar UID datasource coincide con dashboard |

## 13. Checklist post-instalación

- [ ] `.env` con todos los `CHANGE_ME` reemplazados por secretos fuertes
- [ ] Crontab del host con backup diario configurado (`crontab -l`)
- [ ] `IDEAM_MODE=real` (o `simulado` si no hay internet)
- [ ] SMTP_RELAY_HOST configurado (para que alertas lleguen)
- [ ] Cert SSL: renovado con `rotate-ssl-cert.sh` si ha cambiado el host
- [ ] Modelos IA entrenados en el boot (`docker compose logs ai-service | grep "Modelos v2"`)
- [ ] Dashboard Grafana mostrando datos reales (todas las tarjetas con valores)
- [ ] Prometheus targets en estado `UP` (≥ 7 de 8; ai-service/api/node/postgres/redis mínimos)
