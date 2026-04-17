# Guía de presentación — Manobi Sentinel
## Para revisión/entrega a producción (PNN Colombia)

> **Objetivo:** llegar a la revisión con un discurso corto, un demo sin fallos, y respuestas listas para las preguntas típicas.

---

## 1. Checklist 24 horas antes

### 1.1 Verifica el servidor
```bash
# Todo healthy, 20 contenedores arriba
ssh root@192.168.50.5 "cd /opt/manobi-sentinel && docker compose ps | grep -Ev 'healthy|Up' | head"
# Esperado: ninguna línea (todo healthy/Up)

# SSL válido
ssh root@192.168.50.5 "openssl x509 -in /opt/manobi-sentinel/nginx/ssl/manobi.crt -noout -enddate"
# Esperado: notAfter > hoy + 1 año

# Último backup (automático 02:00 AM diario)
ssh root@192.168.50.5 "ls -lht /opt/manobi/backups/*.dump | head -3"
# Esperado: dump de hoy, >20 MB
```

### 1.2 Siembra datos frescos para el demo
```bash
# Fuerza un polling IDEAM y NASA FIRMS para tener eventos recientes.
# Requiere un access token de admin; cámbialo por tus credenciales.
ssh root@192.168.50.5 'TOKEN=$(curl -sk -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@manobi.local\",\"password\":\"<TU_PASSWORD>\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)[\"access_token\"])") && \
  curl -sk -X POST -H "Authorization: Bearer $TOKEN" https://localhost/api/ideam/poll && \
  curl -sk -X POST -H "Authorization: Bearer $TOKEN" https://localhost/api/hotspots/poll'
```

### 1.3 Prepara una alerta visible para el demo en vivo
```bash
# Cierra una alerta amarilla; el motor la regenerará en el próximo ciclo (≤15 min)
# y se verá el publish/email en tiempo real durante la demo.
ssh root@192.168.50.5 'docker exec manobi-postgres psql -U manobi -d manobi -c \
  "UPDATE alertas SET estado='"'"'cerrada'"'"', fecha_fin=NOW() \
   WHERE id = (SELECT id FROM alertas WHERE estado='"'"'activa'"'"' AND nivel='"'"'amarillo'"'"' \
               ORDER BY creado_en ASC LIMIT 1) RETURNING id, tipo;"'
```

### 1.4 Abre en pestañas (en el orden del demo)
1. https://192.168.50.5/login (app)
2. https://192.168.50.5:3001/ (Grafana — user: admin)
3. https://192.168.50.5/api/docs (Swagger)
4. GitHub: https://github.com/fbolivar/manobi-sentinel
5. Bandeja de tu email (`fbolivarb@gmail.com`) para mostrar el correo real

---

## 2. Elevator pitch (60 segundos)

> Manobi Sentinel es una plataforma **on-premise** que automatiza el monitoreo y la alerta temprana climática de los **73 parques nacionales** de Colombia. Integra **8 fuentes de datos oficiales** (IDEAM + NASA FIRMS) y **modelos de IA** que predicen incendio e inundación, evaluando reglas configurables **cada 15 minutos** y notificando por **email, push y webhook**. Corre 100% en servidores del estado, sin dependencia de la nube, con dashboards, histórico, auditoría y reportes PDF/XLSX/CSV.

Menciona tres números:
- **73 parques** (100% del SINAP con geometría oficial RUNAP).
- **8 fuentes de datos** integradas.
- **<15 min** de detección automática.

---

## 3. Script de la presentación (30–40 min)

### Sección A — Por qué existe (5 min)
Usa la tabla de `docs/propuesta-valor-pnn.md` sección "Capacidades vs. estado anterior". Punto clave a subrayar:
- Antes: detección manual por llamadas o reportes tardíos.
- Ahora: automático cada 15 min, alerta por email antes de que el operador se entere por radio.

### Sección B — Demo en vivo (15 min)
Sigue la sección **4. Demo paso a paso** más abajo.

### Sección C — Arquitectura (5 min)
Muestra `docs/arquitectura.md` o el diagrama. Puntos clave:
- **On-premise** — todo en el servidor de PNN, sin datos saliendo del país salvo APIs de fuente (NASA FIRMS).
- **Docker Compose** — 20 servicios, fáciles de replicar en otro servidor.
- **Stack abierto**: NestJS + React + PostgreSQL/PostGIS + Redis + MinIO + FastAPI/scikit-learn + Grafana.
- **Sin licencias de pago**.

