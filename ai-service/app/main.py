from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
from prometheus_fastapi_instrumentator import Instrumentator

from .routers import predict as predict_router
from .routers import heatmap as heatmap_router
from .services.training import ensure_models, VERSION
from .services.db import get_pool, close_pool

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
log = logging.getLogger('manobi-ai')

app = FastAPI(title='Manobi Sentinel AI', version='0.4.0', description='Microservicio de predicción climática')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

app.include_router(predict_router.router)
app.include_router(heatmap_router.router)

Instrumentator(
    excluded_handlers=['/health', '/metrics'],
).instrument(app).expose(app, endpoint='/metrics', include_in_schema=False)


@app.on_event('startup')
def boot():
    log.info('Verificando modelos persistidos…')
    ensure_models()
    log.info(f'Modelos {VERSION} listos')
    try:
        get_pool()
    except Exception as e:
        log.warning(f'Pool PostgreSQL no disponible al boot: {e}')


@app.on_event('shutdown')
def shutdown():
    close_pool()


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'manobi-ai', 'modelo_version': VERSION, 'ts': datetime.utcnow().isoformat()}


@app.get('/')
def root():
    return {
        'service': 'manobi-ai',
        'docs': '/docs',
        'endpoints': [
            'POST /predict/incendio', 'POST /predict/inundacion',
            'POST /predict/retrain/{tipo}',
            'GET  /predictions/heatmap/{tipo}',
        ],
    }
