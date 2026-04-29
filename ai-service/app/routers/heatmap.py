"""Heatmap GeoJSON consumido por el frontend para overlay en OpenLayers.
Consulta la tabla `predicciones` y devuelve, por cada parque, la predicción
más reciente (últimas 24h) del tipo solicitado, usando el centroide del
polígono del parque como punto geométrico."""
from fastapi import APIRouter, HTTPException, Query
from psycopg.rows import dict_row
import logging
from ..services.db import get_pool

log = logging.getLogger('manobi-ai.heatmap')

router = APIRouter(prefix='/predictions', tags=['predictions'])

_QUERY = """
    SELECT DISTINCT ON (p.parque_id)
        p.parque_id,
        p.probabilidad,
        p.fecha,
        p.modelo_version,
        pk.nombre AS parque_nombre,
        ST_X(ST_Centroid(pk.geometria)) AS lon,
        ST_Y(ST_Centroid(pk.geometria)) AS lat
    FROM predicciones p
    JOIN parques pk ON pk.id = p.parque_id
    WHERE p.tipo = %(tipo)s
      AND p.fecha >= NOW() - (%(horas)s || ' hours')::interval
      AND pk.geometria IS NOT NULL
    ORDER BY p.parque_id, p.fecha DESC
"""


@router.get('/heatmap/{tipo}')
def heatmap(tipo: str, horas: int = Query(24, ge=1, le=168)):
    if tipo not in ('incendio', 'inundacion'):
        raise HTTPException(404, 'tipo no válido')

    try:
        with get_pool().connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_QUERY, {'tipo': tipo, 'horas': horas})
            rows = cur.fetchall()
    except Exception as e:
        log.warning(f'Fallo consulta heatmap: {e}')
        return {'type': 'FeatureCollection', 'features': [], 'error': 'db_unavailable'}

    features = [
        {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [float(r['lon']), float(r['lat'])]},
            'properties': {
                'tipo': tipo,
                'probabilidad': float(r['probabilidad']),
                'parque_id': str(r['parque_id']),
                'parque_nombre': r['parque_nombre'],
                'fecha': r['fecha'].isoformat() if r['fecha'] else None,
                'modelo_version': r['modelo_version'],
            },
        }
        for r in rows
    ]
    return {'type': 'FeatureCollection', 'features': features}


@router.get('/health')
def latest():
    return {'ok': True, 'service': 'predictions'}
