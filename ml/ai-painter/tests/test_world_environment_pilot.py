"""Synthetic-only checks for experiment147; no actual dataset is read or trained."""

import copy
import importlib.util
import io
from pathlib import Path
import time
import unittest


MODULE = Path(__file__).resolve().parents[1] / "scripts/world_environment_pilot.py"
spec = importlib.util.spec_from_file_location("world_environment_pilot", MODULE)
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


def fixture():
    dates = pilot.date_range("20200101", "20231231")
    values = {date: [float(i % 11), 40.0 + i % 40, 20.0 + (i % 60) / 10, 1.0 + (i % 9) / 10] for i, date in enumerate(dates)}
    train_dates = pilot.date_range(*pilot.SPLITS["train"])
    windows = []
    for split, span in pilot.SPLITS.items():
        group = pilot.date_range(*span)
        for i in range(7, len(group)):
            windows.append({"split": split, "history": [values[d] for d in group[i - 7:i]], "target": values[group[i]],
                            "historyDates": group[i - 7:i], "targetDate": group[i]})
    return {"schemaVersion": "world-environment-pilot-dataset-v1", "contractSha256": pilot.CONTRACT_SHA256,
            "sourceBinding": {"syntheticFixtureOnly": True}, "fieldOrder": pilot.FIELDS, "units": pilot.UNITS,
            "trainDays": [values[d] for d in train_dates], "trainDates": train_dates, "windows": windows, "productionReady": False}


class DatasetChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.valid = fixture()

    def test_complete_disjoint_calendar_and_fields_accept(self):
        self.assertIs(pilot.validate_dataset(self.valid, pilot.CONTRACT_SHA256), self.valid)

    def test_future_target_cannot_enter_history(self):
        data = copy.deepcopy(self.valid)
        data["windows"][0]["historyDates"][-1] = data["windows"][0]["targetDate"]
        with self.assertRaisesRegex(ValueError, "future"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)

    def test_cross_split_and_reordered_targets_rejected(self):
        data = copy.deepcopy(self.valid)
        data["windows"][724]["split"] = "train"
        with self.assertRaisesRegex(ValueError, "split"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)
        data = copy.deepcopy(self.valid)
        data["windows"][0], data["windows"][1] = data["windows"][1], data["windows"][0]
        with self.assertRaisesRegex(ValueError, "sequence"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)

    def test_source_values_must_agree_across_overlapping_windows(self):
        data = copy.deepcopy(self.valid)
        data["windows"][0]["history"] = copy.deepcopy(data["windows"][0]["history"])
        data["windows"][0]["history"][0][2] += 0.1
        with self.assertRaisesRegex(ValueError, "inconsistent"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)

    def test_nan_boolean_wrong_units_and_unknown_fields_rejected(self):
        for value in [float("nan"), float("inf"), True, "1"]:
            data = copy.deepcopy(self.valid)
            data["trainDays"][0][0] = value
            with self.assertRaisesRegex(ValueError, "numeric"):
                pilot.validate_dataset(data, pilot.CONTRACT_SHA256)
        data = copy.deepcopy(self.valid)
        data["units"] = ["m/day", "%", "C", "m/s"]
        with self.assertRaisesRegex(ValueError, "unit"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)
        data = copy.deepcopy(self.valid)
        data["futureClimatology"] = [1, 2, 3]
        with self.assertRaisesRegex(ValueError, "schema"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)

    def test_normalization_dates_cannot_include_holdout(self):
        data = copy.deepcopy(self.valid)
        data["trainDates"][-1] = "20220101"
        with self.assertRaisesRegex(ValueError, "normalization dates"):
            pilot.validate_dataset(data, pilot.CONTRACT_SHA256)

    def test_duplicate_json_and_wrong_contract_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            pilot.strict_json(b'{"x":1,"x":2}')
        with self.assertRaisesRegex(ValueError, "frozen"):
            pilot.validate_contract({}, "0" * 64)


class ModelChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = pilot.configure_torch()
        cls.data = fixture()

    def test_normalizer_uses_unique_train_days_only(self):
        mean, std = pilot.fit_normalizer(self.data["trainDays"])
        changed = copy.deepcopy(self.data)
        for window in changed["windows"]:
            if window["split"] != "train":
                window["history"] = [[99.0, 99.0, 99.0, 99.0] for _ in range(7)]
                window["target"] = [99.0] * 4
        changed_mean, changed_std = pilot.fit_normalizer(changed["trainDays"])
        self.assertTrue(self.torch.equal(mean, changed_mean))
        self.assertTrue(self.torch.equal(std, changed_std))
        self.assertEqual(mean.shape, (4,))

    def test_small_cpu_fit_updates_parameters_and_strict_reload_reproduces(self):
        torch = self.torch
        torch.random.default_generator.manual_seed(147)
        mean, std = pilot.fit_normalizer(self.data["trainDays"])
        x, y, _, _ = pilot.tensors(self.data["windows"][:8], mean, std)
        model = pilot.make_model()
        initial = {k: v.clone() for k, v in model.state_dict().items()}
        trace = pilot.train_updates(model, x, y, 3, time.monotonic() + 30)
        self.assertEqual(len(trace), 3)
        self.assertTrue(any(not torch.equal(initial[k], v) for k, v in model.state_dict().items()))
        buffer = io.BytesIO()
        torch.save({"state_dict": model.state_dict()}, buffer)
        buffer.seek(0)
        restored = pilot.make_model()
        restored.load_state_dict(torch.load(buffer, map_location="cpu", weights_only=True)["state_dict"], strict=True)
        restored.eval()
        self.assertTrue(torch.equal(model(x), restored(x)))
        self.assertEqual(str(next(restored.parameters()).device), "cpu")

    def test_deadline_stops_before_update(self):
        torch = self.torch
        model = pilot.make_model()
        initial = {k: v.clone() for k, v in model.state_dict().items()}
        trace = []
        with self.assertRaisesRegex(ValueError, "wall budget"):
            pilot.train_updates(model, torch.zeros(2, 7, 4), torch.zeros(2, 4), 3, time.monotonic() - 1, trace)
        self.assertEqual(trace, [])
        self.assertTrue(all(torch.equal(initial[k], v) for k, v in model.state_dict().items()))

    def test_illegal_predictions_are_counted_not_clipped(self):
        torch = self.torch
        prediction = torch.tensor([[-1.0, 101.0, -274.0, -0.1], [1.0, 50.0, 20.0, 2.0]])
        before = prediction.clone()
        self.assertEqual(pilot.physical_violations(prediction), dict.fromkeys(pilot.FIELDS, 1))
        self.assertTrue(torch.equal(before, prediction))

    def test_ablation_retains_latest_day_and_architecture_is_frozen(self):
        torch = self.torch
        x = torch.arange(56, dtype=torch.float32).reshape(2, 7, 4)
        ablated = x[:, -1:, :].repeat(1, 7, 1)
        self.assertTrue(torch.equal(x[:, -1], ablated[:, -1]))
        self.assertFalse(torch.equal(x[:, :-1], ablated[:, :-1]))
        model = pilot.make_model()
        self.assertEqual(model.hidden.in_features, 28)
        self.assertEqual(model.hidden.out_features, 32)
        self.assertEqual(model.output.out_features, 4)


if __name__ == "__main__":
    unittest.main()
