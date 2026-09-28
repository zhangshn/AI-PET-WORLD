"""CPU-only negative gates for the controller-compatible V15 worker."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_v15_stage0.py"
spec = importlib.util.spec_from_file_location("v15_worker_gate", SCRIPT)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerGateTest(unittest.TestCase):
    def setUp(self):
        self.contract_binding = worker.bind(worker.CONTRACT_PATH)
        self.contract = worker.bound_json(worker.ROOT, self.contract_binding)
        self.package_binding = {"path": "fake/execution-package.json", "sha256": "a" * 64}
        self.cpu_binding = {"path": ".runtime/ai-painter/"
                            "stage4-mvp-conditional-texture-v15-cpu-acceptances/fake.json",
                            "sha256": "b" * 64}
        self.gpu_binding = {"path": ".runtime/ai-painter/"
                            "stage4-mvp-conditional-texture-v15-gpu-qualifications/fake.json",
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
                  "candidateContract": self.contract_binding,
                  "datasetManifest": self.package["datasetManifest"],
                  "optimizerSteps": 0, "trainingStarted": False,
                  "initialModelStateSha256": initial_model,
                  "initialDiscriminatorStateSha256": initial_critic}
        cpu = {**shared, "schemaVersion":
               "stage4-mvp-conditional-texture-v15-formal-cpu-acceptance-v1",
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
               "stage4-mvp-conditional-texture-v15-readonly-gpu-report-v1",
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


if __name__ == "__main__":
    unittest.main()
