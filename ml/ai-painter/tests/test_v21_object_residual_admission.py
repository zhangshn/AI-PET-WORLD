"""Synthetic V21 contract negatives; never create a contract or initialize CUDA."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import v21_object_residual_admission as gate
import accept_stage4_mvp_object_residual_v21_cpu as acceptance_program
import run_stage4_mvp_object_residual_v21_readonly_gpu_qualification as gpu

import torch


def fixture():
    baseline = json.loads((ROOT / gate.BASELINE["path"]).read_text(encoding="utf8"))
    candidate_binding = {"path": "data/ai-painter/system-governance/future-v21-not-created.json",
                         "sha256": "1" * 64}
    cpu_binding = {"path": ".runtime/ai-painter/future-v21-cpu-not-created.json",
                   "sha256": "2" * 64}
    programs = {key: {"path": path, "sha256": "3" * 64}
                for key, path in gate.PROGRAM_PATHS.items()}
    programs.update({key: deepcopy(baseline["programBindings"][key])
                     for key in gate.FROZEN_PROGRAMS})
    programs["v18ModelCore"] = deepcopy(baseline["programBindings"]["model"])
    alignments = deepcopy(baseline["trainingReviewAlignment"])
    for item in alignments[3:]:
        role = item["responsibilityId"]
        item["upstreamResponsibilityOutputIdentity"] = item["responsibilityOutputIdentity"]
        item["responsibilityOutputIdentity"] = role + "_masked_learned_rgb_residual_3x192x256"
        item["positiveAlignmentTests"] = [programs["modelTests"], baseline["programBindings"]["objectiveTests"]]
        item["negativeAlignmentTests"] = [programs["modelTests"], baseline["programBindings"]["objectiveTests"]]
    attempt = "synthetic-v21-attempt"
    candidate = {"schemaVersion": gate.SCHEMA, "capabilityVersion": gate.CAPABILITY,
                 "status": "cpu_candidate_not_execution_qualified", "cpuAcceptance": None,
                 "priorCandidate": deepcopy(gate.BASELINE),
                 "v18FrozenReference": deepcopy(gate.BASELINE),
                 "architectureEvidence": deepcopy(gate.ARCHITECTURE_EVIDENCE),
                 "preReviewRejected": deepcopy(gate.PRE_REVIEW_REJECTION),
                 "objectResidualScope": deepcopy(gate.OBJECT_RESIDUAL_SCOPE),
                 "modelPlan": {"baseChannels": 48, "patchChannels": 32, "seed": gate.SEED},
                 "foundationAssetBinding": {
                     **deepcopy(baseline["foundationAssetBinding"]),
                     "initializationSeed": gate.SEED,
                     "parentCheckpointLoaded": False},
                 "activationGates": deepcopy(baseline["activationGates"]),
                 "resourceBudget": deepcopy(baseline["resourceBudget"]),
                 "readonlyGpuQualification": {
                     "attemptId": attempt, "trainSampleId": gate.v18.TRAIN_ID,
                     "trainOrdinal": gate.v18.TRAIN_ORDINAL, "outputRoot": gate.GPU_ROOT},
                 "programBindings": programs,
                 "trainingReviewAlignment": alignments,
                 "boundedTrainingPlan": deepcopy(baseline["boundedTrainingPlan"])}
    candidate["boundedTrainingPlan"]["capabilityVersion"] = gate.CAPABILITY
    candidate["boundedTrainingPlan"]["model"]["freshInitializationSeed"] = gate.SEED
    for key in ("datasetBinding", "dryScope", "conditionContract", "lossContract",
                "reviewThresholdContract", "precisionExecutionPlan", "businessScope",
                "authorityBoundary", "positionRegularization"):
        candidate[key] = deepcopy(baseline[key])
    acceptance = {"schemaVersion": gate.CPU_SCHEMA,
                  "status": "cpu_readonly_accepted_execution_disabled",
                  "capabilityVersion": gate.CAPABILITY,
                  "candidateContractAtAcceptance": candidate_binding,
                  "implementationIdentitySha256": gate.implementation_identity(candidate),
                  "acceptanceProgram": programs["formalCpuAcceptance"],
                  "cpuTestsPassed": True, "optimizerCreated": False,
                  "optimizerSteps": 0, "weightsModified": False,
                  "gpuInitialized": False, "trainingAllowed": False,
                  "checkpointLoaded": False, "checkpointWritten": False,
                  "challengeContentRead": False, "regressionContentRead": False,
                  "initialModelStateSha256": "4" * 64,
                  "finalModelStateSha256": "4" * 64,
                  "initialCriticStateSha256": "5" * 64,
                  "finalCriticStateSha256": "5" * 64,
                  "objectHeadGradientAbsoluteSums": {role: 1.0 for role in
                      ("object_footprints", "object_tree", "object_rock", "object_vegetation")},
                  "responsibilityGradients": {role: {"maskedGradientAbsoluteSum": 1.0}
                                              for role in gate.v18.ROLES},
                  "reviewApplicability": {item["responsibilityId"]: item["reviewApplicability"]
                                          for item in alignments},
                  "objectSupport": {role: {"corePixels": 1, "visiblePixels": 1 if
                                    role == "object_footprints" else 2} for role in
                                    ("object_footprints", "object_tree", "object_rock", "object_vegetation")},
                  "supportPositiveControlsPassed": True,
                  "supportNegativeControlsPassed": True}
    return baseline, candidate, acceptance, candidate_binding, cpu_binding, attempt


class V21AdmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        assert not torch.cuda.is_initialized()

    def test_valid_synthetic_interface_has_no_cuda_action(self):
        baseline, candidate, acceptance, binding, _, attempt = fixture()
        gate.validate_candidate(candidate, baseline, attempt_id=attempt, output_root=gate.GPU_ROOT)
        gate.validate_acceptance(candidate, acceptance, candidate_binding=binding)
        self.assertFalse(torch.cuda.is_initialized())

    def test_frozen_and_new_alignment_mutations_fail(self):
        changes = (
            lambda c: c["datasetBinding"].update(trainSelectionSha256="0" * 64),
            lambda c: c.update(businessScope="unbounded"),
            lambda c: c["authorityBoundary"].update(trainingAllowed=True),
            lambda c: c["positionRegularization"].update(priorCheckpointLoaded=True),
            lambda c: c["priorCandidate"].update(sha256="0" * 64),
            lambda c: c["conditionContract"].update(sha256="0" * 64),
            lambda c: c["lossContract"].update(spatialWeight=0),
            lambda c: c["reviewThresholdContract"].update(formalStage0ActivationInherited=True),
            lambda c: c["precisionExecutionPlan"].update(generatorAutocast="float16"),
            lambda c: c["boundedTrainingPlan"]["checkpointSelection"].update(validationSamples=4),
            lambda c: c["modelPlan"].update(seed=20260928),
            lambda c: c["foundationAssetBinding"].update(failedCheckpointLoaded=True),
            lambda c: c["activationGates"].update(trainingAllowed=True),
            lambda c: c["trainingReviewAlignment"][3].update(
                responsibilityOutputIdentity="object_footprints_learned_feature_8x192x256"),
            lambda c: c["trainingReviewAlignment"][4].update(
                upstreamResponsibilityOutputIdentity="fabricated"),
            lambda c: c["trainingReviewAlignment"][5].update(negativeAlignmentTests=[]),
            lambda c: c["objectResidualScope"]["object_tree"].update(radius=0),
            lambda c: c["objectResidualScope"].update(crossClassRingOverlap="allowed"),
            lambda c: c["architectureEvidence"].update(sha256="0" * 64),
            lambda c: c["preReviewRejected"].update(sha256="0" * 64),
            lambda c: c["programBindings"]["model"].update(path="ml/ai-painter/other.py"),
            lambda c: c["programBindings"]["v18ModelCore"].update(sha256="0" * 64),
        )
        for change in changes:
            baseline, candidate, _, _, _, attempt = fixture()
            change(candidate)
            with self.subTest(change=change), self.assertRaises(ValueError):
                gate.validate_candidate(candidate, baseline, attempt_id=attempt,
                                        output_root=gate.GPU_ROOT)

    def test_budget_and_subject_mutations_fail(self):
        for key, value in (("sampleCount", 2), ("optimizerSteps", 1),
                           ("automaticRetries", 1), ("checkpointWrites", 1),
                           ("maxWallSeconds", 121), ("cpuThreads", 3),
                           ("maxGpuMemoryFraction", .7001)):
            baseline, candidate, _, _, _, attempt = fixture()
            candidate["resourceBudget"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                gate.validate_candidate(candidate, baseline, attempt_id=attempt,
                                        output_root=gate.GPU_ROOT)
        baseline, candidate, _, _, _, attempt = fixture()
        candidate["readonlyGpuQualification"]["trainOrdinal"] = 0
        with self.assertRaisesRegex(ValueError, "fixed train"):
            gate.validate_candidate(candidate, baseline, attempt_id=attempt,
                                    output_root=gate.GPU_ROOT)

    def test_cpu_acceptance_mutations_fail_before_gpu(self):
        for key, value in (("cpuTestsPassed", False), ("optimizerSteps", 1),
                           ("checkpointLoaded", True), ("gpuInitialized", True),
                           ("supportNegativeControlsPassed", False),
                           ("finalModelStateSha256", "0" * 64),
                           ("implementationIdentitySha256", "0" * 64)):
            _, candidate, acceptance, binding, _, _ = fixture()
            acceptance[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                gate.validate_acceptance(candidate, acceptance, candidate_binding=binding)
        _, candidate, acceptance, binding, _, _ = fixture()
        acceptance["objectHeadGradientAbsoluteSums"]["object_tree"] = 0
        with self.assertRaisesRegex(ValueError, "head gradients"):
            gate.validate_acceptance(candidate, acceptance, candidate_binding=binding)

    def test_missing_contract_fails_before_cpu_tests_or_cuda(self):
        with patch.object(acceptance_program, "_run_tests") as tests, \
             patch.object(gpu, "run_cuda") as cuda:
            with self.assertRaises((FileNotFoundError, ValueError)):
                acceptance_program.run_cpu(
                    {"path": "data/ai-painter/system-governance/future-v21-not-created.json",
                     "sha256": "1" * 64}, attempt_id="synthetic-v21-attempt",
                    output_root=gate.GPU_ROOT)
            tests.assert_not_called()
            cuda.assert_not_called()
        self.assertFalse(torch.cuda.is_initialized())

    def test_replay_and_namespace_escape_fail_without_writes(self):
        with patch.object(Path, "mkdir", side_effect=FileExistsError), \
             patch.object(gate.v18, "write_json") as writer:
            with self.assertRaisesRegex(ValueError, "already consumed"):
                gpu.claim_attempt({"attemptId": "synthetic-v21-attempt",
                                   "outputRoot": gate.GPU_ROOT})
            writer.assert_not_called()
        with self.assertRaisesRegex(ValueError, "namespace"):
            gpu.attempt_directory("synthetic-v21-attempt", ".runtime/other")

    def test_head_gradients_and_vram_negative_controls_are_cpu_only(self):
        model = torch.nn.Module()
        model.object_rgb_heads = torch.nn.ModuleDict({role: torch.nn.Linear(1, 1) for role in
            ("object_footprints", "object_tree", "object_rock", "object_vegetation")})
        with self.assertRaisesRegex(ValueError, "gradient missing"):
            gpu._head_gradients(model)
        for parameter in model.parameters():
            parameter.grad = torch.ones_like(parameter)
        self.assertEqual(len(gpu._head_gradients(model)), 4)
        for parameter in model.object_rgb_heads["object_tree"].parameters():
            parameter.grad.zero_()
        with self.assertRaisesRegex(ValueError, "gradient zero"):
            gpu._head_gradients(model)
        for key in ("reserved", "allocated", "device_used"):
            measurement = {"total": 1000, "reserved": 700,
                           "allocated": 600, "device_used": 700, "fraction": .7}
            measurement[key] = 701
            with self.assertRaises(ValueError):
                gate.v18.check_memory(**measurement)
        self.assertFalse(torch.cuda.is_initialized())

    def test_support_reconstruction_rejects_cross_class_ring_and_leak(self):
        dimensions = (1, 1, 192, 256)
        cores = {role: torch.zeros(dimensions, dtype=torch.bool) for role in
                 ("object_footprints", "object_tree", "object_rock", "object_vegetation")}
        cores["object_footprints"][:, :, 10, 10] = True
        cores["object_tree"][:, :, 20, 20] = True
        cores["object_rock"][:, :, 30, 30] = True
        cores["object_vegetation"][:, :, 40, 40] = True
        coverages = {role: mask.clone() for role, mask in cores.items() if role != "object_footprints"}
        for role, y in (("object_tree", 20), ("object_rock", 30), ("object_vegetation", 40)):
            coverages[role][:, :, y, 21] = True
        object_coverage = cores["object_footprints"].clone()
        for mask in coverages.values():
            object_coverage |= mask
        evidence = {"responsibilityConditions": cores, "roleCoverage": coverages,
                    "objectCoverage": object_coverage,
                    "visibleObjectSupportMasks": {
                        role: (cores[role] if role == "object_footprints" else coverages[role]).clone()
                        for role in cores},
                    "maskedObjectRgbResiduals": {
                        role: torch.zeros((1, 3, 192, 256)) for role in cores}}
        self.assertEqual(set(gate.validate_object_support(evidence)), set(cores))
        corrupted = deepcopy(evidence)
        corrupted["visibleObjectSupportMasks"]["object_tree"][:, :, 20, 21] = False
        with self.assertRaisesRegex(ValueError, "support differs"):
            gate.validate_object_support(corrupted)
        corrupted = deepcopy(evidence)
        corrupted["maskedObjectRgbResiduals"]["object_tree"][:, :, 0, 0] = 1
        with self.assertRaisesRegex(ValueError, "support differs"):
            gate.validate_object_support(corrupted)
        self.assertFalse(torch.cuda.is_initialized())

    def test_real_v21_forward_support_matches_gate_reconstruction(self):
        from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
            build_native_rgb_object_residual_v21_cpu)
        from test_native_rgb_object_residual_v21_cpu import ORDER, scene
        conditions, table = scene()
        model = build_native_rgb_object_residual_v21_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()
        with torch.no_grad():
            _, evidence = model(conditions, table, return_evidence=True)
            support = gate.validate_object_support(evidence)
        self.assertEqual(set(support), set(gate.OBJECT_RESIDUAL_SCOPE) - {
            "typedCoreOverride", "crossClassRingOverlap", "outsideBoundObjectCoverage"})
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
