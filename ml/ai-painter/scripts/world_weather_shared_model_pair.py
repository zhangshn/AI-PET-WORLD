"""Load the registered humidity candidate and its existing wind dependency as one CPU weather pair."""
import hashlib
from pathlib import Path


HERE = Path(__file__).resolve().parent
SOURCES = {
    "world_environment_humidity.py": "b3e0788504f52eaeab44fb556acced7b32d5a79af3ab47e6a0faf12df0762928",
    "world_environment_holdout.py": "cf8b2555422b775a6b5bed2c86320e93f810a14d59b127d5da2d7f04a78a840a",
    "world_environment_stability_wind.py": "718d4736db582deb067c2fa57d375e94f1cc928d13b5ee81a9a6893c8d307e13",
    "world_environment_stability.py": "a0f9d12e07eca5b7d9c2611935c6f70c00818f25ee910edc5dfe22ad19a9638e",
    "world_environment_comparison.py": "c68f38252e3ed743fa33769d5d0432d8f19da0b6f6563bbd900d27c92241f1b6",
    "world_environment_pilot.py": "d77135fec15215cea671f3b949ff92cb62fa61b6c81db82f4ddb33317dd07a51",
}


def load_pair():
    for filename, expected in SOURCES.items():
        if hashlib.sha256((HERE / filename).read_bytes()).hexdigest() != expected:
            raise ValueError("registered weather source differs: " + filename)
    import world_environment_humidity as humidity

    # This is the wind module already loaded by humidity's registered dependency chain.
    # A separate import of the wind script creates a second pilot and a second process-wide Torch setup.
    wind = humidity.wind
    for module, expected_path in ((humidity, "world_environment_humidity.py"),
                                  (humidity.holdout, "world_environment_holdout.py"),
                                  (wind, "world_environment_stability_wind.py"),
                                  (humidity.pilot, "world_environment_pilot.py")):
        if Path(module.__file__).resolve() != HERE / expected_path:
            raise ValueError("weather module loaded from unexpected path: " + expected_path)
    if humidity.holdout.wind is not wind or humidity.holdout.pilot is not humidity.pilot or wind.pilot is not humidity.pilot:
        raise ValueError("weather models do not share the same runtime instance")
    return humidity, wind
