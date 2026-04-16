from fastapi import APIRouter
from ..schemas.predict import ForecastInput, IncendioInput, InundacionInput, PredictionOutput, TrainResponse
from ..services import inference, training
from datetime import datetime, timedelta

router = APIRouter(prefix='/predict', tags=['predict'])


@router.post('/incendio', response_model=PredictionOutput)
def predict_incendio(payload: IncendioInput):
    return inference.predict_incendio(payload.model_dump())


@router.post('/inundacion', response_model=PredictionOutput)
def predict_inundacion(payload: InundacionInput):
    return inference.predict_inundacion(payload.model_dump())


@router.post('/forecast', response_model=list[PredictionOutput])
def forecast(payload: ForecastInput):
    results = []
    d = payload.model_dump()
    for h in payload.horizontes:
        feats = {**d, 'dias_sin_lluvia': d['dias_sin_lluvia'] + h // 24}
        if payload.tipo == 'incendio':
            r = inference.predict_incendio(feats)
        else:
            r = inference.predict_inundacion({
                'parque_id': d.get('parque_id'),
                'lluvia_24h_mm': d['lluvia_24h_mm'] * max(0.5, 1 - h / 168),
                'lluvia_1h_mm': 0,
                'nivel_riesgo': 'medio',
            })
        r['horizonte_h'] = h
        r['fecha'] = (datetime.utcnow() + timedelta(hours=h)).isoformat()
        results.append(r)
    return results


@router.post('/retrain/{tipo}', response_model=TrainResponse)
def retrain(tipo: str):
    if tipo == 'incendio':
        result = training.train_incendio()
    elif tipo == 'inundacion':
        result = training.train_inundacion()
    else:
        return {'tipo': tipo, 'modelo_version': '-', 'accuracy': 0.0, 'samples': 0}
    inference.reset_cache()
    return result
