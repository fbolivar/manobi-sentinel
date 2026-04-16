-- Reglas de alerta iniciales (motor evalúa cada 15 min)
INSERT INTO reglas_alerta (nombre, condicion, accion, nivel_resultante, activa) VALUES
('Lluvia extrema en parque de alto riesgo',
 '{"operador":"AND","condiciones":[
     {"campo":"lluvia_24h_mm","comparador":">","valor":50},
     {"campo":"parque.nivel_riesgo","comparador":"=","valor":"alto"}
 ]}'::jsonb,
 'Generar alerta roja por inundación', 'rojo', TRUE),

('Riesgo extremo de incendio',
 '{"operador":"AND","condiciones":[
     {"campo":"temperatura_c","comparador":">","valor":35},
     {"campo":"humedad_relativa","comparador":"<","valor":20},
     {"campo":"dias_sin_lluvia","comparador":">","valor":10}
 ]}'::jsonb,
 'Generar alerta roja por riesgo de incendio', 'rojo', TRUE),

('Lluvia intensa en ladera',
 '{"operador":"AND","condiciones":[
     {"campo":"lluvia_1h_mm","comparador":">","valor":30},
     {"campo":"topografia","comparador":"=","valor":"ladera"}
 ]}'::jsonb,
 'Generar alerta amarilla por riesgo de deslizamiento', 'amarillo', TRUE),

('Predicción IA alta probabilidad',
 '{"operador":"AND","condiciones":[
     {"campo":"prediccion_ia.probabilidad","comparador":">","valor":70}
 ]}'::jsonb,
 'Generar alerta según probabilidad IA', 'rojo', TRUE),

('Viento sostenido alto',
 '{"operador":"AND","condiciones":[
     {"campo":"viento_kmh","comparador":">","valor":60}
 ]}'::jsonb,
 'Generar alerta amarilla por viento', 'amarillo', TRUE)
ON CONFLICT DO NOTHING;
