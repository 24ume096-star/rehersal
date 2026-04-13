import numpy as np
import pickle
from sklearn.ensemble import RandomForestRegressor
import os

def train():
    print("Generating simulated training dataset...")
    # Features: [NDVI, rainfall, distance_to_water, elevation]
    np.random.seed(42)
    n_samples = 5000
    
    ndvi = np.random.uniform(0.1, 0.8, n_samples)
    rainfall = np.random.uniform(0, 250, n_samples) # NCR monsoon extremes up to 250mm
    distance = np.random.uniform(0, 30000, n_samples) # Distance from Yamuna (up to 30km outward)
    elevation = np.random.uniform(190, 260, n_samples) # Real Delhi elevation typically 200-240m

    X = np.column_stack((ndvi, rainfall, distance, elevation))
    
    # NCR Specific Risk Topology Calculations
    risk = (
        (0.8 - ndvi) * 0.2 + 
        (rainfall / 250.0) * 0.35 +
        (1.0 - np.minimum(distance, 10000)/10000.0) * 0.2 +  # Increased Yamuna floodplain spillover risk
        (1.0 - np.minimum(elevation - 190, 70)/70.0) * 0.25 # Sharp risk curves for low-lying sectors (190-210m)
    )
    risk += np.random.normal(0, 0.05, n_samples)
    y = np.clip(risk, 0.0, 1.0)

    print("Training RandomForestRegressor model...")
    rf = RandomForestRegressor(n_estimators=50, max_depth=5, random_state=42)
    rf.fit(X, y)
    
    print("Model R^2 score:", rf.score(X, y))

    # ensure folder is set correctly
    path = os.path.dirname(os.path.realpath(__main__.__file__)) if hasattr(np, '__main__') else os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(path, "flood_risk_rf.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(rf, f)
    print(f"Saved optimized model to {model_path}")

if __name__ == "__main__":
    train()
