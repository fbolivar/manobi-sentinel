# Configuración SMTP y CI/CD

## SMTP Relay (#1)

Los emails de alertas se generan pero quedan en cola de Postfix. Para entregar al correo real:

### Opción A — Relay con servidor SMTP corporativo
```bash
# 1. Editar .env
SMTP_RELAY_HOST=smtp.parques.gov.co     # servidor SMTP del MEN o PNN
SMTP_RELAY_PORT=587                      # típico TLS
SMTP_RELAY_USER=manobi@parques.gov.co    # si requiere autenticación
SMTP_RELAY_PASSWORD=xxxxx

# 2. Recrear postfix
docker compose up -d --force-recreate postfix

# 3. Probar
docker exec manobi-postfix sendmail -v test@parques.gov.co <<< "Subject: Test Manobi\n\nHola"
docker exec manobi-postfix mailq
```

### Opción B — Gmail como relay (para pruebas)
```bash
SMTP_RELAY_HOST=smtp.gmail.com
SMTP_RELAY_PORT=587
SMTP_RELAY_USER=cuenta@gmail.com
SMTP_RELAY_PASSWORD=app-password-de-16-chars   # generar en myaccount.google.com/apppasswords
```

### Verificar que las alertas salgan
```bash
docker compose stop ai-service      # dispara alerta
sleep 180                            # esperar 3 min
docker exec manobi-postfix mailq     # debe mostrar email entregado (no encolado)
docker compose up -d ai-service      # restaurar
```

---

## CI/CD con GitHub (#3)

### Crear repositorio
```bash
cd /opt/manobi-sentinel
git init
git add -A
git commit -m "Initial commit — Manobi Sentinel v0.4"

# Crear repo en GitHub (requiere gh CLI o crear desde web)
gh repo create BC-FABRIC-SAS/manobi-sentinel --private --source=. --push
```

### Verificar pipeline
El archivo `.github/workflows/ci.yml` tiene 3 jobs:
- **backend** — `npm install && npm test` (jest, 18 tests)
- **frontend** — `npm install && npm run build && npm test` (vitest, 2 tests)
- **docker-build** — construye 3 imágenes (api, frontend, ai-service) con buildx cache

Push a `main` o PR dispara la pipeline automáticamente.

### Deploy automático (opcional)
Agregar job en `ci.yml` que haga SSH al server:
```yaml
  deploy:
    runs-on: ubuntu-latest
    needs: [docker-build]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: root
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/manobi-sentinel
            git pull
            docker compose build
            docker compose up -d
```
Configurar secrets `SERVER_HOST` y `SSH_KEY` en GitHub Settings > Secrets.
