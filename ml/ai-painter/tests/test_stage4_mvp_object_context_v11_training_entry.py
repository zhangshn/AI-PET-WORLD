"""No optimizer may start from qualifications without an active V11 ticket."""

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import train_stage4_mvp_native_rgb_object_context_renderer_v11_stage0 as worker


ROOT = Path(__file__).resolve().parents[3]


class V11TrainingEntryTests(unittest.TestCase):
    def _package(self):
        contract, _ = worker.load_contract(ROOT)
        return {
            "schemaVersion": worker.PACKAGE_SCHEMA,
            "capabilityVersion": worker.CAPABILITY_VERSION,
            "stage": worker.STAGE,
            "datasetManifest": {key: contract["datasetBinding"][key]
                                for key in ("path", "sha256")},
            "ticketConsumptionRequired": True,
            "permittedSplits": ["train", "validation"],
            "forbiddenSplits": ["challenge", "regression"],
            "resourceBudget": {"maxEpochs": 24, "maxOptimizerSteps": 1152,
                               "maxGpuMemoryFraction": 0.7},
            "cpuQualification": {"path": "cpu"},
            "gpuQualification": {"path": "gpu"},
            "formalInitializationSha256": "hash",
            "programBindings": [],
            "runId": "unregistered-v11-run",
            "packageId": "unregistered-v11-package",
        }

    def test_nonregistered_qualification_cannot_start_training(self):
        package = self._package()
        contract, _ = worker.load_contract(ROOT)
        cpu = {"status": "cpu_contract_passed_training_still_disabled",
               "capabilityVersion": worker.CAPABILITY_VERSION,
               "dataset": contract["datasetBinding"], "trainingStarted": False}
        gpu = {"status": "readonly_gpu_qualification_passed",
               "capabilityVersion": worker.CAPABILITY_VERSION,
               "cpuQualification": package["cpuQualification"],
               "datasetManifest": package["datasetManifest"],
               "optimizerSteps": 0, "weightsModified": False,
               "trainingStarted": False, "formalInitializationSha256": "hash"}
        with patch.object(worker, "bound_json", side_effect=[package, cpu, gpu]):
            with self.assertRaisesRegex(ValueError, "not the registered active task"):
                worker.authenticate({"path": "synthetic"})

    def test_crop_schedule_is_rejected_before_qualification_reads(self):
        package = self._package()
        package["resourceBudget"]["maxOptimizerSteps"] = 2304
        with patch.object(worker, "bound_json", return_value=package):
            with self.assertRaisesRegex(ValueError, "resource budget"):
                worker.authenticate({"path": "synthetic"})

    def test_exact_active_ticket_reaches_bounded_worker_preflight(self):
        package = self._package()
        contract, _ = worker.load_contract(ROOT)
        cpu = {"status": "cpu_contract_passed_training_still_disabled",
               "capabilityVersion": worker.CAPABILITY_VERSION,
               "dataset": contract["datasetBinding"], "trainingStarted": False}
        gpu = {"status": "readonly_gpu_qualification_passed",
               "capabilityVersion": worker.CAPABILITY_VERSION,
               "cpuQualification": package["cpuQualification"],
               "datasetManifest": package["datasetManifest"],
               "optimizerSteps": 0, "weightsModified": False,
               "trainingStarted": False, "formalInitializationSha256": "hash"}
        registry = {"executionState": "executing", "activeExecution": {
            "runId": package["runId"], "packageId": package["packageId"],
            "capabilityVersion": worker.CAPABILITY_VERSION,
        }}
        with patch.object(worker, "bound_json", side_effect=[package, cpu, gpu]), \
                patch.object(worker, "read_json", return_value=registry):
            received, _, _ = worker.authenticate({"path": "synthetic"})
        self.assertEqual(received["resourceBudget"]["maxOptimizerSteps"], 1152)


if __name__ == "__main__":
    unittest.main()
