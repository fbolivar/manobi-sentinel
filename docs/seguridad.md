# Seguridad aplicada — Manobi Sentinel

> **Aclaración honesta**: ningún sistema es "a prueba de ataques" en absoluto. Este documento
> lista los controles concretos aplicados, su motivación, y los puntos que siguen siendo
> responsabilidad del operador (rotación de credenciales, actualización de dependencias,
> monitoreo activo).

Última revisión: 2026-04-17

---

## 1. Defensas en capas (OWASP-aligned)

### 1.1 Transporte (HTTPS)
- Nginx sirve TLS 1.2 y 1.3 exclusivamente (ver [nginx/conf.d/manobi.conf](../nginx/conf.d/manobi.conf)).
- Cifrados modernos: ECDHE-ECDSA / ECDHE-RSA con AES256-GCM y ChaCha20-Poly1305.
- `ssl_session_tickets off` (mitiga re-uso de sesiones).
- Cert autofirmado 10 años (SAN completa, rotable con [scripts/rotate-ssl-cert.sh](../scripts/rotate-ssl-cert.sh)).

### 1.2 Cabeceras de seguridad
Configuradas en [nginx/conf.d/security-headers.conf](../nginx/conf.d/security-headers.conf) con flag `always`:

| Header | Valor | Protege contra |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Downgrade HTTPS→HTTP |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing / XSS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Filtrado de URL |
| `Permissions-Policy` | 19 features deshabilitadas | Acceso a APIs sensibles del navegador |
| `Content-Security-Policy` | Estricta (ver abajo) | XSS, inyección, SSRF del lado cliente |

