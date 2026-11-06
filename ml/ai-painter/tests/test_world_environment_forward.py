"""155 schema/integrity checks; never invokes the actual model forward."""

import copy
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_forward.py"
spec = importlib.util.spec_from_file_location("forward155", PATH)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def fixture():
    probe, wire = worker.read_contracts()
    world = {k: "synthetic-" + k for k in worker.IDENTITY_FIELDS}
    world.update(tick=0, stateVersion=0, eventCursor=0, worldFactsPayloadSha256="f" * 64, statePayloadSha256="a" * 64, recordContentSha256="b" * 64)
    values = [[0, 50 + i, 20 + i / 10, 1 + i / 10] for i in range(7)]
    periods = []
    for date in probe["features"]["dates"]:
        day = dt.datetime.strptime(date, "%Y%m%d").replace(tzinfo=dt.timezone.utc)
        periods.append({"startUtc": day.isoformat(timespec="milliseconds").replace("+00:00", "Z"), "endUtc": (day + dt.timedelta(days=1)).isoformat(timespec="milliseconds").replace("+00:00", "Z")})
    forecast = probe["features"]["forecastInterval"]
    features = {"schemaVersion": probe["features"]["schemaVersion"], "sourceSha256": wire["archiveBindings"][0]["sha256"], "fieldOrder": probe["features"]["fieldOrder"],
                "units": probe["features"]["units"], "shape": [7, 4], "dates": probe["features"]["dates"], "periods": periods,
                "asOfUtc": forecast["startUtc"], "asOfSemantics": "retrospective_completed_day_assumption_not_publication", "horizonSeconds": 86400,
                "targetPeriod": {"startUtc": forecast["startUtc"], "endUtc": forecast["endUtc"]}, "values": values}
    features["inputContentSha256"] = worker.sha(worker.canonical(features))
    binding = {"identity": {k: world[k] for k in worker.IDENTITY_FIELDS}, "before": {"tick": 0, "stateVersion": 0, "eventCursor": 0,
               "fileSha256": probe["worldStore"]["sha256"], "factsSha256": world["worldFactsPayloadSha256"], "stateSha256": world["statePayloadSha256"], "recordSha256": world["recordContentSha256"]}}
    request = {"schemaVersion": wire["input"]["schemaVersion"], "taskId": probe["taskId"], "contractSha256": worker.CONTRACT_SHA256,
               "worldBinding": binding, "features": features, "historyOrigin": "external_archival_context", "productionReady": False}
    archive = {"header": {"start": "20200101", "end": "20200131", "time_standard": "UTC"},
               "parameters": {f: {"units": unit} for f, unit in zip(features["fieldOrder"], features["units"])},
               "properties": {"parameter": {f: {d: values[i][j] for i, d in enumerate(features["dates"])} for j, f in enumerate(features["fieldOrder"])}}}
    receipt = {"responseSha256": features["sourceSha256"], "httpStatus": 200}
    return request, probe, wire, world, archive, receipt


def reseal(features):
    features["inputContentSha256"] = worker.sha(worker.canonical({k: v for k, v in features.items() if k != "inputContentSha256"}))


class ForwardChecks(unittest.TestCase):
    def validate(self, request, probe, wire, world, archive, receipt):
        return worker.validate_input(worker.canonical(request), probe, wire, world, probe["worldStore"]["sha256"], archive, receipt)

    def test_exact_wire_and_feature_matrix_accept_without_model_call(self):
        args = fixture()
        self.assertEqual(self.validate(*args), args[0])

    def test_future_field_date_or_period_rejected_even_if_rehashed(self):
        for mutation in ("targetValues", "date", "period"):
            request, *rest = fixture()
            if mutation == "targetValues":
                request["features"]["targetValues"] = [1, 50, 25, 1]
            elif mutation == "date":
                request["features"]["dates"] = request["features"]["dates"][:-1] + ["20200108"]
            else:
                request["features"]["periods"][-1]["endUtc"] = "2020-01-09T00:00:00.000Z"
            reseal(request["features"])
            with self.assertRaises(ValueError):
                self.validate(request, *rest)

    def test_changed_world_before_identity_and_boolean_tick_rejected(self):
        for mutation in ("world", "hash", "boolean"):
            request, *rest = fixture()
            if mutation == "world":
                request["worldBinding"]["identity"]["worldId"] = "another-world"
            elif mutation == "hash":
                request["worldBinding"]["before"]["stateSha256"] = "0" * 64
            else:
                request["worldBinding"]["before"]["tick"] = False
            with self.assertRaises(ValueError):
                self.validate(request, *rest)

    def test_modified_values_or_units_rejected_even_after_reseal(self):
        for mutation in ("values", "units"):
            request, *rest = fixture()
            if mutation == "values":
                request["features"]["values"][0][2] += 0.1
            else:
                request["features"]["units"] = ["mm/day", "%", "K", "m/s"]
            reseal(request["features"])
            with self.assertRaises(ValueError):
                self.validate(request, *rest)

    def test_duplicate_nonfinite_and_oversized_stdin_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            worker.strict_json(b'{"x":1,"x":2}')
        for data in [b'{"x":NaN}', b'{"x":1e9999}']:
            with self.assertRaisesRegex(ValueError, "nonfinite"):
                worker.strict_json(data)
        request, probe, wire, world, archive, receipt = fixture()
        with self.assertRaisesRegex(ValueError, "byte bound"):
            worker.validate_input(b" " * 65537, probe, wire, world, probe["worldStore"]["sha256"], archive, receipt)

    def test_digest_and_archive_vs_world_memory_boundary(self):
        request, *rest = fixture()
        request["features"]["inputContentSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "canonical SHA"):
            self.validate(request, *rest)
        request, *rest = fixture()
        request["historyOrigin"] = "world_memory"
        with self.assertRaisesRegex(ValueError, "archive/production"):
            self.validate(request, *rest)
        request, *rest = fixture()
        request["productionReady"] = True
        with self.assertRaisesRegex(ValueError, "archive/production"):
            self.validate(request, *rest)

    def test_world_metadata_cannot_enter_features(self):
        request, *rest = fixture()
        request["features"]["climate"] = {"futureYear": 2025}
        reseal(request["features"])
        with self.assertRaisesRegex(ValueError, "unknown fields"):
            self.validate(request, *rest)
        request, *rest = fixture()
        request["worldBinding"]["environment"] = {"climate": "ignored"}
        with self.assertRaisesRegex(ValueError, "world binding"):
            self.validate(request, *rest)


if __name__ == "__main__":
    unittest.main()
