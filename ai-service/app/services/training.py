"""Generador de dataset sintético + entrenamiento de modelos.

Bootstrap inicial: hasta tener históricos reales suficientes, generamos datos
sintéticos basados en heurísticas climáticas conocidas para Colombia. Cuando
en producción se acumulen >= 1000 alertas reales, sustituir esto por queries
a la tabla `predicciones`/`alertas` para reentrenar.
"""
from __future__ import annotations
import os
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

MODELS_DIR = Path(os.getenv('MODELS_DIR', '/app/models'))
MODELS_DIR.mkdir(parents=True, exist_ok=True)
VERSION = 'v2'


def _synthetic_incendio(n: int = 8000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    temperatura = rng.normal(26, 6, n).clip(10, 45)
    humedad = rng.normal(70, 18, n).clip(5, 100)
    dias = rng.integers(0, 45, n)
    viento = rng.normal(10, 7, n).clip(0, 80)

    score = (
        0.12 * (temperatura - 25)
        - 0.05 * (humedad - 65)
        + 0.09 * dias
        + 0.04 * viento
        + rng.normal(0, 0.3, n)
    )
    prob = 1 / (1 + np.exp(-score))
    label = (rng.random(n) < prob).astype(int)
    return pd.DataFrame({
        'temperatura_c': temperatura, 'humedad_relativa': humedad,
        'dias_sin_lluvia': dias, 'viento_kmh': viento, 'label': label,
    })


def _synthetic_inundacion(n: int = 8000, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    lluvia24 = rng.gamma(2.5, 12, n).clip(0, 400)
    lluvia1 = rng.gamma(1.2, 8, n).clip(0, 150)
    nivel_riesgo_num = rng.integers(0, 3, n)
    pendiente = rng.normal(20, 12, n).clip(0, 80)

    score = (
        0.03 * lluvia24
        + 0.05 * lluvia1
        + 0.7 * nivel_riesgo_num
        + 0.02 * pendiente
        - 1.2
        + rng.normal(0, 0.3, n)
    )
    prob = 1 / (1 + np.exp(-score))
    label = (rng.random(n) < prob).astype(int)
    return pd.DataFrame({
        'lluvia_24h_mm': lluvia24, 'lluvia_1h_mm': lluvia1,
        'nivel_riesgo_num': nivel_riesgo_num, 'pendiente_pct': pendiente, 'label': label,
    })


def train_incendio() -> dict:
    df = _synthetic_incendio()
    X = df.drop(columns=['label']); y = df['label']
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', LogisticRegression(max_iter=500, C=1.0)),
    ])
    pipe.fit(Xtr, ytr)
    acc = accuracy_score(yte, pipe.predict(Xte))
    path = MODELS_DIR / f'incendio_{VERSION}.joblib'
    joblib.dump({'model': pipe, 'features': list(X.columns), 'version': VERSION}, path)
    return {'tipo': 'incendio', 'modelo_version': VERSION, 'accuracy': float(acc), 'samples': len(df)}


def train_inundacion() -> dict:
    df = _synthetic_inundacion()
    X = df.drop(columns=['label']); y = df['label']
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=7, stratify=y)
    clf = DecisionTreeClassifier(max_depth=6, min_samples_leaf=20, random_state=7)
    clf.fit(Xtr, ytr)
    acc = accuracy_score(yte, clf.predict(Xte))
    path = MODELS_DIR / f'inundacion_{VERSION}.joblib'
    joblib.dump({'model': clf, 'features': list(X.columns), 'version': VERSION}, path)
    return {'tipo': 'inundacion', 'modelo_version': VERSION, 'accuracy': float(acc), 'samples': len(df)}


def ensure_models() -> None:
    """Entrena modelos si no existen al boot."""
    if not (MODELS_DIR / f'incendio_{VERSION}.joblib').exists():
        train_incendio()
    if not (MODELS_DIR / f'inundacion_{VERSION}.joblib').exists():
        train_inundacion()
