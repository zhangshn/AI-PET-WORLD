"""CPU-only V26 worker identity and fail-closed checks."""
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

import painter_stage4_v26_v2_dry_single_world_checkpoint_worker as v26  # noqa: E402


class V26WorkerCpuTests(unittest.TestCase):


    def test_fresh_factory_keeps_v24_initial_state_and_v26_graph(self):
        from ai_painter.complete_world.object_local_context_isolation_v26_cpu import (
            LocalFactAppearance,
        )
        reader = v26.base.v24.core.cpu.BoundReader(ROOT)
        _manifest, order, _continuous, _, _membership = (
            v26.base.v24.core.cpu.select_rows(reader))
        reader.unchanged()
        with v26.base._preserve_global_rng():
            torch.manual_seed(v26.base.MODEL_SEED)
            legacy, old_critic = v26.base.v24.fresh_networks(order)
            torch.manual_seed(v26.base.MODEL_SEED)
            model, critic = v26.fresh_networks(order)
        self.assertEqual(v26.base.v24.core.cpu.state_hash(model),
                         v26.base.v24.core.cpu.state_hash(legacy))
        self.assertEqual(v26.base.v24.core.cpu.state_hash(critic),
                         v26.base.v24.core.cpu.state_hash(old_critic))
        self.assertIsInstance(model.core.core.appearance, LocalFactAppearance)
        self.assertFalse(any(isinstance(module, torch.nn.Dropout2d)
                             for module in model.modules()))

    def test_v26_checkpoint_schema_cannot_reload_as_v24(self):
        selection = {
            "epoch": 24, "worstApplicableObjectCorrelation": 0.2,
            "meanValidationRgbMae": 0.3,
            "applicableImageCounts": {
                name: 1 for name in v26.base.OBJECT_CHANNELS},
            "rank": [0.2, -0.3, -24], "qualificationGranted": False,
            "checkpointPromotionEligible": False,
        }
        package = {"path": "run/package.json", "sha256": "1" * 64}
        candidate = {"path": "policy.json", "sha256": "2" * 64}
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        payload, _ = v26.base.serialize_checkpoint(
            model, critic, epoch=24, selection=selection,
            execution_package=package, candidate_contract=candidate,
            identity=v26.IDENTITY)
        saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
        self.assertEqual(saved["schemaVersion"], v26.IDENTITY["checkpointSchema"])
        self.assertEqual(saved["capabilityVersion"], v26.CAPABILITY)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata differs"):
            v26.base.reload_checkpoint_exact(
                payload, expected_epoch=24, expected_selection=selection,
                execution_package=package, candidate_contract=candidate,
                channel_order=(), network_factory=lambda _order: (model, critic))

    def test_old_or_fake_ticket_rejected_before_cuda(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "ticket.json"
            target.write_text(json.dumps({"schemaVersion": v26.base.TRAINING_TICKET_SCHEMA,
                "status": "issued_single_use", "capabilityVersion": v26.base.CAPABILITY,
                "trainingAllowed": True}), encoding="utf8")
            binding = {"path": "ticket.json",
                       "sha256": v26.hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "V26 single-use training ticket"):
                v26.authenticate_training_gate(binding, root=root,
                                               check_process=False)

    def test_real_fresh_v26_checkpoint_roundtrip_has_own_identity(self):
        from test_object_head_train_dropout_v25_cpu import ORDER
        selection = {
            "epoch": 24, "worstApplicableObjectCorrelation": 0.2,
            "meanValidationRgbMae": 0.3, "rank": [0.2, -0.3, -24],
            "applicableImageCounts": {name: 8 for name in v26.base.OBJECT_CHANNELS},
            "qualificationGranted": False, "checkpointPromotionEligible": False,
        }
        package = {"path": "fixture/package.json", "sha256": "1" * 64}
        candidate = {"path": "fixture/policy.json", "sha256": "2" * 64}
        with v26.base._preserve_global_rng():
            torch.manual_seed(v26.base.MODEL_SEED)
            model, critic = v26.fresh_networks(ORDER)
        payload, states = v26.base.serialize_checkpoint(model, critic, epoch=24,
            selection=selection, execution_package=package, candidate_contract=candidate,
            identity=v26.IDENTITY)
        restored, restored_critic, actual = v26.base.reload_checkpoint_exact(
            payload, expected_epoch=24, expected_selection=selection,
            execution_package=package, candidate_contract=candidate, channel_order=ORDER,
            network_factory=v26.fresh_networks, identity=v26.IDENTITY)
        self.assertEqual(actual, states)
        self.assertEqual(v26.base.nested_state_hash(v26.base._cpu_state_dict(restored)), states["Model"])
        self.assertEqual(v26.base.nested_state_hash(v26.base._cpu_state_dict(restored_critic)), states["Critic"])
        for original, recovered in ((model, restored), (critic, restored_critic)):
            self.assertEqual(list(original.state_dict()), list(recovered.state_dict()))
            for key, tensor in original.state_dict().items():
                self.assertTrue(torch.equal(tensor, recovered.state_dict()[key]), key)
        self.assertFalse(torch.cuda.is_initialized())

    def test_invalid_gate_never_reaches_optimizer(self):
        terminal = v26.base.run_with_terminal_boundary(
            terminal_sink=lambda _value: None,
            train_samples=[], validation_samples=[], channel_order=[],
            training_gate={"trainingAllowed": True},
            resource_check=lambda: None,
            checkpoint_sink=lambda *_args: None,
            device=torch.device("cpu"), identity=v26.IDENTITY)
        self.assertEqual(terminal["status"], "experiment_failed_closed")
        self.assertEqual(terminal["capabilityVersion"], v26.CAPABILITY)
        self.assertEqual(terminal["schemaVersion"], v26.IDENTITY["terminalSchema"])
        self.assertEqual(terminal["optimizerStepsGenerator"], 0)


    def test_runtime_and_model_identity_are_explicit_distinct_v2_identities(self):
        from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
            CAPABILITY, AGGREGATION_RULE, DeterministicObjectAssemblyRenderer,
        )
        from test_object_head_train_dropout_v25_cpu import ORDER
        import painter_stage4_v26_dry_single_world_checkpoint_worker as old
        model, _critic = v26.fresh_networks(ORDER)
        self.assertEqual(v26.CAPABILITY,
                         "stage4_mvp256_dry_object_local_context_isolation_v26_v2")
        self.assertEqual(model.capability_version, CAPABILITY)
        self.assertEqual(model.object_aggregation_rule, AGGREGATION_RULE)
        self.assertIsInstance(model.core.core, DeterministicObjectAssemblyRenderer)
        self.assertNotEqual(v26.CAPABILITY, old.CAPABILITY)
        self.assertNotEqual(v26.IDENTITY, old.IDENTITY)
        self.assertNotEqual(v26.OUTPUT_PARENT, old.OUTPUT_PARENT)
        self.assertNotEqual(v26.POLICY_PATH, old.POLICY_PATH)
        self.assertFalse(model.execution_qualified)

if __name__ == "__main__":
    unittest.main()
