# Guía: Integración de Correo Electrónico — Manobi Sentinel

Esta guía explica paso a paso cómo configurar el módulo de email, conectarlo a un relay SMTP real y verificar que las notificaciones lleguen correctamente.

---

## Arquitectura del módulo de email

```
Alerta detectada
      │
      ▼
AlertListenerService          (escucha Redis pub/sub)
      │
      ▼
EmailQueueService             ──► Cola BullMQ  (manobi:email en Redis)
                                       │
                               EmailQueueProcessor
                                       │  3 intentos, backoff exponencial
                                       ▼
                               NotificacionesService.enviarEmail()
                                       │
                                  Nodemailer
                                       │
                                  Postfix (local)
                                       │
                              Gmail / SMTP institucional
                                       │
                              Destinatario final ✉
```

**Componentes creados:**

| Archivo | Función |
|---------|---------|
| `email-templates.service.ts` | Plantillas HTML: alerta, digest, reporte, bienvenida, prueba |
| `email-queue.processor.ts` | Worker BullMQ: procesa jobs con 3 reintentos (5s→25s→125s) |
| `email-queue.service.ts` | Encola emails; expone stats y control de la cola |
| `email-admin.controller.ts` | API REST admin: test SMTP, preview plantillas, gestión de cola |
| `notificaciones.module.ts` | (actualizado) registra BullMQ queue + nuevos providers |
| `alert-listener.service.ts` | (actualizado) usa cola en vez de envío directo |

---

## Paso 1 — Requisitos previos

Necesitas una de estas opciones de relay SMTP:

| Opción | Cuándo usarla |
|--------|---------------|
| **Gmail SMTP Relay** (smtp-relay.gmail.com) | Cuenta Google Workspace o Gmail; entorno de pruebas |
| **Servidor institucional** (Exchange, Postfix externo) | PNN Colombia con servidor de correo propio |
| **SendGrid / Brevo (gratis)** | Producción sin servidor propio; hasta 300 emails/día gratis |

---

## Paso 2 — Configurar Gmail como relay SMTP

### 2.1 Habilitar contraseña de aplicación (cuenta personal Gmail)

1. Ve a **myaccount.google.com** → Seguridad → Verificación en dos pasos (activar si no está).
2. Busca **"Contraseñas de aplicaciones"** → Crear → Nombre: `manobi-sentinel`.
3. Google genera una clave de 16 caracteres. Cópiala.

### 2.2 Habilitar SMTP Relay (Google Workspace)

Si tienes Google Workspace (dominio institucional):
1. Consola de Admin → **Aplicaciones → Google Workspace → Gmail → Enrutamiento avanzado**.
2. Sección **SMTP relay service** → Agregar regla:
   - Remitentes permitidos: solo mis dominios
   - Requerir SMTP Auth: ✓
   - Requerir TLS: ✓
3. Usar host: `smtp-relay.gmail.com:587`

---

## Paso 3 — Configurar el archivo `.env`

Edita tu archivo `.env` en la raíz del proyecto:

```bash
# ---- SMTP (Postfix local hacia relay) ----
SMTP_HOST=postfix
SMTP_PORT=25
SMTP_FROM=alertas@parques.gov.co          # remitente que verán los destinatarios

# ---- Relay externo (Postfix reenvía aquí) ----
SMTP_RELAY_HOST=smtp-relay.gmail.com      # o smtp.gmail.com para cuenta personal
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=tu-cuenta@gmail.com
SMTP_RELAY_PASSWORD=xxxx xxxx xxxx xxxx  # contraseña de aplicación (sin espacios)

# ---- Operadores que reciben alertas ROJAS ----
# Separa múltiples emails con coma, sin espacios
NOTIFY_EMAIL_OPERADORES=operador1@parques.gov.co,sala-crisis@parques.gov.co

# ---- URL pública (para los botones "Ver en Dashboard") ----
PUBLIC_URL=https://192.168.50.5
```

> **Seguridad:** nunca subas `.env` al repositorio. Está en `.gitignore`.

---

## Paso 4 — Configurar Postfix como relay

