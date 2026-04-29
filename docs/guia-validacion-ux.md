# Guía de validación UX — Manobi Sentinel

> Para realizar con 1 operador de PNN. Duración estimada: 45 min.

## Requisitos
- Navegador Chrome/Firefox actualizado
- Acceso a `https://192.168.50.5` (LAN del servidor)
- Credenciales: las proporcionadas por el admin

## Flujo de validación

### 1. Login (2 min)
- [ ] Acceder a `https://192.168.50.5` → redirige a `/login`
- [ ] Ingresar email + contraseña → Dashboard carga en < 5 s
- [ ] Intentar contraseña incorrecta → mensaje "Error de autenticación"

### 2. Dashboard y mapa (10 min)
- [ ] Panel izquierdo: "Alertas Activas" muestra lista con nivel rojo/amarillo
- [ ] Mapa: polígonos de parques visibles con colores según nivel de riesgo
- [ ] Click sobre un parque → tooltip con nombre, región, nivel
- [ ] Checkbox "Eventos" → puntos azules de estaciones IDEAM
- [ ] Checkbox "Heatmap IA" → blobs de color sobre los parques
- [ ] Selector "Incendio" / "Inundación" en el Heatmap cambia la visualización
- [ ] Panel derecho: "Métricas en tiempo real" con contadores
- [ ] Barra inferior: timeline con datos de temperatura/viento/lluvia
- **Observaciones:** _______________________________________________

### 3. Histórico (5 min)
- [ ] Click "Histórico" en la barra de navegación
- [ ] Filtrar por parque → la tabla y el gráfico de barras se actualizan
- [ ] Filtrar por nivel "rojo" → solo aparecen alertas rojas
- [ ] Seleccionar rango de fechas → datos coherentes
- [ ] Click "CSV" → se descarga archivo con las alertas filtradas
- **Observaciones:** _______________________________________________

### 4. Reportes (5 min)
- [ ] Click "Reportes" → formulario de generación a la izquierda
- [ ] Generar reporte PDF → mensaje "Reporte generado correctamente"
- [ ] El reporte aparece en la tabla de la derecha
- [ ] Click "Descargar" → se abre el PDF en nueva pestaña
- [ ] Probar con XLSX y CSV
- **Observaciones:** _______________________________________________

### 5. Suscripciones (5 min)
- [ ] Click "Suscripciones" → formulario canal Email
- [ ] Crear suscripción con nivel rojo + parque específico
- [ ] La suscripción aparece en la lista con indicador verde pulsante
- [ ] Pausar la suscripción → indicador gris
- [ ] Reactivar → indicador verde otra vez
- **Observaciones:** _______________________________________________

### 6. Reglas de alerta (5 min, solo admin)
- [ ] Click "Reglas" → lista de reglas con indicador activa/pausada
- [ ] Click "Editar" en una regla → panel lateral con JSON de condición
- [ ] Modificar el valor del umbral → "GUARDAR" → regla actualizada
- [ ] Click "+ NUEVA" → crear regla de prueba → aparece en la lista
- [ ] Eliminar la regla de prueba → desaparece
- **Observaciones:** _______________________________________________

### 7. Gestión de usuarios (5 min, solo admin)
- [ ] Click "Usuarios" → tabla con usuarios existentes
- [ ] Crear usuario operador con email/password válidos → aparece en tabla
- [ ] Cambiar rol a "consulta" desde el dropdown → cambio instantáneo
- [ ] Desactivar el usuario → botón cambia a "Activar"
- [ ] Eliminar el usuario de prueba
- **Observaciones:** _______________________________________________

### 8. Grafana (5 min)
- [ ] Acceder a `https://192.168.50.5/grafana/` → login de Grafana
- [ ] Dashboard "Manobi Sentinel / Overview" → paneles con datos reales
- [ ] Stat "Alertas activas — ROJO" tiene un valor numérico
- [ ] Gráfico "Alertas por hora" muestra barras
- [ ] Gráfico "Eventos IDEAM por tipo" muestra curvas de los 5 tipos
- [ ] Panel "Logs" muestra entradas recientes del motor
- **Observaciones:** _______________________________________________

## Feedback del operador

### ¿Qué fue fácil de entender?

### ¿Qué fue confuso o difícil de encontrar?

### ¿Qué información adicional le gustaría ver en el dashboard?

### ¿Qué acciones le gustaría poder hacer que hoy no puede?

### Calificación general (1-5): ___
