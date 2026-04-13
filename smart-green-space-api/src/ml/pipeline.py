import sys
import os
import pickle
import numpy as np
import geojson
import requests
import json
import shap
from datetime import datetime
from ndviService import get_gee_ndvi_grid, get_gee_dem_grid

def run_pipeline(park_id):
    # Metropolitan NCR Expansion (Outer bounds: Dwarka -> Noida, Central Delhi -> Gurgaon)
    lat_start = 28.45
    lng_start = 76.85
    lat_end = 28.75
    lng_end = 77.35
    bounds_ncr = {"w": lng_start, "s": lat_start, "e": lng_end, "n": lat_end}
    
    ndvi_grid = get_gee_ndvi_grid(park_id, bounds=bounds_ncr)
    
    try:
        dem_grid = get_gee_dem_grid(bounds_ncr)
    except Exception as e:
        print(f"Failed to fetch DEM grid, using simulated. {e}")
        dem_grid = np.full(ndvi_grid.shape, 215.0)

    # Reconcile any minor shape mismatches by truncating to minimal bounds
    min_lat = min(ndvi_grid.shape[0], dem_grid.shape[0])
    min_lng = min(ndvi_grid.shape[1], dem_grid.shape[1])
    ndvi_grid = ndvi_grid[:min_lat, :min_lng]
    dem_grid = dem_grid[:min_lat, :min_lng]
    
    grid_size_lat, grid_size_lng = ndvi_grid.shape

    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flood_risk_rf.pkl")
    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        print(f"Failed to load ML model {model_path}: {e}")
        sys.exit(1)

    print("Running Machine Learning model inference on raster dataset...")

    print("Running Machine Learning model inference on raster dataset...")
    
    # Live Open-Meteo Fetching & Historic Accumulation
    print("Fetching live and 72-hour historical weather metrics from Open-Meteo...")
    try:
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat_start}&longitude={lng_start}&current=precipitation,relative_humidity_2m&daily=precipitation_sum&past_days=3&elevation=nan"
        w_res = requests.get(weather_url, timeout=5).json()
        current_rainfall = float(w_res['current']['precipitation'])
        current_humidity = float(w_res['current']['relative_humidity_2m'])
        live_elev = float(w_res.get('elevation', 215.0))
        
        # 72-Hour trailing saturation array sum
        past_precip = w_res.get('daily', {}).get('precipitation_sum', [0, 0, 0])
        saturated_load = round(sum(p for p in past_precip if p is not None), 2)
        
        print(f"[Weather] Retrieved: Rain={current_rainfall}mm, Humidity={current_humidity}%, Elev={live_elev}m, 72h-Load={saturated_load}mm")
    except Exception as e:
        print(f"Failed to fetch live weather: {e}. Defaulting to hybrid mock.")
        current_rainfall = 45 # mm/hr fallback
        current_humidity = 80 # fallback
        live_elev = 215.0
        saturated_load = 120.5
    
    lat_step = (lat_end - lat_start) / grid_size_lat
    lng_step = (lng_end - lng_start) / grid_size_lng
    
    features = []
    cells = []

    for i in range(grid_size_lat):
        for j in range(grid_size_lng):
            ndvi_val = ndvi_grid[i, j]
            real_elev = dem_grid[i, j]
            
            # Yamuna River Proximity Logic: The river physically travels down Longitude ~77.25
            cell_lng = lng_start + (j * lng_step)
            # Distance from Yamuna mathematically approximated (degrees -> meters)
            dist_to_yamuna = abs(cell_lng - 77.25) * 111000 
            
            # Final 4 features input layout [NDVI, Rainfall, Distance to Yamuna, True SRTM Elevation]
            features.append([ndvi_val, current_rainfall, dist_to_yamuna, real_elev])
            
            # Forward the geographically accurate risk array out to GeoJSON heatmap
            cell_lat = lat_start + (i * lat_step)
            cell_lng = lng_start + (j * lng_step)
            cells.append({
                "i": i, "j": j,
                "poly": [
                    (cell_lng, cell_lat),
                    (cell_lng + lng_step, cell_lat),
                    (cell_lng + lng_step, cell_lat + lat_step),
                    (cell_lng, cell_lat + lat_step),
                    (cell_lng, cell_lat)
                ]
            })

    X = np.array(features)
    predictions = model.predict(X)

    # ── SHAP Explainability ───────────────────────────────────────────────────
    print("Calculating SHAP feature attributions for transparency...")
    try:
        explainer = shap.TreeExplainer(model)
        # Use a subset if X is massive, but for park grid it should be fine
        shap_vals = explainer.shap_values(X)
        
        # If binary classification, shap_values might be a list of two arrays
        # If regression or single output, it's one array. 
        # Typically RF classifiers in scikit-learn return [contribs_class0, contribs_class1]
        if isinstance(shap_vals, list):
            # Focus on contributions to the "High Risk" class (index 1) or probability
            shap_impact = np.abs(shap_vals[1]) if len(shap_vals) > 1 else np.abs(shap_vals[0])
        else:
            shap_impact = np.abs(shap_vals)
            
        # Normalize to percentages for user readability
        shap_sums = np.sum(shap_impact, axis=1)[:, np.newaxis]
        # Avoid division by zero
        shap_sums[shap_sums == 0] = 1e-9
        attributions = (shap_impact / shap_sums) * 100
    except Exception as e:
        print(f"SHAP calculation failed: {e}")
        attributions = np.zeros(X.shape)

    print("Generating Heatmap GeoJSON...")
    features_geojson = []
    
    for idx, cell in enumerate(cells):
        risk_score = predictions[idx]
        
        if risk_score > 0.65:
            color = "#ef4444"
            level = "High"
        elif risk_score > 0.4:
            color = "#eab308"
            level = "Medium"
        else:
            color = "#22c55e"
            level = "Low"
            
        feature = geojson.Feature(
            geometry=geojson.Polygon([cell["poly"]]),
            properties={
                "riskScore": round(float(risk_score), 2),
                "level": level,
                "fillColor": color,
                "fillOpacity": 0.5,
                "ndvi": round(float(X[idx][0]), 2),
                "rainfall": current_rainfall,
                "humidity": current_humidity,
                "elevation": round(float(X[idx][3]), 2),
                "saturatedLoad": saturated_load,
                "attributions": {
                    "vegetation_impact": round(float(attributions[idx][0]), 1),
                    "rainfall_impact":   round(float(attributions[idx][1]), 1),
                    "hydrology_proximity": round(float(attributions[idx][2]), 1),
                    "topography_impact": round(float(attributions[idx][3]), 1)
                }
            }
        )
        features_geojson.append(feature)

    feature_collection = geojson.FeatureCollection(features_geojson)

    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "heatmaps"))
    os.makedirs(public_dir, exist_ok=True)
    
    output_path = os.path.join(public_dir, f"{park_id}_heatmap.geojson")
    with open(output_path, "w") as f:
        geojson.dump(feature_collection, f)
        
    print(f"Pipeline completed successfully. Heatmap saved to {output_path}")

if __name__ == "__main__":
    park_id = sys.argv[1] if len(sys.argv) > 1 else "default_park"
    run_pipeline(park_id)
