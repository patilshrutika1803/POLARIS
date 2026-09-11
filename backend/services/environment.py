"""
backend/services/environment.py

Environmental lookup service reading ocean current velocity (uo, vo) and sea-ice concentration (siconc)
from the frozen NetCDF dataset GLORYS12.nc.
Performs safe grid interpolation and coordinate boundary handling without modifying GLORYS12.nc.
"""

import os
import logging
import xarray as xr
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "GLORYS12.nc")

_DATASET = None
_DATASET_PATH = None
MAX_VALID_CELL_SEARCH_KM = 50.0
REQUIRED_VARIABLES = ("uo", "vo", "siconc")

logger = logging.getLogger(__name__)


class EnvironmentServiceError(RuntimeError):
    """Raised when GLORYS12 data cannot be loaded or queried."""


def _haversine_km(latitude_1, longitude_1, latitude_2, longitude_2):
    latitude_1 = np.radians(latitude_1)
    latitude_2 = np.radians(latitude_2)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = np.radians(longitude_2) - np.radians(longitude_1)
    haversine = (
        np.sin(delta_latitude / 2.0) ** 2
        + np.cos(latitude_1) * np.cos(latitude_2) * np.sin(delta_longitude / 2.0) ** 2
    )
    return 6371.0 * 2.0 * np.arcsin(np.sqrt(haversine))


def load_dataset(nc_path: str = DATA_PATH):
    """
    Lazy load GLORYS12.nc dataset.
    """
    global _DATASET, _DATASET_PATH
    if _DATASET is None or _DATASET_PATH != nc_path:
        if not os.path.exists(nc_path):
            raise FileNotFoundError(f"GLORYS12 dataset not found at: {nc_path}")
        _DATASET = xr.open_dataset(nc_path)
        _DATASET_PATH = nc_path
    return _DATASET