El archivo de configuración de Postfix para el contenedor está en `docker/postfix/main.cf`. Si no existe, créalo:

```bash
# docker/postfix/main.cf
myhostname = manobi-sentinel
mydomain = parques.gov.co
myorigin = $mydomain
inet_interfaces = all
relayhost = [smtp-relay.gmail.com]:587

# Autenticación SASL hacia el relay
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt

# Sin entrega local
local_transport = error
local_recipient_maps =
```

Crea el archivo de credenciales:

```bash
# docker/postfix/sasl_passwd
[smtp-relay.gmail.com]:587    tu-cuenta@gmail.com:xxxxxxxxxxxxxxxxxxxx
```

Aplica los cambios dentro del contenedor:

```bash
docker exec -it manobi-postfix bash
postmap /etc/postfix/sasl_passwd
chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
postfix reload
```

---

## Paso 5 — Verificar la configuración SMTP

### 5.1 Desde la API (recomendado)

Con la sesión de admin iniciada, llama al endpoint de prueba:

```bash
curl -X POST https://192.168.50.5/api/email/test \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"destinatario": "tu-email@ejemplo.com"}'
```

Respuesta esperada:
```json
{
  "ok": true,
  "messageId": "<abc123@manobi-sentinel>",
  "destinatario": "tu-email@ejemplo.com"
}
```

### 5.2 Desde la línea de comandos

```bash
# Prueba directa de Postfix
docker exec -it manobi-postfix bash
echo "Prueba de email" | mail -s "Test Manobi" tu-email@ejemplo.com

# Ver cola de correo de Postfix
docker exec manobi-postfix mailq

# Ver logs de Postfix
docker exec manobi-postfix tail -f /var/log/mail.log
```

### 5.3 Errores comunes y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `Authentication failed` | Contraseña incorrecta / 2FA no configurado | Regenerar contraseña de app Google |
| `Connection refused` | Postfix no levantó / red Docker | `docker restart manobi-postfix` |
| `Relay access denied` | Postfix no tiene el relay configurado | Verificar `main.cf` y `sasl_passwd` |
| `TLS handshake failed` | Certificados del host incorrectos | Instalar `ca-certificates` en el contenedor Postfix |
| Email llega a spam | Falta SPF/DKIM en el dominio | Configurar registros DNS (ver Paso 8) |

---

## Paso 6 — Gestionar la cola BullMQ

La cola `manobi:email` en Redis procesa los emails con reintentos automáticos.

### Ver estadísticas

```bash
# Via API
curl https://192.168.50.5/api/email/queue/stats \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

Respuesta:
```json
{
  "waiting": 0,
  "active": 1,
  "failed": 0,
  "completed": 145,
  "delayed": 0
}
```

### Ver jobs fallidos

```bash
curl https://192.168.50.5/api/email/queue/failed \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### Reintentar todos los fallidos

```bash
curl -X POST https://192.168.50.5/api/email/queue/retry-failed \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### Monitorear con logs

```bash
# Logs del procesador de la cola en tiempo real
docker logs -f manobi-api | grep -E '\[EmailQueue\]|\[AlertListener\]'
```

---

## Paso 7 — Previsualizar plantillas de email

Revisa cómo se ven los emails antes de que lleguen a los usuarios:

```bash
# Plantilla de alerta roja
curl "https://192.168.50.5/api/email/preview?tipo=alerta" \
  -H "Authorization: Bearer TU_TOKEN_JWT" | jq -r '.html' > preview-alerta.html

# Plantilla de digest diario
curl "https://192.168.50.5/api/email/preview?tipo=digest" \
  -H "Authorization: Bearer TU_TOKEN_JWT" | jq -r '.html' > preview-digest.html
