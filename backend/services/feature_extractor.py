"""Feature extraction from the real B15A Wanderer time series."""

import math
import os
import re
from dataclasses import dataclass
from datetime import datetime


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "B15A_Wanderer_2008.txt")
SOURCE_COLUMNS = (
    "year", "month", "day", "hour", "minute", "latitude", "longitude",
    "orientation", "bottom_temp", "top_temp", "humidity", "wind_direction",
    "wind_speed", "pressure", "solar", "snow_distance",
)
REQUIRED_ENVIRONMENT_COLUMNS = SOURCE_COLUMNS[5:7] + SOURCE_COLUMNS[8:]


class FeatureExtractionError(ValueError):
    """Raised when a real B15A record cannot produce model features."""


@dataclass(frozen=True)
class B15ARecord:
    source_index: int
    timestamp: datetime
    values: tuple[float, ...]


def _parse_records(path: str = DATA_PATH) -> list[B15ARecord]:
    if not os.path.exists(path):
        raise FeatureExtractionError(f"B15A dataset not found at: {path}")

    records = []
    with open(path, "r", encoding="utf-8", errors="replace") as data_file:
        for line_number, raw_line in enumerate(data_file, start=1):
            tokens = [token for token in re.split(r"[\s,]+", raw_line.strip()) if token]
            if len(tokens) != len(SOURCE_COLUMNS):
                continue
            try:
                values = tuple(float(token) for token in tokens)
                timestamp = datetime(
                    int(values[0]), int(values[1]), int(values[2]),
                    int(values[3]), int(values[4]),
                )
            except (TypeError, ValueError, OverflowError) as exc:
                raise FeatureExtractionError(
                    f"Invalid B15A timestamp or numeric value on line {line_number}"
                ) from exc
            records.append(B15ARecord(len(records), timestamp, values))

    if not records:
        raise FeatureExtractionError("B15A dataset contains no numeric records")
    return records


def load_b15a_records(path: str = DATA_PATH) -> list[B15ARecord]:
    """Load the parsed numeric B15A records in their original time order."""
    return _parse_records(path)


def _is_finite_record(record: B15ARecord) -> bool:
    return all(math.isfinite(value) for value in record.values)


def _haversine_km(first: B15ARecord, second: B15ARecord) -> float:
    earth_radius_km = 6371.0088
    lat1, lon1 = math.radians(first.values[5]), math.radians(first.values[6])
    lat2, lon2 = math.radians(second.values[5]), math.radians(second.values[6])
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * earth_radius_km * math.asin(math.sqrt(min(1.0, haversine)))


def _initial_bearing(first: B15ARecord, second: B15ARecord) -> float:
    lat1 = math.radians(first.values[5])
    lat2 = math.radians(second.values[5])
    delta_lon = math.radians(second.values[6] - first.values[6])
    x = math.sin(delta_lon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        raise FeatureExtractionError("B15A coordinates are outside valid geographic ranges")


def _validate_features(features: dict[str, float]) -> dict[str, float]:
    expected = (
        "latitude", "longitude", "bottom_temp", "top_temp", "humidity",
        "wind_speed", "pressure", "solar", "snow_distance", "hour_of_day",
        "day_of_year", "sin_hour", "cos_hour", "displacement", "speed", "bearing",
    )
    if tuple(features) != expected:
        raise FeatureExtractionError("B15A features are not in the model's required order")
    if any(not math.isfinite(value) for value in features.values()):
        raise FeatureExtractionError("B15A feature extraction produced a non-finite value")
    _validate_coordinates(features["latitude"], features["longitude"])
    if not 0.0 <= features["hour_of_day"] < 24.0:
        raise FeatureExtractionError("Derived hour_of_day is outside [0, 24)")
    if not 1.0 <= features["day_of_year"] <= 366.0:
        raise FeatureExtractionError("Derived day_of_year is invalid")
    if features["displacement"] < 0.0 or features["speed"] < 0.0:
        raise FeatureExtractionError("Derived displacement and speed must be non-negative")
    if not 0.0 <= features["bearing"] < 360.0:
        raise FeatureExtractionError("Derived bearing is outside [0, 360)")
    return features


def extract_features(record_index: int | None = None, path: str = DATA_PATH) -> dict[str, float]:
    """Extract exactly the 16 model inputs from a B15A record and its predecessor.

    ``displacement`` is kilometers and ``speed`` is meters/second, calculated
    from the actual elapsed time. The source measurements are already in the
    units used by the model, so no environmental unit conversion is applied.
    """
    records = load_b15a_records(path)
    if record_index is None:
        candidates = range(1, len(records))
    else:
        if record_index < 1 or record_index >= len(records):
            raise FeatureExtractionError("trajectory_index must identify a record with a predecessor")
        candidates = (record_index,)

    selected = None
    for candidate in candidates:
        previous = records[candidate - 1]
        current = records[candidate]
        if _is_finite_record(previous) and _is_finite_record(current):
            selected = (previous, current)
            break
    if selected is None:
        raise FeatureExtractionError("Selected B15A trajectory record lacks a complete predecessor")

    previous, current = selected
    latitude = current.values[5]
    longitude = current.values[6]
    _validate_coordinates(latitude, longitude)
    elapsed_seconds = (current.timestamp - previous.timestamp).total_seconds()
    if elapsed_seconds <= 0.0:
        raise FeatureExtractionError("B15A trajectory timestamps must increase")

    displacement = _haversine_km(previous, current)
    speed = displacement * 1000.0 / elapsed_seconds
    hour_of_day = current.timestamp.hour + current.timestamp.minute / 60.0
    day_of_year = float(current.timestamp.timetuple().tm_yday)
    angle = 2.0 * math.pi * hour_of_day / 24.0

    return _validate_features({
        "latitude": latitude,
        "longitude": longitude,
        "bottom_temp": current.values[8],
        "top_temp": current.values[9],
        "humidity": current.values[10],
        "wind_speed": current.values[12],
        "pressure": current.values[13],
        "solar": current.values[14],
        "snow_distance": current.values[15],
        "hour_of_day": hour_of_day,
        "day_of_year": day_of_year,
        "sin_hour": math.sin(angle),
        "cos_hour": math.cos(angle),
        "displacement": displacement,
        "speed": speed,
        "bearing": _initial_bearing(previous, current),
    })