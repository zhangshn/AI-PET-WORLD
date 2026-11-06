import datetime
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from world_weather_temperature_gain import FIELD_ORDER, apply_temperature_gain


class TemperatureGainTest(unittest.TestCase):
    def setUp(self):
        self.weights = {
            "fieldOrder": FIELD_ORDER, "std": [1., 1., 1., 1.],
            "seasonNormal": [[0., 60., 20., 0.], [0., 0., 2., 0.], [0.]*4],
            "anomalyAutoregression": [[0., 0.] for _ in range(29)],
            "guards": [[0., 250.], [0., 100.], [0., 42.], [0., 12.]],
        }
        self.history = [[0., 60., 20., 1.] for _ in range(7)]
        self.raw = [4., 70., 19., 2.]

    def test_lag_order_and_leap_year_leave_three_fields_unchanged(self):
        self.weights["anomalyAutoregression"][0][1] = 1.
        self.history[0][0] = 3.
        day = datetime.date(2020, 2, 29)
        phase = 2*math.pi*(day - datetime.date(2020, 1, 1)).days/366
        result = apply_temperature_gain(self.raw, "20200229", self.history, self.weights, .5)
        self.assertEqual(result, [4., 70., 19.+.5*(20.+2.*math.sin(phase)+3.-19.), 2.])
        self.assertEqual(self.raw, [4., 70., 19., 2.])

    def test_invalid_date_history_and_physical_bounds_fail(self):
        for date, history, raw, gain in [
            ("20210229", self.history, self.raw, .5),
            ("20200108", self.history[1:], self.raw, .5),
            ("20200108", self.history, self.raw, float("nan")),
            ("20200108", self.history, [4., 101., 19., 2.], .5),
        ]:
            with self.subTest(date=date, gain=gain), self.assertRaises(ValueError):
                apply_temperature_gain(raw, date, history, self.weights, gain)


if __name__ == "__main__":
    unittest.main()
