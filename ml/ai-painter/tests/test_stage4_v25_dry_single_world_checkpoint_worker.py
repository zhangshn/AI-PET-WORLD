"""CPU-only V25 worker identity and fail-closed checks."""
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import torch

ROOT = Path(__file__).resolve().parents[3]
for entry in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

import painter_stage4_v25_dry_single_world_checkpoint_worker as v25  # noqa: E402


class V25WorkerCpuTests(unittest.TestCase):
    def test_recovery_policy_preserves_training_ast_and_rejects_changed_boundaries(self):
        def binding(path):
            return {"path": path, "sha256": v25.hashlib.sha256((ROOT / path).read_bytes()).hexdigest()}

        old_path = v25.POLICY_PATH.replace("-v2.json", "-v1.json")
        previous = json.loads((ROOT / old_path).read_bytes())
        candidate = {**previous, "schemaVersion": v25.POLICY_SCHEMA,
            "executionVersion": "heartbeat_recovery_v2", "recovery": {
                "additionalExecutionAttempts": 1, "automaticTrainingRetries": 0,
                "historicalCheckpointMayInitialize": False, "oldRunMustRemainClosed": True,
                "heartbeatPublication": {
                    "retryableErrorCodes": ["EPERM", "EACCES", "EBUSY"],
                    "maxReplaceAttempts": 21, "retryDelayMilliseconds": 100,
                    "maxWaitMilliseconds": 2000, "sameStagedBytesOnly": True,
                    "preservePreviousHeartbeat": True,
                },
                "predecessorPolicy": binding(old_path),
                "predecessorFailure": binding(v25.PREDECESSOR_ROOT + "/failure.json"),
                "predecessorClaim": binding(v25.OUTPUT_PARENT + "/single-training-attempt-claim.json"),
                "predecessorTicketConsumption": binding(v25.PREDECESSOR_ROOT + "/training-ticket-consumed.json"),
                "historicalSpecification": binding(".runtime/ai-painter/stage4-mvp-v25-successor-binding/frozen-v25-1.32/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
                "historicalWorker": binding(".runtime/ai-painter/stage4-mvp-v25-successor-binding/frozen-v25-1.32/painter_stage4_v25_dry_single_world_checkpoint_worker.py"),
            }}
        reader = v25.base.v24.core.cpu.BoundReader(ROOT)
        self.assertEqual(v25.validate_recovery_policy(reader, candidate),
                         candidate["recovery"]["predecessorFailure"])
        reader.unchanged()
        for mutate in (
            lambda value: value["recovery"].update(additionalExecutionAttempts=2),
            lambda value: value["recovery"].update(historicalCheckpointMayInitialize=True),
            lambda value: value["singleChange"].update(probability=0.2),
            lambda value: value.update(executionVersion="unknown"),
        ):
            changed = json.loads(json.dumps(candidate))
            mutate(changed)
            with self.assertRaises(ValueError):
                v25.validate_recovery_policy(v25.base.v24.core.cpu.BoundReader(ROOT), changed)

    def test_fresh_factory_keeps_v24_initial_state_and_v25_graph(self):
        from ai_painter.complete_world.object_head_train_dropout_v25_cpu import (
            TrainDropoutHead,
        )
        reader = v25.base.v24.core.cpu.BoundReader(ROOT)
        _manifest, order, _continuous, _, _membership = (
            v25.base.v24.core.cpu.select_rows(reader))
        reader.unchanged()
        with v25.base._preserve_global_rng():
            torch.manual_seed(v25.base.MODEL_SEED)
            legacy, old_critic = v25.base.v24.fresh_networks(order)
            torch.manual_seed(v25.base.MODEL_SEED)
            model, critic = v25.fresh_networks(order)
        self.assertEqual(v25.base.v24.core.cpu.state_hash(model),
                         v25.base.v24.core.cpu.state_hash(legacy))
        self.assertEqual(v25.base.v24.core.cpu.state_hash(critic),
                         v25.base.v24.core.cpu.state_hash(old_critic))
        self.assertTrue(all(isinstance(head, TrainDropoutHead)
                            for head in model.object_rgb_heads.values()))

    def test_v25_checkpoint_schema_cannot_reload_as_v24(self):
        selection = {
            "epoch": 24, "worstApplicableObjectCorrelation": 0.2,
            "meanValidationRgbMae": 0.3,
            "applicableImageCounts": {
                name: 1 for name in v25.base.OBJECT_CHANNELS},
            "rank": [0.2, -0.3, -24], "qualificationGranted": False,
            "checkpointPromotionEligible": False,
        }
        package = {"path": "run/package.json", "sha256": "1" * 64}
        candidate = {"path": "policy.json", "sha256": "2" * 64}
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        payload, _ = v25.base.serialize_checkpoint(
            model, critic, epoch=24, selection=selection,
            execution_package=package, candidate_contract=candidate,
            identity=v25.IDENTITY)
        saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
        self.assertEqual(saved["schemaVersion"], v25.IDENTITY["checkpointSchema"])
        self.assertEqual(saved["capabilityVersion"], v25.CAPABILITY)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata differs"):
            v25.base.reload_checkpoint_exact(
                payload, expected_epoch=24, expected_selection=selection,
                execution_package=package, candidate_contract=candidate,
                channel_order=(), network_factory=lambda _order: (model, critic))

    def test_old_or_fake_ticket_rejected_before_cuda(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "ticket.json"
            target.write_text(json.dumps({"schemaVersion": v25.base.TRAINING_TICKET_SCHEMA,
                "status": "issued_single_use", "capabilityVersion": v25.base.CAPABILITY,
                "trainingAllowed": True}), encoding="utf8")
            binding = {"path": "ticket.json",
                       "sha256": v25.hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "V25 single-use training ticket"):
                v25.authenticate_training_gate(binding, root=root,
                                               check_process=False)

    def test_invalid_gate_never_reaches_optimizer(self):
        terminal = v25.base.run_with_terminal_boundary(
            terminal_sink=lambda _value: None,
            train_samples=[], validation_samples=[], channel_order=[],
            training_gate={"trainingAllowed": True},
            resource_check=lambda: None,
            checkpoint_sink=lambda *_args: None,
            device=torch.device("cpu"), identity=v25.IDENTITY)
        self.assertEqual(terminal["status"], "experiment_failed_closed")
        self.assertEqual(terminal["capabilityVersion"], v25.CAPABILITY)
        self.assertEqual(terminal["schemaVersion"], v25.IDENTITY["terminalSchema"])
        self.assertEqual(terminal["optimizerStepsGenerator"], 0)


if __name__ == "__main__":
    unittest.main()
