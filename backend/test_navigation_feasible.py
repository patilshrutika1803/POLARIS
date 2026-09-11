import sys

import numpy as np

from services.environment import GLORYSEnvironment
from services.navigation import DijkstraRouteOptimizer
from services.risk_engine import haversine_km


MAX_ACCEPTABLE_SICONC = 0.4
GRID_RESOLUTION = 25
CRITICAL_RADIUS_KM = 2.0


def find_low_ice_candidates(environment):
    sea_ice = environment.ds["siconc"].isel(time=0)
    values = np.asarray(sea_ice.values)
    latitudes = np.asarray(environment.ds["latitude"].values)
    longitudes = np.asarray(environment.ds["longitude"].values)

    candidate_indices = np.argwhere(
        np.isfinite(values) & (values <= MAX_ACCEPTABLE_SICONC)
    )
    candidates = []
    for latitude_index, longitude_index in candidate_indices:
        candidates.append(
            {
                "latitude": float(latitudes[latitude_index]),
                "longitude": float(longitudes[longitude_index]),
                "siconc": float(values[latitude_index, longitude_index]),
            }
        )
    return candidates


def closest_candidate(candidates, target_latitude, target_longitude):
    return min(
        candidates,
        key=lambda candidate: (
            candidate["latitude"] - target_latitude
        ) ** 2
        + (candidate["longitude"] - target_longitude) ** 2,
    )


def main():
    environment = GLORYSEnvironment()
    candidates = find_low_ice_candidates(environment)

    regional_candidates = [
        candidate
        for candidate in candidates
        if -60.5 <= candidate["latitude"] <= -60.0
        and 150.0 <= candidate["longitude"] <= 156.0
    ]
    if len(regional_candidates) < 2:
        raise RuntimeError("Could not find two nearby low-ice GLORYS12 candidates.")

    start_candidate = closest_candidate(regional_candidates, -60.25, 151.0)
    destination_candidate = closest_candidate(regional_candidates, -60.25, 155.0)

    start = {
        "latitude": start_candidate["latitude"],
        "longitude": start_candidate["longitude"],
    }
    destination = {
        "latitude": destination_candidate["latitude"],
        "longitude": destination_candidate["longitude"],
    }

    iceberg_predictions = {
        "current": {"latitude": -61.00, "longitude": 157.00},
        "20_min": {"latitude": -61.01, "longitude": 157.01},
        "1_hour": {"latitude": -61.02, "longitude": 157.02},
        "6_hour": {"latitude": -61.03, "longitude": 157.03},
    }

    iceberg_clearances = [
        haversine_km(
            start["latitude"],
            start["longitude"],
            prediction["latitude"],
            prediction["longitude"],
        )
        for prediction in iceberg_predictions.values()
    ]
    if min(iceberg_clearances) < CRITICAL_RADIUS_KM:
        raise RuntimeError("Selected start is inside the critical iceberg radius.")

    print("GLORYS12 low-ice candidates found:", len(candidates))
    print("Candidate start:", start_candidate)
    print("Candidate destination:", destination_candidate)
    for label, candidate in (("start", start), ("destination", destination)):
        environment_result = environment.get_environmental_data(
            candidate["latitude"], candidate["longitude"]
        )
        print(f"{label} environmental values:", {
            "uo": environment_result["uo_mps"],
            "vo": environment_result["vo_mps"],
            "siconc": environment_result["siconc"],
        })
        if not all(np.isfinite(environment_result[key]) for key in ("uo_mps", "vo_mps", "siconc")):
            raise RuntimeError(f"{label} candidate has non-finite environmental data")
    print("GLORYS12 domain:")
    print("  latitude:", environment.min_lat, "to", environment.max_lat)
    print("  longitude:", environment.min_lon, "to", environment.max_lon)

    optimizer = DijkstraRouteOptimizer(environment=environment)
    result = optimizer.optimize_route(
        start=start,
        destination=destination,
        iceberg_predictions=iceberg_predictions,
        vessel_speed_knots=12.0,
        max_acceptable_siconc=MAX_ACCEPTABLE_SICONC,
        grid_resolution=GRID_RESOLUTION,
    )

    print("\nFeasible-route diagnostic result")
    print("start:", start)
    print("destination:", destination)
    print("start siconc:", start_candidate["siconc"])
    print("destination siconc:", destination_candidate["siconc"])
    print("route_status:", result.get("route_status"))
    print("waypoint_count:", result.get("waypoint_count"))
    print("total_distance_km:", result.get("total_distance_km"))
    print("estimated_hours:", result.get("estimated_hours"))
    print("route_cost:", result.get("route_cost"))
    print("iceberg_min_clearance_km:", result.get("iceberg_min_clearance_km"))


if __name__ == "__main__":
    main()
