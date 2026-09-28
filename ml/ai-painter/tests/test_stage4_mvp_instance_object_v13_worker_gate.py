"""Negative CPU tests for the V13 worker; never construct an optimizer or use GPU."""

from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "ml/ai-painter/scripts/train_stage4_mvp_instance_object_v13_stage0.py"
spec = importlib.util.spec_from_file_location("v13_stage0_worker_gate", SCRIPT)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
MATERIALIZER = ROOT / "ml/ai-painter/scripts/materialize_stage4_mvp_instance_object_v13_review_candidates.py"
materializer_spec = importlib.util.spec_from_file_location("v13_stage0_materializer_gate", MATERIALIZER)
materializer = importlib.util.module_from_spec(materializer_spec)
materializer_spec.loader.exec_module(materializer)
GPU_PROBE = ROOT / "ml/ai-painter/scripts/run_stage4_mvp_instance_object_v13_readonly_gpu_qualification.py"
gpu_spec = importlib.util.spec_from_file_location("v13_readonly_gpu_gate", GPU_PROBE)
gpu_probe = importlib.util.module_from_spec(gpu_spec)
gpu_spec.loader.exec_module(gpu_probe)


class V13WorkerGateTest(unittest.TestCase):
    def setUp(self):
        self.contract, _ = worker.verify_contract()
        self.candidate = worker.base.bind(worker.CONTRACT_PATH)
        self.review = worker.base.bind(worker.REVIEW_PATH)
        self.cpu_binding = {"path": "fake/cpu.json", "sha256": "a" * 64}
        self.gpu_binding = {"path": "fake/gpu.json", "sha256": "b" * 64}
        self.package_binding = {"path": "fake/package.json", "sha256": "c" * 64}
        self.cpu = {
            "status": "cpu_readonly_passed_formal_review_and_training_still_disabled",
            "capabilityVersion": worker.CAPABILITY,
            "candidateContract": self.candidate,
            "datasetManifest": self.contract["datasetBinding"]["manifest"],
            "splitObjectCoverage": {"train": {"sampleCount": 48},
                                    "validation": {"sampleCount": 8}},
            "optimizerSteps": 0, "trainingStarted": False,
            "initialModelStateSha256": "d" * 64,
        }
        self.gpu = {
            "status": "readonly_gpu_qualification_passed_training_still_disabled",
            "capabilityVersion": worker.CAPABILITY,
            "candidateContract": self.candidate,
            "cpuQualification": self.cpu_binding,
            "datasetManifest": self.contract["datasetBinding"]["manifest"],
            "optimizerSteps": 0, "weightsModified": False,
            "trainingStarted": False, "peakGpuReservedFraction": 0.5,
            "initialModelStateSha256": "d" * 64,
        }
        self.package = {
            "schemaVersion": worker.PACKAGE_SCHEMA,
            "capabilityVersion": worker.CAPABILITY,
            "stage": worker.STAGE,
            "datasetManifest": self.contract["datasetBinding"]["manifest"],
            "candidateContract": self.candidate,
            "reviewContract": self.review,
            "cpuQualification": self.cpu_binding,
            "gpuQualification": self.gpu_binding,
            "resourceBudget": worker.BUDGET,
            "permittedSplits": ["train", "validation"],
            "forbiddenSplits": ["challenge", "regression"],
            "ticketConsumptionRequired": True,
            "programBindings": [worker.base.bind(
                "ml/ai-painter/scripts/train_stage4_mvp_instance_object_v13_stage0.py")],
            "formalInitializationSha256": "d" * 64,
            "runId": "fake-v13", "packageId": "fake-v13-package",
            "outputRoot": ".runtime/ai-painter/"
                          "stage4-mvp-native-rgb-instance-object-v13-formal-executions/"
                          "fake-batch/stages/fake-v13",
        }

    def authenticate_with(self, package=None, cpu=None, gpu=None, review=None):
        values = {
            self.package_binding["path"]: package or self.package,
            self.cpu_binding["path"]: cpu or self.cpu,
            self.gpu_binding["path"]: gpu or self.gpu,
            self.review["path"]: review or worker.bound_json(worker.ROOT, self.review),
        }
        with patch.object(worker, "bound_json", side_effect=lambda _root, binding:
                          values[binding["path"]]):
            return worker.authenticate(self.package_binding)

    def test_unregistered_package_cannot_start_training(self):
        with self.assertRaisesRegex(ValueError, "not the registered active execution"):
            self.authenticate_with()

    def test_forged_gpu_or_split_evidence_fails_before_registry(self):
        gpu = deepcopy(self.gpu)
        gpu["optimizerSteps"] = 1
        with self.assertRaisesRegex(ValueError, "CPU/GPU evidence invalid"):
            self.authenticate_with(gpu=gpu)
        package = deepcopy(self.package)
        package["permittedSplits"] = ["train", "challenge"]
        with self.assertRaisesRegex(ValueError, "package identity or bounds invalid"):
            self.authenticate_with(package=package)

    def test_inactive_review_or_unbound_worker_fails(self):
        review = deepcopy(worker.bound_json(worker.ROOT, self.review))
        review["activation"]["formalReviewExecutionAllowed"] = False
        with self.assertRaisesRegex(ValueError, "formal review is unavailable"):
            self.authenticate_with(review=review)
        package = deepcopy(self.package)
        package["programBindings"] = []
        with self.assertRaisesRegex(ValueError, "worker is not bound"):
            self.authenticate_with(package=package)

    def test_materializer_rejects_wrong_output_and_incomplete_training(self):
        terminal_binding = {"path": "fake/terminal.json", "sha256": "e" * 64}
        terminal = {"schemaVersion": worker.TERMINAL_SCHEMA,
                    "status": "failed_closed", "executionState": "failed_closed"}
        values = {self.package_binding["path"]: self.package,
                  terminal_binding["path"]: terminal}
        with patch.object(materializer, "bound_json", side_effect=lambda _root, binding:
                          values[binding["path"]]):
            with self.assertRaisesRegex(ValueError, "not bound to one Stage0"):
                materializer.materialize(self.package_binding, terminal_binding,
                                         ".runtime/ai-painter/other/review-candidates")
            with self.assertRaisesRegex(ValueError, "training terminal is not qualified"):
                materializer.materialize(self.package_binding, terminal_binding,
                                         self.package["outputRoot"] + "/review-candidates")

    def test_readonly_gpu_policy_rejects_training_permission_and_wrong_cpu(self):
        policy = gpu_probe.bound_json(gpu_probe.ROOT,
                                      gpu_probe.bind(gpu_probe.POLICY_PATH))
        original = gpu_probe.bound_json
        for change in (
            lambda value: value["execution"].update({"trainingAllowed": True}),
            lambda value: value["cpuQualification"].update({"sha256": "0" * 64}),
        ):
            altered = deepcopy(policy)
            change(altered)
            with patch.object(gpu_probe, "bound_json", side_effect=lambda root, binding: (
                altered if binding["path"] == gpu_probe.POLICY_PATH
                else original(root, binding)
            )):
                with self.assertRaises((ValueError, AssertionError)):
                    gpu_probe.run()


if __name__ == "__main__":
    unittest.main()
