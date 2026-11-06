"""166 boundary tests: real saved source bytes, synthetic next commit, zero model loads."""
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
SPEC = importlib.util.spec_from_file_location("scheduled166", ROOT / "ml/ai-painter/scripts/world_environment_scheduled_forward.py")
W = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(W)


class Output:
    shape = (1, 4)
    def __init__(self, values): self.values = values
    def __getitem__(self, index): return self
    def tolist(self): return self.values


class FakeTorch:
    float64 = "float64"
    def tensor(self, values, dtype, device):
        assert dtype == "float64" and device == "cpu"
        return values
    def no_grad(self): return contextlib.nullcontext()
    def isfinite(self, output): return types.SimpleNamespace(all=lambda: all(math.isfinite(v) for v in output.values))


class ScheduledTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = W.read_contract()
        cls.old_read = staticmethod(W.read_fixed)

    def setUp(self):
        W.FORWARD_CALLS = 0
        self.c = copy.deepcopy(self.contract)
        self.files = {}
        self.record_raw = self.old_read(self.c["sourceRecordRef"], 512 * 1024)
        self.record = json.loads(self.record_raw)
        self.event_raw = self.old_read(self.c["sourceEventRef"])
        self.event = json.loads(self.event_raw)
        self.prior_input = json.loads(self.old_read(self.c["sourceInputRef"]))
        self.prior_output = json.loads(self.old_read(self.c["sourceOutputRef"]))
        self.side = self.c["recordPath"] + ".evolution/"
        self.event_ref = {"path": self.side + self.event["businessKey"] + "." + self.event["eventSha256"] + ".event.json", "sha256": W.sha(self.event_raw)}
        self.install_record(self.record_raw, self.event_raw)
        self.data = self.make_input(1, self.prior_input, self.prior_output, self.record, self.record_raw, self.event_ref)

    def install_record(self, record_raw, event_raw):
        rec, ev = json.loads(record_raw), json.loads(event_raw)
        stem = ev["businessKey"] + "." + ev["eventSha256"]
        journal = {"state": "committed", "identity": self.c["identity"], "eventSha256": ev["eventSha256"],
                   "event": {"fileSha256": W.sha(event_raw)}, "recordContentSha256": rec["recordContentSha256"],
                   "next": {"name": ev["businessKey"] + "." + W.sha(record_raw) + ".record.json", "fileSha256": W.sha(record_raw)}}
        self.files[self.c["recordPath"]] = record_raw
        self.files[self.side + stem + ".event.json"] = event_raw
        self.files[self.side + stem + ".commit.json"] = W.canonical(journal)
        self.files[self.side + journal["next"]["name"]] = record_raw

    def make_input(self, step, previous, output, record, record_raw, event_ref):
        provenance = copy.deepcopy(previous["provenance"][1:])
        for p in provenance:
            if p["origin"] == "initialized_store_weather": p["sourceRef"] = W.ref_identity(self.c["sourceSeedRecordRef"])
        provenance.append({"origin": "committed_model_output", "sourceRef": event_ref,
                           "periodStartUtc": previous["interval"]["logicalStartUtc"], "periodEndUtc": previous["interval"]["logicalEndUtc"], "note": "pure fixture"})
        return {"schemaVersion": self.c["inputContract"]["schemaVersion"], "taskId": W.TASK_ID, "contractSha256": W.CONTRACT_SHA256,
                "mode": "primary", "step": step, "identity": self.c["identity"],
                "before": {"tick": step, "stateVersion": step + 1, "eventCursor": step + 1, "fileSha256": W.sha(record_raw), "recordContentSha256": record["recordContentSha256"]},
                "interval": self.c["steps"][step - 1]["interval"], "window": {"fieldOrder": self.c["fieldOrder"], "units": self.c["units"], "values": previous["window"]["values"][1:] + [output["values"]]},
                "provenance": provenance, "previousEventRef": event_ref}

    def read(self, ref, limit=8 * 1024 * 1024):
        if ref["path"] not in self.files: return self.old_read(ref, limit)
        raw = self.files[ref["path"]]
        if len(raw) > limit or W.sha(raw) != ref["sha256"]: raise ValueError("fixture_hash")
        return raw

    def live(self, path, maximum=W.MAX_BYTES):
        raw = self.files[path]
        if len(raw) > maximum: raise ValueError("fixture_bytes")
        return raw, {"path": path, "sha256": W.sha(raw)}

    def validate(self, data=None):
        data = W.validate_input(W.canonical(data or self.data), self.c)
        with mock.patch.object(W, "read_fixed", side_effect=self.read), mock.patch.object(W, "read_live", side_effect=self.live):
            W.validate_sources(data, self.c)

    def test_actual_first_window_and_seed(self):
        self.validate()
        self.assertEqual(self.data["window"]["values"][-1], self.prior_output["values"])
        self.assertEqual(self.data["provenance"][5]["sourceRef"], W.ref_identity(self.c["sourceSeedRecordRef"]))

    def test_input_boundaries(self):
        edits = [lambda d: d.update(step=3), lambda d: d.update(step=True), lambda d: d["before"].update(tick=0),
                 lambda d: d["before"].update(stateVersion=1), lambda d: d["before"].update(eventCursor=True),
                 lambda d: d["window"]["units"].__setitem__(0, "m/day"), lambda d: d["window"]["values"][0].__setitem__(0, True),
                 lambda d: d["interval"].update(durationSeconds=15), lambda d: d["previousEventRef"].update(path="../outside"),
                 lambda d: d["provenance"][6].update(periodEndUtc="2020-01-10T00:00:00.000Z")]
        for edit in edits:
            d = copy.deepcopy(self.data); edit(d)
            with self.subTest(data=d), self.assertRaises(ValueError): W.validate_input(W.canonical(d), self.c)

    def test_duplicate_json_nonfinite_and_length(self):
        for raw in [b'{"a":1,"a":2}', b'{"a":NaN}', b' ' * 65537]:
            with self.assertRaises(ValueError): W.validate_input(raw, self.c)

    def test_wrong_history_seed_or_maintenance_source(self):
        for edit in [lambda d: d["window"]["values"][0].__setitem__(1, 30),
                     lambda d: d["provenance"][5]["sourceRef"].update(path=self.c["sourceRecordRef"]["path"]),
                     lambda d: d["provenance"][6].update(origin="maintenance")]:
            d = copy.deepcopy(self.data); edit(d)
            with self.assertRaises(ValueError): self.validate(d)

    def test_uncommitted_record_rejected_before_load(self):
        key = next(k for k in self.files if k.endswith('.commit.json'))
        j = json.loads(self.files[key]); j["state"] = "prepared"; self.files[key] = W.canonical(j)
        with mock.patch.object(W, "read_contract", return_value=self.c), mock.patch.object(W, "read_fixed", side_effect=self.read), mock.patch.object(W, "read_live", side_effect=self.live), mock.patch.object(W.HELPER, "load_model") as load:
            with self.assertRaises(ValueError): W.run(W.canonical(self.data), W.utc_now(), time.monotonic())
            load.assert_not_called()

    def test_mock_forward_raw_finite_output(self):
        predicted = [-1, 101, 100, 30]
        predictor = mock.Mock(return_value=Output(predicted))
        with mock.patch.object(W, "read_contract", return_value=self.c), mock.patch.object(W, "validate_sources"), mock.patch.object(W, "read_fixed", return_value=b'x'), mock.patch.object(W.HELPER, "load_model", return_value=(types.SimpleNamespace(predict=predictor), {}, FakeTorch())):
            output = json.loads(W.run(W.canonical(self.data), W.utc_now(), time.monotonic()))
            self.assertEqual(output["values"], predicted)
            self.assertEqual(output["modelForwardRuns"], 1)
            self.assertFalse(output["productionReady"])
            predictor.assert_called_once()

    def test_next_step_consumes_committed_output(self):
        previous = copy.deepcopy(self.data)
        input_raw = W.canonical(previous)
        output = {"schemaVersion": self.c["outputContract"]["schemaVersion"], "contractSha256": W.CONTRACT_SHA256, "step": 1,
                  "workerSha256": W.sha((ROOT / W.SELF_PATH).read_bytes()), "inputBytesSha256": W.sha(input_raw), "featureValueSha256": W.feature_value_sha(previous["window"]["values"]),
                  "checkpointSha256": self.c["checkpoint"]["sha256"], "fieldOrder": self.c["fieldOrder"], "units": self.c["units"], "values": [0.1, 60, 25.5, 1.6], "pid": 999, "modelForwardRuns": 1, "productionReady": False}
        output_raw = W.canonical(output)
        prefix = self.c["stepRoot"] + "/step-1/"
        self.files[prefix + "input.json"] = input_raw
        self.files[prefix + "output.json"] = output_raw
        self.files[prefix + "forward-process.json"] = W.canonical({"exitCode": 0, "pid": 999, "stdout": output_raw.decode()})
        rec = copy.deepcopy(self.record); rec.update(tick=2, stateVersion=3, eventCursor=3, recordContentSha256='3'*64)
        ev = copy.deepcopy(self.event); ev.update(toTick=2, toStateVersion=3, cursor=3, businessKey='1'*64, eventSha256='2'*64)
        ev["evidence"]["inputRef"].update(id=prefix+'input.json', sha256=W.sha(input_raw))
        ev["evidence"]["outputRef"].update(id=prefix+'output.json', sha256=W.sha(output_raw))
        for change, value in zip(ev["changes"], output["values"]):
            change["newValue"] = value
        evol = rec["worldState"]["payload"]["environment"]["evolution"]
        evol["logicalEndUtc"] = previous["interval"]["logicalEndUtc"]; evol["commit"]["eventSha256"] = ev["eventSha256"]; evol["weather"]["values"] = output["values"]
        rec_raw, ev_raw = W.canonical(rec), W.canonical(ev)
        self.install_record(rec_raw, ev_raw)
        ev_ref = {"path": self.side + ev["businessKey"] + '.' + ev["eventSha256"] + '.event.json', "sha256": W.sha(ev_raw)}
        self.data = self.make_input(2, previous, output, rec, rec_raw, ev_ref)
        self.validate()
        self.data["window"]["values"][-1][1] += 1
        with self.assertRaises(ValueError): self.validate()


if __name__ == '__main__': unittest.main()