### Sección D — Operación y entrega (10 min)
Sigue la sección **6. Qué dejas instalado**.

---

## 4. Demo paso a paso (cómo hacerlo en vivo)

### Paso 1 — Login
- URL: `https://192.168.50.5/`
- Usa `fbolivarb@gmail.com` o `admin@manobi.local`.
- **Qué mostrar:** la app pide credenciales, usa JWT con refresh, brute-force protection (5 intentos = 15 min lock).

### Paso 2 — Dashboard
- **Mapa OpenLayers** con polígonos de los 73 parques coloreados por `nivel_riesgo`.
- Toggle de capas: "Eventos" (puntos IDEAM), "Heatmap IA" (probabilidad de incendio), "Puntos de calor" (hotspots NASA agrupados en clusters).
- Click en un parque → panel con datos.
- Panel derecho: **alertas activas en vivo** (20 en este momento), con botón ✕ para cerrar (admin/operador).

### Paso 3 — Histórico
- `/historico` — filtra por parque, nivel, rango de fechas.
- Gráfico de barras de alertas por día.
- Botón **CSV** para exportar.

### Paso 4 — Reglas
- `/reglas` — 10 reglas activas.
- Muestra una regla (ejemplo: "Temperatura anómala en páramo"): condición en JSON, nivel resultante, acción.
- Explica: **el operador puede añadir/editar reglas sin tocar código**.

### Paso 5 — Suscripciones
- `/suscripciones` — muestra tu suscripción email.
- Crea una nueva en vivo (ej. webhook a un pastebin o otro email).
- Explica 3 canales: email, webhook, push del navegador.

### Paso 6 — Email real (momento "wow")
- Tenés que haber cerrado la alerta antes (paso 1.3). En el próximo ciclo (:00, :15, :30, :45) aparece el email en tu bandeja.
- Abre el email → diseño branded PNN, link "Ver en Dashboard".
- Si te toca esperar, muestra un email previo.

### Paso 7 — Reportes
- `/reportes` — genera un PDF en vivo con filtros.
- Explica: **diario automático 6 AM, semanal 7 AM lunes**, con PDF adjunto por email.
- Descarga el PDF generado.

### Paso 8 — Grafana (monitoring)
- `https://192.168.50.5:3001/` — panel de salud del sistema.
- 18 paneles, 7 reglas de alerta de Grafana configuradas.
- Puntos: CPU, memoria, queries/sec, alertas generadas, ciclos del motor.

### Paso 9 — Swagger
- `/api/docs` — 35+ endpoints documentados.
- Demo rápido: `/alertas` con Authorize.

### Paso 10 — GitHub
- Muestra el repo: CI verde (✓ backend ✓ frontend ✓ docker-build).
- Tests: 18 backend (Jest) + 2 frontend (Vitest).

---

## 5. Preguntas frecuentes (y cómo responder)

### "¿Qué pasa si se cae el servidor?"
- Backups diarios a las 2 AM en `/opt/manobi/backups/*.dump`, retención 30 días.
- Script `database/backups/restore.sh --test` que valida el dump en una DB temporal **sin tocar producción**.
- Docker Compose reinicia los contenedores con `restart: unless-stopped`.
- RTO estimado desde backup: < 30 min.

### "¿Por qué on-premise y no en la nube?"
- Datos sensibles del estado colombiano.
- Sin dependencia de SLA de terceros ni tasas de egreso.
- Funciona en redes aisladas del gobierno (el servidor usa su propio tileserver local).

### "¿Qué pasa si IDEAM o NASA se caen?"
- Todo es **pull** con timeout y fallback: si NASA no responde, se usa el último dato cacheado o el fallback climatológico.
- Nada bloquea el motor de alertas.

### "¿Cómo se añade un parque nuevo?"
- API `POST /parques` con geometría GeoJSON o vía script de seed.
- El motor lo evalúa automáticamente en el siguiente ciclo.

### "¿Se puede conectar con otros sistemas (SINAPRED, SIREDEC, etc.)?"
- Sí, vía **webhooks**: una suscripción con canal `webhook` envía un POST JSON con cada alerta al endpoint que se configure.
- O vía la API REST documentada en Swagger.

