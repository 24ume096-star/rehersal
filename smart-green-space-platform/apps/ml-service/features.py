"""Feature names and engineering helpers for the Delhi flood ML model."""
import numpy as np

FEATURE_NAMES = [
    "ndvi",
    "elevation_m",
    "rainfall_24h_mm",
    "soil_moisture",
    "river_discharge_m3s",
    "distance_to_yamuna_km",
    "drainage_capacity_score",
    "green_cover_pct",
]

FEATURE_DESCRIPTIONS = {
    "ndvi":                    "Normalised Difference Vegetation Index",
    "elevation_m":             "Terrain elevation (m above sea level)",
    "rainfall_24h_mm":         "Cumulative rainfall in last 24 hours (mm)",
    "soil_moisture":           "Volumetric soil moisture (0-1 scale)",
    "river_discharge_m3s":     "Yamuna River discharge (m³/s)",
    "distance_to_yamuna_km":   "Distance to nearest Yamuna bank (km)",
    "drainage_capacity_score": "Storm-drain capacity index (0=blocked, 100=full)",
    "green_cover_pct":         "Green space cover within 1 km radius (%)",
}


def to_feature_array(raw: dict) -> np.ndarray:
    """Convert a raw input dict to a 2-D feature array (1, n_features)."""
    return np.array([[raw[f] for f in FEATURE_NAMES]], dtype=np.float64)


def risk_grade(score: float) -> str:
    """Map a continuous risk score to an A-E grade."""
    if score < 20:  return "A"
    if score < 40:  return "B"
    if score < 60:  return "C"
    if score < 80:  return "D"
    return "E"
