from services.navigation import DijkstraRouteOptimizer


print("Initializing Dijkstra Route Optimizer...")

optimizer = DijkstraRouteOptimizer()

print("Dijkstra Route Optimizer initialized successfully!")


# -----------------------------
# VESSEL
# -----------------------------

start = {
    "latitude": -62.30,
    "longitude": 150.00
}

destination = {
    "latitude": -62.50,
    "longitude": 150.50
}

vessel_speed_knots = 12.0
max_acceptable_siconc = 0.4


# -----------------------------
# ICEBERG PREDICTIONS
# -----------------------------

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


print("\n--- ROUTE INPUT ---")
print("Start:", start)
print("Destination:", destination)
print("Vessel speed:", vessel_speed_knots, "knots")
print("Maximum acceptable sea-ice concentration:", max_acceptable_siconc)


print("\n--- ICEBERG PREDICTIONS ---")

for horizon, position in iceberg_predictions.items():
    print(f"{horizon}: {position}")


# -----------------------------
# RUN DIJKSTRA
# -----------------------------

print("\nRunning Dijkstra route optimization...")
print("This may take a little while because GLORYS12 is queried across the grid.")


result = optimizer.optimize_route(
    start=start,
    destination=destination,
    iceberg_predictions=iceberg_predictions,
    vessel_speed_knots=vessel_speed_knots,
    max_acceptable_siconc=max_acceptable_siconc,
    grid_resolution=25
)


# -----------------------------
# RESULT
# -----------------------------

print("\n==============================")
print("DIJKSTRA ROUTE RESULT")
print("==============================")

print(result)