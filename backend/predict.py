"""
backend/predict.py

ML Inference module for iceberg trajectory prediction using the frozen iceberg_model.pkl.
Strictly preserves the 16 input features and outputs predicted coordinates for 20-min, 1-hour, and 6-hour horizons.
"""

import os
import joblib
import pandas as pd
import numpy as np

# Absolute path resolution for backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "iceberg_model.pkl")

# Expected 16 features in exact order
EXPECTED_FEATURES = [
    'latitude', 'longitude', 'bottom_temp', 'top_temp', 'humidity',
    'wind_speed', 'pressure', 'solar', 'snow_distance', 'hour_of_day',
    'day_of_year', 'sin_hour', 'cos_hour', 'displacement', 'speed', 'bearing'
]

# Singleton model holder
_MODEL = None


class PredictionServiceError(RuntimeError):
    """Raised when the model cannot produce a valid prediction."""


def is_model_loaded() -> bool:
    """Return whether the singleton model has been loaded successfully."""
    return _MODEL is not None


def load_model():
    """
    Load frozen RandomForestRegressor model using joblib.
    """
    global _MODEL
    if _MODEL is None:
        if not os.path.exists(MODEL_PATH):
            raise PredictionServiceError("Model file not found")
        try:
            _MODEL = joblib.load(MODEL_PATH)
        except Exception as exc:
            raise PredictionServiceError("Model could not be loaded") from exc
    return _MODEL


def predict_trajectory(user_input: dict) -> dict:
    """
    Predict iceberg future trajectory coordinates.
    
    Parameters:
        user_input (dict): Input dictionary containing the 16 required feature values.
        
    Returns:
        dict: Predicted coordinates for current, 20_min, 1_hour, and 6_hour horizons.
    """
    model = load_model()

    # Validate that all 16 features are present
    missing = [f for f in EXPECTED_FEATURES if f not in user_input]
    if missing:
        raise ValueError(f"Missing required features for iceberg ML model: {missing}")

    # Format input DataFrame matching exact feature ordering
    input_df = pd.DataFrame([[user_input[f] for f in EXPECTED_FEATURES]], columns=EXPECTED_FEATURES)

    # Perform inference
    try:
        raw_predictions = np.asarray(model.predict(input_df))
    except Exception as exc:
        raise PredictionServiceError("Model inference failed") from exc

    if raw_predictions.size != 6:
        raise PredictionServiceError("Model output must contain exactly six values")

    predictions = raw_predictions.reshape(-1)
    if not np.all(np.isfinite(predictions)):
        raise PredictionServiceError("Model output contains non-finite values")

    # Parse predictions
    # Predictions array layout:
    # [lat_20m, lon_20m, lat_1h, lon_1h, lat_6h, lon_6h]
    result = {
        "current": {
            "latitude": float(user_input['latitude']),
            "longitude": float(user_input['longitude'])
        },
        "20_min": {
            "latitude": float(predictions[0]),
            "longitude": float(predictions[1])
        },
        "1_hour": {
            "latitude": float(predictions[2]),
            "longitude": float(predictions[3])
        },
        "6_hour": {
            "latitude": float(predictions[4]),
            "longitude": float(predictions[5])
        }
    }
    return result


if __name__ == "__main__":
    # Test script directly
    sample_input = {
        'latitude': -76.85589, 'longitude': 168.52410, 'bottom_temp': -15.42,
        'top_temp': -13.43, 'humidity': 69.35, 'wind_speed': 4.28,
        'pressure': 982.79, 'solar': 505.15, 'snow_distance': 3.72,
        'hour_of_day': 1.0, 'day_of_year': 305, 'sin_hour': 0.2588,
        'cos_hour': 0.9659, 'displacement': 0.047, 'speed': 0.0506, 'bearing': 351.37
    }
    print("Testing predict_trajectory...")
    output = predict_trajectory(sample_input)
    print(output)
