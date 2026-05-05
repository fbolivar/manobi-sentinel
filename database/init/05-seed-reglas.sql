-- Reglas de alerta (motor evalúa cada 15 min)
-- Contexto disponible: lluvia_24h_mm, lluvia_1h_mm, viento_kmh, temperatura_c,
--   humedad_relativa, dias_sin_lluvia, nivel_rio_mt, parque.nivel_riesgo,
--   prediccion_ia.incendio, prediccion_ia.inundacion

INSERT INTO reglas_alerta (nombre, condicion, accion, nivel_resultante, activa) VALUES

-- ─── AMARILLO ────────────────────────────────────────────────────────────────

('Lluvia moderada sostenida 24h',
 '{"campo":"lluvia_24h_mm","comparador":">","valor":30}'::jsonb,
 'Monitorear niveles de precipitación acumulada. Alertar a guardaparques en zonas de ladera.',
 'amarillo', TRUE),

('Lluvia intensa en 1h',
 '{"campo":"lluvia_1h_mm","comparador":">","valor":30}'::jsonb,
 'Lluvia intensa en la última hora. Revisar condición de ríos y drenajes en el área.',
 'amarillo', TRUE),

('Sequía prolongada con calor',
 '{"operador":"AND","condiciones":[
     {"campo":"dias_sin_lluvia","comparador":">","valor":15},
     {"campo":"temperatura_c","comparador":">","valor":28}
 ]}'::jsonb,
 'Condiciones de sequía con calor elevado. Incrementar patrullaje preventivo contra incendios.',
 'amarillo', TRUE),

('Temperatura anómala en parque de riesgo',
 '{"operador":"AND","condiciones":[
     {"campo":"temperatura_c","comparador":">","valor":25},
     {"campo":"parque.nivel_riesgo","comparador":"in","valor":["alto","medio"]}
 ]}'::jsonb,
 'Temperatura elevada en área de riesgo alto o medio. Activar monitoreo de condiciones de incendio.',
 'amarillo', TRUE),

('Viento sostenido alto',
 '{"campo":"viento_kmh","comparador":">","valor":60}'::jsonb,
 'Vientos fuertes sostenidos. Precaución con propagación de incendios y caída de árboles.',
 'amarillo', TRUE),

('Nivel de río elevado',
 '{"campo":"nivel_rio_mt","comparador":">","valor":3.5}'::jsonb,
 'Nivel del río por encima del umbral de precaución. Monitorear estaciones hidrológicas IDEAM.',
 'amarillo', TRUE),

('Precondición de incendio',
 '{"operador":"AND","condiciones":[
     {"campo":"temperatura_c","comparador":">","valor":30},
     {"campo":"humedad_relativa","comparador":"<","valor":35},
     {"campo":"dias_sin_lluvia","comparador":">","valor":5}
 ]}'::jsonb,
 'Condiciones favorables para inicio de incendio. Activar alerta temprana y patrullaje preventivo.',
 'amarillo', TRUE),

-- ─── ROJO ────────────────────────────────────────────────────────────────────

('Lluvia extrema en parque de alto riesgo',
 '{"operador":"AND","condiciones":[
     {"campo":"lluvia_24h_mm","comparador":">","valor":50},
     {"campo":"parque.nivel_riesgo","comparador":"=","valor":"alto"}
 ]}'::jsonb,
 'Lluvia extrema en área de alto riesgo. Activar protocolo de emergencia por posible inundación o deslizamiento.',
 'rojo', TRUE),

('Riesgo extremo de incendio',
 '{"operador":"AND","condiciones":[
     {"campo":"temperatura_c","comparador":">","valor":35},
     {"campo":"humedad_relativa","comparador":"<","valor":20},
     {"campo":"dias_sin_lluvia","comparador":">","valor":10}
 ]}'::jsonb,
 'Condiciones extremas de incendio. Activar protocolo de emergencia. Contactar Bomberos y Defensa Civil.',
 'rojo', TRUE),

('Predicción IA — incendio',
 '{"campo":"prediccion_ia.incendio","comparador":">","valor":70}'::jsonb,
 'Alta probabilidad de incendio según modelo IA. Verificar con imágenes satelitales OroraTech.',
 'rojo', TRUE),

('Predicción IA — inundación',
 '{"campo":"prediccion_ia.inundacion","comparador":">","valor":80}'::jsonb,
 'Alta probabilidad de inundación según modelo IA. Verificar niveles de río y condiciones de lluvia aguas arriba.',
 'rojo', TRUE),

('Río en nivel crítico con lluvia',
 '{"operador":"AND","condiciones":[
     {"campo":"nivel_rio_mt","comparador":">","valor":5},
     {"campo":"lluvia_1h_mm","comparador":">","valor":15}
 ]}'::jsonb,
 'Nivel crítico del río combinado con lluvia activa. Riesgo inminente de desbordamiento. Activar evacuación preventiva.',
 'rojo', TRUE)

ON CONFLICT DO NOTHING;
