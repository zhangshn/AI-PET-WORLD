"""CPU-only adversarial gate tests; fixtures are never execution tickets on disk."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import sys
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import train_stage4_mvp_structured_object_v17_dry_stage0 as worker


def fixture():
    candidate = json.loads(worker.cpu.project_file(ROOT, worker.CANDIDATE["path"]).read_bytes())
    package = {"schemaVersion": worker.PACKAGE_SCHEMA, "runId": "test-v17-run-0001",
        "packageId": "test-v17-package-0001", "batchRunId": "test-v17-batch-0001",
        "capabilityVersion": worker.CAPABILITY, "candidateContract": deepcopy(worker.CANDIDATE),
        "cpuQualification": candidate["cpuAcceptance"], "gpuQualification": deepcopy(worker.GPU_REPORT),
        "datasetManifest": deepcopy(worker.cpu.MANIFEST), "dryScope": deepcopy(worker.gpu.SCOPE),
        "modelPlan": deepcopy(worker.gpu.MODEL_PLAN), "precisionExecutionPlan": deepcopy(worker.gpu.PRECISION_PLAN),
        "stage": deepcopy(worker.STAGE), "resourceBudget": deepcopy(worker.BUDGET),
        "optimizerPlan": deepcopy(worker.OPTIMIZER_PLAN), "programBindings": {
            role: worker.bind(path) for role, path in (("worker", worker.WORKER_PATH),
                ("workerTests", worker.TEST_PATH), ("supervisor", worker.SUPERVISOR_PATH))},
        "ticketConsumptionRequired": True, "permittedSplits": ["train", "validation"],
        "forbiddenSplits": ["challenge", "regression"],
        "outputRoot": worker.OUTPUT_PREFIX + "test-v17-run-0001",
        "formalStage0QualificationAllowed": False, "runtimePublicationAllowed": False}
    package["outputTerminalPath"] = package["outputRoot"] + "/phase-terminal.json"
    registry_bytes = worker.cpu.project_file(ROOT, worker.REGISTRY_PATH).read_bytes()
    registry = json.loads(registry_bytes)
    ticket = {"schemaVersion": worker.TICKET_SCHEMA, "status": "issued_single_use", "ticketId": "test-v17-ticket-0001",
        **{key: deepcopy(package[key]) for key in worker.MIRROR_FIELDS},
        "registryBeforeStart": {"registryRevision": registry["registryRevision"],
            "registrySha256": worker.cpu.sha(registry_bytes), "activeExecution": None}}
    package["trainingExecutionTicket"] = {"path": package["outputRoot"] + "/training-ticket.json",
        "sha256": worker.cpu.sha(worker.cpu.canonical_bytes(ticket))}
    return package, ticket


def active_fixture(package, ticket):
    identity = {key: package[key] for key in ("capabilityVersion", "runId", "packageId")}
    identity.update(processId=123456, processStartIdentity="123456:2026-09-26T00:00:00.0000000Z")
    lock = {"schemaVersion": "ai-painter-current-active-execution-lock-v1", **identity}
    heartbeat = {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **identity,
        "executionState": "executing", "heartbeatAtUtc": worker.utc_now(), "ttlSeconds": 120}
    active = {**identity, "executionState": "executing", "programLineage": package["programBindings"]}
    baseline = ticket["registryBeforeStart"]
    registry = {"schemaVersion": "ai-painter-current-execution-registry-v1", **identity,
        "executionState": "executing", "registryRevision": baseline["registryRevision"] + 1,
        "supersedes": {"registryRevision": baseline["registryRevision"], "currentSha256": baseline["registrySha256"]},
        "activeExecution": active}
    return registry, lock, heartbeat


def chain_fixture(*, launcher=False):
    child = {"pid": os.getpid(), "parentPid": 234567 if launcher else 123456,
        "executablePath": sys._base_executable, "createdAtUtc": "2026-09-26T00:00:02.0000000Z"}
    parent = {"pid": 123456, "parentPid": 345678, "executablePath": "C:/Program Files/nodejs/node.exe",
        "createdAtUtc": "2026-09-26T00:00:00.0000000Z"}
    middle = {"pid": 234567, "parentPid": 123456,
        "executablePath": str(ROOT / "ml/ai-painter/.venv/Scripts/python.exe"),
        "createdAtUtc": "2026-09-26T00:00:01.0000000Z"}
    return [child, middle, parent] if launcher else [child, parent]


class WorkerGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
        import torch
        torch.set_num_threads(2)
        cls.torch = torch

    def test_package_ticket_consistent_future_fixture(self):
        package, ticket = fixture()
        worker.validate_package(package, ticket)

    def test_no_ticket_or_readonly_contract_cannot_admit_training(self):
        package, ticket = fixture()
        for bad in ({}, {"schemaVersion": worker.gpu.CANDIDATE_SCHEMA}, {**ticket, "status": "consumed"}):
            with self.subTest(bad=bad.get("schemaVersion")), self.assertRaises(ValueError):
                worker.validate_package(package, bad)
        with patch.object(worker.cpu.BoundReader, "json", return_value={}), \
             patch.object(self.torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
            with self.assertRaises(ValueError):
                worker.authenticate({"path": "missing.json", "sha256": "a" * 64})

    def test_resource_optimizer_and_split_mutations_rejected_even_when_ticket_agrees(self):
        for key, subkey, value in (("stage", "epochCount", 25), ("resourceBudget", "maxGpuMemoryFraction", .70001),
            ("resourceBudget", "cpuThreads", 4), ("resourceBudget", "automaticRetries", 1),
            ("resourceBudget", "maxGeneratorSteps", 1153), ("resourceBudget", "maxDiscriminatorSteps", 1153),
            ("resourceBudget", "timeoutSeconds", 43201), ("optimizerPlan", "generatorLearningRate", .001),
            ("modelPlan", "seed", 20260926), ("precisionExecutionPlan", "generatorAutocast", "float16")):
            package, ticket = fixture()
            package[key][subkey] = value
            ticket[key] = deepcopy(package[key])
            with self.subTest(field=subkey), self.assertRaises(ValueError):
                worker.validate_package(package, ticket)
        for key, value in (("permittedSplits", ["train", "validation", "challenge"]),
            ("formalStage0QualificationAllowed", True), ("ticketConsumptionRequired", 1)):
            package, ticket = fixture()
            package[key] = ticket[key] = value
            with self.assertRaises(ValueError):
                worker.validate_package(package, ticket)

    def test_ticket_program_output_and_candidate_mutations_rejected(self):
        for mutate in (lambda p: p.update(runId="different-run"),
            lambda p: p["candidateContract"].update(sha256="a" * 64),
            lambda p: p["programBindings"]["worker"].update(path="old-v16.py"),
            lambda p: p.update(outputRoot=worker.OUTPUT_PREFIX + "../test-v17-run-0001")):
            package, ticket = fixture()
            mutate(package)
            for key in worker.MIRROR_FIELDS:
                ticket[key] = deepcopy(package[key])
            with self.assertRaises(ValueError):
                worker.validate_package(package, ticket)

    def test_real_cpu_gpu_evidence_and_memory_revalidated(self):
        package, _ = fixture()
        reader = worker.cpu.BoundReader()
        candidate = reader.json(package["candidateContract"])
        cpu = reader.json(package["cpuQualification"])
        report = reader.json(package["gpuQualification"])
        worker.validate_gpu_report(report, candidate, cpu, package)
        for field, value in (("optimizerSteps", 1), ("weightsModified", True),
            ("implementationIdentitySha256", "b" * 64), ("finalCriticStateSha256", "a" * 64)):
            bad = deepcopy(report)
            bad[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                worker.validate_gpu_report(bad, candidate, cpu, package)
        bad = deepcopy(report)
        bad["responsibilityGradients"]["terrain_water"]["maskedGradientAbsoluteSum"] = 0
        with self.assertRaises(ValueError):
            worker.validate_gpu_report(bad, candidate, cpu, package)
        bad = deepcopy(report)
        bad["memoryMeasurements"][0]["limitBytes"] += 1
        with self.assertRaises(ValueError):
            worker.validate_gpu_report(bad, candidate, cpu, package)
        bad = deepcopy(report)
        observation = bad["memoryMeasurements"][0]["observed"]
        observation["device_used"] = int(observation["total"] * .7) + 1
        with self.assertRaises(ValueError):
            worker.validate_gpu_report(bad, candidate, cpu, package)

    def test_active_registry_lock_and_heartbeat_are_all_required(self):
        package, ticket = fixture()
        registry, lock, heartbeat = active_fixture(package, ticket)
        worker.validate_active(registry, package, {}, ticket["registryBeforeStart"], lock, heartbeat, check_process=False)
        for location, key, value in (("registry", "activeExecution", None), ("lock", "runId", "wrong-run"),
            ("heartbeat", "processStartIdentity", "reused-pid"), ("heartbeat", "ttlSeconds", 999),
            ("heartbeat", "heartbeatAtUtc", (datetime.now(timezone.utc) - timedelta(seconds=121)).isoformat())):
            copies = {"registry": deepcopy(registry), "lock": deepcopy(lock), "heartbeat": deepcopy(heartbeat)}
            copies[location][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                worker.validate_active(copies["registry"], package, {}, ticket["registryBeforeStart"],
                    copies["lock"], copies["heartbeat"], check_process=False)

    def test_dead_supervisor_reused_pid_or_wrong_parent_rejected(self):
        package, ticket = fixture()
        registry, lock, heartbeat = active_fixture(package, ticket)
        for actual, parent in (("123456:reused", 123456), (lock["processStartIdentity"], 654321)):
            with patch.object(worker, "process_identity", return_value=actual), \
                 patch.object(worker, "read_process_chain", return_value=chain_fixture()), \
                 patch.object(worker.os, "getppid", return_value=parent):
                with self.assertRaises(ValueError):
                    worker.validate_active(registry, package, {}, ticket["registryBeforeStart"], lock, heartbeat)

    def test_inactive_snapshot_cannot_be_an_active_registry(self):
        with self.assertRaises(ValueError):
            worker.validate_idle_registry({"schemaVersion": "ai-painter-current-execution-registry-v1",
                "registryRevision": 313, "activeExecution": {"runId": "old"}, "executionState": "failed_closed"})

    def test_registry_advance_must_derive_from_ticket_baseline(self):
        package, ticket = fixture()
        registry, lock, heartbeat = active_fixture(package, ticket)
        for key, value in (("currentSha256", "b" * 64), ("registryRevision", 1)):
            bad = deepcopy(registry)
            bad["supersedes"][key] = value
            with self.assertRaises(ValueError):
                worker.validate_active(bad, package, {}, ticket["registryBeforeStart"], lock, heartbeat, check_process=False)

    def test_preflight_rejects_stale_registry_raw_sha(self):
        package, ticket = fixture()
        baseline = deepcopy(ticket["registryBeforeStart"])
        baseline["registrySha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "registry changed"):
            worker.current_registry(package, {}, baseline, worker.cpu.BoundReader(), preflight=True)

    def test_active_dispatch_real_registry_three_field_binding(self):
        package, ticket = fixture()
        registry, lock, heartbeat = active_fixture(package, ticket)
        package_binding = {"path": package["outputRoot"] + "/execution-package.json", "sha256": "c" * 64}
        dispatch = {"status": "bounded_dry_training_dispatched", "runId": package["runId"],
            "packageId": package["packageId"], "executionPackage": package_binding,
            "trainingExecutionTicket": package["trainingExecutionTicket"]}
        lock_binding = {"path": package["outputRoot"] + "/execution-lock.json", "sha256": "a" * 64}
        terminal_binding = {"path": package["outputRoot"] + "/training-dispatched.json", "sha256": "b" * 64}
        registry["activeExecution"].update(lock=lock_binding,
            heartbeat={"path": package["outputRoot"] + "/heartbeat.json", "ttlSeconds": 120})
        registry["terminalEvidence"] = {**terminal_binding, "status": dispatch["status"]}
        registry["packageSha256"] = terminal_binding["sha256"]
        reader = SimpleNamespace(json=lambda bound: lock if bound == lock_binding else dispatch if bound == terminal_binding else None)
        original_project_file = worker.cpu.project_file
        def project_file(project_root, logical):
            if logical == worker.REGISTRY_PATH:
                return SimpleNamespace(read_bytes=lambda: worker.cpu.canonical_bytes(registry))
            if logical == package["outputRoot"] + "/heartbeat.json":
                return SimpleNamespace(read_bytes=lambda: worker.cpu.canonical_bytes(heartbeat))
            return original_project_file(project_root, logical)
        with patch.object(worker.cpu, "project_file", side_effect=project_file), \
             patch.object(worker, "process_identity", return_value=lock["processStartIdentity"]), \
             patch.object(worker, "read_process_chain", return_value=chain_fixture()), \
             patch.object(worker.os, "getppid", return_value=lock["processId"]):
            worker.current_registry(package, package_binding, ticket["registryBeforeStart"], reader)
            dispatch["executionPackage"] = {**package_binding, "sha256": "d" * 64}
            with self.assertRaisesRegex(ValueError, "registered dispatch"):
                worker.current_registry(package, package_binding, ticket["registryBeforeStart"], reader)

    def test_real_preflight_in_memory_no_gpu_no_tensor_decode_no_ticket_files(self):
        package, ticket = fixture()
        ticket_data = worker.cpu.canonical_bytes(ticket)
        package_data = worker.cpu.canonical_bytes(package)
        binding = {"path": package["outputRoot"] + "/execution-package.json", "sha256": worker.cpu.sha(package_data)}
        memory = {binding["path"]: package_data, package["trainingExecutionTicket"]["path"]: ticket_data}
        original_read = worker.cpu.BoundReader.read

        def read(reader, bound):
            if bound["path"] in memory:
                raw = memory[bound["path"]]
                worker.require(worker.cpu.sha(raw) == bound["sha256"], "fixture SHA differs")
                return raw
            return original_read(reader, bound)

        with patch.object(worker.cpu.BoundReader, "read", read), \
             patch.object(worker.cpu, "load_sample", side_effect=AssertionError("tensor decoding reached")), \
             patch.object(self.torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
            context = worker.authenticate(binding, preflight=True)
        self.assertEqual(len(context["rows"]["train"]), 48)
        self.assertEqual(len(context["rows"]["validation"]), 8)
        self.assertNotIn("challenge", context["rows"])
        self.assertFalse(worker.cpu.project_file(ROOT, binding["path"]).exists())

    def test_split_loader_rejects_heldout_before_content(self):
        context = {"rows": {"train": [{"split": "challenge"}]}}
        with patch.object(worker.cpu, "load_sample", side_effect=AssertionError("heldout decoded")):
            with self.assertRaises(ValueError):
                worker.load_splits(context, lambda *args, **kwargs: None)

    def test_optimizer_rejects_validation_nonfinite_and_exhausted_before_step(self):
        torch = self.torch
        for split, count, nan in (("validation", 0, False), ("train", 1152, False), ("train", 0, True)):
            model = torch.nn.Linear(1, 1)
            optimizer = torch.optim.AdamW(model.parameters(), lr=.001)
            loss = model(torch.ones(1, 1)).sum() * (float("nan") if nan else 1)
            counts = {"generator": count}
            before = worker.cpu.state_hash(model)
            with patch.object(optimizer, "step", side_effect=AssertionError("optimizer reached")):
                with self.assertRaises(ValueError):
                    worker.update_network(optimizer, loss, model, {"split": split}, "generator", counts, 1152, lambda: None)
            self.assertEqual(worker.cpu.state_hash(model), before)
            self.assertEqual(counts["generator"], count)

    def test_nonfinite_gradient_rejected_even_with_finite_loss(self):
        torch = self.torch
        model = torch.nn.Linear(1, 1)
        optimizer = torch.optim.AdamW(model.parameters())
        model.weight.register_hook(lambda grad: grad * float("nan"))
        with patch.object(optimizer, "step", side_effect=AssertionError("step reached")):
            with self.assertRaises(ValueError):
                worker.update_network(optimizer, model(torch.ones(1, 1)).sum(), model,
                    {"split": "train"}, "generator", {"generator": 0}, 1152, lambda: None)

    def test_completed_but_nonfinite_step_is_counted_in_failure(self):
        torch = self.torch
        model = torch.nn.Linear(1, 1)
        optimizer = torch.optim.AdamW(model.parameters())
        counts = {"generator": 0}
        def poison():
            with torch.no_grad():
                model.weight.fill_(float("nan"))
        with patch.object(optimizer, "step", side_effect=poison):
            with self.assertRaises(ValueError):
                worker.update_network(optimizer, model(torch.ones(1, 1)).sum(), model,
                    {"split": "train"}, "generator", counts, 1152, lambda: None)
        self.assertEqual(counts["generator"], 1)

    def test_memory_failure_prevents_optimizer_step(self):
        torch = self.torch
        model = torch.nn.Linear(1, 1)
        optimizer = torch.optim.AdamW(model.parameters())
        with patch.object(optimizer, "step", side_effect=AssertionError("step reached")):
            with self.assertRaisesRegex(ValueError, "memory"):
                worker.update_network(optimizer, model(torch.ones(1, 1)).sum(), model,
                    {"split": "train"}, "generator", {"generator": 0}, 1152,
                    lambda: (_ for _ in ()).throw(ValueError("memory cap")))

    def test_validation_no_grad_and_state_unchanged(self):
        torch = self.torch
        class Tiny(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.weight = torch.nn.Parameter(torch.ones(1))
            def forward(self, conditions, table):
                return conditions * self.weight
        model = Tiny()
        before = worker.cpu.state_hash(model)
        sample = {"sampleId": "validation-1", "split": "validation", "conditions": torch.ones(1),
                  "image": torch.ones(1), "objectInstanceTable": []}
        def score(predicted, *args):
            self.assertFalse(torch.is_grad_enabled())
            self.assertFalse(predicted.requires_grad)
            return predicted.mean(), {}
        with patch("ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17.validation_structured_object_score", score):
            value, rows = worker.validate_samples(model, [sample], [], lambda: None)
        self.assertEqual(value, 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(worker.cpu.state_hash(model), before)
        self.assertIsNone(model.weight.grad)

    def test_atomic_checkpoint_safe_roundtrip_and_no_overwrite(self):
        torch = self.torch
        model, critic = torch.nn.Linear(2, 1), torch.nn.Linear(2, 1)
        with tempfile.TemporaryDirectory(prefix="v17-worker-test-") as directory:
            path = Path(directory) / "epoch-01.pt"
            expected = worker.checkpoint(path, model, critic, {"epoch": 1, "validationScore": .5})
            loaded = torch.load(io.BytesIO(path.read_bytes()), weights_only=True)
            self.assertEqual(loaded["modelStateSha256"], expected[0])
            model.load_state_dict(loaded["modelState"], strict=True)
            self.assertEqual(worker.cpu.state_hash(model), expected[0])
            original = path.read_bytes()
            with self.assertRaises(ValueError):
                worker.checkpoint(path, model, critic, {})
            self.assertEqual(path.read_bytes(), original)

    def test_exclusive_consumption_and_failed_atomic_evidence_retained(self):
        with tempfile.TemporaryDirectory(prefix="v17-worker-test-") as directory:
            path = Path(directory) / "worker-started.json"
            worker.write_exclusive(path, {"runId": "test"})
            with self.assertRaises(FileExistsError):
                worker.write_exclusive(path, {"runId": "test"})
            target = Path(directory) / "epoch.pt"
            with patch.object(worker.os, "replace", side_effect=OSError("disk error")):
                with self.assertRaises(OSError):
                    worker.atomic_bytes(target, b"evidence")
            self.assertFalse(target.exists())
            self.assertEqual(next(Path(directory).glob("*.staged-*")).read_bytes(), b"evidence")

    def test_authenticated_failure_records_terminal_and_consumption_blocks_replay(self):
        package, ticket = fixture()
        from ai_painter.complete_world.split_release import bound_json
        manifest = bound_json(ROOT, worker.cpu.MANIFEST)
        context = {"package": package, "ticket": ticket, "reader": worker.cpu.BoundReader(), "registry": {},
            "order": manifest["identityPayload"]["channelOrder"],
            "acceptance": {"initialModelStateSha256": "a" * 64}}
        original_project_file = worker.cpu.project_file
        with tempfile.TemporaryDirectory(prefix="v17-worker-test-") as directory:
            root = Path(directory)
            def project_file(project_root, logical):
                if logical == package["outputRoot"]:
                    return root
                return original_project_file(project_root, logical)
            with patch.object(worker, "authenticate", return_value=context), \
                 patch.object(worker.cpu, "project_file", side_effect=project_file), \
                 patch.object(self.torch.cuda, "is_available", side_effect=AssertionError("CUDA reached")):
                terminal = worker.run({"path": "test-memory-only", "sha256": "a" * 64})
                self.assertEqual(terminal["status"], "failed_closed")
                self.assertIn("fresh training state differs", terminal["error"])
                self.assertFalse(terminal["trainingStarted"])
                self.assertEqual(terminal["optimizerStepsGenerator"], 0)
                self.assertTrue((root / "phase-terminal.json").exists())
                self.assertTrue((root / "worker-started.json").exists())
                self.assertIn("failureModelStateSha256", terminal)
                with self.assertRaisesRegex(ValueError, "already consumed"):
                    worker.run({"path": "test-memory-only", "sha256": "a" * 64})

    def test_direct_and_exact_venv_launcher_chains_accepted(self):
        for launcher in (False, True):
            rows = chain_fixture(launcher=launcher)
            result = worker.validate_process_chain(rows, 123456, "123456:" + rows[-1]["createdAtUtc"],
                worker_pid=os.getpid(), worker_parent=rows[0]["parentPid"])
            self.assertEqual(result, rows)

    def test_arbitrary_intermediate_wrong_edges_and_pid_reuse_rejected(self):
        for mutate in (lambda r: r[1].update(executablePath="C:/other/python.exe"),
            lambda r: r[1].update(parentPid=999), lambda r: r[0].update(pid=999),
            lambda r: r[0].update(executablePath="C:/unrelated/python.exe"),
            lambda r: r[1].update(createdAtUtc="2026-09-26T00:00:03.0000000Z"),
            lambda r: r[-1].update(createdAtUtc="2026-09-26T00:00:01.0000000Z"),
            lambda r: r.append(deepcopy(r[-1])), lambda r: r[1].update(executablePath=None)):
            rows = chain_fixture(launcher=True)
            mutate(rows)
            with self.assertRaises(ValueError):
                worker.validate_process_chain(rows, 123456, "123456:2026-09-26T00:00:00.0000000Z",
                    worker_pid=os.getpid(), worker_parent=234567)

    def test_changed_chain_between_cim_reads_rejected(self):
        package, ticket = fixture()
        registry, lock, heartbeat = active_fixture(package, ticket)
        rows = chain_fixture(launcher=True)
        changed = deepcopy(rows)
        changed[1]["createdAtUtc"] = "2026-09-26T00:00:01.0000010Z"
        with patch.object(worker, "process_identity", return_value=lock["processStartIdentity"]), \
             patch.object(worker, "read_process_chain", side_effect=[rows, changed]), \
             patch.object(worker.os, "getppid", return_value=234567):
            with self.assertRaisesRegex(ValueError, "chain changed"):
                worker.validate_active(registry, package, {}, ticket["registryBeforeStart"], lock, heartbeat)

    @unittest.skipUnless(os.name == "nt", "Windows venv launcher integration")
    def test_real_node_venv_python_chain_cpu_only(self):
        # Same Node child_process -> project venv path as the supervisor, but
        # execute only this read-only process probe, never the training entry.
        probe = ("import os,sys,json; sys.path.insert(0,'ml/ai-painter/scripts'); "
            "import train_stage4_mvp_structured_object_v17_dry_stage0 as w; "
            "p=int(os.environ['V17_TEST_SUPERVISOR_PID']); identity=w.process_identity(p); "
            "rows=w.read_process_chain(os.getpid(),p); "
            "w.validate_process_chain(rows,p,identity); "
            "assert rows==w.read_process_chain(os.getpid(),p); "
            "print(json.dumps({'depth':len(rows),'workerPid':os.getpid(),'supervisorPid':p,'rows':rows}))")
        code = ("const {spawnSync}=require('node:child_process'); const r=spawnSync(" +
            json.dumps(str(ROOT / "ml/ai-painter/.venv/Scripts/python.exe")) + ",['-B','-c'," + json.dumps(probe) +
            "],{encoding:'utf8',windowsHide:true,env:{...process.env,V17_TEST_SUPERVISOR_PID:String(process.pid),"
            "PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:''}});"
            "process.stdout.write(r.stdout||''); process.stderr.write(r.stderr||''); process.exitCode=r.status??1;")
        completed = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, timeout=30,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        self.assertEqual(completed.returncode, 0, completed.stderr)
        evidence = json.loads(completed.stdout)
        self.assertEqual(evidence["depth"], 3)
        self.assertNotEqual(evidence["workerPid"], evidence["supervisorPid"])

    def test_cuda_remains_uninitialized(self):
        self.assertFalse(self.torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
