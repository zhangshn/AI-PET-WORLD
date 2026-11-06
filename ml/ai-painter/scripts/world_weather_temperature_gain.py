"""Temperature observation correction for the Sakaerat four-field daily model."""
import datetime
import math


FIELD_ORDER = ["PRECTOTCORR", "RH2M", "T2M", "WS2M"]


def _vector(values, size):
    return (isinstance(values, (list, tuple)) and len(values) == size
            and all(type(x) in (float, int) and math.isfinite(x) for x in values))


def _seasonal_normal(day, coefficients):
    start = day.replace(month=1, day=1)
    year_days = (start.replace(year=start.year + 1) - start).days
    angle = 2 * math.pi * (day - start).days / year_days
    phase = (1.0, math.sin(angle), math.cos(angle))
    return [sum(phase[k] * coefficients[k][field] for k in range(3)) for field in range(4)]


def apply_temperature_gain(raw, target_date, history, weights, gain):
    """Apply the frozen gain to one native prediction, oldest history day first.

    target_date is the UTC data product day (YYYYMMDD). The caller verifies
    chronological Store/receipt bindings and immutable model weights before use.
    """
    if not isinstance(target_date, str) or len(target_date) != 8 or not target_date.isascii() or not target_date.isdigit():
        raise ValueError("expected an eight-digit UTC product date")
    day = datetime.date(int(target_date[:4]), int(target_date[4:6]), int(target_date[6:]))
    if not _vector(raw, 4) or len(history) != 7 or not all(_vector(row, 4) for row in history):
        raise ValueError("expected four weather fields and seven finite history days")
    if not _vector([gain], 1) or not 0 < gain < 1:
        raise ValueError("invalid trained gain")
    if weights["fieldOrder"] != FIELD_ORDER:
        raise ValueError("unexpected weather field order")
    normal, regression, scales = weights["seasonNormal"], weights["anomalyAutoregression"], weights["std"]
    if (len(normal) != 3 or not all(_vector(row, 4) for row in normal)
            or len(regression) != 29 or not all(_vector(row, 2) for row in regression)
            or not _vector(scales, 4) or min(scales) <= 0):
        raise ValueError("invalid seasonal anomaly weights")
    features = []
    for i, row in enumerate(history):
        normal_day = _seasonal_normal(day + datetime.timedelta(days=i - 7), normal)
        features.extend((row[j] - normal_day[j]) / scales[j] for j in range(4))
    features.append(1.0)
    normal_target = _seasonal_normal(day, normal)
    temperature = normal_target[2] + scales[2] * sum(v * regression[k][1] for k, v in enumerate(features))
    output = list(raw)
    output[2] = raw[2] + gain * (temperature - raw[2])
    guards = weights["guards"]
    if (len(guards) != 4 or not all(_vector(interval, 2) for interval in guards)
            or not all(lo <= value <= hi for (lo, hi), value in zip(guards, output))):
        raise ValueError("weather output outside validated physical bounds")
    return output
