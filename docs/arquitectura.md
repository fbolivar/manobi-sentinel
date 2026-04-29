# Arquitectura — Manobi Sentinel

## Diagrama de arquitectura (Mermaid)

> GitHub renderiza este bloque como un diagrama interactivo.
> Para exportarlo como PNG: copia el bloque en https://mermaid.live y descarga.

```mermaid
graph TB
    User[Usuarios / Operadores<br/>PNN Colombia]

    subgraph EdgeLayer["Edge (HTTPS 443)"]
        Nginx[Nginx<br/>reverse proxy + TLS 1.2/1.3<br/>rate-limit + security headers]
    end

    subgraph App["Aplicacion"]
        Frontend[Frontend React + OpenLayers<br/>vendor-ol split / lazy routes]
        API[API NestJS<br/>JWT auth + RBAC<br/>35+ endpoints]
        AI[AI Service FastAPI<br/>scikit-learn<br/>incendio + inundacion]
    end

    subgraph Geo["Servidores geoespaciales"]
        GeoServer[GeoServer<br/>WMS/WFS]
        PgTileserv[pg_tileserv<br/>MVT vectoriales]
        TileserverGL[TileServer GL<br/>tiles base offline]
    end

    subgraph DataLayer["Datos y estado"]
        Postgres[(PostgreSQL 16<br/>+ PostGIS 3.4<br/>73 parques)]
        Redis[(Redis<br/>cache + pub/sub<br/>+ BullMQ)]
        Minio[(MinIO<br/>reportes PDF/XLSX)]
    end

    subgraph Ext["Fuentes externas"]
        IDEAM[IDEAM SODA API<br/>5 datasets climaticos]
        NASA[NASA FIRMS<br/>VIIRS + MODIS hotspots]
    end

    subgraph Notif["Notificaciones"]
        Postfix[Postfix<br/>relay Gmail]
        Gmail[Gmail SMTP relay<br/>smtp-relay.gmail.com:587]
        Push[Web Push<br/>VAPID]
        Webhook[Webhooks HTTP]
    end

    subgraph Obs["Observabilidad"]
        Prom[Prometheus]
        Graf[Grafana<br/>18 paneles + 7 alertas]
        Loki[Loki + Promtail]
    end

    User -->|HTTPS| Nginx
    Nginx --> Frontend
    Nginx --> API
    Nginx --> GeoServer
    Nginx --> PgTileserv
    Nginx --> TileserverGL
    Nginx --> Graf

    Frontend -.->|REST + WS| API
    API --> Postgres
    API --> Redis
    API --> Minio
    API --> AI
    AI --> Postgres

    API -->|cron 15 min| IDEAM
    API -->|cron 30 min| NASA

    API -->|publish alerta| Redis
    Redis -->|subscribe| API
    API --> Postfix
    Postfix --> Gmail
    API --> Push
    API --> Webhook

    Postgres -.->|exporter| Prom
    Redis -.->|exporter| Prom
    API -.->|/metrics| Prom
    Prom --> Graf
    API -.->|logs| Loki
    Loki --> Graf

    classDef user fill:#2d3748,stroke:#4a5568,color:#fff
    classDef edge fill:#2b6cb0,stroke:#2c5282,color:#fff
    classDef app fill:#2f855a,stroke:#276749,color:#fff
    classDef data fill:#b7791f,stroke:#975a16,color:#fff
    classDef ext fill:#702459,stroke:#521b41,color:#fff
    classDef obs fill:#4a5568,stroke:#2d3748,color:#fff

    class User user
    class Nginx edge
    class Frontend,API,AI app
    class Postgres,Redis,Minio data
    class IDEAM,NASA ext
    class Prom,Graf,Loki obs
```

## Vista general (ASCII fallback)

```
                         +------------------------+
                         |  Usuarios / Operadores |
                         +----------+-------------+
                                    | HTTPS 443
                                    v
                              +---------+
                              |  Nginx  |  reverse proxy + SSL + rate limit + headers
                              +----+----+
          +----------+-------------+--------------+------------+-----------+
          v          v             v              v            v           v
      Frontend   API (NestJS)  GeoServer   pg_tileserv   TileServer GL  Grafana
       (React)        |        (WMS/WFS)    (MVT)        (tiles base)
                      |
         +------------+---------------------+
         v            v                     v
      PostgreSQL   Redis                MinIO        AI Service (FastAPI)
      + PostGIS    (cache + queue)      (S3)         scikit-learn
```

## Redes Docker

- **frontend-net** — nginx ↔ frontend
- **backend-net** — api, postgres, redis, minio, ai-service, geo-services, postfix
- **monitoring-net** — prometheus, grafana, loki, promtail

## Decisiones clave

| Tema            | Elección                    | Motivo                                               |
|-----------------|-----------------------------|------------------------------------------------------|
| Mapa frontend   | OpenLayers + tiles locales  | Sin API keys externas, cumple requisito on-premise   |
| Base de datos   | PostgreSQL 16 + PostGIS 3.4 | Estándar GIS, soporte JSONB para reglas dinámicas    |
| Colas           | BullMQ sobre Redis          | Misma infra que cache, menos servicios               |
| Observabilidad  | Prometheus + Grafana + Loki | Stack abierto, sin licencias                         |
| SSL             | Nginx con TLS 1.2/1.3       | Obligatorio por requerimiento gubernamental          |
| IA              | scikit-learn + árbol decisión | Interpretabilidad exigida por entidad              |
| Reportes PDF    | Puppeteer + Chromium headless | HTML→PDF fiel, misma plantilla que el frontend     |

## Flujo de alerta (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    participant IDEAM as IDEAM SODA
    participant NASA as NASA FIRMS
    participant DB as PostgreSQL
    participant Engine as Alert Engine<br/>(cron 15 min)
    participant AI as AI Service
    participant Redis as Redis pub/sub
    participant Listener as Alert Listener
    participant SMTP as Postfix + Gmail
    participant User as fbolivarb@gmail.com

    Note over IDEAM,DB: Ingesta automatica
    IDEAM->>DB: INSERT eventos (cron 15 min)
    NASA->>DB: INSERT hotspots (cron 30 min)

    Note over Engine,AI: Evaluacion de reglas
    Engine->>DB: SELECT reglas activas + parques
    loop por cada parque (73)
        Engine->>DB: contextoPorParque (con cache 20 min)
        Engine->>AI: predictIncendio + predictInundacion
        AI-->>Engine: probabilidad + clase
        Engine->>Engine: evaluar condicion JSONB
    end

    Note over Engine,Redis: Dedup + publish
    Engine->>DB: findOne(parque_id, tipo, activa)
    alt Alerta no existe
        Engine->>DB: INSERT alertas
        Engine->>Redis: PUBLISH manobi:alertas
    else Alerta ya existe
        Engine-->>Engine: dedup++ (no publish)
    end

    Note over Listener,User: Notificacion
    Redis->>Listener: SUBSCRIBE manobi:alertas
    Listener->>DB: SELECT suscripciones (nivel match)
    Listener->>SMTP: sendMail(subject, html)
    SMTP->>User: Email entregado (250 OK)
```

## Flujo de alerta (ASCII fallback)

```
IDEAM / sensores --> eventos_climaticos (Postgres)
                        |
                        v
              Alert Engine (@Cron 15 min)
                        |
          +-------------+-------------+
          v             v             v
     Regla JSONB   Prediccion IA  Deduplicacion
                        |
                        v
                    alertas (Postgres)
                        |
          +-------------+-------------+
          v             v             v
       WebSocket    BullMQ email   Webhook
       (frontend)   (Postfix)      (http post)
```