**CSP aplicada**:
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob:;
font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com;
connect-src 'self' wss:;
worker-src 'self' blob:;
frame-ancestors 'self';
form-action 'self';
base-uri 'self';
object-src 'none';
```

Decisiones conscientes:
- Se removió `X-XSS-Protection` (feature deprecated en Chrome, puede introducir bugs).
- Se quitó `https:` genérico de `connect-src` e `img-src` para evitar exfiltración.
- `'unsafe-inline'` en style-src se mantiene porque Tailwind + OpenLayers inyectan estilos dinámicos.

### 1.3 Autenticación y autorización
- **2FA obligatorio por email** (OTP 6 dígitos, TTL 5 min, max 5 intentos, código hasheado SHA-256 en Redis).
- **JWT access** 15 min + **refresh** 7 días con **rotación** (cada refresh genera nuevo par y revoca el anterior en Redis).
- **Brute-force protection**: 5 intentos fallidos → cuenta bloqueada 15 min (por email, en Redis).
- **Password hashing**: bcrypt cost 12.
- **Logout revoca el refresh token** server-side (Redis `DEL`).
- **RBAC** con 3 roles (`admin`, `operador`, `consulta`) aplicado vía `@Roles()` + `RolesGuard`.
- No hay enumeración de usuarios: el mismo mensaje para credenciales inválidas y usuario inexistente.

### 1.4 Rate limiting
Todas las zonas son por IP, configuradas en [nginx/nginx.conf](../nginx/nginx.conf):

| Endpoint | Zona | Rate | Burst |
|---|---|---|---|
| `/api/*` (general) | `api_general` | 100/min | 50 nodelay |
| `/api/auth/login` | `auth_login` | 5/min | 3 nodelay |
| `/api/auth/verify-otp` | `auth_otp` | 10/min | 5 nodelay |
| `/api/auth/resend-otp` | `auth_resend` | 3/min | 2 nodelay |
| `/api/auth/refresh` | `auth_refresh` | 20/min | 10 nodelay |

### 1.5 Protección contra inyección
- **SQL injection**: 100% queries parametrizadas vía TypeORM. No hay `string concatenation` a SQL.
- **XSS**: React escapa por defecto. Emails HTML no interpolan input del usuario sin sanitizar.
- **Validación de input**: `ValidationPipe` con `whitelist: true, forbidNonWhitelisted: true, transform: true`. Todo DTO usa `class-validator` (@IsEmail, @MinLength, @Matches, etc).
- **SSRF en webhooks**: [suscripciones.service.ts](../backend/src/notificaciones/suscripciones.service.ts) valida que el `destino` del webhook:
  - Usa protocolo `http:` o `https:` (no `file:`, `gopher:`, `ftp:`).
  - No apunta a `localhost`, `0.0.0.0`, ni nombres de servicios internos (`postgres`, `redis`, etc).
  - No es una IP privada (RFC1918: 10/8, 172.16/12, 192.168/16), loopback (127/8), link-local (169.254/16) ni multicast. IPv6: loopback, link-local y ULA bloqueados.

### 1.6 CORS
`enableCors({ origin: cfg.get('corsOrigins'), credentials: true })`. Lista blanca estricta en `CORS_ORIGIN` (.env).

### 1.7 Info disclosure
- **Swagger `/api/docs`** solo se sirve si `NODE_ENV !== production` o `ENABLE_SWAGGER=true`. En prod, por defecto no está expuesto.
- `server_tokens off` en nginx (no revela versión).
- `X-Powered-By` removido por Helmet.

### 1.8 Almacenamiento de secretos
- `.env` en el servidor con permisos restrictivos.
- Contraseñas en DB con bcrypt.
- Tokens de refresh con TTL + revocación en Redis.
- OTP codes hasheados, nunca en claro en logs.
- Backups `.pnnc` con AES-256-GCM opcional + PBKDF2-SHA256 600k iteraciones (OWASP 2023).

---

## 2. Lo que NO garantiza este hardening

- **Compromiso del servidor de hosting**: si un atacante gana SSH root o el hypervisor, nada de lo anterior aplica.
- **Phishing del usuario**: si un admin entrega sus credenciales + código OTP en una página falsa, entra. La autenticación por app (TOTP) o hardware key (WebAuthn) son más resistentes pero no se implementaron en este MVP.
- **Supply chain**: si un paquete npm o imagen Docker queda comprometido. Mitigación: `npm audit`, fijar versiones en `package.json`, usar imágenes oficiales.
- **Vulnerabilidades zero-day** en NestJS, nginx, PostgreSQL, etc. Mitigación: monitorear CVEs y actualizar.
- **Disponibilidad**: no hay DDoS protection ante un atacante con capacidad real. El servidor está on-premise; considerar una CDN (Cloudflare, por ejemplo) en producción si se expone a Internet.

---

## 3. Responsabilidades del operador

### 3.1 Antes del go-live
- [ ] Rotar **todas** las credenciales default:
  - `ADMIN_PASSWORD` en `.env` (password inicial del admin).
  - `POSTGRES_PASSWORD`.
  - `MINIO_ROOT_PASSWORD`.
  - `REDIS_PASSWORD`.
  - `GRAFANA_ADMIN_PASSWORD`.
  - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (128+ bytes random cada uno).
  - `SMTP_RELAY_PASSWORD` si el que hay es de prueba.
- [ ] Cambiar el email del usuario `admin@manobi.local` a un buzón institucional real (el OTP no llega a dominios inexistentes).
- [ ] `NOTIFY_EMAIL_OPERADORES` apuntando a una lista de distribución oficial, no a emails personales.
- [ ] Revisar `CORS_ORIGIN` en `.env` — solo incluir los dominios que realmente sirven el frontend.

### 3.2 Operación continua
- **Mensual**: `npm audit` en backend y frontend, actualizar vulns high/critical. Ver [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Mensual**: revisar `manobi-backup.log` y probar `restore.sh --test` con el último dump.
- **Trimestral**: rotar el cert SSL con [scripts/rotate-ssl-cert.sh](../scripts/rotate-ssl-cert.sh).
- **Trimestral**: rotar secrets JWT (requiere re-login de todos los usuarios).
- **Continuo**: monitorear Grafana (7 reglas activas) + logs de nginx/api en Loki.

### 3.3 En caso de incidente
- Endpoint `/api/auth/logout` revoca un refresh token individual.
- Para cerrar todas las sesiones de un usuario: `DELETE FROM usuarios WHERE id=X` (desactiva) o revocar JWT secret.
- Para bajar la app: `docker compose stop api frontend` mantiene DB y MinIO accesibles solo por ssh.
- Restore desde backup: UI `/backups` o CLI [scripts/restore-pnnc.sh](../scripts/restore-pnnc.sh).

---

## 4. Verificación

Checks rápidos para comprobar que todo está activo:

```bash
# 1. Security headers
curl -skI https://192.168.50.5/ | grep -iE 'strict-transport|x-frame|content-security|permissions-policy'

# 2. Rate limiting en login
for i in 1 2 3 4 5 6 7 8; do
  curl -sk -o /dev/null -w "%{http_code}\n" -X POST https://192.168.50.5/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"x@y.com","password":"xxxxxxxx"}'
done
# Esperado: primeros ~5 en 401, luego 503 (rate limited)

# 3. Swagger no expuesto en prod
curl -sk -o /dev/null -w "%{http_code}\n" https://192.168.50.5/api/docs
# Esperado: 404

# 4. SSRF bloqueado en webhook
# (Desde un usuario autenticado) intentar crear suscripción con canal=webhook, destino=http://postgres:5432
# Esperado: 400 Bad Request
```
