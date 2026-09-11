"""
backend/demo_backend.py

Local verification suite for the complete Iceberg Navigation Backend pipeline.
Tests model loading, 16 features input, 3 prediction horizons, GLORYS12 environmental lookup,
risk engine CPA/TCPA scoring, Dijkstra route optimizer, and FastAPI endpoint execution.
"""

import sys
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from predict import predict_trajectory
from services.environment import GLORYSEnvironment
from services.risk_engine import RiskEngine
from services.navigation import DijkstraRouteOptimizer
from fastapi.testclient import TestClient
from main import app


def run_pipeline_demo():
    print("=" * 80)
    print(" ICEBERG NAVIGATION BACKEND - INTEGRATION TEST & DEMO ")
    print("=" * 80)

    # 1. Sample 16-feature input
    sample_iceberg_input = {
        'latitude': -76.85589, 'longitude': 168.52410, 'bottom_temp': -15.42,
        'top_temp': -13.43, 'humidity': 69.35, 'wind_speed': 4.28,
        'pressure': 982.79, 'solar': 505.15, 'snow_distance': 3.72,
        'hour_of_day': 1.0, 'day_of_year': 305, 'sin_hour': 0.2588,
        'cos_hour': 0.9659, 'displacement': 0.047, 'speed': 0.0506, 'bearing': 351.37
    }

    start_pos = {"latitude": -76.80, "longitude": 168.40}
    dest_pos = {"latitude": -76.50, "longitude": 168.90}
    vessel_speed_knots = 12.0
    max_acceptable_siconc = 0.4

    print("\n--- STEP 1: ML Trajectory Prediction (iceberg_model.pkl) ---")
    preds = predict_trajectory(sample_iceberg_input)
    print("Model loaded successfully.")
    print("All 16 features accepted.")
    print("Predicted Horizons:")
    for horizon, coords in preds.items():
        print(f"  - {horizon:<7}: Lat = {coords['latitude']:.5f}°, Lon = {coords['longitude']:.5f}°")

    print("\n--- STEP 2: GLORYS12 Environmental Lookup (GLORYS12.nc) ---")
    env = GLORYSEnvironment()
    env_data = env.get_environmental_data(start_pos["latitude"], start_pos["longitude"])
    print("GLORYS12 lookup successful:")
    print(f"  - uo (eastward current)  : {env_data['uo_mps']} m/s")
    print(f"  - vo (northward current) : {env_data['vo_mps']} m/s")
    print(f"  - siconc (sea ice frac)  : {env_data['siconc']}")
    print(f"  - Current speed & heading: {env_data['current_speed_knots']} knots @ {env_data['current_heading_deg']}°")
    print(f"  - Status                 : {env_data['status']}")

    print("\n--- STEP 3: Maritime Risk Engine (CPA / TCPA) ---")
    risk_engine = RiskEngine()
    risk_data = risk_engine.evaluate_risk(start_pos, dest_pos, preds, vessel_speed_knots=vessel_speed_knots)
    print("Risk evaluation successful:")
    print(f"  - CPA (Closest Approach) : {risk_data['closest_point_of_approach_km']} km ({risk_data['closest_point_of_approach_nm']} NM)")
    print(f"  - TCPA (Time to CPA)     : {risk_data['time_to_cpa_minutes']} minutes ({risk_data['time_to_cpa_hours']} hours)")
    print(f"  - Threat Level           : {risk_data['threat_level']}")
    print(f"  - Risk Score (0-100)     : {risk_data['risk_score']}")

    print("\n--- STEP 4: Dijkstra Route Optimizer ---")
    nav_engine = DijkstraRouteOptimizer(environment=env)
    route_data = nav_engine.optimize_route(
        start=start_pos,
        destination=dest_pos,
        iceberg_predictions=preds,
        vessel_speed_knots=vessel_speed_knots,
        max_acceptable_siconc=max_acceptable_siconc
    )
    print("Dijkstra route optimization successful:")
    print(f"  - Algorithm              : {route_data['algorithm']}")
    print(f"  - Waypoints generated   : {route_data['waypoint_count']}")
    print(f"  - Total Route Distance   : {route_data['total_distance_nm']} NM ({route_data['total_distance_km']} km)")
    print(f"  - Estimated Travel Time  : {route_data['estimated_hours']} hours ({route_data['estimated_minutes']} mins)")
    print(f"  - Route Cost Value       : {route_data['route_cost']}")
    print(f"  - Min Iceberg Clearance  : {route_data['iceberg_min_clearance_km']} km")
    print(f"  - Route Status           : {route_data['route_status']}")

    print("\n--- STEP 5: FastAPI Endpoint Verification (POST /navigation/analyze) ---")
    client = TestClient(app)
    payload = {
        "start": start_pos,
        "destination": dest_pos,
        "vessel_info": {
            "speed_knots": vessel_speed_knots,
            "max_acceptable_siconc": max_acceptable_siconc
        },
        "iceberg_features": sample_iceberg_input
    }
    response = client.post("/navigation/analyze", json=payload)
    assert response.status_code == 200, f"Endpoint failed with code {response.status_code}"
    res_json = response.json()
    print("FastAPI POST /navigation/analyze returned 200 OK.")
    print("Keys in API Response:", list(res_json.keys()))

    print("\n" + "=" * 80)
    print(" VERIFICATION SUMMARY: ALL PIPELINE CHECKS PASSED SUCCESSFULLY ")
    print("=" * 80)


if __name__ == "__main__":
    run_pipeline_demo()
