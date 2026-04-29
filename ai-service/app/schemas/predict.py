from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class IncendioInput(BaseModel):
    parque_id: Optional[str] = None
    temperatura_c: float = Field(..., ge=-10, le=55)
    humedad_relativa: float = Field(..., ge=0, le=100)
    dias_sin_lluvia: int = Field(..., ge=0, le=365)
    viento_kmh: float = Field(0, ge=0, le=200)


class InundacionInput(BaseModel):
    parque_id: Optional[str] = None
    lluvia_24h_mm: float = Field(..., ge=0, le=1000)
    lluvia_1h_mm: float = Field(0, ge=0, le=500)
    nivel_riesgo: str = Field('medio', pattern='^(bajo|medio|alto)$')
    pendiente_pct: float = Field(15.0, ge=0, le=100)


class PredictionOutput(BaseModel):
    tipo: str
    probabilidad: float
    clase: int
    modelo_version: str
    fecha: datetime
    parque_id: Optional[str] = None
    horizonte_h: int = 0


class ForecastInput(BaseModel):
    parque_id: Optional[str] = None
    tipo: str = Field(..., pattern='^(incendio|inundacion)$')
    temperatura_c: float = Field(25, ge=-10, le=55)
    humedad_relativa: float = Field(75, ge=0, le=100)
    dias_sin_lluvia: int = Field(2, ge=0, le=365)
    viento_kmh: float = Field(10, ge=0, le=200)
    lluvia_24h_mm: float = Field(0, ge=0, le=1000)
    horizontes: list[int] = Field(default=[0, 24, 48, 72])


class HeatmapPoint(BaseModel):
    coordinates: list[float]
    intensidad: float


class TrainResponse(BaseModel):
    tipo: str
    modelo_version: str
    accuracy: float
    samples: int
