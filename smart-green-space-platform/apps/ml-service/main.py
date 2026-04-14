"""
Delhi Flood Risk ML Service — FastAPI application.
Exposes /predict, /predict/batch, /model/info, and /health.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import FloodModel, load_or_train_model
from shap_explain import SHAPExplainer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Delhi Flood Risk ML API",
    description="Random Forest flood risk predictions with SHAP explainability",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:4173",   # Vite preview / prod container
        "http://localhost:3000",   # API (internal cross-fetch)
        "*",                       # open for hackathon demos
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Startup: load / train model ─────────────────────────────────────────────
flood_model: FloodModel = None   # type: ignore
shap_explainer: SHAPExplainer = None  # type: ignore

@app.on_event("startup")
async def startup_event():
    global flood_model, shap_explainer
    logger.info("Loading flood model …")
    flood_model    = load_or_train_model()
    shap_explainer = SHAPExplainer(flood_model.regressor)
    logger.info("Model ready — version flood_rf_v1")


# ─── Schemas ─────────────────────────────────────────────────────────────────
class ZoneFeatures(BaseModel):
    parkId:                  str
    ndvi:                    float = Field(..., ge=0.0, le=1.0)
    elevation_m:             float = Field(..., ge=150, le=300)
    rainfall_24h_mm:         float = Field(..., ge=0, le=500)
    soil_moisture:           float = Field(..., ge=0.0, le=1.0)
    river_discharge_m3s:     float = Field(..., ge=0)
    distance_to_yamuna_km:   float = Field(..., ge=0)
    drainage_capacity_score: float = Field(..., ge=0, le=100)
    green_cover_pct:         float = Field(..., ge=0, le=100)


class BatchRequest(BaseModel):
    zones: list[ZoneFeatures]


class SHAPEntry(BaseModel):
    feature:      str
    shapValue:    float
    direction:    str
    humanReadable: str


class PredictionResponse(BaseModel):
    parkId:           str
    riskScore:        float
    floodProbability: float
    riskGrade:        str
    confidence:       float
    shapValues:       dict[str, float]
    topFactors:       list[dict]


class BatchResponse(BaseModel):
    predictions:    list[PredictionResponse]
    cityRiskScore:  float
    criticalZones:  list[str]


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _features_from_zone(zone: ZoneFeatures) -> dict:
    return {
        "ndvi":                    zone.ndvi,
        "elevation_m":             zone.elevation_m,
        "rainfall_24h_mm":         zone.rainfall_24h_mm,
        "soil_moisture":           zone.soil_moisture,
        "river_discharge_m3s":     zone.river_discharge_m3s,
        "distance_to_yamuna_km":   zone.distance_to_yamuna_km,
        "drainage_capacity_score": zone.drainage_capacity_score,
        "green_cover_pct":         zone.green_cover_pct,
    }

def _build_prediction(park_id: str, features: dict) -> PredictionResponse:
    result     = flood_model.predict(features)
    shap_list  = shap_explainer.explain(features)

    return PredictionResponse(
        parkId           = park_id,
        riskScore        = result["riskScore"],
        floodProbability = result["floodProbability"],
        riskGrade        = result["riskGrade"],
        confidence       = result["confidence"],
        shapValues       = {s["feature"]: s["shapValue"] for s in shap_list},
        topFactors       = [
            {
                "factor":       s["feature"],
                "contribution": s["shapValue"],
                "direction":    s["direction"],
                "humanReadable": s["humanReadable"],
            }
            for s in shap_list
        ],
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":    "ok",
        "service":   "delhi-flood-ml",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "modelLoaded": flood_model is not None,
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(zone: ZoneFeatures):
    """Single-zone flood risk prediction with SHAP explainability."""
    if not flood_model:
        raise HTTPException(status_code=503, detail="Model not yet loaded")
    features = _features_from_zone(zone)
    return _build_prediction(zone.parkId, features)


@app.post("/predict/batch", response_model=BatchResponse)
def predict_batch(req: BatchRequest):
    """Batch prediction for multiple Delhi flood zones."""
    if not flood_model:
        raise HTTPException(status_code=503, detail="Model not yet loaded")
    if not req.zones:
        raise HTTPException(status_code=422, detail="zones list is empty")

    predictions: list[PredictionResponse] = []
    for zone in req.zones:
        features = _features_from_zone(zone)
        predictions.append(_build_prediction(zone.parkId, features))

    city_risk     = sum(p.riskScore for p in predictions) / len(predictions)
    critical_zones = [p.parkId for p in predictions if p.riskScore >= 70]

    return BatchResponse(
        predictions   = predictions,
        cityRiskScore = round(city_risk, 2),
        criticalZones = critical_zones,
    )


@app.get("/model/info")
def model_info():
    """Return model metadata, training metrics, and feature importances."""
    if not flood_model:
        raise HTTPException(status_code=503, detail="Model not yet loaded")
    return {
        "modelVersion":       "flood_rf_v1",
        "trainedAt":          flood_model.trained_at,
        "metrics":            flood_model.metrics,
        "featureImportances": flood_model.feature_importances,
    }
