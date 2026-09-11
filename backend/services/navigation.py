"""
backend/services/navigation.py

Dijkstra-based route optimization engine over a risk-weighted spatial grid graph.
Implements the transparent route cost formula:
    Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty
Integrates GLORYS12 ocean currents and sea-ice concentration with ML iceberg predictions.
"""

import sys
import os
import heapq
import numpy as np

# Ensure services directory can resolve peer modules
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.environment import EnvironmentServiceError, GLORYSEnvironment
from services.risk_engine import haversine_km

KM_TO_NM = 0.539957


class DijkstraRouteOptimizer:
    """
    Route optimization using Dijkstra's algorithm over a spatial grid graph.
    """
    def __init__(self, environment: GLORYSEnvironment = None):
        self.env = environment if environment is not None else GLORYSEnvironment()

    def optimize_route(
        self,
        start: dict,
        destination: dict,
        iceberg_predictions: dict,
        vessel_speed_knots: float = 12.0,
        max_acceptable_siconc: float = 0.4,
        grid_resolution: int = 25
    ) -> dict:
        """
        Compute optimal safe route using Dijkstra's algorithm.
        
        Parameters:
            start (dict): {"latitude": float, "longitude": float}
            destination (dict): {"latitude": float, "longitude": float}
            iceberg_predictions (dict): Output from predict_trajectory()
            vessel_speed_knots (float): Vessel cruise speed in knots.
            max_acceptable_siconc (float): Max allowed sea-ice concentration (0.0 - 1.0).
            grid_resolution (int): Grid resolution per dimension (e.g. 25x25).
            
        Returns:
            dict containing waypoints, total_distance_nm, estimated_hours, route_cost, summary.
        """
        start_lat, start_lon = start["latitude"], start["longitude"]
        dest_lat, dest_lon = destination["latitude"], destination["longitude"]

        # Collect predicted iceberg positions (20-min, 1-hr, 6-hr, current)
        ib_points = []
        for key in ["current", "20_min", "1_hour", "6_hour"]:
            if key in iceberg_predictions:
                ib_points.append((iceberg_predictions[key]["latitude"], iceberg_predictions[key]["longitude"]))

        # Build bounding box for spatial grid graph
        all_lats = [start_lat, dest_lat] + [p[0] for p in ib_points]
        all_lons = [start_lon, dest_lon] + [p[1] for p in ib_points]

        margin = 0.15  # degrees margin (~15 km padding)
        min_lat = min(all_lats) - margin
        max_lat = max(all_lats) + margin
        min_lon = min(all_lons) - margin
        max_lon = max(all_lons) + margin

        # Create discrete grid coordinates
        lats = np.linspace(min_lat, max_lat, grid_resolution)
        lons = np.linspace(min_lon, max_lon, grid_resolution)

        # Helper to get closest grid node index
        def get_closest_node_idx(lat, lon):
            i = int(np.argmin(np.abs(lats - lat)))
            j = int(np.argmin(np.abs(lons - lon)))
            return (i, j)

        start_node = get_closest_node_idx(start_lat, start_lon)
        dest_node = get_closest_node_idx(dest_lat, dest_lon)

        # Precompute environmental data and risk cost for each grid node (i, j)
        node_env = {}
        node_risk = {}
        
        CRITICAL_RADIUS_KM = 2.0
        WARNING_RADIUS_KM = 12.0

        for i in range(grid_resolution):
            for j in range(grid_resolution):
                n_lat, n_lon = lats[i], lons[j]
                
                # GLORYS12 environmental lookup
                try:
                    env_data = self.env.get_environmental_data(n_lat, n_lon)
                except EnvironmentServiceError:
                    node_env[(i, j)] = {
                        "blocked": True,
                        "reason": "GLORYS12 environmental data unavailable"
                    }
                    node_risk[(i, j)] = 0.0
                    continue

                node_env[(i, j)] = env_data
                siconc = env_data["siconc"]
                node_blocked = False

                # 1. Sea-Ice Penalty
                sea_ice_penalty = siconc * 50.0
                if siconc > max_acceptable_siconc:
                    node_blocked = True

                # 2. Iceberg Proximity Risk
                iceberg_risk = 0.0
                min_ib_dist_km = float("inf")
                for ib_lat, ib_lon in ib_points:
                    d_km = haversine_km(n_lat, n_lon, ib_lat, ib_lon)
                    if d_km < min_ib_dist_km:
                        min_ib_dist_km = d_km

                if min_ib_dist_km < CRITICAL_RADIUS_KM:
                    node_blocked = True
                elif min_ib_dist_km < WARNING_RADIUS_KM:
                    # Exponential repulsion risk cost
                    iceberg_risk += 100.0 * np.exp(-(min_ib_dist_km - CRITICAL_RADIUS_KM) / 3.0)

                node_env[(i, j)]["blocked"] = node_blocked
                total_node_cost = iceberg_risk + sea_ice_penalty
                node_risk[(i, j)] = total_node_cost

        if node_env[start_node].get("blocked", False):
            return {
                "algorithm": "Dijkstra",
                "waypoints": [],
                "waypoint_count": 0,
                "total_distance_nm": 0.0,
                "total_distance_km": 0.0,
                "estimated_hours": 0.0,
                "estimated_minutes": 0.0,
                "route_cost": None,
                "iceberg_min_clearance_km": None,
                "route_status": "INFEASIBLE",
                "reason": (
                    "Vessel start position has unavailable GLORYS12 environmental data."
                    if node_env[start_node].get("reason") == "GLORYS12 environmental data unavailable"
                    else "Vessel start position violates navigation constraints."
                ),
                "cost_formula": "Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty"
            }

        if node_env[dest_node].get("blocked", False):
            return {
                "algorithm": "Dijkstra",
                "waypoints": [],
                "waypoint_count": 0,
                "total_distance_nm": 0.0,
                "total_distance_km": 0.0,
                "estimated_hours": 0.0,
                "estimated_minutes": 0.0,
                "route_cost": None,
                "iceberg_min_clearance_km": None,
                "route_status": "INFEASIBLE",
                "reason": (
                    "Destination has unavailable GLORYS12 environmental data."
                    if node_env[dest_node].get("reason") == "GLORYS12 environmental data unavailable"
                    else "Destination violates navigation constraints."
                ),
                "cost_formula": "Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty"
            }

        # 8-connected grid neighbors (horizontal, vertical, diagonal)
        neighbors = [
            (-1, 0), (1, 0), (0, -1), (0, 1),
            (-1, -1), (-1, 1), (1, -1), (1, 1)
        ]

        # Priority queue for Dijkstra algorithm: (cumulative_cost, node_idx)
        pq = [(0.0, start_node)]
        distances = {start_node: 0.0}
        parent = {}

        while pq:
            curr_cost, curr = heapq.heappop(pq)

            if curr == dest_node:
                break

            if curr_cost > distances.get(curr, float("inf")):
                continue

            ci, cj = curr
            c_lat, c_lon = lats[ci], lons[cj]

            for di, dj in neighbors:
                ni, nj = ci + di, cj + dj
                if 0 <= ni < grid_resolution and 0 <= nj < grid_resolution:
                    next_node = (ni, nj)
                    if node_env[next_node].get("blocked", False):
                        continue
                    n_lat, n_lon = lats[ni], lons[nj]

                    # Distance Cost (Nautical Miles)
                    step_dist_km = haversine_km(c_lat, c_lon, n_lat, n_lon)
                    step_dist_nm = step_dist_km * KM_TO_NM

                    # Average node risk penalty
                    step_risk_cost = (node_risk[curr] + node_risk[next_node]) / 2.0

                    # Total Edge Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty
                    edge_cost = step_dist_nm + step_risk_cost

                    new_cost = curr_cost + edge_cost
                    if new_cost < distances.get(next_node, float("inf")):
                        distances[next_node] = new_cost
                        parent[next_node] = curr
                        heapq.heappush(pq, (new_cost, next_node))

        # Reconstruct path from parent pointers
        path_nodes = []
        curr = dest_node

        if dest_node in parent or dest_node == start_node:
            while curr in parent:
                path_nodes.append(curr)
                curr = parent[curr]
            path_nodes.append(start_node)
            path_nodes.reverse()
        else:
            return {
                "algorithm": "Dijkstra",
                "waypoints": [],
                "waypoint_count": 0,
                "total_distance_nm": 0.0,
                "total_distance_km": 0.0,
                "estimated_hours": 0.0,
                "estimated_minutes": 0.0,
                "route_cost": None,
                "iceberg_min_clearance_km": None,
                "route_status": "INFEASIBLE",
                "reason": "No feasible route satisfies the current iceberg and sea-ice constraints.",
                "cost_formula": "Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty"
            }

        # Convert path node indices to waypoints
        waypoints = []
        total_dist_km = 0.0
        
        # Override start and destination to exact user coordinates
        waypoints.append({"latitude": round(start_lat, 6), "longitude": round(start_lon, 6)})

        for idx in range(1, len(path_nodes) - 1):
            pi, pj = path_nodes[idx]
            waypoints.append({"latitude": round(float(lats[pi]), 6), "longitude": round(float(lons[pj]), 6)})

        waypoints.append({"latitude": round(dest_lat, 6), "longitude": round(dest_lon, 6)})

        # Compute total distance along waypoints
        for idx in range(len(waypoints) - 1):
            p1 = waypoints[idx]
            p2 = waypoints[idx + 1]
            total_dist_km += haversine_km(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])

        total_dist_nm = total_dist_km * KM_TO_NM
        v_speed_knots = max(vessel_speed_knots, 1.0)
        estimated_hours = total_dist_nm / v_speed_knots

        # Check route safety clearance
        min_clearance_km = float("inf")
        for wp in waypoints:
            for ib_lat, ib_lon in ib_points:
                d = haversine_km(wp["latitude"], wp["longitude"], ib_lat, ib_lon)
                if d < min_clearance_km:
                    min_clearance_km = d

        route_status = "SAFE" if min_clearance_km >= WARNING_RADIUS_KM else ("CAUTION" if min_clearance_km >= CRITICAL_RADIUS_KM else "HAZARDOUS")

        return {
            "algorithm": "Dijkstra",
            "waypoints": waypoints,
            "waypoint_count": len(waypoints),
            "total_distance_nm": round(total_dist_nm, 2),
            "total_distance_km": round(total_dist_km, 2),
            "estimated_hours": round(estimated_hours, 2),
            "estimated_minutes": round(estimated_hours * 60.0, 1),
            "route_cost": round(float(distances.get(dest_node, 0.0)), 2),
            "iceberg_min_clearance_km": round(min_clearance_km, 2),
            "route_status": route_status,
            "cost_formula": "Route Cost = Distance Cost + Iceberg Risk + Sea-Ice Penalty + Vessel Constraint Penalty"
        }


if __name__ == "__main__":
    print("Testing DijkstraRouteOptimizer...")
    optimizer = DijkstraRouteOptimizer()
    v_start = {"latitude": -76.80, "longitude": 168.40}
    v_dest = {"latitude": -76.50, "longitude": 168.90}
    ib_preds = {
        "current": {"latitude": -76.84, "longitude": 168.52},
        "20_min": {"latitude": -76.841, "longitude": 168.525},
        "1_hour": {"latitude": -76.842, "longitude": 168.526},
        "6_hour": {"latitude": -76.848, "longitude": 168.539}
    }
    result = optimizer.optimize_route(v_start, v_dest, ib_preds)
    print("Dijkstra route result:", result)
