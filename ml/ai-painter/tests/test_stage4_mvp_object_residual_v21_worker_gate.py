"""V21 worker admission controls; no optimizer or GPU is started."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import train_stage4_mvp_object_residual_v21_dry_stage0 as worker


def fixture():
    run_id = "test-v21-run-0001"
    output = worker.OUTPUT_PREFIX + run_id
    fake = lambda path: {"path": path, "sha256": "1" * 64}
    programs = {role: fake(path) for role, path in {
        "worker": worker.WORKER_PATH, "workerTests": worker.TEST_PATH,
        "supervisor": worker.SUPERVISOR_PATH}.items()}
    common = {
        "runId": run_id, "packageId": "test-v21-package-0001",
        "batchRunId": "test-v21-batch-0001", "capabilityVersion": worker.CAPABILITY,
        "candidateContract": deepcopy(worker.CANDIDATE),
        "cpuQualification": deepcopy(worker.CPU_REPORT),
        "gpuQualification": deepcopy(worker.GPU_REPORT),
        "datasetManifest": deepcopy(worker.cpu.MANIFEST), "dryScope": deepcopy(worker.gpu.SCOPE),
        "modelPlan": deepcopy(worker.MODEL_PLAN),
        "precisionExecutionPlan": deepcopy(worker.PRECISION_PLAN),
        "stage": deepcopy(worker.STAGE), "resourceBudget": deepcopy(worker.BUDGET),
        "optimizerPlan": deepcopy(worker.OPTIMIZER_PLAN), "programBindings": programs,
        "ticketConsumptionRequired": True, "permittedSplits": ["train", "validation"],
        "forbiddenSplits": ["challenge", "regression"], "outputRoot": output,
        "outputTerminalPath": output + "/phase-terminal.json",
        "formalStage0QualificationAllowed": False, "runtimePublicationAllowed": False,
    }
    ticket_binding = fake(output + "/training-ticket.json")
    package = {**common, "schemaVersion": worker.PACKAGE_SCHEMA,
               "trainingExecutionTicket": ticket_binding}
    ticket = {**common, "schemaVersion": worker.TICKET_SCHEMA,
              "status": "issued_single_use", "ticketId": "test-v21-ticket-0001",
              "registryBeforeStart": {"registryRevision": 1,
                  "registrySha256": "2" * 64, "activeExecution": None}}
    return package, ticket


class V21WorkerAdmissionTests(unittest.TestCase):
    def test_exact_bounded_package_and_ticket(self):
        package, ticket = fixture()
        worker.validate_package(package, ticket)

    def test_ticket_mirror_and_retry_rejected(self):
        package, ticket = fixture()
        for field, value in (("resourceBudget", {**worker.BUDGET, "maxEpochs": 25}),
                             ("permittedSplits", ["train", "validation", "challenge"]),
                             ("modelPlan", {**worker.MODEL_PLAN, "seed": 20260927}),
                             ("cpuQualification", {**worker.CPU_REPORT, "sha256": "0" * 64})):
            changed = deepcopy(package); changed[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                worker.validate_package(changed, ticket)
        ticket["status"] = "consumed"
        with self.assertRaises(ValueError):
            worker.validate_package(package, ticket)

    def test_gpu_report_must_be_fixed_attempt(self):
        package, ticket = fixture()
        package["gpuQualification"]["path"] = worker.GPU_ROOT + "/other/report.json"
        ticket["gpuQualification"] = deepcopy(package["gpuQualification"])
        with self.assertRaisesRegex(ValueError, "gpuQualification"):
            worker.validate_package(package, ticket)

    def test_registry_must_be_idle(self):
        with self.assertRaisesRegex(ValueError, "inactive baseline"):
            worker.validate_idle_registry({"schemaVersion": "ai-painter-current-execution-registry-v1",
                "activeExecution": {"runId": "other"}, "executionState": "executing", "registryRevision": 1})

    def test_real_frozen_reports_and_cpu_preflight(self):
        candidate = json.loads((ROOT / worker.CANDIDATE["path"]).read_text(encoding="utf8"))
        acceptance = json.loads((ROOT / worker.CPU_REPORT["path"]).read_text(encoding="utf8"))
        report = json.loads((ROOT / worker.GPU_REPORT["path"]).read_text(encoding="utf8"))
        worker.validate_gpu_report(report, candidate, acceptance, {
            "candidateContract": worker.CANDIDATE,
            "cpuQualification": worker.CPU_REPORT})
        preflight = worker.preflight_evidence()
        self.assertEqual(preflight["status"], "cpu_preflight_passed_training_not_started")
        self.assertFalse(preflight["sampleTensorsDecoded"])
        self.assertFalse(preflight["ticketIssued"])

    def test_forged_gpu_head_or_resource_evidence_fails(self):
        candidate = json.loads((ROOT / worker.CANDIDATE["path"]).read_text(encoding="utf8"))
        acceptance = json.loads((ROOT / worker.CPU_REPORT["path"]).read_text(encoding="utf8"))
        report = json.loads((ROOT / worker.GPU_REPORT["path"]).read_text(encoding="utf8"))
        package = {"candidateContract": worker.CANDIDATE, "cpuQualification": worker.CPU_REPORT}
        for change in (
            lambda value: value["objectHeadGradientAbsoluteSums"].update(object_tree=0),
            lambda value: value["objectSupport"]["object_tree"].update(visiblePixels=1),
            lambda value: value["memoryMeasurements"][0].update(peakReservedBytes=10**12),
            lambda value: value.update(trainingAllowedByThisArtifact=True),
        ):
            altered = deepcopy(report)
            change(altered)
            with self.subTest(change=change), self.assertRaises(ValueError):
                worker.validate_gpu_report(altered, candidate, acceptance, package)

    def test_negative_adversarial_loss_is_preserved_outside_console_projection(self):
        self.assertEqual(worker.display_loss_for_telemetry(0.25), 0.25)
        self.assertIsNone(worker.display_loss_for_telemetry(-0.25))
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            worker.display_loss_for_telemetry(float("nan"))

    def test_validation_and_held_out_samples_cannot_update_optimizer(self):
        for split in ("validation", "challenge", "regression"):
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "optimizer update prohibited"):
                worker.update_network(None, None, None, {"split": split},
                                      "generator", {"generator": 0}, 1152, lambda: None)

    def test_train_sample_cannot_enter_validation_selector(self):
        model = torch.nn.Linear(1, 1)
        with self.assertRaisesRegex(ValueError, "selection may read validation only"):
            worker.validate_samples(model, [{"split": "train"}], [], lambda: None, 8)


if __name__ == "__main__":
    unittest.main()