### "¿Cuántos usuarios soporta?"
- Probado con 2 usuarios concurrentes; el stack (NestJS + PostgreSQL + Redis) escala a cientos sin cambios.
- El bottleneck realista sería el mapa renderizando 10K+ eventos — ya mitigado con LIMIT 500 y clustering.

### "¿Seguridad?"
- JWT access (15 min) + refresh (7d) con rotación y revocación en Redis.
- Brute-force protection: 5 intentos → lock 15 min.
- Passwords con bcrypt cost 12.
- Roles: `admin`, `operador`, `consulta`.
- HTTPS obligatorio con cert SSL interno (10 años).
- Helmet + CORS restrictivo + ValidationPipe con whitelist.

### "¿Cuánto cuesta operar?"
- Cero licencias (100% open source).
- Costos: servidor físico/VPS + electricidad + conexión NASA FIRMS (gratis).

### "¿Qué falta para escalar a 1000 parques?"
- Partitioning de `eventos_climaticos` (hoy 300K filas, ya tiene retención de 30 días).
- HA de PostgreSQL (replicación).
- Horizontal scaling del API (stateless, se replica fácil).

---

## 6. Qué dejas instalado para el equipo receptor

### 6.1 Credenciales y accesos
Entrega un documento físico o PDF cifrado con:
- IP del servidor, usuario SSH, clave o llave pública autorizada.
- `admin@manobi.local` + password (pedir cambiarla en el primer login).
- `fbolivarb@gmail.com` + password (o reasignar al email institucional).
- Credenciales de Grafana (admin).
- Token MinIO.
- JWT secrets y SMTP password (en `.env` del servidor — documentar que está ahí).

### 6.2 Documentación en el repo (ya presente)
- `README.md` — instalación desde cero.
- `docs/arquitectura.md` — diagramas y componentes.
- `docs/operacion.md` — 13 secciones (start/stop, logs, backups, troubleshooting).
- `docs/manual-usuario.md` — para el operador que usa la UI.
- `docs/propuesta-valor-pnn.md` — para lectores no-técnicos.
- `docs/guia-presentacion.md` — **este archivo**.
- `docs/setup-smtp-ci.md` — configuración SMTP y CI/CD.
- `docs/guia-validacion-ux.md` — pasos de QA manual por página.

### 6.3 Procedimientos operativos (runbook)
Muestra en `docs/operacion.md` cómo:
- Reiniciar un servicio: `docker compose restart <service>`.
- Ver logs: `docker compose logs -f <service>`.
- Hacer backup manual: `bash /opt/manobi-sentinel/database/backups/backup.sh`.
- Restaurar: `bash /opt/manobi-sentinel/database/backups/restore.sh --test`.
- Rotar cert SSL: `bash /opt/manobi-sentinel/scripts/rotate-ssl-cert.sh`.

### 6.4 Contactos y soporte
- Mantenedor actual: Fernando Bolívar (fbolivarb@gmail.com).
- Repositorio: https://github.com/fbolivar/manobi-sentinel.
- Ventana de soporte / handoff acordada con el comité.

---

## 7. Checklist final antes de entrar a la reunión

- [ ] Servidor verificado (todos los contenedores healthy).
- [ ] SSL vigente.
- [ ] Último backup < 24h.
- [ ] Alerta amarilla cerrada la noche anterior (para email en vivo).
- [ ] Pestañas abiertas en el orden del demo.
- [ ] Bandeja de email abierta y lista.
- [ ] Proyector / screen share probado.
- [ ] Respaldo offline: video grabado del demo (por si cae la red).
- [ ] Propuesta-valor y este documento impresos o en PDF para entregar.
- [ ] Datos clave memorizados: **73 parques, 8 fuentes, <15 min detección**.

---

## 8. Si algo falla durante el demo

| Problema | Plan B |
|---|---|
| La red se cae | Muestra el video del demo pregrabado. |
| Frontend lento | Refresca con Ctrl+Shift+R. Si persiste, muestra Grafana para evidenciar que el API responde. |
| No llega el email | Muestra el log del API (`docker compose logs api --tail 50`) con "Email enviado messageId=..." — evidencia técnica. |
| Motor de alertas no genera nuevas | Demuéstralo cerrando una alerta desde el botón ✕ en la UI; explica que en el próximo ciclo (≤15 min) se regenera. |
| Login falla | Usa el otro usuario. Si ambos fallan, muestra la API directamente con curl + Swagger. |

---

**Última actualización:** 2026-04-17
