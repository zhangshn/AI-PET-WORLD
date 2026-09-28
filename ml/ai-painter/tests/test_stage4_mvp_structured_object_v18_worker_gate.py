"""V18 worker admission controls; no optimizer or GPU is started."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import train_stage4_mvp_structured_object_v18_dry_stage0 as worker


def fixture():
    run_id = "test-v18-run-0001"
    output = worker.OUTPUT_PREFIX + run_id
    fake = lambda path: {"path": path, "sha256": "1" * 64}
    programs = {role: fake(path) for role, path in {
        "worker": worker.WORKER_PATH, "workerTests": worker.TEST_PATH,
        "supervisor": worker.SUPERVISOR_PATH}.items()}
    common = {
        "runId": run_id, "packageId": "test-v18-package-0001",
        "batchRunId": "test-v18-batch-0001", "capabilityVersion": worker.CAPABILITY,
        "candidateContract": deepcopy(worker.CANDIDATE),
        "cpuQualification": fake(".runtime/ai-painter/stage4-mvp-structured-object-v18-formal-cpu-acceptances/synthetic/report.json"),
        "gpuQualification": fake(worker.gpu.OUTPUT_ROOT + "/attempt-" +
            worker.cpu.sha(b"v18-dry-gpu-20260927-001") + "/report.json"),
        "datasetManifest": deepcopy(worker.cpu.MANIFEST), "dryScope": deepcopy(worker.gpu.SCOPE),
        "modelPlan": deepcopy(worker.gpu.MODEL_PLAN),
        "precisionExecutionPlan": deepcopy(worker.gpu.PRECISION_PLAN),
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
              "status": "issued_single_use", "ticketId": "test-v18-ticket-0001",
              "registryBeforeStart": {"registryRevision": 1,
                  "registrySha256": "2" * 64, "activeExecution": None}}
    return package, ticket


class V18WorkerAdmissionTests(unittest.TestCase):
    def test_exact_bounded_package_and_ticket(self):
        package, ticket = fixture()
        worker.validate_package(package, ticket)

    def test_ticket_mirror_and_retry_rejected(self):
        package, ticket = fixture()
        for field, value in (("resourceBudget", {**worker.BUDGET, "maxEpochs": 25}),
                             ("permittedSplits", ["train", "validation", "challenge"]),
                             ("modelPlan", {**worker.gpu.MODEL_PLAN, "seed": 20260927})):
            changed = deepcopy(package); changed[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                worker.validate_package(changed, ticket)
        ticket["status"] = "consumed"
        with self.assertRaises(ValueError):
            worker.validate_package(package, ticket)

    def test_gpu_report_must_be_fixed_attempt(self):
        package, ticket = fixture()
        package["gpuQualification"]["path"] = worker.gpu.OUTPUT_ROOT + "/other/report.json"
        ticket["gpuQualification"] = deepcopy(package["gpuQualification"])
        with self.assertRaisesRegex(ValueError, "fixed one-attempt GPU"):
            worker.validate_package(package, ticket)

    def test_registry_must_be_idle(self):
        with self.assertRaisesRegex(ValueError, "inactive baseline"):
            worker.validate_idle_registry({"schemaVersion": "ai-painter-current-execution-registry-v1",
                "activeExecution": {"runId": "other"}, "executionState": "executing", "registryRevision": 1})


if __name__ == "__main__":
    unittest.main()
