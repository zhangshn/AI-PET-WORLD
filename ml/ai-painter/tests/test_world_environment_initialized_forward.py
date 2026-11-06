"""164 pure boundary tests. Predictors are mocks; no checkpoint load/forward."""
import contextlib
import copy
import importlib.util
import json
import math
from pathlib import Path
import time
import types
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("initialized_forward_test", ROOT / "ml/ai-painter/scripts/world_environment_initialized_forward.py")
WORKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKER)


class Output:
    shape = (1, 4)
    def __init__(self, values):
        self.values = values
    def __getitem__(self, index):
        assert index == 0
        return self
    def tolist(self):
        return self.values


class FakeTorch:
    float64 = "mock_float64"
    def tensor(self, values, dtype, device):
        assert dtype == self.float64 and device == "cpu"
        return values
    @staticmethod
    def no_grad():
        return contextlib.nullcontext()
    @staticmethod
    def isfinite(output):
        return types.SimpleNamespace(all=lambda: all(math.isfinite(v) for v in output.values))


class InitializedForwardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = WORKER.read_contract()
        cls.source_record = WORKER.read_fixed(cls.contract["sourceInitializedRecordRef"], 512 * 1024)
        cls.source_event = WORKER.read_fixed(cls.contract["sourceInitializationEventRef"], 65536)
        cls.archive = WORKER.read_fixed(cls.contract["archiveRef"], 65536)
        cls.receipt = WORKER.read_fixed(cls.contract["archiveReceiptRef"], 65536)

    def setUp(self):
        WORKER.FORWARD_CALLS = 0
        self.c = copy.deepcopy(self.contract)
        record, source = json.loads(self.source_record), json.loads(self.archive)
        values = [[source["properties"]["parameter"][f][f"2020010{i}"] for f in self.c["fieldOrder"]] for i in range(1, 7)]
        values.append(record["worldState"]["payload"]["environment"]["evolution"]["weather"]["values"])
        self.data = {"schemaVersion": self.c["inputContract"]["schemaVersion"], "taskId": WORKER.TASK_ID,
                     "contractSha256": WORKER.CONTRACT_SHA256, "mode": "primary", "identity": self.c["identity"],
                     "before": self.c["before"], "interval": self.c["interval"],
                     "window": {"fieldOrder": self.c["fieldOrder"], "units": self.c["units"], "values": values},
                     "provenance": [{"origin": "external_archival_context" if i < 6 else "initialized_store_weather",
                                     "sourceRef": WORKER.ref_identity(self.c["archiveRef"] if i < 6 else self.c["initializedRecordRef"]),
                                     "periodStartUtc": f"2020-01-0{i+1}T00:00:00.000Z", "periodEndUtc": f"2020-01-0{i+2}T00:00:00.000Z",
                                     "note": "fixture provenance; maintenance is not a numerical day"} for i in range(7)],
                     "initializationEventRef": WORKER.ref_identity(self.c["initializationEventRef"])}

    def encoded(self):
        return json.dumps(self.data, allow_nan=False).encode()

    def source_reader(self, ref, limit=65536):
        del limit
        files = {self.c["sourceInitializedRecordRef"]["path"]: self.source_record,
                 self.c["initializedRecordRef"]["path"]: self.source_record,
                 self.c["archiveRef"]["path"]: self.archive,
                 self.c["archiveReceiptRef"]["path"]: self.receipt,
                 self.c["sourceInitializationEventRef"]["path"]: self.source_event,
                 self.c["initializationEventRef"]["path"]: self.source_event}
        return files[ref["path"]]

    def test_fixed_contract_read_without_model_loading(self):
        self.assertEqual(WORKER.read_contract()["before"]["stateVersion"], 1)
        self.assertEqual(self.c["reusedWorker"]["sha256"], WORKER.LEGACY_SHA)
        self.assertEqual(WORKER.FORWARD_CALLS, 0)

    def test_actual_metadata_and_exact_0_1_1_source_semantics(self):
        data = WORKER.validate_input(self.encoded(), self.c)
        with mock.patch.object(WORKER, "read_fixed", side_effect=self.source_reader):
            WORKER.validate_sources(data, self.c)
        self.assertEqual(data["window"]["values"][6], [0, 56.36, 25.13, 1.47])
        self.assertEqual(len(data["window"]["values"]), 7)

    def test_legacy_equal_counters_and_bool_are_rejected(self):
        for counters in [(0, 0, 0), (1, 1, 1), (False, 1, 1), (0, True, 1), (0, 1, True)]:
            with self.subTest(counters=counters):
                d = copy.deepcopy(self.data)
                for key, value in zip(("tick", "stateVersion", "eventCursor"), counters):
                    d["before"][key] = value
                with self.assertRaisesRegex(ValueError, "164_before_0_1_1"):
                    WORKER.validate_input(json.dumps(d).encode(), self.c)

    def test_unknown_fields_units_identity_hash_interval_and_mode_rejected(self):
        changes = [lambda d: d.update(passed=True), lambda d: d.update(mode="history_probe"),
                   lambda d: d["window"]["units"].__setitem__(1, "fraction"),
                   lambda d: d["identity"].__setitem__("worldId", "integration158-spoof"),
                   lambda d: d["before"].__setitem__("recordContentSha256", "0" * 64),
                   lambda d: d["interval"].__setitem__("logicalEndUtc", "2020-01-10T00:00:00.000Z"),
                   lambda d: d["initializationEventRef"].__setitem__("path", "../escape")]
        for change in changes:
            d = copy.deepcopy(self.data); change(d)
            with self.assertRaises(ValueError):
                WORKER.validate_input(json.dumps(d).encode(), self.c)

    def test_wrong_last_origin_future_period_and_maintenance_as_day_rejected(self):
        for change in [lambda d: d["provenance"][6].__setitem__("origin", "external_archival_context"),
                       lambda d: d["provenance"][6].__setitem__("sourceRef", WORKER.ref_identity(self.c["initializationEventRef"])),
                       lambda d: d["provenance"][6].__setitem__("periodEndUtc", "2020-01-09T00:00:00.000Z"),
                       lambda d: d["window"]["values"].append([0, 50, 20, 2])]:
            d = copy.deepcopy(self.data); change(d)
            with self.assertRaises(ValueError):
                WORKER.validate_input(json.dumps(d).encode(), self.c)

    def test_changed_matrix_cannot_use_valid_provenance_to_bypass_source_check(self):
        for row in [0, 6]:
            d = copy.deepcopy(self.data); d["window"]["values"][row][1] += 1
            data = WORKER.validate_input(json.dumps(d).encode(), self.c)
            with mock.patch.object(WORKER, "read_fixed", side_effect=self.source_reader):
                with self.assertRaisesRegex(ValueError, "164_actual_matrix"):
                    WORKER.validate_sources(data, self.c)

    def test_invalid_or_missing_source_never_loads_model(self):
        with mock.patch.object(WORKER.HELPER, "load_model") as load:
            with self.assertRaises(ValueError):
                WORKER.run(b'{}', WORKER.utc_now(), time.monotonic())
            with mock.patch.object(WORKER, "validate_sources", side_effect=FileNotFoundError("fixture copy missing")):
                with self.assertRaises(FileNotFoundError):
                    WORKER.run(self.encoded(), WORKER.utc_now(), time.monotonic())
            load.assert_not_called()
        self.assertEqual(WORKER.FORWARD_CALLS, 0)

    def test_mock_single_forward_preserves_raw_finite_out_of_domain_values(self):
        predictor = mock.Mock(return_value=Output([0.0, 150.0, 20.0, -5.0]))
        with mock.patch.object(WORKER, "read_contract", return_value=self.c), \
             mock.patch.object(WORKER, "validate_sources") as sources, \
             mock.patch.object(WORKER.HELPER, "load_model", return_value=(types.SimpleNamespace(predict=predictor), {}, FakeTorch())), \
             mock.patch.object(WORKER, "read_fixed", return_value=b"mocked-bound-byte-recheck"):
            raw = self.encoded()
            result = json.loads(WORKER.run(raw, WORKER.utc_now(), time.monotonic()))
            self.assertEqual(result["values"], [0.0, 150.0, 20.0, -5.0])
            self.assertEqual(result["modelForwardRuns"], 1)
            self.assertEqual(result["inputBytesSha256"], WORKER.sha(raw))
            self.assertEqual(result["featureValueSha256"], WORKER.feature_value_sha(self.data["window"]["values"]))
            self.assertEqual(set(result), set(self.c["outputContract"]["exactFields"]))
            self.assertFalse(result["productionReady"])
            self.assertEqual(sources.call_count, 2)
            with self.assertRaisesRegex(ValueError, "164_one_forward_only"):
                WORKER.run(raw, WORKER.utc_now(), time.monotonic())
        self.assertEqual(predictor.call_count, 1)

    def test_mock_nonfinite_output_fails_without_clipping(self):
        predictor = mock.Mock(return_value=Output([0.0, float("nan"), 20.0, 2.0]))
        with mock.patch.object(WORKER, "validate_sources"), \
             mock.patch.object(WORKER.HELPER, "load_model", return_value=(types.SimpleNamespace(predict=predictor), {}, FakeTorch())):
            with self.assertRaisesRegex(ValueError, "164_output_nonfinite_shape"):
                WORKER.run(self.encoded(), WORKER.utc_now(), time.monotonic())
        self.assertEqual(predictor.call_count, 1)

    def test_strict_json_and_matrix_representation(self):
        for raw in [b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":1e309}', b' ' * 65537]:
            with self.assertRaises(ValueError):
                WORKER.strict_json(raw)
        self.assertEqual(math.copysign(1, WORKER.strict_json(b'{"x":-0}')["x"]), -1)
        positive = [[0.0] * 4 for _ in range(7)]
        negative = copy.deepcopy(positive); negative[0][0] = -0.0
        self.assertNotEqual(WORKER.feature_value_sha(positive), WORKER.feature_value_sha(negative))


if __name__ == "__main__":
    unittest.main()
