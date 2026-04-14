"""
SHAP explainability for the Delhi flood ML model.
Uses TreeExplainer on the fitted RandomForestRegressor.
"""
from __future__ import annotations
import numpy as np
import shap
from features import FEATURE_NAMES, FEATURE_DESCRIPTIONS, to_feature_array


def _human_readable(feature: str, value: float, shap_val: float) -> str:
    """Generate a plain-English explanation for a single SHAP contribution."""
    direction = "contributed" if shap_val > 0 else "reduced"
    pct = abs(round(shap_val, 2))

    templates: dict[str, str] = {
        "ndvi": (
            f"Low vegetation cover (NDVI {value:.2f}) {direction} "
            f"{pct*100:.0f}% of this flood risk score"
        ),
        "elevation_m": (
            f"Low terrain elevation ({value:.0f} m) {direction} "
            f"{pct*100:.0f}% of this flood risk score"
        ),
        "rainfall_24h_mm": (
            f"{'Heavy' if value > 100 else 'Moderate'} rainfall (+{value:.0f} mm) "
            f"{direction} {pct*100:.0f}% of this flood risk score"
        ),
        "soil_moisture": (
            f"{'Saturated' if value > 0.7 else 'Moist'} soil ({value:.2f}) "
            f"{direction} {pct*100:.0f}% of this flood risk score"
        ),
        "river_discharge_m3s": (
            f"{'High' if value > 8000 else 'Moderate'} river discharge "
            f"({value/1000:.1f}k m³/s) {direction} {pct*100:.0f}% of this flood risk score"
        ),
        "distance_to_yamuna_km": (
            f"{'Proximity to' if shap_val > 0 else 'Distance from'} Yamuna "
            f"({value:.1f} km) {direction} {pct*100:.0f}% of this flood risk score"
        ),
        "drainage_capacity_score": (
            f"{'Poor' if value < 40 else 'Moderate'} drainage capacity ({value:.0f}/100) "
            f"{direction} {pct*100:.0f}% of this flood risk score"
        ),
        "green_cover_pct": (
            f"{'Low' if value < 30 else 'Moderate'} green cover ({value:.0f}%) "
            f"{direction} {pct*100:.0f}% of this flood risk score"
        ),
    }
    return templates.get(feature, f"{FEATURE_DESCRIPTIONS.get(feature, feature)} ({value:.2f}) {direction} {pct*100:.0f}%")


class SHAPExplainer:
    def __init__(self, regressor) -> None:
        self.explainer = shap.TreeExplainer(regressor)

    def explain(self, features_dict: dict, top_n: int = 4) -> list[dict]:
        """
        Return the top-N SHAP contributions for a single prediction.

        Returns a list of dicts:
          { feature, shapValue, direction, humanReadable }
        sorted by absolute SHAP value descending.
        """
        X = to_feature_array(features_dict)
        raw = self.explainer.shap_values(X)          # shape (1, n_features)
        sv_arr = np.asarray(raw).reshape(-1)          # flatten to (n_features,)

        results: list[dict] = []
        for feature, sv in zip(FEATURE_NAMES, sv_arr):
            results.append({
                "feature":      feature,
                "shapValue":    round(float(sv), 4),
                "direction":    "increases_risk" if sv > 0 else "reduces_risk",
                "humanReadable": _human_readable(feature, float(features_dict[feature]), float(sv)),
            })

        results.sort(key=lambda x: abs(x["shapValue"]), reverse=True)
        return results[:top_n]
