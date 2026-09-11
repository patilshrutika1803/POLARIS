import math

import httpx
import numpy as np

from services.environment import GLORYSEnvironment


API_URL = "http://127.0.0.1:8000/navigation/analyze"
MAX_ACCEPTABLE_SICONC = 0.4


def low_ice_candidates(environment):
    sea_ice = np.asarray(environment.ds["siconc"].isel(time=0).values)
    latitudes = np.asarray(environment.ds["latitude"].values)
    longitudes = np.asarray(environment.ds["longitude"].values)
    indices = np.argwhere(np.isfinite(sea_ice) & (sea_ice <= MAX_ACCEPTABLE_SICONC))
    return [
        (float(latitudes[latitude_index]), float(longitudes[longitude_index]))
        for latitude_index, longitude_index in indices
    ]


def choose_route_points(environment):
    candidates = [
        point
        for point in low_ice_candidates(environment)
        if -60.5 <= point[0] <= -60.0 and 150.0 <= point[1] <= 156.0
    ]
    if len(candidates) < 2:
        raise AssertionError("Could not find two low-ice points in the GLORYS12 test area")
    return candidates[0], candidates[-1]


def main():
    environment = GLORYSEnvironment()
    start, destination = choose_route_points(environment)
    payload = {
        "start": {"latitude": start[0], "longitude": start[1]},
        "destination": {"latitude": destination[0], "longitude": destination[1]},
        "vessel_info": {
            "speed_knots": 12.0,
            "max_acceptable_siconc": MAX_ACCEPTABLE_SICONC,
            "heading": 90.0,
        },
    }

    with httpx.Client(timeout=120.0) as client:
        response = client.post(API_URL, json=payload)

    assert response.status_code == 200, response.text
    assert "application/json" in response.headers.get("content-type", "")
    result = response.json()

    for key in ("status", "iceberg_predictions", "glorys12_environment", "risk_analysis", "recommended_route"):
        assert key in result

    predictions = result["iceberg_predictions"]
    for horizon in ("current", "20_min", "1_hour", "6_hour"):
        assert horizon in predictions
        assert math.isfinite(predictions[horizon]["latitude"])
        assert math.isfinite(predictions[horizon]["longitude"])

    environment_result = result["glorys12_environment"]
    assert environment_result["status"] in {"OK", "OUT_OF_BOUNDS_CLAMPED"}
    assert math.isfinite(environment_result["siconc"])

    risk_result = result["risk_analysis"]
    assert "risk_score" in risk_result
    assert any(key in risk_result for key in ("threat_level", "threats", "threat"))

    route_result = result["recommended_route"]
    assert route_result["route_status"] in {"SAFE", "CAUTION", "HAZARDOUS", "INFEASIBLE"}
    assert result["status"] == "SUCCESS"

    print("API integration test passed")
    print("route_status:", route_result["route_status"])


if __name__ == "__main__":
    main()