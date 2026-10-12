"""Zero-compute adapter tests; fixtures do not admit GPU or real training."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import painter_stage4_ecology_regime_execution_worker as worker
import qualify_stage4_ecology_regime_execution_gpu as gpu


def binding(name):
    return {"path": "synthetic/" + name, "sha256": hashlib.sha256(name.encode()).hexdigest()}


class Reader:
    def __init__(self, values):
        self.values = values
        self.root = worker.ROOT
        self.checked = 0
    def read(self, item):
        worker.auth.exact_binding(item)
        raw = json.dumps(self.values[item["path"]], sort_keys=True, separators=(",", ":")).encode()
        if hashlib.sha256(raw).hexdigest() != item["sha256"]:
            raise ValueError("synthetic fixture byte mismatch")
        return raw
    def json(self, item):
        return worker.auth.decode(self.read(item))
    def unchanged(self):
        self.checked += 1
    def path(self, logical):
        return self.root / logical
    def put(self, logical, value):
        self.values[logical] = deepcopy(value)
        raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
        return {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}


def gate_fixture():
    reader = Reader({})
    ids = ["synthetic-train-" + str(i) for i in range(48)]
    plan = {"runId": "synthetic-ecology-run", "packageId": "synthetic-ecology-package",
        "outputRoot": ".runtime/ai-painter/ecology-regime-managed-executions/synthetic-ecology-run",
        "programBindings": {"worker": binding("worker.py")}}
    plan["trainSplit"] = reader.put("synthetic/train.json", {"sampleIds": ids})
    state = {"generator": "a" * 64, "discriminator": "b" * 64}
    plan["modelBinding"] = reader.put("synthetic/model.json", {"initialState": state})
    package = binding("package.json")
    gate = {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": worker.CAPABILITY,
        "executionProfile": worker.EXECUTION_PROFILE, "executionPackage": package,
        "runId": plan["runId"], "packageId": plan["packageId"], "programBindings": plan["programBindings"],
        "actualCounts": {key + suffix: count for key, count in gpu.Calls.LIMITS.items()
            for suffix in ("Attempted", "Completed")}, "cases": [{"sampleId": sid, "passed": True} for sid in ids],
        "optimizerSteps": 0, "initialState": state, "finalState": state, "initialCpuState": state,
        "checkpointLoaded": False, "checkpointWritten": False}
    return reader, plan, package, gate


class ExecutionAdapterTests(unittest.TestCase):
    def test_complete_own_gpu_gate_and_changed_identity_rejected(self):
        reader, plan, package, gate = gate_fixture()
        logical = plan["outputRoot"] + "/gpu-gate.json"
        bound = reader.put(logical, gate)
        self.assertEqual(worker.verify_gpu_gate(reader, plan, package, bound), gate)
        for field, value in (("schema", "detail-weight-all-train-gpu-gate-v1"),
                ("capabilityVersion", "old-model"), ("runId", "another-run"),
                ("executionPackage", binding("different-package.json")),
                ("programBindings", {}), ("optimizerSteps", False), ("checkpointWritten", True),
                ("initialCpuState", {"generator": "c" * 64, "discriminator": "b" * 64})):
            with self.subTest(field=field):
                bad = {**gate, field: value}
                with self.assertRaises(ValueError):
                    worker.verify_gpu_gate(reader, plan, package, reader.put(logical, bad))

    def test_incomplete_reordered_and_boolean_gpu_counts_rejected(self):
        reader, plan, package, gate = gate_fixture()
        logical = plan["outputRoot"] + "/gpu-gate.json"
        variants = [{**gate, "cases": gate["cases"][:-1]},
            {**gate, "cases": list(reversed(gate["cases"]))},
            {**gate, "finalState": {"generator": "c" * 64, "discriminator": "b" * 64}},
            {**gate, "actualCounts": {**gate["actualCounts"], "forwardCompleted": True}}]
        for variant in variants:
            with self.assertRaises(ValueError):
                worker.verify_gpu_gate(reader, plan, package, reader.put(logical, variant))

    def test_raw_gate_cannot_replace_owned_acceptance(self):
        reader, plan, package, gate = gate_fixture()
        with self.assertRaises(ValueError):
            worker.verify_owned_gpu(reader, plan, package, reader.put(plan["outputRoot"] + "/gpu-gate.json", gate))
        with self.assertRaises(ValueError):
            worker.verify_owned_gpu(reader, plan, package, reader.put(plan["outputRoot"] + "/gpu-acceptance.json", gate))

    def test_successful_release_boolean_without_command_proof_rejected(self):
        reader = Reader({})
        fake = {"schema": "detail-weight-live-native-owner-receipt-v1", "phase": "qualification",
            "ownerClosed": True, "cleanupConfirmed": True, "proof": {"assignedBeforeResume": True,
                "killOnJobClose": True, "exitCode": 0, "activeProcessesAfterCleanup": 0}}
        with self.assertRaises((ValueError, KeyError)):
            worker.verify_owned_release(reader, reader.put("synthetic/receipt.json", fake),
                phase="qualification", output_root="synthetic", args=[], programs={})
        fake["proof"]["activeProcessesAfterCleanup"] = False
        with self.assertRaises(ValueError):
            worker.verify_owned_release(reader, reader.put("synthetic/receipt.json", fake),
                phase="qualification", output_root="synthetic", args=[], programs={})

    def test_partial_optimizer_failure_preserved_and_unknown_not_zero(self):
        _reader, plan, package, _gate = gate_fixture()
        error = RuntimeError("simulated G failure after one D success")
        error.actual_optimizer_counts = {"generator": 0, "discriminator": 1}
        error.completed_epochs = 0
        error.secondary_restore_error = "simulated restore failure"
        terminal = worker.failed_terminal(error, package, plan)
        self.assertEqual(terminal["optimizerStepsDiscriminator"], 1)
        self.assertEqual(terminal["originalError"]["message"], str(error))
        self.assertIn("secondary_restore_error", terminal["secondaryErrors"])
        self.assertFalse(terminal["formalStage4QualificationAllowed"])
        unknown = worker.failed_terminal(ValueError("pre-update failure"), package, plan)
        self.assertIsNone(unknown["optimizerSteps"])
        self.assertIsNone(unknown["optimizerStepsGenerator"])
        self.assertEqual(unknown["automaticRetries"], 0)

    def test_split_rejection_precedes_metadata_and_pixels(self):
        with patch.object(worker, "runtime", return_value=(None, Mock(), None, None)) as runtime:
            for splits in (("challenge",), ("regression",), ("train", "train"), ()):
                with self.assertRaises(ValueError):
                    worker.load_samples(Mock(), {}, splits=splits)
            runtime.return_value[1].prepare_metadata.assert_not_called()

    def test_event_counts_refuse_completion_without_attempt_and_extra_calls(self):
        calls = gpu.Calls()
        calls.begin()
        with self.assertRaises(ValueError):
            calls.event("complete", "forward", None)
        calls.event("attempt", "forward", None)
        calls.event("complete", "forward", None)
        with self.assertRaises(ValueError):
            calls.event("attempt", "forward", None)
        for _ in range(4):
            calls.event("attempt", "generator", None)
            calls.event("complete", "generator", None)
        with self.assertRaises(ValueError):
            calls.event("attempt", "generator", None)
        self.assertEqual(calls.counts["forwardCompleted"], 1)
        self.assertEqual(calls.counts["generatorCompleted"], 4)

    def test_claim_failure_does_not_dispatch_or_publish_over_previous_terminal(self):
        _reader, plan, package, _gate = gate_fixture()
        import painter_stage4_ecology_regime_lifecycle as lifecycle
        fake_torch = SimpleNamespace(set_num_threads=Mock())
        with patch.object(worker, "runtime", return_value=(fake_torch, None, None, None)), \
             patch.object(worker, "authenticate_live", return_value=(Mock(), {}, plan, {})), \
             patch.object(worker, "write", side_effect=FileExistsError("already consumed")), \
             patch.object(lifecycle, "training_loop") as dispatch:
            with self.assertRaises(FileExistsError):
                worker.run(package, binding("gpu-acceptance.json"))
            dispatch.assert_not_called()

    def test_package_failure_precedes_claim_or_cuda(self):
        package = binding("package.json")
        fake_torch = SimpleNamespace(set_num_threads=Mock())
        with patch.object(worker, "runtime", return_value=(fake_torch, None, None, None)), \
             patch.object(worker, "authenticate_live", side_effect=ValueError("source mismatch")), \
             patch.object(worker, "write") as writes:
            with self.assertRaisesRegex(ValueError, "source mismatch"):
                worker.run(package, binding("gpu-acceptance.json"))
            writes.assert_not_called()

    def test_component_acceptance_cannot_be_final_entry_acceptance(self):
        reader = Reader({})
        plan = {"programBindings": {}, "lifecycleCpuAcceptance": reader.put("synthetic/acceptance.json",
            {"schema": "ecology-lifecycle-real-cpu-acceptance-v1", "status": "passed"})}
        with self.assertRaisesRegex(ValueError, "final-entry CPU"):
            worker.verify_final_cpu(reader, plan, {})

    def test_loader_demands_own_roles_and_final_cpu_after_auth_component(self):
        reader = Reader({})
        package = binding("package.json")
        acceptance = binding("entry-acceptance.json")
        plan = {"lifecycleCpuAcceptance": acceptance,
            "programBindings": {"worker": {"path": worker.PATH,
                "sha256": hashlib.sha256(Path(worker.__file__).read_bytes()).hexdigest()},
                "gpuQualifier": {"path": worker.GPU_PATH, "sha256": "a" * 64},
                "reviewWorker": {"path": worker.REVIEW_PATH, "sha256": "b" * 64}}}
        spec = {"inputEvidence": [acceptance]}
        context = worker.auth.ExecutionContext(reader, package, spec, plan, {})
        source = SimpleNamespace(Reader=Mock(return_value=reader), verify_loaded_sources=Mock())
        with patch.object(worker, "runtime", return_value=(None, None, None, source)), \
             patch.object(worker.auth, "load_execution_package", return_value=context), \
             patch.object(worker, "verify_final_cpu") as final:
            self.assertEqual(worker.load_package(package), (reader, spec, plan, {}))
            final.assert_called_once_with(reader, plan, {})
            source.verify_loaded_sources.assert_called_once()
            plan["programBindings"]["gpuQualifier"]["path"] = "old-qualifier.py"
            with self.assertRaisesRegex(ValueError, "own final execution adapter"):
                worker.load_package(package)

    def test_gpu_failure_keeps_primary_and_never_reads_validation_or_retries(self):
        reader, plan, package, _gate = gate_fixture()
        primary = RuntimeError("simulated train content failure")
        fake_torch = SimpleNamespace(set_num_threads=Mock())
        writes = []
        def write(_root, logical, value, **_kw):
            writes.append((logical, value))
            if logical.endswith("gpu-failure.json"):
                raise OSError("simulated secondary storage failure")
        with patch.object(worker, "runtime", return_value=(fake_torch, None, None, None)), \
             patch.object(worker, "authenticate_live", return_value=(reader, {}, plan, {})), \
             patch.object(worker, "write", side_effect=write), \
             patch.object(worker, "load_samples", side_effect=primary) as load:
            with self.assertRaises(RuntimeError) as result:
                gpu.run(package)
            self.assertIs(result.exception, primary)
            self.assertIn("secondary storage", primary.secondary_evidence_error)
            load.assert_called_once_with(reader, plan, splits=("train",))
            self.assertEqual([Path(item[0]).name for item in writes], ["gpu-consumed.json", "gpu-failure.json"])
            self.assertEqual(writes[-1][1]["completedCases"], 0)
            self.assertTrue(all(n == 0 for n in writes[-1][1]["actualCounts"].values()))


if __name__ == "__main__":
    unittest.main()
