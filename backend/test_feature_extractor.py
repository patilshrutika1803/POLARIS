import math
from pathlib import Path

from services.feature_extractor import (
    DATA_PATH,
    REQUIRED_ENVIRONMENT_COLUMNS,
    SOURCE_COLUMNS,
    extract_features,
    load_b15a_records,
)


EXPECTED_FEATURES = (
    "latitude", "longitude", "bottom_temp", "top_temp", "humidity",
    "wind_speed", "pressure", "solar", "snow_distance", "hour_of_day",
    "day_of_year", "sin_hour", "cos_hour", "displacement", "speed", "bearing",
)


def test_real_b15a_feature_extraction():
    assert Path(DATA_PATH).is_file()
    records = load_b15a_records()
    assert records
    assert SOURCE_COLUMNS[:7] == (
        "year", "month", "day", "hour", "minute", "latitude", "longitude",
    )
    assert set(REQUIRED_ENVIRONMENT_COLUMNS).issubset(SOURCE_COLUMNS)

    features = extract_features()
    assert tuple(features) == EXPECTED_FEATURES
    assert all(math.isfinite(value) for value in features.values())
    assert -90.0 <= features["latitude"] <= 90.0
    assert -180.0 <= features["longitude"] <= 180.0
    assert 0.0 <= features["hour_of_day"] < 24.0
    assert 1.0 <= features["day_of_year"] <= 366.0

    angle = 2.0 * math.pi * features["hour_of_day"] / 24.0
    assert math.isclose(features["sin_hour"], math.sin(angle))
    assert math.isclose(features["cos_hour"], math.cos(angle))
    assert features["displacement"] >= 0.0
    assert features["speed"] >= 0.0
    assert 0.0 <= features["bearing"] < 360.0


if __name__ == "__main__":
    test_real_b15a_feature_extraction()
    print("Real B15A feature extraction test passed")