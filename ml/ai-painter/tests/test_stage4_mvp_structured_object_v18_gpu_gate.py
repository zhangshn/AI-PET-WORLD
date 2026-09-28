"""CPU-only future-interface fixtures. No GPU qualification is executed here."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as gpu
import torch


def fixture():
    """In-memory proposed interface, never persisted as a contract or evidence."""
    programs = {key: {"path": path, "sha256": "1" * 64} for key, path in gpu.PROGRAM_PATHS.items()}
    programs["scopeVerifier"] = deepcopy(gpu.SCOPE_VERIFIER)
    programs["formalCpuAcceptance"] = {"path": "ml/ai-painter/scripts/future_formal_v18_cpu_acceptance.py", "sha256": "2" * 64}
    cpu_binding = {"path": ".runtime/test-fixture-not-created/formal-cpu.json", "sha256": "3" * 64}
    candidate_binding = {"path": "data/ai-painter/system-governance/future-v18-candidate-not-created.json", "sha256": "4" * 64}
    candidate = {"schemaVersion": gpu.CANDIDATE_SCHEMA, "capabilityVersion": gpu.CAPABILITY,
        "status": "cpu_candidate_not_execution_qualified",
        "activationGates": {"readonlyGpuQualificationAllowed": True, "trainingAllowed": False},
        "datasetBinding": {"manifest": deepcopy(gpu.cpu.MANIFEST),
                           "trainSelectionSha256": "5" * 64, "validationSelectionSha256": "6" * 64},
        "dryScope": deepcopy(gpu.SCOPE), "conditionContract": deepcopy(gpu.cpu.CONDITION_CONTRACT),
        "modelPlan": deepcopy(gpu.MODEL_PLAN), "precisionExecutionPlan": deepcopy(gpu.PRECISION_PLAN),
        "programBindings": programs, "cpuAcceptance": None,
        "readonlyGpuQualification": {"attemptId": "synthetic-attempt-only", "trainSampleId": gpu.TRAIN_ID,
                                     "trainOrdinal": gpu.TRAIN_ORDINAL, "outputRoot": gpu.OUTPUT_ROOT},
        "resourceBudget": {"maxGpuMemoryFraction": 0.7, "maxWallSeconds": 120, "cpuThreads": 2,
                           "sampleCount": 1, "optimizerSteps": 0, "automaticRetries": 0, "checkpointWrites": 0},
        "lossContract": {"path": "data/ai-painter/system-governance/future-v18-loss-not-created.json", "sha256": "a" * 64},
        "reviewThresholdContract": {"path": "data/ai-painter/system-governance/future-v18-review-not-created.json", "sha256": "b" * 64},
        "foundationAssetBinding": {"initializationSeed": 20260928, "autoencoderLoadedByThisRenderer": False,
                                   "failedCheckpointLoaded": False, "checkpointLoaded": False},
        "trainingReviewAlignment": [{"responsibilityId": role, "conditionChannelIds": [role]} for role in gpu.ROLES]}
    acceptance = {"schemaVersion": gpu.CPU_SCHEMA, "status": "cpu_readonly_accepted_execution_disabled",
        "capabilityVersion": gpu.CAPABILITY, "implementationIdentitySha256": gpu.implementation_identity(candidate),
        "candidateContractAtAcceptance": deepcopy(candidate_binding),
        "acceptanceProgram": deepcopy(programs["formalCpuAcceptance"]), "cpuTestsPassed": True,
        "optimizerCreated": False, "optimizerSteps": 0, "weightsModified": False, "gpuInitialized": False,
        "trainingAllowed": False, "initialModelStateSha256": "7" * 64, "finalModelStateSha256": "7" * 64,
        "initialCriticStateSha256": "8" * 64, "finalCriticStateSha256": "8" * 64}
    args = {"candidate_binding": candidate_binding, "cpu_binding": cpu_binding,
            "attempt_id": "synthetic-attempt-only", "output_root": gpu.OUTPUT_ROOT}
    return candidate, acceptance, args


class V18GpuGateCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.cuda.is_initialized():
            raise AssertionError("CPU gate tests require CUDA uninitialized")

    def test_complete_future_interface_is_consistent_without_execution(self):
        candidate, acceptance, args = fixture()
        gpu.validate_gate(candidate, acceptance, **args)
        self.assertFalse(torch.cuda.is_initialized())
        changed = deepcopy(candidate)
        changed["cpuAcceptance"] = deepcopy(args["cpu_binding"])
        self.assertEqual(gpu.implementation_identity(candidate), gpu.implementation_identity(changed))
        changed["readonlyGpuQualification"]["attemptId"] = "future-attempt-two"
        self.assertNotEqual(gpu.implementation_identity(candidate), gpu.implementation_identity(changed))

    def test_inactive_or_train_active_fails_before_scope_and_sample_reads(self):
        for field, value in (("readonlyGpuQualificationAllowed", False), ("readonlyGpuQualificationAllowed", 1),
                             ("trainingAllowed", True), ("trainingAllowed", 0)):
            candidate, acceptance, args = fixture()
            candidate["activationGates"][field] = value
            with patch.object(gpu.cpu.BoundReader, "json", side_effect=[candidate, acceptance]), \
                 patch.object(gpu, "verify_dry_scope") as scope, patch.object(gpu, "run_cuda") as cuda:
                with self.assertRaisesRegex(ValueError, "activation"):
                    gpu.authenticate(args["candidate_binding"], args["cpu_binding"], args["attempt_id"], args["output_root"])
                scope.assert_not_called()
                cuda.assert_not_called()

    def test_numerical_probe_and_stale_implementation_are_not_formal_acceptance(self):
        candidate, acceptance, args = fixture()
        for changes in ({"status": "cpu_numerical_probe_passed_not_qualification"},
                        {"schemaVersion": gpu.cpu.REPORT_SCHEMA}, {"implementationIdentitySha256": "0" * 64},
                        {"finalModelStateSha256": "9" * 64}, {"cpuTestsPassed": 1}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                gpu.validate_gate(candidate, acceptance | changes, **args)
        candidate["programBindings"]["formalCpuAcceptance"]["path"] = gpu.cpu.PROGRAM_PATH
        with self.assertRaisesRegex(ValueError, "probe is not formal"):
            gpu.validate_gate(candidate, acceptance, **args)

    def test_binding_model_precision_role_and_subject_changes_fail(self):
        for mutate in (
            lambda c: c.update(schemaVersion="old-v16"),
            lambda c: c["dryScope"].update(sha256="0" * 64),
            lambda c: c["datasetBinding"]["manifest"].update(sha256="0" * 64),
            lambda c: c["modelPlan"].update(baseChannels=32),
            lambda c: c["precisionExecutionPlan"].update(generatorAutocast="float16"),
            lambda c: c["trainingReviewAlignment"].reverse(),
            lambda c: c["trainingReviewAlignment"].pop(),
            lambda c: c["readonlyGpuQualification"].update(trainOrdinal=0),
            lambda c: c["readonlyGpuQualification"].update(trainSampleId="validation-subject"),
            lambda c: c.update(cpuAcceptance={"path": "not-immutable", "sha256": "0" * 64}),
            lambda c: c["programBindings"]["scopeVerifier"].update(sha256="757513faa55f2f666fca10616d280dd23f0bcc435561bc509b22338dfa78565e"),
        ):
            candidate, acceptance, args = fixture()
            mutate(candidate)
            with self.assertRaises(ValueError):
                gpu.validate_gate(candidate, acceptance, **args)

    def test_excessive_resources_optimizer_and_retry_are_rejected(self):
        for key, value in (("maxGpuMemoryFraction", 0.700001), ("maxGpuMemoryFraction", float("nan")),
                           ("maxWallSeconds", 121), ("cpuThreads", 5), ("optimizerSteps", 1),
                           ("optimizerSteps", False), ("automaticRetries", 1), ("checkpointWrites", 1), ("sampleCount", 2)):
            candidate, acceptance, args = fixture()
            candidate["resourceBudget"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                gpu.validate_gate(candidate, acceptance, **args)

    def test_vram_measurement_rejects_one_byte_over_limit(self):
        valid = {"total": 1000, "reserved": 700, "allocated": 600, "device_used": 700, "fraction": 0.7}
        self.assertEqual(gpu.check_memory(**valid)["limitBytes"], 700)
        for key in ("reserved", "allocated", "device_used"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                gpu.check_memory(**(valid | {key: 701}))

    def test_replay_and_namespace_escape_fail_without_writes(self):
        request = {"attemptId": "synthetic-attempt-only", "outputRoot": gpu.OUTPUT_ROOT}
        with patch.object(Path, "mkdir", side_effect=FileExistsError), patch.object(gpu, "write_json") as writer:
            with self.assertRaisesRegex(ValueError, "already consumed"):
                gpu.claim_attempt(request)
            writer.assert_not_called()
        with self.assertRaisesRegex(ValueError, "namespace"):
            gpu.attempt_directory("synthetic-attempt-only", ".runtime/other")

    def test_worker_cannot_bypass_missing_parent_claim(self):
        candidate, acceptance, args = fixture()
        request = {"candidateContract": args["candidate_binding"], "cpuAcceptance": args["cpu_binding"],
                   "attemptId": args["attempt_id"], "outputRoot": args["output_root"]}
        with patch.object(gpu, "authenticate", return_value=(gpu.cpu.BoundReader(), candidate, acceptance, {}, [], [], {})), \
             patch.object(Path, "read_bytes", side_effect=FileNotFoundError("no parent claim")), \
             patch.object(gpu, "run_cuda") as cuda, patch.object(gpu, "write_json") as writer:
            report = gpu.worker(request)
            self.assertEqual(report["status"], "failed_closed")
            self.assertFalse(report["gpuInitialized"])
            cuda.assert_not_called()
            writer.assert_not_called()

    def test_real_scope_preflight_and_fixed_positive_train_are_cpu_only(self):
        reader = gpu.cpu.BoundReader()
        result = gpu.verify_dry_scope(reader)
        self.assertEqual(result["status"], gpu.SCOPE_STATUS)
        manifest, order, continuous, _, memberships = gpu.cpu.select_rows(reader)
        source = reader.json(manifest["sourceIndex"])
        ids = reader.json(manifest["splits"]["train"])["sampleIds"]
        self.assertEqual(ids[gpu.TRAIN_ORDINAL], gpu.TRAIN_ID)
        row = next(item for item in source["samples"] if item["sampleId"] == gpu.TRAIN_ID)
        _, identity, counts = gpu.positive_train_sample(reader, row, order, continuous)
        self.assertEqual(identity["ordinal"], 43)
        self.assertEqual(counts["terrain_water"], 5553)
        self.assertEqual(counts["terrain_shoreline"], 8112)
        self.assertTrue(all(value > 0 for value in counts.values()))
        self.assertEqual(memberships["validation"]["count"], 8)
        reader.unchanged()
        self.assertFalse(torch.cuda.is_initialized())

    def test_nontrain_pixel_reads_are_rejected_before_adapter(self):
        for split in ("validation", "challenge", "regression"):
            with patch.object(gpu.cpu, "load_sample") as loader:
                with self.assertRaisesRegex(ValueError, "fixed positive train"):
                    gpu.positive_train_sample(None, {"sampleId": gpu.TRAIN_ID, "split": split}, [], [])
                loader.assert_not_called()

    def test_source_program_sha_is_recomputed(self):
        with self.assertRaisesRegex(ValueError, "source SHA mismatch"):
            gpu.cpu.BoundReader().read({"path": gpu.PROGRAM_PATH, "sha256": "0" * 64})

    def test_missing_nonfinite_and_zero_gradients_fail_on_cpu(self):
        model = torch.nn.Linear(1, 1)
        with self.assertRaisesRegex(ValueError, "gradient missing"):
            gpu.gradient_facts(model, "cpu")
        for parameter in model.parameters():
            parameter.grad = torch.zeros_like(parameter)
        with self.assertRaisesRegex(ValueError, "all gradients are zero"):
            gpu.gradient_facts(model, "cpu")
        for parameter in model.parameters():
            parameter.grad = torch.ones_like(parameter)
        self.assertEqual(len(gpu.gradient_facts(model, "cpu")), 2)
        model.weight.grad[0, 0] = float("nan")
        with self.assertRaisesRegex(ValueError, "nonfinite gradient"):
            gpu.gradient_facts(model, "cpu")

    def test_discriminator_isolation_survives_an_objective_that_does_not_detach(self):
        from ai_painter.complete_world import native_rgb_conditional_texture_cpu as objective
        critic = torch.nn.Linear(1, 1)
        prediction = torch.ones(2, requires_grad=True)
        def deliberately_leaky(discriminator, value, sample):
            return value.sum() + discriminator.weight.sum(), {}
        with patch.object(objective, "discriminator_train_objective", side_effect=deliberately_leaky):
            loss, _ = gpu.detached_discriminator_objective(critic, prediction, {})
            loss.backward()
        self.assertIsNone(prediction.grad)
        self.assertTrue(bool(torch.isfinite(critic.weight.grad).all()))

    def test_wrong_fresh_cpu_state_is_rejected_before_any_cuda_query(self):
        candidate, acceptance, _ = fixture()
        order = gpu.cpu.BoundReader().json(gpu.cpu.CONDITION_CONTRACT)["tensorContract"]["channelOrder"]
        with patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA query before state check")) as query:
            with self.assertRaisesRegex(ValueError, "formal CPU states"):
                gpu.run_cuda(candidate, acceptance, {}, order, {})
            query.assert_not_called()
        self.assertFalse(torch.cuda.is_initialized())

    def test_seven_responsibility_gradients_must_be_finite_and_nonzero_in_support(self):
        order = gpu.cpu.BoundReader().json(gpu.cpu.CONDITION_CONTRACT)["tensorContract"]["channelOrder"]
        conditions = torch.zeros(23, 192, 256)
        features = {}
        for role in gpu.ROLES:
            conditions[order.index(role), 20:24, 20:24] = 1
            features[role] = torch.zeros(1, 8, 192, 256)
            features[role].grad = torch.ones_like(features[role])
        sample = {"conditions": conditions}
        self.assertEqual(set(gpu.role_gradient_facts(features, sample, order)), set(gpu.ROLES))
        missing = dict(features)
        del missing["terrain_shoreline"]
        with self.assertRaisesRegex(ValueError, "keys differ"):
            gpu.role_gradient_facts(missing, sample, order)
        features["terrain_water"].grad.zero_()
        with self.assertRaisesRegex(ValueError, "gradient is zero"):
            gpu.role_gradient_facts(features, sample, order)
        features["terrain_water"].grad.fill_(1)
        features["terrain_water"].grad[0, 0, 20, 20] = float("nan")
        with self.assertRaisesRegex(ValueError, "missing/nonfinite"):
            gpu.role_gradient_facts(features, sample, order)

    def test_loss_review_and_foundation_cannot_change_after_cpu_acceptance(self):
        for field in ("lossContract", "reviewThresholdContract", "foundationAssetBinding", "activationGates", "resourceBudget"):
            candidate, acceptance, args = fixture()
            candidate[field]["changedAfterCpu"] = True
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "formal CPU identity"):
                gpu.validate_gate(candidate, acceptance, **args)
        for field in ("lossContract", "reviewThresholdContract"):
            candidate, acceptance, args = fixture()
            candidate[field] = {}
            with self.assertRaisesRegex(ValueError, "bound contract file missing"):
                gpu.validate_gate(candidate, acceptance, **args)
        candidate, acceptance, args = fixture()
        candidate["foundationAssetBinding"]["failedCheckpointLoaded"] = True
        with self.assertRaisesRegex(ValueError, "fresh foundation"):
            gpu.validate_gate(candidate, acceptance, **args)
        self.assertEqual(gpu.declared_bindings({"nested": [fixture()[0]["lossContract"]]}),
                         [fixture()[0]["lossContract"]])
        with self.assertRaises(ValueError):
            gpu.declared_bindings({"path": "data/missing-sha.json"})


if __name__ == "__main__":
    unittest.main()
