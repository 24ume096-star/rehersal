"""
Synthetic Delhi flood training data generator.
Produces 2000 samples with realistic correlations:
  high rainfall + low elevation + low ndvi = high risk
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

def generate_training_data(n: int = 2000) -> pd.DataFrame:
    # ─── Raw features ──────────────────────────────────────────────────────
    ndvi                   = RNG.uniform(0.10, 0.70, n)
    elevation_m            = RNG.uniform(200,  240,  n)
    rainfall_24h_mm        = RNG.uniform(0,    300,  n)
    soil_moisture          = RNG.uniform(0,    1.0,  n)
    river_discharge_m3s    = RNG.uniform(0,    20_000, n)
    distance_to_yamuna_km  = RNG.uniform(0.1,  25,   n)
    drainage_capacity_score = RNG.uniform(0,   100,  n)
    green_cover_pct        = RNG.uniform(0,    80,   n)

    # ─── Realistic risk label (0-100) ──────────────────────────────────────
    # Each factor contributes up to its named maximum
    risk_raw = (
        (1 - ndvi)                       * 20   +   # low vegetation → +risk
        (240 - elevation_m) / 40         * 15   +   # low elevation  → +risk
        (rainfall_24h_mm / 300)          * 30   +   # heavy rainfall → +risk
        soil_moisture                    * 10   +   # saturated soil → +risk
        (river_discharge_m3s / 20_000)   * 15   +   # high discharge → +risk
        np.exp(-distance_to_yamuna_km / 4) * 8  +   # proximity boost
        (1 - drainage_capacity_score / 100) * 10 +  # bad drainage   → +risk
        (1 - green_cover_pct / 80)       * 5         # low green cover → +risk
    )
    # Normalise to 0-100 and add Gaussian noise
    flood_risk_score = np.clip(risk_raw / 1.13 + RNG.normal(0, 4, n), 0, 100)

    # ─── Binary flood classification (60+ = event) ─────────────────────────
    flood_event = flood_risk_score >= 60

    return pd.DataFrame({
        "ndvi":                    ndvi,
        "elevation_m":             elevation_m,
        "rainfall_24h_mm":         rainfall_24h_mm,
        "soil_moisture":           soil_moisture,
        "river_discharge_m3s":     river_discharge_m3s,
        "distance_to_yamuna_km":   distance_to_yamuna_km,
        "drainage_capacity_score": drainage_capacity_score,
        "green_cover_pct":         green_cover_pct,
        "flood_risk_score":        flood_risk_score.round(2),
        "flood_event":             flood_event,
    })


if __name__ == "__main__":
    df = generate_training_data()
    print(df.describe())
    print(f"\nFlood events: {df['flood_event'].sum()} / {len(df)}")
