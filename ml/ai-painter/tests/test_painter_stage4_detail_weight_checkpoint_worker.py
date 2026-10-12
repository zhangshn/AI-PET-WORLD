"""In-memory artificial content bindings; no execution or qualification claims."""
import hashlib
import json
from pathlib import Path
import sys
import unittest
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_detail_weight_checkpoint_worker as candidate


class MemoryReader:
    def __init__(self): self.files = {}; self.observed = {}
    def add(self, path, value):
        raw = json.dumps(value, sort_keys=True).encode(); self.files[path] = raw
        return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}
    def read(self, binding):
        raw = self.files[binding["path"]]
        if hashlib.sha256(raw).hexdigest() != binding["sha256"]: raise ValueError("fixture SHA differs")
        self.observed[binding["path"]] = binding; return raw
    def json(self, binding): return json.loads(self.read(binding))
    def unchanged(self):
        for binding in list(self.observed.values()): self.read(binding)


def fixture():
    _torch, _profile, shared, _codec = candidate._components()
    reader = MemoryReader()
    dataset = reader.add("synthetic/dataset.json", {"datasetVersion": "artificial-test-v1"})
    validation_ids = ["synthetic-validation-" + str(i) for i in range(8)]
    split = reader.add("synthetic/validation.json", {"split": "validation", "sampleIds": validation_ids})
    worker = reader.add(candidate.PROGRAM, {"syntheticSourcePlaceholder": True})
    package = reader.add("synthetic/package.json", {"capabilityVersion": candidate.CAPABILITY,
        "runId": "synthetic-run", "packageId": "synthetic-package", "datasetManifest": dataset,
        "validationSplit": split, "programBindings": {"worker": worker}, "synthetic": True})
    observations = [{"sampleId": sid, "split": "validation", "epoch": 24, "fullRgbMae": .2,
                     "objectCorrelations": {role: .1 for role in shared.OBJECT_CHANNELS}} for sid in validation_ids]
    selection = shared.rank_validation_epoch(observations, validation_ids, epoch=24)
    record = {"capabilityVersion": candidate.CAPABILITY, "runId": "synthetic-run", "packageId": "synthetic-package",
              "executionPackage": package, "datasetManifest": dataset, "epoch": 24,
              "optimizerSteps": {"generator": 1152, "discriminator": 1152}, "validation": observations, "selection": selection}
    selected = reader.add("synthetic/selection.json", record)
    return reader, dict(execution_package=package, dataset_manifest=dataset, selection_record=selected,
                        actual_counts={"generator": 1152, "discriminator": 1152}), record


class CheckpointComponentTests(unittest.TestCase):
    def test_training_entry_is_closed_before_any_computation(self):
        with self.assertRaises(candidate.LifecycleIntegrationUnavailable): candidate.training_entry(trainingAllowed=True)
        gaps = candidate.integration_gaps()
        self.assertGreaterEqual(len(gaps), 4)
        self.assertTrue(all(gap["path"] and gap["line"] > 0 and gap["minimalInterface"] for gap in gaps))

    def test_bindings_and_machine_rank_rehashed_but_never_execution_authenticated(self):
        reader, args, _record = fixture()
        result = candidate.verify_context(reader, **args)
        self.assertEqual(result["epoch"], 24)
        self.assertFalse(result["executionAuthenticated"])
        self.assertFalse(result["qualificationGranted"])
        self.assertEqual(result["counts"], args["actual_counts"])
        reader.files[args["selection_record"]["path"]] += b" "
        with self.assertRaises(ValueError): candidate.verify_context(reader, **args)

    def test_wrong_rank_run_counts_epoch_and_validation_split_rejected(self):
        for field, value in (("selection", {}), ("runId", "other"), ("epoch", 25),
                             ("optimizerSteps", {"generator": 1151, "discriminator": 1152})):
            with self.subTest(field=field):
                reader, args, record = fixture(); record[field] = value
                args["selection_record"] = reader.add("synthetic/bad-record.json", record)
                with self.assertRaises(ValueError): candidate.verify_context(reader, **args)
        reader, args, _ = fixture()
        with self.assertRaises(ValueError): candidate.verify_context(reader, **{**args, "actual_counts": {"generator": True, "discriminator": 1152}})

    def test_cpu_snapshot_round_trip_marked_synthetic_no_optimizer_rng_or_resume(self):
        import torch
        from test_object_appearance_regime_conditioned_cpu import ORDER
        threads = torch.get_num_threads(); torch.set_num_threads(2)
        try:
            reader, args, _ = fixture(); _torch, profile, _shared, codec = candidate._components()
            model, critic = profile.fresh_networks(ORDER)
            envelope = candidate.encode_snapshot(model=model, critic=critic, reader=reader, **args)
            self.assertTrue(envelope["modelState"]["bindings"]["synthetic"])
            self.assertFalse(envelope["checkpointQualified"])
            self.assertFalse(envelope["optimizerStateIncluded"])
            self.assertFalse(envelope["rngStateIncluded"])
            self.assertFalse(envelope["automaticResumeAllowed"])
            payload = codec.serialize_checkpoint(envelope)
            checkpoint = {"path": "synthetic/checkpoint.pt", "sha256": hashlib.sha256(payload).hexdigest()}
            reader.files[checkpoint["path"]] = payload
            decoded = candidate.read_checkpoint_source(reader, checkpoint)
            with torch.no_grad(): next(model.parameters()).add_(.5)
            result = candidate.reload_snapshot(decoded, model=model, critic=critic, reader=reader, **args)
            self.assertTrue(result["synthetic"]); self.assertFalse(result["checkpointQualified"])
            self.assertFalse(result["automaticResumeAllowed"])
            self.assertTrue(all(torch.equal(v, envelope["modelState"]["generator"][name]) for name, v in model.state_dict().items()))
            reader.files[checkpoint["path"]] += b"x"
            with self.assertRaises(ValueError): candidate.read_checkpoint_source(reader, checkpoint)
        finally: torch.set_num_threads(threads)


if __name__ == "__main__": unittest.main()
