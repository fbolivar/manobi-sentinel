-- Índices espaciales (GIST) y de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_parques_geom               ON parques USING GIST (geometria);
CREATE INDEX IF NOT EXISTS idx_parques_region             ON parques (region);
CREATE INDEX IF NOT EXISTS idx_parques_nivel_riesgo       ON parques (nivel_riesgo);

CREATE INDEX IF NOT EXISTS idx_eventos_geom               ON eventos_climaticos USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha              ON eventos_climaticos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo               ON eventos_climaticos (tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_datos_raw_gin      ON eventos_climaticos USING GIN (datos_raw);

CREATE INDEX IF NOT EXISTS idx_alertas_estado             ON alertas (estado);
CREATE INDEX IF NOT EXISTS idx_alertas_nivel              ON alertas (nivel);
CREATE INDEX IF NOT EXISTS idx_alertas_parque             ON alertas (parque_id);
CREATE INDEX IF NOT EXISTS idx_alertas_fecha_inicio       ON alertas (fecha_inicio DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_activas
    ON alertas (parque_id, tipo) WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_predicciones_parque        ON predicciones (parque_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha         ON predicciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_predicciones_tipo          ON predicciones (tipo);

CREATE INDEX IF NOT EXISTS idx_usuarios_email             ON usuarios (email);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario          ON auditoria_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha            ON auditoria_logs (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_estaciones_geom            ON estaciones_ideam USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_reglas_activa              ON reglas_alerta (activa);
