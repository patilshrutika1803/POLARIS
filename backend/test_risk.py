from services.risk_engine import RiskEngine


print("Initializing Risk Engine...")

risk_engine = RiskEngine()

print("Risk Engine initialized successfully!")


# -----------------------------
# VESSEL INPUT
# -----------------------------

vessel_start = {
    "latitude": -62.30,
    "longitude": 150.00
}

vessel_dest = {
    "latitude": -62.50,
    "longitude": 150.50
}

vessel_speed_knots = 12.0


# -----------------------------
# ICEBERG PREDICTIONS
# -----------------------------
# Same structure produced by predict.py

iceberg_predictions = {
    "current": {
        "latitude": -62.31,
        "longitude": 150.05
    },

    "20_min": {
        "latitude": -62.31,
        "longitude": 150.06
    },

    "1_hour": {
        "latitude": -62.32,
        "longitude": 150.07
    },

    "6_hour": {
        "latitude": -62.33,
        "longitude": 150.08
    }
}


print("\n--- VESSEL ---")
print("Start:", vessel_start)
print("Destination:", vessel_dest)
print("Speed:", vessel_speed_knots, "knots")


print("\n--- ICEBERG PREDICTIONS ---")
for key, value in iceberg_predictions.items():
    print(f"{key}: {value}")


# -----------------------------
# RISK CALCULATION
# -----------------------------

print("\nCalculating risk...")

result = risk_engine.evaluate_risk(
    vessel_start=vessel_start,
    vessel_dest=vessel_dest,
    iceberg_predictions=iceberg_predictions,
    vessel_speed_knots=vessel_speed_knots
)


print("\n--- RISK RESULT ---")
print(result)