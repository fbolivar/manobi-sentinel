# Manual de usuario — Manobi Sentinel
## Sistema de alerta temprana climática para PNN Colombia

---

### Acceso al sistema

1. Abra su navegador (Chrome o Firefox) y visite: `https://192.168.50.5`
2. Ingrese su email y contraseña proporcionados por el administrador
3. Click "INICIAR SESIÓN"

> Si olvidó su contraseña, contacte al administrador del sistema.

---

### Dashboard (pantalla principal)

Al ingresar verá 4 zonas:

**Panel izquierdo — Alertas activas:**
- Lista de alertas en tiempo real ordenadas por gravedad
- Rojo = crítico (requiere acción inmediata)
- Amarillo = precaución (monitorear)
- Las alertas se actualizan automáticamente sin recargar

**Centro — Mapa interactivo:**
- Polígonos de colores = parques por nivel de riesgo
- Puntos azules = estaciones meteorológicas IDEAM
- Puntos rojos/naranjas = focos de calor satelitales (NASA + OroraTech)
- Click en cualquier elemento para ver detalles
- Use el panel de capas (esquina superior derecha) para activar/desactivar:
  - *Base* — mapa de fondo
  - *Parques* — polígonos de áreas protegidas
  - *Eventos* — estaciones meteorológicas
  - *Heatmap IA* — predicción de riesgo por inteligencia artificial
  - *Puntos de calor* — detecciones satelitales reales de incendios

**Panel derecho — Métricas en tiempo real:**
- Contadores de alertas por nivel
- Top 5 parques con más alertas
- Predicciones IA recientes

**Barra inferior — Timeline meteorológico:**
- Variables de temperatura, viento, lluvia de las últimas 24 horas

---

### Histórico de alertas

1. Click "Histórico" en la barra de navegación
2. Use los filtros:
   - **Parque** — ver alertas de un parque específico
   - **Nivel** — filtrar solo rojo, amarillo o verde
   - **Desde / Hasta** — rango de fechas
3. El gráfico de barras muestra tendencia diaria
4. La tabla inferior lista cada alerta con detalles
5. Click **CSV** para descargar un archivo con las alertas filtradas

---

### Reportes

1. Click "Reportes" en la barra de navegación
2. En el panel izquierdo:
   - Elija **tipo** de reporte (ej: "Resumen de alertas")
   - Seleccione **formato**: PDF, Excel o CSV
   - Marque los **niveles** a incluir
   - Opcionalmente seleccione **rango de fechas**
3. Click **GENERAR**
4. El reporte aparece en la tabla de la derecha
5. Click **Descargar** para obtener el archivo

---

### Suscripciones de notificación

1. Click "Suscripciones" en la barra de navegación
2. Cree una suscripción:
   - **Canal**: Email, Webhook o Push (navegador)
   - **Destino**: dirección de correo o URL
   - **Parque**: específico o "Todos"
   - **Niveles**: marque rojo, amarillo y/o verde
3. Las suscripciones se pueden pausar y reactivar
4. Las alertas rojo y amarillo se envían automáticamente

---

### Reglas de alerta (administrador)

1. Click "Reglas" en la barra de navegación
2. Vea las reglas activas del motor de alertas
3. Para editar una regla: click "Editar" → modifique el JSON de condición → "GUARDAR"
4. Para crear: click "+ NUEVA" → complete nombre, nivel, condición
5. Para pausar/reactivar: use los botones en cada regla

**Campos disponibles en condiciones:**
- `temperatura_c` — temperatura del aire (°C)
- `humedad_relativa` — humedad (%)
- `viento_kmh` — velocidad del viento (km/h)
- `lluvia_24h_mm` — lluvia acumulada 24h (mm)
- `lluvia_1h_mm` — lluvia última hora (mm)
- `dias_sin_lluvia` — días consecutivos sin lluvia
- `prediccion_ia.incendio` — probabilidad IA de incendio (0-100)
- `prediccion_ia.inundacion` — probabilidad IA de inundación (0-100)
- `parque.nivel_riesgo` — nivel de riesgo del parque (bajo/medio/alto)

---

### Gestión de usuarios (solo administrador)

1. Click "Usuarios" en la barra de navegación
2. Vea la tabla de usuarios existentes
3. Para crear: complete nombre, email, contraseña (≥8 chars), rol
4. Roles disponibles:
   - **Admin** — acceso total, puede crear usuarios y reglas
   - **Operador** — puede generar reportes, crear alertas manuales
   - **Consulta** — solo lectura del dashboard e histórico

---

### Grafana (monitoreo técnico)

1. Visite `https://192.168.50.5/grafana/`
2. Ingrese con las credenciales de Grafana (consulte al admin)
3. Dashboard "Manobi Sentinel / Overview" muestra:
   - Alertas activas y tendencias
   - Eventos IDEAM por tipo
   - Probabilidad IA por tipo
   - CPU, memoria, conexiones PostgreSQL
   - Logs del motor de alertas

---

### Preguntas frecuentes

**¿Cada cuánto se actualizan las alertas?**
El motor evalúa cada 15 minutos. Los datos IDEAM se actualizan cada 30 min. Los satélites (NASA/OroraTech) cada 1 hora.

**¿Qué significan los puntos de calor en el mapa?**
Son detecciones reales de temperatura anómala captadas por satélites (VIIRS, MODIS, GOES). Un punto rojo dentro de un parque genera automáticamente una alerta.

**¿Puedo recibir alertas en mi celular?**
Sí, cree una suscripción tipo "Push" y active las notificaciones cuando el navegador lo solicite. También puede crear una suscripción tipo "Email".

**¿La app funciona sin internet?**
Parcialmente. Si pierde conexión, verá los últimos datos cacheados. Al recuperar conexión, se actualiza automáticamente.

---

*Manobi Sentinel v0.4 — Parques Nacionales Naturales de Colombia*
*BC Fabric SAS — 2026*
