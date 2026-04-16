from __future__ import annotations
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict
import pandas as pd
import joblib
from .training import MODELS_DIR, VERSION

NIVEL_MAP = {'bajo': 0, 'medio': 1, 'alto': 2}


@lru_cache(maxsize=4)
def _load(tipo: str) -> Dict[str, Any]:
    path = MODELS_DIR / f'{tipo}_{VERSION}.joblib'
    return joblib.load(path)


def predict_incendio(payload: Dict[str, Any]) -> Dict[str, Any]:
    bundle = _load('incendio')
    df = pd.DataFrame([{k: payload.get(k, 0) for k in bundle['features']}])
    proba = float(bundle['model'].predict_proba(df)[0, 1])
    return {
        'tipo': 'incendio',
        'probabilidad': round(proba * 100, 2),
        'clase': int(proba >= 0.5),
        'modelo_version': bundle['version'],
        'fecha': datetime.utcnow().isoformat(),
        'parque_id': payload.get('parque_id'),
    }


def predict_inundacion(payload: Dict[str, Any]) -> Dict[str, Any]:
    bundle = _load('inundacion')
    nivel = payload.get('nivel_riesgo', 'medio')
    feats = {
        'lluvia_24h_mm': payload.get('lluvia_24h_mm', 0),
        'lluvia_1h_mm': payload.get('lluvia_1h_mm', 0),
        'nivel_riesgo_num': NIVEL_MAP.get(nivel, 1),
        'pendiente_pct': payload.get('pendiente_pct', 15),
    }
    df = pd.DataFrame([feats])
    proba = float(bundle['model'].predict_proba(df)[0, 1])
    return {
        'tipo': 'inundacion',
        'probabilidad': round(proba * 100, 2),
        'clase': int(proba >= 0.5),
        'modelo_version': bundle['version'],
        'fecha': datetime.utcnow().isoformat(),
        'parque_id': payload.get('parque_id'),
    }


def reset_cache() -> None:
    _load.cache_clear()
