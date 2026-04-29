# Propuesta de valor — Manobi Sentinel
## Sistema de alerta temprana climática para Parques Nacionales Naturales de Colombia

---

## Resumen ejecutivo

Manobi Sentinel es una plataforma web on-premise que monitorea en tiempo real las condiciones climáticas y riesgos de incendio en los 73 parques nacionales naturales de Colombia, utilizando datos de 8 fuentes oficiales (IDEAM + NASA + OroraTech) y modelos de inteligencia artificial predictiva.

---

## Métricas de operación (primeras 48h)

| Indicador | Valor |
|---|---|
| Parques monitoreados | **73** (100% del SINAP con geometría oficial RUNAP) |
| Fuentes de datos activas | **8** (5 IDEAM + VIIRS + MODIS + OroraTech) |
| Hotspots satelitales captados | **35,453** en 48h |
| Eventos meteorológicos ingestados | **110,982** en 48h |
| Predicciones IA generadas | **2,502** |
| Alertas generadas | **64** (49 rojas + 15 amarillas) |
| Tiempo de detección | **5 segundos** por ciclo |
| Frecuencia de evaluación | Cada **15 minutos** |
| Disponibilidad | **24/7** on-premise, sin dependencia cloud |

---

## Capacidades vs. estado anterior

| Capacidad | Sin Manobi | Con Manobi |
|---|---|---|
| Detección de incendio forestal | Manual, reportes tardíos | Automática, satelital cada 30 min |
| Cobertura de parques | Parcial, según recursos de campo | 73/73 parques monitoreados 24/7 |
| Alertas | Ninguna automatizada | Reglas configurables por nivel/variable |
| Notificación a operadores | Llamada telefónica | Email automático + push + webhook |
| Datos meteorológicos | Consulta manual portal IDEAM | 5 variables ingestadas automáticamente |
| Predicción | Ninguna | IA incendio + inundación + forecast 72h |
| Histórico | Archivos Excel | Dashboard filtrable + exportable CSV/PDF/XLSX |
| Auditoría | Ninguna | Log completo por usuario con timestamps |

---

## Arquitectura técnica

- **100% on-premise** — cumple requisitos gubernamentales de soberanía de datos
- **Sin costos de cloud** — corre en un servidor Debian con Docker
- **Open source** — sin licencias recurrentes de software
- **Certificado SSL** — comunicaciones cifradas TLS 1.2/1.3
- **Respaldo automático** — backup diario PostgreSQL + MinIO con retención 30 días

### Stack tecnológico
- **Backend:** NestJS (Node.js) — 35+ endpoints API REST documentados con Swagger
- **Frontend:** React + OpenLayers — mapa interactivo con capas
- **IA:** FastAPI + scikit-learn — predicción incendio/inundación + forecast 72h
- **Base de datos:** PostgreSQL 16 + PostGIS — soporte geoespacial nativo
- **Monitoreo:** Grafana + Prometheus + Loki — 18 paneles + 7 reglas de alerting

---

## Costos operativos estimados

| Concepto | Costo mensual |
|---|---|
| Servidor Debian (existente PNN) | $0 (ya asignado) |
| Electricidad + red | Incluido en presupuesto TI |
| NASA FIRMS API | $0 (gratuito) |
| OroraTech API (contratado) | Según plan comercial |
| IDEAM datos abiertos | $0 (datos.gov.co) |
| Soporte técnico BC Fabric | Por definir |
| **Licencias de software** | **$0** |

---

## Propuesta de servicios BC Fabric SAS

### Fase 1 — Despliegue (completada)
- Instalación on-premise en servidor PNN
- Configuración de red, SSL, Docker
- Integración con 8 fuentes de datos
- Capacitación inicial a operadores

### Fase 2 — Soporte y evolución (propuesta)
- Soporte técnico remoto L1/L2
- Actualizaciones de seguridad mensuales
- Nuevas integraciones bajo demanda (sensores IoT, drones)
- Reentrenamiento de modelos IA con datos históricos
- Dashboard de reportes personalizados

### Fase 3 — Escalamiento (futuro)
- Réplica a otras áreas protegidas (SINAP completo)
- Integración MODIS/VIIRS NRT (near-real-time por correo NASA)
- App móvil offline para guardaparques
- API pública para interoperabilidad con SIAC, RUNAP

---

## Contacto

**BC Fabric SAS**
Fernando Bolívar
fbolivarb@gmail.com

---

*Documento generado: Abril 2026*
*Versión del sistema: Manobi Sentinel v0.4*
