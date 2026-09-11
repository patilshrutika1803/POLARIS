import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "iceberg_model.pkl"

print("Loading model...")
print("Model path:", MODEL_PATH)

model = joblib.load(MODEL_PATH)

print("\nMODEL LOADED SUCCESSFULLY!")
print("Model type:", type(model))
print("Number of input features:", model.n_features_in_)
print("Number of outputs:", model.n_outputs_)