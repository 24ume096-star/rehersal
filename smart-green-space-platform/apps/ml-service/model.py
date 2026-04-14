"""
RandomForest flood risk model — training, saving, loading, and inference.
"""
from __future__ import annotations
import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import joblib
import mlflow
import mlflow.sklearn
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, roc_auc_score, f1_score

from features import FEATURE_NAMES, to_feature_array, risk_grade
from data.training_data import generate_training_data

logger = logging.getLogger(__name__)

MODEL_DIR  = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "flood_rf_v1.pkl"
META_PATH  = MODEL_DIR / "flood_rf_v1_meta.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)


class FloodModel:
    def __init__(self) -> None:
        self.regressor:  RandomForestRegressor | None  = None
        self.classifier: RandomForestClassifier | None = None
        self.trained_at: str = ""
        self.metrics: dict   = {}
        self.feature_importances: dict = {}

    # ─── Training ────────────────────────────────────────────────────────────
    def train(self) -> None:
        logger.info("Generating synthetic training data …")
        df = generate_training_data(2000)

        X   = df[FEATURE_NAMES].values
        y_r = df["flood_risk_score"].values
        y_c = df["flood_event"].astype(int).values

        X_tr, X_te, yr_tr, yr_te, yc_tr, yc_te = train_test_split(
            X, y_r, y_c, test_size=0.2, random_state=42
        )

        mlflow.set_tracking_uri("file:./mlruns")
        with mlflow.start_run(run_name="flood_rf_v1"):

            # Regressor
            self.regressor = RandomForestRegressor(
                n_estimators=200, max_depth=12, random_state=42, n_jobs=-1
            )
            self.regressor.fit(X_tr, yr_tr)
            yr_pred = self.regressor.predict(X_te)
            rmse    = float(np.sqrt(mean_squared_error(yr_te, yr_pred)))
            r2      = float(r2_score(yr_te, yr_pred))

            # Classifier
            self.classifier = RandomForestClassifier(
                n_estimators=200, random_state=42, n_jobs=-1
            )
            self.classifier.fit(X_tr, yc_tr)
            yc_pred  = self.classifier.predict(X_te)
            yc_proba = self.classifier.predict_proba(X_te)[:, 1]
            auc      = float(roc_auc_score(yc_te, yc_proba))
            f1       = float(f1_score(yc_te, yc_pred))

            # Log to MLflow
            mlflow.log_metrics({"rmse": rmse, "r2": r2, "auc": auc, "f1": f1})
            mlflow.sklearn.log_model(self.regressor,  "flood_regressor")
            mlflow.sklearn.log_model(self.classifier, "flood_classifier")

        self.trained_at = datetime.now(timezone.utc).isoformat()
        self.metrics    = {"rmse": round(rmse, 4), "r2": round(r2, 4),
                           "auc": round(auc, 4), "f1": round(f1, 4)}
        self.feature_importances = {
            name: round(float(imp), 4)
            for name, imp in zip(FEATURE_NAMES, self.regressor.feature_importances_)
        }
        logger.info("Training complete — RMSE=%.2f  R²=%.3f  AUC=%.3f", rmse, r2, auc)

    # ─── Persistence ─────────────────────────────────────────────────────────
    def save(self) -> None:
        joblib.dump({"regressor": self.regressor, "classifier": self.classifier}, MODEL_PATH)
        meta = {"trained_at": self.trained_at, "metrics": self.metrics,
                "feature_importances": self.feature_importances}
        META_PATH.write_text(json.dumps(meta, indent=2))
        logger.info("Model saved to %s", MODEL_PATH)

    @classmethod
    def load(cls) -> "FloodModel":
        obj = cls()
        data = joblib.load(MODEL_PATH)
        obj.regressor  = data["regressor"]
        obj.classifier = data["classifier"]
        meta = json.loads(META_PATH.read_text())
        obj.trained_at = meta["trained_at"]
        obj.metrics    = meta["metrics"]
        obj.feature_importances = meta["feature_importances"]
        logger.info("Model loaded from %s", MODEL_PATH)
        return obj

    # ─── Inference ───────────────────────────────────────────────────────────
    def predict(self, features_dict: dict) -> dict:
        assert self.regressor and self.classifier, "Model not loaded"
        X = to_feature_array(features_dict)

        risk_score      = float(self.regressor.predict(X)[0])
        flood_proba     = float(self.classifier.predict_proba(X)[0][1])

        # Confidence: 1 − normalised std across trees
        tree_preds      = np.array([t.predict(X)[0] for t in self.regressor.estimators_])
        confidence      = float(np.clip(1.0 - np.std(tree_preds) / 50.0, 0.0, 1.0))

        return {
            "riskScore":       round(risk_score, 2),
            "floodProbability": round(flood_proba, 4),
            "riskGrade":       risk_grade(risk_score),
            "confidence":      round(confidence, 4),
        }


# ─── Module-level helper ─────────────────────────────────────────────────────
def load_or_train_model() -> FloodModel:
    """Load a saved model from disk, training and saving if absent."""
    if MODEL_PATH.exists():
        try:
            return FloodModel.load()
        except Exception as exc:
            logger.warning("Could not load saved model (%s); retraining …", exc)

    model = FloodModel()
    model.train()
    model.save()
    return model