class GLORYSEnvironment:
    """
    Environment service to query ocean conditions from GLORYS12.nc.
    """
    def __init__(self, nc_path: str = DATA_PATH):
        self.nc_path = nc_path
        self.ds = load_dataset(self.nc_path)
        
        # Grid boundaries
        self.min_lat = float(self.ds['latitude'].min())
        self.max_lat = float(self.ds['latitude'].max())
        self.min_lon = float(self.ds['longitude'].min())
        self.max_lon = float(self.ds['longitude'].max())

    def get_environmental_data(self, latitude: float, longitude: float) -> dict:
        """
        Query uo, vo, and siconc for a given latitude and longitude.
        Performs safe boundary clamping if coordinates are slightly out of dataset grid.
        
        Returns:
            dict containing uo (m/s), vo (m/s), siconc (0.0-1.0), current_speed_knots, current_heading_deg.
        """
        try:
            if not (self.min_lat <= latitude <= self.max_lat and self.min_lon <= longitude <= self.max_lon):
                raise EnvironmentServiceError(
                    f"Requested coordinate is outside GLORYS12 coverage: ({latitude}, {longitude})"
                )

            clamped_lat = float(np.clip(latitude, self.min_lat, self.max_lat))
            clamped_lon = float(np.clip(longitude, self.min_lon, self.max_lon))
            status = "OK"

            missing = [name for name in REQUIRED_VARIABLES if name not in self.ds]
            if missing:
                raise ValueError(f"Missing GLORYS12 variables: {missing}")

            latitudes = np.asarray(self.ds["latitude"].values)
            longitudes = np.asarray(self.ds["longitude"].values)
            latitude_index = int(np.argmin(np.abs(latitudes - clamped_lat)))
            longitude_index = int(np.argmin(np.abs(longitudes - clamped_lon)))
            nearest_latitude_index = latitude_index
            nearest_longitude_index = longitude_index
            selected_latitude = float(latitudes[latitude_index])
            selected_longitude = float(longitudes[longitude_index])

            sample = self.ds.isel(latitude=latitude_index, longitude=longitude_index)
            if "time" in sample.dims:
                sample = sample.isel(time=0)
            if "depth" in sample.dims:
                sample = sample.isel(depth=0)

            selected_time = sample["time"].values if "time" in sample.coords else None
            uo_values = np.asarray(self.ds["uo"].isel(time=0, depth=0).values)
            vo_values = np.asarray(self.ds["vo"].isel(time=0, depth=0).values)
            siconc_values = np.asarray(self.ds["siconc"].isel(time=0).values)
            nearest_raw_values = (
                uo_values[nearest_latitude_index, nearest_longitude_index],
                vo_values[nearest_latitude_index, nearest_longitude_index],
                siconc_values[nearest_latitude_index, nearest_longitude_index],
            )
            valid_cells = np.isfinite(uo_values) & np.isfinite(vo_values) & np.isfinite(siconc_values)

            latitude_grid, longitude_grid = np.meshgrid(latitudes, longitudes, indexing="ij")
            distance_km = _haversine_km(
                clamped_lat,
                clamped_lon,
                latitude_grid,
                longitude_grid,
            )
            valid_cells &= distance_km <= MAX_VALID_CELL_SEARCH_KM
            candidate_indices = np.argwhere(valid_cells)
            if not len(candidate_indices):
                raise ValueError(
                    "No valid GLORYS12 ocean cell within "
                    f"{MAX_VALID_CELL_SEARCH_KM:.0f} km of requested coordinate"
                )

            candidate_distances = distance_km[candidate_indices[:, 0], candidate_indices[:, 1]]
            nearest_candidate = candidate_indices[int(np.argmin(candidate_distances))]
            latitude_index, longitude_index = map(int, nearest_candidate)
            selected_latitude = float(latitudes[latitude_index])
            selected_longitude = float(longitudes[longitude_index])
            lookup_distance_km = float(distance_km[latitude_index, longitude_index])
            lookup_method = (
                "exact_grid_cell"
                if latitude_index == int(np.argmin(np.abs(latitudes - clamped_lat)))
                and longitude_index == int(np.argmin(np.abs(longitudes - clamped_lon)))
                else "nearest_valid_cell"
            )
            uo_val = float(uo_values[latitude_index, longitude_index])
            vo_val = float(vo_values[latitude_index, longitude_index])
            siconc_val = float(siconc_values[latitude_index, longitude_index])
            selected_time_value = self.ds["time"].values[0] if "time" in self.ds.coords else None
            logger.debug(
                "GLORYS12 lookup requested=(%.6f, %.6f) clamped=(%.6f, %.6f) "
                "nearest_indices=(%d, %d) selected_indices=(%d, %d) selected=(%.6f, %.6f) "
                "time=%s nearest_raw=(uo=%s, vo=%s, siconc=%s) raw=(uo=%s, vo=%s, siconc=%s)",
                latitude, longitude, clamped_lat, clamped_lon, latitude_index, longitude_index,
                nearest_latitude_index, nearest_longitude_index, selected_latitude, selected_longitude,
                selected_time_value, *nearest_raw_values, uo_val, vo_val, siconc_val,
            )
            if not all(np.isfinite(value) for value in (uo_val, vo_val, siconc_val)):
                raise ValueError("GLORYS12 lookup returned non-finite values")
            siconc_val = float(np.clip(siconc_val, 0.0, 1.0))

            # Calculate current speed in m/s and knots
            speed_mps = float(np.sqrt(uo_val**2 + vo_val**2))
            speed_knots = speed_mps * 1.94384  # 1 m/s = 1.94384 knots

            # Calculate current heading (degrees clockwise from North)
            # theta = atan2(uo, vo) converted to degrees
            heading_rad = np.arctan2(uo_val, vo_val)
            heading_deg = float((np.degrees(heading_rad) + 360.0) % 360.0)

            return {
                "latitude": latitude,
                "longitude": longitude,
                "clamped_latitude": clamped_lat,
                "clamped_longitude": clamped_lon,
                "lookup_method": lookup_method,
                "requested_latitude": latitude,
                "requested_longitude": longitude,
                "selected_latitude": selected_latitude,
                "selected_longitude": selected_longitude,
                "lookup_distance_km": round(lookup_distance_km, 4),
                "selected_time": str(selected_time_value) if selected_time_value is not None else None,
                "uo_mps": round(uo_val, 4),
                "vo_mps": round(vo_val, 4),
                "siconc": round(siconc_val, 4),
                "current_speed_mps": round(speed_mps, 4),
                "current_speed_knots": round(speed_knots, 4),
                "current_heading_deg": round(heading_deg, 2),
                "status": status
            }
        except Exception as exc:
            if isinstance(exc, EnvironmentServiceError):
                raise
            raise EnvironmentServiceError("GLORYS12 environmental lookup failed") from exc


if __name__ == "__main__":
    print("Testing GLORYSEnvironment...")
    env = GLORYSEnvironment()
    # Sample test coordinates inside dataset bounds (e.g. lat -65.5, lon 50.0)
    data1 = env.get_environmental_data(-65.5, 50.0)
    print("Sample inside bounds:", data1)
    
    # Sample test coordinates outside bounds (e.g. lat -76.85, lon 168.52)
    data2 = env.get_environmental_data(-76.85, 168.52)
    print("Sample outside bounds (clamped):", data2)
