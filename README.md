# Manobi Sentinel

Plataforma web **on-premise** de alerta temprana climática para Parques Nacionales Naturales de Colombia.
100% Open Source, sin dependencias de servicios cloud de pago, desplegada en Debian 12 con Docker.

> **Estado actual:** Sesión 1 — scaffolding inicial. Ver `docs/` para roadmap de sesiones siguientes (backend NestJS, frontend React, IA, IDEAM, reportes).

---

## 1. Requisitos del servidor

- **OS:** Debian 12 (Bookworm) — probado en IP `192.168.50.5`.
- **Docker:** 24+ y Docker Compose v2.
- **CPU/RAM mínimos:** 4 vCPU / 8 GB RAM (recomendado 8 vCPU / 16 GB).
- **Discos montados:**
  - `/opt/manobi/postgres`
  - `/opt/manobi/minio`
  - `/opt/manobi/tiles`
  - `/opt/manobi/monitoring`
- **Puertos expuestos:** 22, 80, 443.

## 2. Instalación de Docker en Debian 12 (desde cero)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian bookworm stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
docker --version && docker compose version
```

## 3. Ajustes del kernel (Redis + PostgreSQL)

```bash
# Redis (evita "Background save may fail under low memory")
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.d/99-manobi.conf

# PostgreSQL / Docker — file descriptors y conexiones
cat <<EOF | sudo tee -a /etc/sysctl.d/99-manobi.conf
fs.file-max = 2097152
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
vm.swappiness = 10
EOF
sudo sysctl --system

# ulimits para Docker
sudo mkdir -p /etc/systemd/system/docker.service.d
cat <<EOF | sudo tee /etc/systemd/system/docker.service.d/override.conf
[Service]
LimitNOFILE=1048576
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
```

## 4. Preparar directorios de datos

```bash
sudo mkdir -p /opt/manobi/{postgres,minio,tiles,monitoring,backups}
sudo chown -R $USER:$USER /opt/manobi
```

## 5. Clonar/copiar el proyecto y configurar `.env`

```bash
cd /opt
sudo mkdir -p manobi-sentinel && sudo chown $USER:$USER manobi-sentinel
# Copia el contenido del repo aquí, luego:
cd manobi-sentinel
cp .env.example .env
# Edita .env y reemplaza TODAS las cadenas CHANGE_ME con contraseñas fuertes.
# Genera secretos JWT con: openssl rand -hex 48
```

## 6. Certificados SSL

### Opción A — Autofirmado (red interna, sin internet)

```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout nginx/ssl/manobi.key \
  -out nginx/ssl/manobi.crt \
  -subj "/C=CO/ST=Cundinamarca/L=Bogota/O=PNN/OU=Manobi/CN=192.168.50.5" \
  -addext "subjectAltName=IP:192.168.50.5,DNS:sentinel.parques.gov.co"
chmod 600 nginx/ssl/manobi.key
```

### Opción B — Let's Encrypt (si hay salida a internet y dominio público)

Usar Certbot con el plugin standalone antes de levantar Nginx, y luego copiar los certificados a `nginx/ssl/manobi.crt` y `nginx/ssl/manobi.key`.

## 7. Descargar tiles base de Colombia (on-premise)

```bash
# Desde una máquina con internet:
wget https://download.geofabrik.de/south-america/colombia-latest.osm.pbf

# Convertir a .mbtiles con tilemaker (instrucciones: https://github.com/systemed/tilemaker)
sudo apt-get install -y tilemaker
tilemaker --input colombia-latest.osm.pbf --output colombia.mbtiles

# Copiar al servidor:
scp colombia.mbtiles user@192.168.50.5:/opt/manobi/tiles/
```

Si no se dispone del archivo al inicio, el servicio `tileserver-gl` seguirá arrancando y se podrá añadir el mbtiles posteriormente (reiniciar el contenedor).

## 8. Levantar la plataforma

```bash
cd /opt/manobi-sentinel
docker compose pull
docker compose build
docker compose up -d

# Verificar estado
docker compose ps
docker compose logs -f api
```

Verificación rápida:

- `https://192.168.50.5/`         → frontend
- `https://192.168.50.5/api/docs` → Swagger (NestJS)
- `https://192.168.50.5/grafana/` → monitoreo
- `https://192.168.50.5/geoserver/web/` → GeoServer
- `https://192.168.50.5/tiles/`   → TileServer GL

## 9. Backups automáticos

Agendar `database/backups/backup.sh` en el cron del host:

```bash
chmod +x /opt/manobi-sentinel/database/backups/backup.sh
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /opt/manobi-sentinel/database/backups/backup.sh >> /var/log/manobi-backup.log 2>&1") | sudo crontab -
```

## 10. Operación básica

| Acción                  | Comando                                       |
|-------------------------|-----------------------------------------------|
| Ver logs de un servicio | `docker compose logs -f <servicio>`           |
| Reiniciar un servicio   | `docker compose restart <servicio>`           |
| Reconstruir tras cambio | `docker compose up -d --build <servicio>`    |
| Apagar todo             | `docker compose down`                         |
| Apagar + limpiar vols   | `docker compose down -v` (⚠ borra datos)      |

## 11. Estructura del proyecto

```
manobi-sentinel/
├── docker-compose.yml           # Orquestación completa
├── docker-compose.dev.yml       # Override desarrollo
├── .env.example                 # Variables documentadas
├── nginx/                       # Reverse proxy + SSL + headers
├── backend/                     # API NestJS (Sesión 2)
├── frontend/                    # React + OpenLayers (Sesión 3)
├── ai-service/                  # FastAPI + scikit-learn (Sesión 4)
├── database/init/               # Esquema, índices, seeds PostGIS
├── database/backups/            # Script backup host
├── tileserver-gl/               # Tiles base on-premise
├── monitoring/                  # Prometheus + Grafana + Loki
├── geoserver/                   # Data dir montado
└── docs/                        # Arquitectura, operación, API
```

## 12. Roadmap de sesiones

- **Sesión 2:** Backend NestJS completo (auth, CRUD parques, motor de alertas, WebSocket, auditoría).
- **Sesión 3:** Frontend React (dashboard NASA dark, mapa OpenLayers, panel alertas, responsive).
- **Sesión 4:** Microservicio IA (FastAPI, predicción incendio/inundación, heatmap).
- **Sesión 5:** Integración IDEAM (ingesta real + simulador), notificaciones email/webhook, reportes PDF/XLSX/CSV.

## 13. Troubleshooting para operadores

| Síntoma                                        | Acción                                                        |
|-----------------------------------------------|---------------------------------------------------------------|
| El frontend no carga                           | `docker compose logs nginx frontend`                          |
| La API responde 502                            | `docker compose restart api && docker compose logs -f api`    |
| PostgreSQL no inicia                           | Verificar permisos de `/opt/manobi/postgres`                  |
| Redis avisa de overcommit                      | Revisar `vm.overcommit_memory` (paso 3)                       |
| Grafana no muestra datos                       | Revisar `monitoring/prometheus/prometheus.yml`                |
| El mapa no muestra tiles                       | Copiar `colombia.mbtiles` a `/opt/manobi/tiles/` y reiniciar  |
| Alertas por email no llegan                    | Revisar variables `SMTP_RELAY_*` en `.env`                    |

---

**Licencia:** Open Source (pendiente definir licencia específica con PNN).
**Contacto técnico:** completar antes de puesta en producción.
