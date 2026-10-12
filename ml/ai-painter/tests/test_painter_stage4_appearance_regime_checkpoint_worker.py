"""Synthetic CPU lifecycle tests; no real row, CUDA, optimizer or model probe."""
import json
import hashlib
from pathlib import Path
import tempfile
import os
import uuid
import unittest
from unittest.mock import patch
import torch
import painter_stage4_appearance_regime_checkpoint_worker as worker

ORDER = tuple(json.loads((worker.ROOT / "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json").read_bytes())["tensorContract"]["channelOrder"])

class Dummy(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = torch.nn.Parameter(torch.tensor(0.0))
    def forward(self, *args, **kwargs):
        raise AssertionError("candidate model must receive explicit sample_forward")

def sample(ordinal=0):
    return {"sampleId": "synthetic-validation-" + str(ordinal), "split": "validation",
        "conditions": torch.zeros(23, 192, 256), "image": torch.zeros(3, 192, 256),
        "objectInstanceTable": (), "appearance_regime": torch.tensor([1., 0., 0., 0.])}

def selection():
    return {"epoch": 24, "worstApplicableObjectCorrelation": 0.2,
        "meanValidationRgbMae": 0.3, "rank": [0.2, -0.3, -24],
        "applicableImageCounts": {k: 1 for k in worker.OBJECT_CHANNELS},
        "qualificationGranted": False, "checkpointPromotionEligible": False}

class WorkerTests(unittest.TestCase):
    def test_explicit_readonly_source_whitelist_rehashes_real_asset_without_copy(self):
        evidence = Path(os.environ.get("AI_PAINTER_TEST_EVIDENCE_ROOT", worker.ROOT / Path(worker.CPU_REPORT_PATH).parent.parent / "lifecycle"))
        root = evidence / ("acceptance-reader-test-" + uuid.uuid4().hex[:8]) / "isolated-project"
        root.mkdir(parents=True)
        parent = json.loads((worker.ROOT / "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json").read_bytes())
        manifest = json.loads((worker.ROOT / parent["frozenBindings"]["datasetManifest"]["path"]).read_bytes())
        index = json.loads((worker.ROOT / manifest["sourceIndex"]["path"]).read_bytes())
        source = next(row for row in index["samples"] if row["split"] == "train")["image"]
        source_path = worker.ROOT / source["path"]
        before = hashlib.sha256(source_path.read_bytes()).hexdigest()
        self.assertEqual(before, source["sha256"])
        target = root / worker.ISOLATED_READONLY_PATH
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({"schemaVersion": "ai-painter-v28-isolated-readonly-inputs-v1",
            "capabilityVersion": worker.CAPABILITY, "sourceRoot": "F:/ai-pet-world",
            "inputs": [{"binding": source, "resolvedPath": source_path.resolve().as_posix()}]}), encoding="utf8")
        reader = worker._bound_reader(root)
        self.assertEqual(hashlib.sha256(reader.read(source)).hexdigest(), before)
        self.assertFalse((root / source["path"]).exists())
        reader.unchanged()
        with self.assertRaisesRegex(ValueError, "whitelist"):
            reader.read({**source, "sha256": "0"*64})
        with self.assertRaises(FileNotFoundError):
            reader.read({"path": "data/unlisted-source.bin", "sha256": "0"*64})
        reader.readonly[source["path"]]["resolvedPath"] = "F:/wrong-source"
        with self.assertRaisesRegex(ValueError, "resolution changed"):
            reader.read(source)
        self.assertEqual(hashlib.sha256(source_path.read_bytes()).hexdigest(), before)
        self.assertFalse(torch.cuda.is_initialized())

    def test_import_and_invalid_gate_never_create_optimizer_or_cuda(self):
        result = worker.run_with_terminal_boundary(terminal_sink=lambda _: None,
            train_samples=[], validation_samples=[], channel_order=[], training_gate=True,
            resource_check=lambda: None, checkpoint_sink=lambda *_: None, device=torch.device("cpu"))
        self.assertEqual(result["schemaVersion"], worker.IDENTITY["terminalSchema"])
        self.assertEqual(result["optimizerStepsGenerator"], 0)
        self.assertEqual(result["status"], "experiment_failed_closed")
        self.assertFalse(torch.cuda.is_initialized())

    def test_validation_uses_exact_explicit_season_and_restores_mode(self):
        model = Dummy().train()
        row = sample()
        seen = []
        def forward(actual_model, actual_sample, return_evidence=False):
            self.assertIs(actual_model, model)
            self.assertIs(actual_sample["appearance_regime"], row["appearance_regime"])
            self.assertFalse(actual_model.training)
            seen.append(actual_sample["sampleId"])
            return torch.zeros(1, 3, 192, 256)
        # Explicit synthetic numeric boundary; authentication and registry stay real.
        with patch.object(worker, "sample_forward", forward), patch.object(worker,
                "original_object_class_spatial_loss",
                return_value=(torch.tensor(0.), {k: 0.2 for k in worker.OBJECT_CHANNELS})):
            observed = worker.validation_observation(model, row, ORDER, epoch=24)
        self.assertEqual(seen, [row["sampleId"]])
        self.assertTrue(model.training)
        self.assertEqual(observed["fullRgbMae"], 0)
        self.assertIsNone(model.weight.grad)

    def test_validation_rejects_missing_season_without_default(self):
        row = sample()
        del row["appearance_regime"]
        with patch.object(worker, "profile") as provider:
            provider.return_value.sample_forward.side_effect = KeyError("appearance_regime")
            with self.assertRaises(KeyError):
                worker.validation_observation(Dummy(), row, ORDER, epoch=24)

    def test_checkpoint_identity_roundtrip_and_old_rejection(self):
        model, critic = Dummy(), Dummy()
        package = {"path": "fixture/package.json", "sha256": "1"*64}
        contract = {"path": "fixture/policy.json", "sha256": "2"*64}
        payload, states = worker.serialize_checkpoint(model, critic, epoch=24, selection=selection(),
            execution_package=package, candidate_contract=contract,
            identity=worker.IDENTITY)
        actual = worker.reload_checkpoint_exact(payload, expected_epoch=24, expected_selection=selection(),
            execution_package=package, candidate_contract=contract, channel_order=ORDER,
            network_factory=lambda _: (Dummy(), Dummy()), identity=worker.IDENTITY)
        self.assertEqual(actual[2], states)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata"):
            worker.base.reload_checkpoint_exact(payload, expected_epoch=24, expected_selection=selection(),
                execution_package=package, candidate_contract=contract, channel_order=ORDER,
                network_factory=lambda _: (Dummy(), Dummy()))

    def test_real_single_ticket_consumption_preserves_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "fixture/ticket.json"
            target.parent.mkdir()
            target.write_text('{"synthetic":true}\n', encoding="utf8")
            binding = {"path":"fixture/ticket.json","sha256":hashlib.sha256(target.read_bytes()).hexdigest()}
            gate = worker.base._AuthenticatedTrainingGate(
                {"path":"fixture/package.json","sha256":"1"*64},
                {"path":"fixture/policy.json","sha256":"2"*64},
                "fixture-run", "fixture-package", "fixture", binding,
                "fixture/training-ticket-consumed.json", None, {}, ())
            consumed = worker.base.consume_training_ticket(gate, root=root,
                capability=worker.CAPABILITY, claim_schema="ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
            before = (root / consumed.consumption_claim["path"]).read_bytes()
            with self.assertRaisesRegex(ValueError, "already consumed"):
                worker.base.consume_training_ticket(gate, root=root,
                    capability=worker.CAPABILITY, claim_schema="ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
            self.assertEqual((root / consumed.consumption_claim["path"]).read_bytes(), before)

    def test_partial_counts_primary_error_preserved(self):
        def synthetic_failure(**kwargs):
            kwargs["_progress_state"]["optimizerSteps"].update(generator=7, discriminator=6)
            raise RuntimeError("synthetic primary failure")
        with patch.object(worker, "bounded_training_loop", synthetic_failure):
            result = worker.run_with_terminal_boundary(terminal_sink=lambda _: None, training_gate=None)
        self.assertEqual(result["optimizerStepsGenerator"], 7)
        self.assertEqual(result["optimizerStepsDiscriminator"], 6)
        self.assertEqual(result["error"], "synthetic primary failure")

    def test_stale_cpu_report_is_not_candidate_qualification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / worker.CPU_REPORT_PATH
            target.parent.mkdir(parents=True)
            target.write_text('{"status":"cpu_contract_checked_not_execution_qualified"}', encoding="utf8")
            binding = {"path":worker.CPU_REPORT_PATH,"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "real CPU proof differs"):
                worker.read_model_cpu_proof(worker._bound_reader(root), binding)

if __name__ == "__main__":
    unittest.main()
