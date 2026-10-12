"""CPU-only V27 worker identity and fail-closed checks."""
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

import painter_stage4_v27_dry_single_world_checkpoint_worker as v27  # noqa: E402


class V27WorkerCpuTests(unittest.TestCase):


    def test_fresh_factory_exact_cpu_proof_and_distinct_hash_algorithms(self):
        from test_object_head_shared_hidden_v27_cpu import ORDER
        import check_stage4_mvp256_dry_v27_v3_cpu as historical
        from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import (
            CAPABILITY, build_fresh_object_head_shared_hidden_v27_cpu)
        model, critic = v27.fresh_networks(ORDER)
        reference = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=ORDER)
        self.assertEqual(list(model.state_dict()), list(reference.state_dict()))
        self.assertTrue(all(torch.equal(v, reference.state_dict()[k])
                            for k, v in model.state_dict().items()))
        self.assertEqual(len(tuple(model.parameters())), 100)
        self.assertEqual(sum(p.numel() for p in model.parameters()), 2236015)
        report = json.loads((ROOT / v27.CPU_REPORT_PATH).read_bytes())
        self.assertEqual(historical.state_hash(model.state_dict()), report["initialState"]["model"])
        self.assertEqual(historical.state_hash(critic.state_dict()), report["initialState"]["critic"])
        self.assertEqual(v27.base.v24.core.cpu.state_hash(model),
                         "8ce5a4173b9594c81bee03a1e5fd132f182d98aa277ffca474dcfc583c517262")
        self.assertEqual(v27.base.v24.core.cpu.state_hash(critic),
                         "72b1b3f6b1b87d9dd7e368a6d845e475287fb9e79d3c5e99f107dc6894cc0baf")
        self.assertEqual(model.capability_version, CAPABILITY)
        self.assertNotEqual(v27.CAPABILITY, CAPABILITY)
        self.assertFalse(torch.cuda.is_initialized())

    def test_v27_checkpoint_schema_cannot_reload_as_v24(self):
        selection = {
            "epoch": 24, "worstApplicableObjectCorrelation": 0.2,
            "meanValidationRgbMae": 0.3,
            "applicableImageCounts": {
                name: 1 for name in v27.base.OBJECT_CHANNELS},
            "rank": [0.2, -0.3, -24], "qualificationGranted": False,
            "checkpointPromotionEligible": False,
        }
        package = {"path": "run/package.json", "sha256": "1" * 64}
        candidate = {"path": "policy.json", "sha256": "2" * 64}
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        payload, _ = v27.base.serialize_checkpoint(
            model, critic, epoch=24, selection=selection,
            execution_package=package, candidate_contract=candidate,
            identity=v27.IDENTITY)
        saved = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
        self.assertEqual(saved["schemaVersion"], v27.IDENTITY["checkpointSchema"])
        self.assertEqual(saved["capabilityVersion"], v27.CAPABILITY)
        with self.assertRaisesRegex(ValueError, "checkpoint metadata differs"):
            v27.base.reload_checkpoint_exact(
                payload, expected_epoch=24, expected_selection=selection,
                execution_package=package, candidate_contract=candidate,
                channel_order=(), network_factory=lambda _order: (model, critic))

    def test_old_or_fake_ticket_rejected_before_cuda(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "ticket.json"
            target.write_text(json.dumps({"schemaVersion": v27.base.TRAINING_TICKET_SCHEMA,
                "status": "issued_single_use", "capabilityVersion": v27.base.CAPABILITY,
                "trainingAllowed": True}), encoding="utf8")
            binding = {"path": "ticket.json",
                       "sha256": v27.hashlib.sha256(target.read_bytes()).hexdigest()}
            with self.assertRaisesRegex(ValueError, "V27 single-use training ticket"):
                v27.authenticate_training_gate(binding, root=root,
                                               check_process=False)

    def test_real_fresh_v27_checkpoint_roundtrip_has_own_identity(self):
        from test_object_head_shared_hidden_v27_cpu import ORDER
        selection = {
            "epoch": 24, "worstApplicableObjectCorrelation": 0.2,
            "meanValidationRgbMae": 0.3, "rank": [0.2, -0.3, -24],
            "applicableImageCounts": {name: 8 for name in v27.base.OBJECT_CHANNELS},
            "qualificationGranted": False, "checkpointPromotionEligible": False,
        }
        package = {"path": "fixture/package.json", "sha256": "1" * 64}
        candidate = {"path": "fixture/policy.json", "sha256": "2" * 64}
        with v27.base._preserve_global_rng():
            torch.manual_seed(v27.base.MODEL_SEED)
            model, critic = v27.fresh_networks(ORDER)
        payload, states = v27.base.serialize_checkpoint(model, critic, epoch=24,
            selection=selection, execution_package=package, candidate_contract=candidate,
            identity=v27.IDENTITY)
        restored, restored_critic, actual = v27.base.reload_checkpoint_exact(
            payload, expected_epoch=24, expected_selection=selection,
            execution_package=package, candidate_contract=candidate, channel_order=ORDER,
            network_factory=v27.fresh_networks, identity=v27.IDENTITY)
        self.assertEqual(actual, states)
        self.assertEqual(v27.base.nested_state_hash(v27.base._cpu_state_dict(restored)), states["Model"])
        self.assertEqual(v27.base.nested_state_hash(v27.base._cpu_state_dict(restored_critic)), states["Critic"])
        for original, recovered in ((model, restored), (critic, restored_critic)):
            self.assertEqual(list(original.state_dict()), list(recovered.state_dict()))
            for key, tensor in original.state_dict().items():
                self.assertTrue(torch.equal(tensor, recovered.state_dict()[key]), key)
        self.assertFalse(torch.cuda.is_initialized())

    def test_invalid_gate_never_reaches_optimizer(self):
        terminal = v27.base.run_with_terminal_boundary(
            terminal_sink=lambda _value: None,
            train_samples=[], validation_samples=[], channel_order=[],
            training_gate={"trainingAllowed": True},
            resource_check=lambda: None,
            checkpoint_sink=lambda *_args: None,
            device=torch.device("cpu"), identity=v27.IDENTITY)
        self.assertEqual(terminal["status"], "experiment_failed_closed")
        self.assertEqual(terminal["capabilityVersion"], v27.CAPABILITY)
        self.assertEqual(terminal["schemaVersion"], v27.IDENTITY["terminalSchema"])
        self.assertEqual(terminal["optimizerStepsGenerator"], 0)


    def test_actual_parent_scope_and_all_required_program_paths_exist(self):
        parent = json.loads((ROOT / "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json").read_bytes())
        self.assertEqual(parent["scope"]["subjectSampleId"],
            "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
        self.assertNotIn("preselectedSubject", parent["scope"])
        for path in v27.PROGRAM_PATHS.values():
            self.assertTrue((ROOT / path).is_file(), path)
        self.assertEqual(v27.PROGRAM_PATHS["model"],
            "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_v27_cpu.py")

    def test_model_cpu_proof_authenticates_snapshots_current_source_and_claim(self):
        reader = v27._bound_reader(ROOT)
        binding = {"path": v27.CPU_REPORT_PATH,
            "sha256": "0c45507597b1cb6fa1b497274b12fbbf34c6726d07f252909a49c10cbd804955"}
        proof = v27.read_model_cpu_proof(reader, binding)
        self.assertEqual(proof["realCallCounts"]["autogradGradCallsCompleted"], 8)
        reader.unchanged()
        for changed in ({**binding, "sha256": "0"*64},
                        {**binding, "path": "other/report.json"}):
            with self.assertRaises(ValueError):
                v27.read_model_cpu_proof(v27._bound_reader(ROOT), changed)

    def test_terminal_fault_keeps_partial_step_counts_and_cannot_overwrite(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "terminal.json"
            gate = v27.base._AuthenticatedTrainingGate(
                {"path": "package.json", "sha256": "a"*64},
                {"path": "policy.json", "sha256": "b"*64},
                "fixture-run", "fixture-package", "run",
                {"path": "ticket.json", "sha256": "c"*64},
                "run/claim.json", None, {}, ())
            consumed = v27.base._ConsumedTrainingGate(gate,
                {"path": "run/claim.json", "sha256": "d"*64})
            def partial(**kwargs):
                state = kwargs["_progress_state"]
                state["optimizerSteps"].update(generator=2, discriminator=3)
                state["actualEpoch"] = 1
                raise RuntimeError("resource failure after partial steps")
            with patch.object(v27.base, "bounded_training_loop", partial), patch.object(
                    v27.base, "_publish_progress", lambda *args, **kwargs: None):
                result = v27.base.run_with_terminal_boundary(
                    terminal_sink=lambda value: v27.base._write_exclusive_json(output, value),
                    training_gate=consumed, identity=v27.IDENTITY)
            self.assertEqual(result["optimizerStepsGenerator"], 2)
            self.assertEqual(result["optimizerStepsDiscriminator"], 3)
            self.assertEqual(result["status"], "experiment_failed_closed")
            before = output.read_bytes()
            with self.assertRaises(FileExistsError):
                v27.base._write_exclusive_json(output, result)
            self.assertEqual(before, output.read_bytes())

    def test_consumption_is_once_and_preserves_claim_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "run").mkdir()
            gate = v27.base._AuthenticatedTrainingGate(
                {"path": "package.json", "sha256": "a"*64},
                {"path": "policy.json", "sha256": "b"*64},
                "fixture-run", "fixture-package", "run",
                {"path": "ticket.json", "sha256": "c"*64},
                "run/claim.json", None, {}, ())
            consumed = v27.base.consume_training_ticket(gate, root=root,
                capability=v27.CAPABILITY,
                claim_schema="ai-painter-stage4-mvp256-dry-v27-v3-ticket-consumption-v1")
            target = root / consumed.consumption_claim["path"]
            before = target.read_bytes()
            with self.assertRaisesRegex(ValueError, "already consumed"):
                v27.base.consume_training_ticket(gate, root=root, capability=v27.CAPABILITY)
            self.assertEqual(before, target.read_bytes())
            self.assertFalse(torch.cuda.is_initialized())

    def test_strict_checkpoint_cross_run_and_wrong_shapes_rejected(self):
        from test_object_head_shared_hidden_v27_cpu import ORDER
        selection = {"epoch": 24, "worstApplicableObjectCorrelation": .2,
            "meanValidationRgbMae": .3, "rank": [.2, -.3, -24],
            "applicableImageCounts": {name: 8 for name in v27.base.OBJECT_CHANNELS},
            "qualificationGranted": False, "checkpointPromotionEligible": False}
        package = {"path": "fixture/package.json", "sha256": "1"*64}
        candidate = {"path": "fixture/policy.json", "sha256": "2"*64}
        model, critic = v27.fresh_networks(ORDER)
        payload, _ = v27.base.serialize_checkpoint(model, critic, epoch=24,
            selection=selection, execution_package=package, candidate_contract=candidate,
            identity=v27.IDENTITY)
        for altered in ({**package, "path": "other/package.json"},
                        {**package, "sha256": "3"*64}):
            with self.assertRaisesRegex(ValueError, "metadata"):
                v27.base.reload_checkpoint_exact(payload, expected_epoch=24,
                    expected_selection=selection, execution_package=altered,
                    candidate_contract=candidate, channel_order=ORDER,
                    network_factory=v27.fresh_networks, identity=v27.IDENTITY)
        with self.assertRaises(RuntimeError):
            v27.base.reload_checkpoint_exact(payload, expected_epoch=24,
                expected_selection=selection, execution_package=package,
                candidate_contract=candidate, channel_order=ORDER,
                network_factory=lambda _: (torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)),
                identity=v27.IDENTITY)

    def test_worker_explicitly_passes_five_group_pair_runner_to_existing_loop(self):
        import inspect
        source = inspect.getsource(v27.run_cli)
        self.assertIn("pair_runner=perform_pair", source)
        self.assertIn("base.run_with_terminal_boundary", source)


    def test_v27_v3_identity_family_preserves_cpu_model_and_rejects_old_checkpoint(self):
        expected = "stage4_mvp256_dry_object_head_shared_hidden_v27_v3"
        self.assertEqual(v27.CAPABILITY, expected)
        for name in ("checkpointSchema", "terminalSchema", "progressSchema"):
            self.assertIn("-v27-v3-", v27.IDENTITY[name])
        self.assertIn("-v27-v3-", v27.PACKAGE_SCHEMA)
        self.assertIn("-v27-v3-", v27.GPU_SCHEMA)
        self.assertIn("-v27-v3-", v27.TICKET_SCHEMA)
        selection = {"epoch": 24, "worstApplicableObjectCorrelation": .2,
            "meanValidationRgbMae": .3, "rank": [.2, -.3, -24],
            "applicableImageCounts": {name: 8 for name in v27.base.OBJECT_CHANNELS},
            "qualificationGranted": False, "checkpointPromotionEligible": False}
        package = {"path": "fixture/package.json", "sha256": "1"*64}
        candidate = {"path": "fixture/policy.json", "sha256": "2"*64}
        model, critic = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        old_identity = {**v27.IDENTITY,
            "capability": "stage4_mvp256_dry_object_head_shared_hidden_v27",
            "checkpointSchema": "ai-painter-stage4-mvp256-dry-v27-checkpoint-v1"}
        payload, _ = v27.base.serialize_checkpoint(model, critic, epoch=24,
            selection=selection, execution_package=package, candidate_contract=candidate,
            identity=old_identity)
        with self.assertRaisesRegex(ValueError, "metadata"):
            v27.base.reload_checkpoint_exact(payload, expected_epoch=24,
                expected_selection=selection, execution_package=package,
                candidate_contract=candidate, channel_order=(),
                network_factory=lambda _: (model, critic), identity=v27.IDENTITY)
        self.assertFalse(torch.cuda.is_initialized())

    def test_worker_rehashes_dependency_roles_and_real_source_bytes_before_gpu(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            logical = "source.py"
            target = root / logical
            target.write_bytes(b"synthetic local source")
            binding = {"path": logical, "sha256": v27.hashlib.sha256(target.read_bytes()).hexdigest()}
            role = "dependency_" + v27.hashlib.sha256(logical.encode("utf8")).hexdigest()
            v27.validate_program_bindings(v27._bound_reader(root), {role: binding})
            for bindings in (
                {"dependency:" + logical: binding},
                {"dependency_" + "0"*64: binding},
                {"constructor": binding},
                {role: {**binding, "sha256": "0"*64}},
            ):
                with self.assertRaises(ValueError):
                    v27.validate_program_bindings(v27._bound_reader(root), bindings)
            target.write_bytes(b"tampered source")
            with self.assertRaises(ValueError):
                v27.validate_program_bindings(v27._bound_reader(root), {role: binding})
        self.assertFalse(torch.cuda.is_initialized())

    def test_predecessor_archive_proof_is_failure_only_with_zero_steps(self):
        reader = v27._bound_reader(ROOT)
        proof = v27.read_predecessor_proof(reader)
        failure = reader.json(proof["predecessorRegistrationFailure"])
        self.assertEqual(failure["optimizerStepsGenerator"], 0)
        self.assertEqual(failure["optimizerStepsDiscriminator"], 0)
        self.assertFalse(failure["trainingStarted"])
        self.assertEqual(reader.json(proof["predecessorExecutionPolicy"])["capabilityVersion"],
                         "stage4_mvp256_dry_object_head_shared_hidden_v27")
        reader.unchanged()
        with self.assertRaises(ValueError):
            v27.read_predecessor_proof(v27._bound_reader(ROOT),
                {**v27.PREDECESSOR_MANIFEST, "sha256": "0"*64})
        self.assertFalse(torch.cuda.is_initialized())

    def test_historical_registry_observation_rehashes_real_transaction_without_live_pointer(self):
        proof = v27.HISTORICAL_REGISTRY_OBSERVATION
        reader = v27._bound_reader(ROOT)
        observed = v27.read_historical_registry_observation(reader, proof["observed"])
        self.assertEqual(observed["snapshot"]["sha256"], proof["observed"]["sha256"])
        current = ROOT / proof["observed"]["path"]
        self.assertNotEqual(v27.hashlib.sha256(current.read_bytes()).hexdigest(), proof["observed"]["sha256"])
        reader.unchanged()
        for changed in ({**proof["observed"], "path": proof["snapshot"]["path"]},
                        {**proof["observed"], "registryRevision": 368},
                        {**proof["observed"], "sha256": "0"*64}):
            with self.assertRaises(ValueError):
                v27.read_historical_registry_observation(v27._bound_reader(ROOT), changed)
        self.assertFalse(torch.cuda.is_initialized())

    def test_historical_registry_semantics_rejects_wrong_commit_revision_path_and_event(self):
        from copy import deepcopy
        proof = v27.HISTORICAL_REGISTRY_OBSERVATION
        records = [json.loads((ROOT / proof[k]["path"]).read_bytes())
                   for k in ("transaction", "snapshot", "event")]
        v27.validate_historical_registry_records(*records)
        for index, field, value in (
            (0, "status", "prepared"), (0, "transactionId", "wrong"),
            (0, "committedAtUtc", "2026-01-01T00:00:00Z"),
            (1, "registryRevision", 368), (2, "eventSequence", 365),
            (2, "transactionId", "wrong"), (2, "runId", "foreign"),
            (2, "currentSha256", "0"*64),
        ):
            changed = deepcopy(records)
            changed[index][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                v27.validate_historical_registry_records(*changed)
        changed = deepcopy(records)
        changed[0]["currentStaged"]["path"] = proof["observed"]["path"]
        with self.assertRaises(ValueError):
            v27.validate_historical_registry_records(*changed)

    def test_v2_predecessor_uses_own_source_and_document_snapshots(self):
        reader = v27._bound_reader(ROOT)
        proof = v27.read_execution_predecessor_proof(reader)
        failure = reader.json(proof["predecessorV2PreflightFailure"])
        self.assertEqual(failure["optimizerStepsGenerator"], 0)
        self.assertEqual(failure["optimizerStepsDiscriminator"], 0)
        self.assertFalse(failure["trainingStarted"])
        self.assertIn("source SHA mismatch: .runtime/ai-painter/current-execution-registry/current.json",
                      failure["error"])
        self.assertNotEqual(proof["frozenSourceManifest"], proof["predecessorV2SourceManifest"])
        reader.unchanged()
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
