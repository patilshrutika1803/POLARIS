"""
backend/services/risk_engine.py

Maritime risk engine calculating Closest Point of Approach (CPA/TCPA),
iceberg danger zones from ML predicted trajectory points (20m, 1h, 6h),
and threat scoring. Does NOT double-advect the iceberg.
"""

import numpy as np

EARTH_RADIUS_KM = 6371.0088
KM_TO_NM = 0.539957  # 1 km = 0.539957 nautical miles


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance in kilometers using Haversine formula.
    """
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)

    a = np.sin(dphi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2.0) ** 2
    a = np.clip(a, 0.0, 1.0)
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return float(EARTH_RADIUS_KM * c)


class RiskEngine:
    """
    Maritime risk evaluation engine.
    """
    def __init__(self, critical_radius_km: float = 2.0, warning_radius_km: float = 10.0):
        self.critical_radius_km = critical_radius_km
        self.warning_radius_km = warning_radius_km

    def evaluate_risk(self, vessel_start: dict, vessel_dest: dict, iceberg_predictions: dict, vessel_speed_knots: float = 12.0) -> dict:
        """
        Evaluate start-position risk against predicted iceberg positions.

        ``vessel_dest`` remains part of the public API for pipeline compatibility;
        this calculation intentionally uses the vessel start and forecast points,
        not the destination, so no destination-based risk formula is implied.
        
        Parameters:
            vessel_start: dict {"latitude": float, "longitude": float}
            vessel_dest: dict {"latitude": float, "longitude": float}
            iceberg_predictions: dict containing 'current', '20_min', '1_hour', '6_hour' lat/lon dicts.
            vessel_speed_knots: Vessel speed in knots.
            
        Returns:
            dict containing CPA (km & NM), TCPA (hours), min_distance_km, threat_level, risk_score.
        """
        v_lat = vessel_start["latitude"]
        v_lon = vessel_start["longitude"]

        # Collect all predicted iceberg trajectory points
        horizon_keys = ["current", "20_min", "1_hour", "6_hour"]
        iceberg_points = []
        distances_km = {}

        min_dist_km = float("inf")
        closest_horizon = "current"

        for key in horizon_keys:
            if key in iceberg_predictions:
                ib_lat = iceberg_predictions[key]["latitude"]
                ib_lon = iceberg_predictions[key]["longitude"]
                dist = haversine_km(v_lat, v_lon, ib_lat, ib_lon)
                distances_km[key] = round(dist, 3)
                iceberg_points.append((ib_lat, ib_lon))

                if dist < min_dist_km:
                    min_dist_km = dist
                    closest_horizon = key

        # Estimate CPA and TCPA
        # Vessel speed in km/h = knots * 1.852
        v_speed_kmh = max(vessel_speed_knots * 1.852, 1.0)
        tcpa_hours = min_dist_km / v_speed_kmh
        cpa_km = min_dist_km
        cpa_nm = cpa_km * KM_TO_NM

        # Risk scoring algorithm (0 to 100)
        # Risk exponentially increases as distance decreases below warning_radius_km
        if min_dist_km <= self.critical_radius_km:
            threat_level = "CRITICAL"
            risk_score = 95.0 + (1.0 - min_dist_km / self.critical_radius_km) * 5.0
        elif min_dist_km <= self.warning_radius_km:
            threat_level = "HIGH"
            ratio = (min_dist_km - self.critical_radius_km) / (self.warning_radius_km - self.critical_radius_km)
            risk_score = 60.0 + (1.0 - ratio) * 35.0
        elif min_dist_km <= 30.0:
            threat_level = "MEDIUM"
            ratio = (min_dist_km - self.warning_radius_km) / 20.0
            risk_score = 25.0 + (1.0 - ratio) * 35.0
        else:
            threat_level = "LOW"
            risk_score = max(0.0, 25.0 * (1.0 - min_dist_km / 100.0))

        risk_score = float(np.clip(risk_score, 0.0, 100.0))

        return {
            "closest_point_of_approach_km": round(cpa_km, 3),
            "closest_point_of_approach_nm": round(cpa_nm, 3),
            "time_to_cpa_hours": round(tcpa_hours, 2),
            "time_to_cpa_minutes": round(tcpa_hours * 60.0, 1),
            "closest_horizon": closest_horizon,
            "horizon_distances_km": distances_km,
            "threat_level": threat_level,
            "risk_score": round(risk_score, 1),
            "critical_radius_km": self.critical_radius_km,
            "warning_radius_km": self.warning_radius_km
        }


if __name__ == "__main__":
    print("Testing RiskEngine...")
    engine = RiskEngine()
    v_start = {"latitude": -76.80, "longitude": 168.50}
    v_dest = {"latitude": -76.50, "longitude": 168.90}
    ib_preds = {
        "current": {"latitude": -76.84, "longitude": 168.52},
        "20_min": {"latitude": -76.841, "longitude": 168.525},
        "1_hour": {"latitude": -76.842, "longitude": 168.526},
        "6_hour": {"latitude": -76.848, "longitude": 168.539}
    }
    risk_output = engine.evaluate_risk(v_start, v_dest, ib_preds, vessel_speed_knots=12.0)
    print(risk_output)
