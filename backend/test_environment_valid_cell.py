import math

from services.environment import GLORYSEnvironment


# Dataset-derived browser scenario coordinates.
REQUESTED_START = {"latitude": -60.25, "longitude": 151.00001525878906}


def main():
    environment = GLORYSEnvironment()
    result = environment.get_environmental_data(
        REQUESTED_START["latitude"], REQUESTED_START["longitude"]
    )

    values = (result["uo_mps"], result["vo_mps"], result["siconc"])
    assert all(math.isfinite(value) for value in values)

    print("Requested coordinate:", REQUESTED_START)
    print("Selected GLORYS12 coordinate:", {
        "latitude": result["selected_latitude"],
        "longitude": result["selected_longitude"],
    })
    print("Lookup distance:", result["lookup_distance_km"], "km")
    print("uo:", result["uo_mps"])
    print("vo:", result["vo_mps"])
    print("siconc:", result["siconc"])
    print("lookup method:", result["lookup_method"])
    print("status: PASS")


if __name__ == "__main__":
    main()