"""CPU-only negative gates for the controller-compatible V16 worker."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_bf16_v16_stage0.py"
spec = importlib.util.spec_from_file_location("v16_worker_gate", SCRIPT)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
MATERIALIZER = ROOT / "ml/ai-painter/scripts/materialize_stage4_mvp_conditional_texture_bf16_v16_review_candidates.py"
materializer_spec = importlib.util.spec_from_file_location("v16_materializer_gate", MATERIALIZER)
materializer = importlib.util.module_from_spec(materializer_spec)
materializer_spec.loader.exec_module(materializer)


class WorkerGateTest(unittest.TestCase):
    def setUp(self):
        self.contract_binding = worker.bind(worker.CONTRACT_PATH)
        self.contract = worker.bound_json(worker.ROOT, self.contract_binding)
        self.package_binding = {"path": "fake/execution-package.json", "sha256": "a" * 64}
        self.cpu_binding = {"path": ".runtime/ai-painter/"
                            "stage4-mvp-conditional-texture-bf16-v16-cpu-acceptances/fake.json",
                            "sha256": "b" * 64}
        self.gpu_binding = {"path": ".runtime/ai-painter/"
                            "stage4-mvp-conditional-texture-bf16-v16-gpu-qualifications/fake.json",
                            "sha256": "c" * 64}
        self.review_binding = {"path": "fake/review.json", "sha256": "d" * 64}
        self.package = {
            "schemaVersion": worker.PACKAGE_SCHEMA,
            "batchRunId": "fake-batch", "runId": "fake-run",
            "packageId": "fake-package", "capabilityVersion": worker.CAPABILITY,
            "stage": worker.STAGE, "candidateContract": self.contract_binding,
            "reviewContract": self.review_binding,
            "datasetManifest": self.contract["datasetBinding"]["manifest"],
            "cpuQualification": self.cpu_binding, "gpuQualification": self.gpu_binding,
            "formalInitializationSha256": "e" * 64,
            "formalDiscriminatorInitializationSha256": "f" * 64,
            "precisionExecutionPlan": worker.PRECISION_PLAN,
            "resourceBudget": worker.BUDGET,
            "programBindings": [worker.bind(worker.WORKER_PATH)],
            "permittedSplits": ["train", "validation"],
            "forbiddenSplits": ["challenge", "regression"],
            "ticketConsumptionRequired": True,
            "outputRoot": worker.OUTPUT_PREFIX + "fake-batch/stages/fake-run",
        }
        self.package["outputTerminalPath"] = self.package["outputRoot"] + "/phase-terminal.json"

    def test_candidate_without_execution_package_evidence_stops_before_cuda_optimizer(self):
        values = {self.package_binding["path"]: self.package,
                  self.contract_binding["path"]: self.contract}
        with patch.object(worker, "bound_json", side_effect=lambda _root, item:
                          values[item["path"]]), \
             patch.object(worker.torch.optim, "AdamW", side_effect=AssertionError("optimizer touched")), \
             patch.object(worker.torch.cuda, "is_available", side_effect=AssertionError("CUDA touched")):
            with self.assertRaises((ValueError, KeyError, FileNotFoundError)):
                worker.run(self.package_binding)

    def test_worker_program_and_candidate_hash_fail_closed(self):
        bad = deepcopy(self.package)
        bad["programBindings"] = []
        with self.assertRaisesRegex(ValueError, "program bindings missing"):
            worker._program_bindings(bad, self.contract)
        bad["programBindings"] = [{"path": worker.WORKER_PATH,
                                   "sha256": "0" * 64}]
        with self.assertRaisesRegex(ValueError, "program bytes changed"):
            worker._program_bindings(bad, self.contract)

    def test_cpu_gpu_reports_cannot_forge_steps_or_initialization(self):
        initial_model, initial_critic = "e" * 64, "f" * 64
        shared = {"capabilityVersion": worker.CAPABILITY,
                  "precisionExecutionPlan": worker.PRECISION_PLAN,
                  "candidateContract": self.contract_binding,
                  "datasetManifest": self.package["datasetManifest"],
                  "optimizerSteps": 0, "trainingStarted": False,
                  "initialModelStateSha256": initial_model,
                  "initialDiscriminatorStateSha256": initial_critic}
        cpu = {**shared, "schemaVersion":
               "stage4-mvp-conditional-texture-bf16-v16-formal-cpu-acceptance-v1",
               "status": worker.CPU_STATUS,
               "formalReviewContract": self.review_binding,
               "acceptanceProgram": {"path": worker.CPU_QUALIFIER_PATH, "sha256": "1" * 64},
               "acceptanceTests": self.contract["programBindings"]["objectiveTests"],
               "alignmentRoles": ["road", "hydrology", "shoreline", "footprints",
                                  "tree", "rock", "vegetation"],
               "formulaSha256": self.contract["lossContract"]["formulaSha256"],
               "trainSelectionSha256": self.contract["datasetBinding"]["trainSelectionSha256"],
               "validationSelectionSha256":
               self.contract["datasetBinding"]["validationSelectionSha256"],
               "independentAcceptance": True, "formalReviewAlignmentPassed": True,
               "cpuTestsPassed": True, "validationContentRead": False,
               "gpuUsed": False}
        gpu = {**shared, "schemaVersion":
               "stage4-mvp-conditional-texture-bf16-v16-readonly-gpu-report-v1",
               "status": worker.GPU_STATUS, "cpuQualification": self.cpu_binding,
               "weightsModified": False, "trainingAllowedByThisArtifact": False,
               "optimizerCreated": False, "checkpointWritten": False,
               "validationRead": False, "challengeRead": False, "regressionRead": False,
               "sampleIdentity": {"sampleId": "fake-train", "split": "train"},
               "peakGpuReservedFraction": 0.5,
               "finalModelStateSha256": initial_model,
               "finalDiscriminatorStateSha256": initial_critic,
               "policy": {"path": worker.GPU_POLICY_PATH, "sha256": "2" * 64}}
        policy = {"candidateContract": self.contract_binding,
                  "precisionExecutionPlan": worker.PRECISION_PLAN,
                  "cpuQualification": self.cpu_binding,
                  "datasetManifest": self.package["datasetManifest"],
                  "program": {"path": worker.GPU_QUALIFIER_PATH, "sha256": "3" * 64},
                  "execution": {"trainingAllowed": False}}
        values = {self.cpu_binding["path"]: cpu,
                  self.gpu_binding["path"]: gpu,
                  worker.GPU_POLICY_PATH: policy}
        bindings = {worker.CPU_QUALIFIER_PATH: cpu["acceptanceProgram"],
                    worker.GPU_QUALIFIER_PATH: policy["program"]}
        def check():
            with patch.object(worker, "bound_json", side_effect=lambda _root, item:
                              values[item["path"]]), \
                 patch.object(worker, "bind", side_effect=lambda path: bindings[path]):
                return worker._qualification(self.package, self.contract,
                                             self.contract_binding)
        self.assertEqual(check()["initialModelStateSha256"], initial_model)
        values[self.gpu_binding["path"]] = {**gpu, "optimizerSteps": 1}
        with self.assertRaisesRegex(ValueError, "qualification invalid"):
            check()
        values[self.gpu_binding["path"]] = {**gpu,
            "initialDiscriminatorStateSha256": "0" * 64}
        with self.assertRaisesRegex(ValueError, "qualification invalid"):
            check()
        values[self.gpu_binding["path"]] = {
            **gpu, "precisionExecutionPlan": {
                **worker.PRECISION_PLAN, "gradientScaler": "enabled",
            },
        }
        with self.assertRaisesRegex(ValueError, "qualification invalid"):
            check()

    def test_expired_active_heartbeat_rejected(self):
        output = self.package["outputRoot"]
        active = {"capabilityVersion": worker.CAPABILITY,
                  "packageId": self.package["packageId"], "runId": self.package["runId"],
                  "processId": 123, "processStartIdentity": "123:2026-09-27T00:00:00Z",
                  "lock": {"path": output + "/execution-lock.json", "sha256": "4" * 64},
                  "heartbeat": {"path": output + "/heartbeat.json", "ttlSeconds": 120}}
        identity = {key: active[key] for key in
                    ("capabilityVersion", "packageId", "runId",
                     "processId", "processStartIdentity")}
        lock = {"schemaVersion": "ai-painter-current-active-execution-lock-v1", **identity}
        heartbeat = {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1",
                     **identity, "executionState": "executing", "ttlSeconds": 120,
                     "heartbeatAtUtc": (datetime.now(timezone.utc) -
                                        timedelta(minutes=3)).isoformat()}
        file = SimpleNamespace(read_text=lambda encoding: json.dumps(heartbeat))
        with patch.object(worker, "bound_json", return_value=lock), \
             patch.object(worker, "project_file", return_value=file):
            with self.assertRaisesRegex(ValueError, "heartbeat expired"):
                worker._active_lock_and_heartbeat(active, self.package)

    def test_forbidden_split_loader_and_package_budget_rejected(self):
        with self.assertRaisesRegex(ValueError, "forbidden split decode"):
            worker._load_bound_split(self.contract, {}, "challenge")
        aligned = deepcopy(self.contract)
        aligned["activationGates"] = {
            "cpuReadOnlyNow": True, "gpuReadOnlyNow": True,
            "gpuNow": False, "optimizerNow": False, "trainingNow": False,
            "formalReviewNow": False, "runtimeFrameNow": False,
        }
        aligned["reviewBinding"]["formalContract"] = self.review_binding
        manifest = worker.bound_json(worker.ROOT, aligned["datasetBinding"]["manifest"])
        values = {self.package_binding["path"]: self.package,
                  self.contract_binding["path"]: aligned,
                  self.package["datasetManifest"]["path"]: manifest}

        def check(package):
            values[self.package_binding["path"]] = package
            with patch.object(worker, "bound_json", side_effect=lambda _root, item:
                              values[item["path"]]), \
                 patch.object(worker, "_review_alignment"), \
                 patch.object(worker, "_qualification", return_value={}), \
                 patch.object(worker, "_program_bindings"), \
                 patch.object(worker, "read_bound", return_value=b""):
                worker.authenticate(self.package_binding)

        wrong = deepcopy(self.package)
        wrong["permittedSplits"] = ["train", "challenge"]
        with self.assertRaisesRegex(ValueError, "package identity or bounds invalid"):
            check(wrong)
        wrong = deepcopy(self.package)
        wrong["resourceBudget"]["maxGeneratorSteps"] += 1
        with self.assertRaisesRegex(ValueError, "package identity or bounds invalid"):
            check(wrong)
        with self.assertRaisesRegex(ValueError, "not the registered active execution"):
            check(self.package)

    def test_bf16_precision_plan_and_no_scaler_are_fixed(self):
        self.assertEqual(worker.PRECISION_PLAN, {
            "generatorAutocast": "bfloat16", "discriminatorAutocast": "bfloat16",
            "gradientScaler": "disabled",
            "nonfiniteGradient": "fail_closed_with_network_parameter_sample_and_step",
            "optimizerUpdateSkipAllowed": False, "optimizer": "AdamW",
            "generatorLearningRate": 0.0001,
            "discriminatorLearningRate": 0.0001,
        })
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("GradScaler(", source)
        self.assertNotIn("dtype=torch.float16", source)
        self.assertGreaterEqual(source.count("dtype=torch.bfloat16"), 4)
        self.assertEqual(worker.STAGE["epochCount"], 24)
        self.assertEqual(worker.BUDGET["maxGeneratorSteps"], 1152)
        self.assertEqual(worker.BUDGET["maxDiscriminatorSteps"], 1152)
        self.assertEqual(worker.BUDGET["maxGpuMemoryFraction"], 0.7)

    def test_bf16_unscaled_step_updates_once_without_grad_scaler(self):
        network = torch.nn.Linear(1, 1, bias=False)
        optimizer = torch.optim.AdamW(network.parameters(), lr=0.0001)
        before = network.weight.detach().clone()
        with patch.object(worker.torch.amp, "GradScaler",
                          side_effect=AssertionError("GradScaler must not be used")):
            with torch.autocast("cpu", dtype=torch.bfloat16):
                loss = network(torch.ones(1, 1)).float().square().mean()
            worker._step(optimizer, loss, network, "generator", "train-001", 1)
        self.assertFalse(torch.equal(before, network.weight.detach()))
        self.assertEqual(len(optimizer.state), 1)
        self.assertEqual(int(optimizer.state[network.weight]["step"]), 1)

    def test_nonfinite_gradient_fails_with_exact_context_and_no_update(self):
        network = torch.nn.Linear(1, 1, bias=False)
        network.weight.register_hook(
            lambda gradient: torch.full_like(gradient, float("inf"))
        )
        optimizer = torch.optim.AdamW(network.parameters(), lr=0.0001)
        before = network.weight.detach().clone()
        loss = network(torch.ones(1, 1)).sum()
        with self.assertRaises(worker.TrainingNumericsError) as caught:
            worker._step(optimizer, loss, network, "discriminator", "train-017", 96)
        self.assertEqual(caught.exception.detail, {
            "network": "discriminator", "parameter": "weight",
            "sampleId": "train-017", "attemptedStep": 96,
            "scale": 1.0, "kind": "nonfinite_gradient",
        })
        self.assertTrue(torch.equal(before, network.weight.detach()))
        self.assertEqual(len(optimizer.state), 0)

    def test_nonfinite_loss_fails_before_backward_or_update(self):
        network = torch.nn.Linear(1, 1, bias=False)
        optimizer = torch.optim.AdamW(network.parameters(), lr=0.0001)
        before = network.weight.detach().clone()
        loss = network(torch.ones(1, 1)).sum() * float("nan")
        with self.assertRaises(worker.TrainingNumericsError) as caught:
            worker._step(optimizer, loss, network, "generator", "train-002", 3)
        self.assertEqual(caught.exception.detail["parameter"], "<loss>")
        self.assertEqual(caught.exception.detail["attemptedStep"], 3)
        self.assertTrue(torch.equal(before, network.weight.detach()))
        self.assertIsNone(network.weight.grad)
        self.assertEqual(len(optimizer.state), 0)

    def test_no_gradient_fails_without_hidden_skip(self):
        network = torch.nn.Linear(1, 1, bias=False)
        optimizer = torch.optim.AdamW(network.parameters(), lr=0.0001)
        loss = network(torch.ones(1, 1)).detach().requires_grad_()
        with self.assertRaises(worker.TrainingNumericsError) as caught:
            worker._step(optimizer, loss, network, "generator", "train-003", 4)
        self.assertEqual(caught.exception.detail["kind"], "missing_gradient")
        self.assertEqual(len(optimizer.state), 0)

    def test_failure_context_keeps_parameter_and_attempted_step(self):
        attempted = {"network": "discriminator", "parameter": "<forward_or_loss>",
                     "sampleId": "train-017", "attemptedStep": 96,
                     "scale": 1.0, "epoch": 2}
        error = worker.TrainingNumericsError(
            network="discriminator", parameter="layers.0.weight",
            sample_id="train-017", attempted_step=96,
            kind="nonfinite_gradient",
        )
        context = worker.failure_context(error, attempted)
        self.assertEqual(context["parameter"], "layers.0.weight")
        self.assertEqual(context["sampleId"], "train-017")
        self.assertEqual(context["attemptedStep"], 96)
        self.assertEqual(context["scale"], 1.0)

    def test_materializer_rejects_wrong_precision_before_cuda(self):
        self.assertIn(
            '"ai-painter-stage4-mvp-conditional-texture-bf16-v16-stage0-review-candidate-pack-v1"',
            MATERIALIZER.read_text(encoding="utf-8"),
        )
        package = deepcopy(self.package)
        package["precisionExecutionPlan"] = {
            **worker.PRECISION_PLAN, "generatorAutocast": "float16",
        }
        terminal = {}
        with patch.object(materializer, "bound_json", side_effect=[package, terminal]), \
             patch.object(materializer.torch.cuda, "is_available",
                          side_effect=AssertionError("CUDA touched")):
            with self.assertRaisesRegex(ValueError, "package split or review boundary invalid"):
                materializer.materialize(self.package_binding,
                                         {"path": "fake/terminal.json", "sha256": "0" * 64},
                                         package["outputRoot"] + "/review-candidates")


if __name__ == "__main__":
    unittest.main()