```

Tipos disponibles: `alerta`, `digest`, `reporte`, `bienvenida`, `prueba`

Abre el archivo HTML en tu navegador para ver el diseño.

---

## Paso 8 — Configurar SPF y DKIM (producción)

Para que los emails no lleguen a spam cuando el dominio es institucional:

### SPF (Sender Policy Framework)

Agrega este registro TXT en el DNS de tu dominio:

```
parques.gov.co.  TXT  "v=spf1 include:_spf.google.com ~all"
```

Si usas servidor propio:
```
parques.gov.co.  TXT  "v=spf1 ip4:TU.IP.DEL.SERVIDOR ~all"
```

### DKIM

1. Genera las claves dentro del contenedor Postfix:
```bash
docker exec -it manobi-postfix bash
apt-get install -y opendkim opendkim-tools
opendkim-genkey -t -s mail -d parques.gov.co
# Genera: mail.private (clave privada) y mail.txt (registro DNS)
cat /etc/opendkim/keys/parques.gov.co/mail.txt
```

2. Agrega el registro TXT generado a tu DNS.

3. Verifica con: `https://mxtoolbox.com/dkim.aspx`

---

## Paso 9 — Suscripciones de email por parque

Los usuarios pueden suscribirse a alertas de parques específicos desde la API:

```bash
# Suscribir al usuario actual a alertas ROJO y AMARILLO del PNN Tayrona
curl -X POST https://192.168.50.5/api/suscripciones \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "parque_id": "UUID-DEL-PARQUE",
    "niveles": ["rojo", "amarillo"],
    "canal": "email",
    "destino": "guardian@parque.gov.co"
  }'

# Listar mis suscripciones
curl https://192.168.50.5/api/suscripciones \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# Desactivar suscripción
curl -X DELETE https://192.168.50.5/api/suscripciones/UUID-SUSCRIPCION \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### Lógica de destinatarios

| Nivel | Quién recibe el email |
|-------|----------------------|
| 🔴 ROJO | Operadores globales (`NOTIFY_EMAIL_OPERADORES`) + suscritos al parque |
| 🟡 AMARILLO | Solo suscritos al parque con nivel `amarillo` |
| 🟢 VERDE | Nadie (ignorado por defecto) |

---

## Paso 10 — Digest diario automático

El sistema genera automáticamente un resumen de alertas del día anterior:

- **6:00 AM** (hora Colombia): Resumen diario → se envía a `NOTIFY_EMAIL_OPERADORES`
- **7:00 AM lunes** (hora Colombia): Informe semanal → se envía a `NOTIFY_EMAIL_OPERADORES`

Estos reportes usan la plantilla `reporte` y se envían **directamente** (no por cola) desde `reports-scheduler.service.ts`.

Para enviar un digest manual:

```typescript
// Desde cualquier servicio que tenga EmailQueueService inyectado:
const { subject, html } = this.emailTemplates.digest(alertas, desde, hasta);
await this.emailQueue.enqueue(destinatarios, subject, html);
```

---

## Resumen de endpoints de la API de email

Todos requieren `Authorization: Bearer TOKEN` y rol `admin`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/email/test` | Test SMTP directo (sin cola) |
| `POST` | `/api/email/enqueue-test` | Test SMTP via cola BullMQ |
| `GET` | `/api/email/queue/stats` | Estadísticas de la cola |
| `GET` | `/api/email/queue/failed` | Jobs fallidos (últimos 50) |
| `POST` | `/api/email/queue/retry-failed` | Reintenta todos los fallidos |
| `DELETE` | `/api/email/queue/drain` | Vacía la cola (solo desarrollo) |
| `GET` | `/api/email/preview?tipo=X` | Preview HTML de plantilla |

---

## Diagrama de flujo de una alerta roja

```
Motor de reglas (cada 15 min)
        │
        ▼
  Alerta ROJA creada en BD
        │
        ▼
  Redis pub/sub (manobi:alertas)
        │
        ├──► AlertListenerService
        │         │
        │         ├── EmailQueueService.enqueue(prioridad=1)
        │         │         │
        │         │         └── BullMQ → EmailQueueProcessor
        │         │                    │  intento 1 → SMTP → entregado ✓
        │         │                    │  o fallo → espera 5s → intento 2
        │         │                    │  o fallo → espera 25s → intento 3
        │         │
        │         ├── PushService.sendToAll()  (notificación navegador)
        │         │
        │         └── Webhooks POST (si hay suscritos)
        │
        └──► AlertsGateway → WebSocket → Dashboard en tiempo real
```
