"""CPU-only binding tests. Synthetic package/live views never dispatch."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import ecology_regime_execution_auth as auth


def raw(value):
    return (json.dumps(value, sort_keys=True, allow_nan=False) + "\n").encode()


class Reader:
    """Real immutable project sources, explicitly synthetic volatile registry."""
    def __init__(self, temp):
        self.temp, self.virtual, self.observed = Path(temp), {}, {}

    def put(self, path, value):
        self.virtual[path] = value if type(value) is bytes else raw(value)
        return {"path": path, "sha256": hashlib.sha256(self.virtual[path]).hexdigest()}

    def bind(self, path):
        value = self.virtual[path] if path in self.virtual else (ROOT / path).read_bytes()
        return {"path": path, "sha256": hashlib.sha256(value).hexdigest()}

    def read(self, binding):
        auth.exact_binding(binding)
        value = self.virtual[binding["path"]] if binding["path"] in self.virtual else (ROOT / binding["path"]).read_bytes()
        auth.require(hashlib.sha256(value).hexdigest() == binding["sha256"], "source SHA differs")
        auth.require(self.observed.get(binding["path"], binding["sha256"]) == binding["sha256"], "source changed")
        self.observed[binding["path"]] = binding["sha256"]
        return value

    def unchanged(self):
        for path, sha in list(self.observed.items()):
            self.read({"path": path, "sha256": sha})

    def path(self, logical):
        # Only mutable synthetic live-view files are persisted; immutable reads
        # above continue to use real project bytes and actual T70 receipts.
        auth.exact_binding({"path": logical, "sha256": "a" * 64})
        target = self.temp / logical
        target.parent.mkdir(parents=True, exist_ok=True)
        if logical in self.virtual:
            target.write_bytes(self.virtual[logical])
        return target


def fixture(reader):
    from ai_painter.complete_world import ecology_regime_managed_checkpoint as codec
    source = {"path": codec.CANDIDATE_PATH,
        "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"}
    configuration = codec.derive_configuration(reader, source, auth.SPECIFICATION)
    candidate = json.loads(reader.read(source))
    acceptance = json.loads(reader.read(auth.COMPONENT_ACCEPTANCE))
    programs = {"component-" + str(i): b for i, b in enumerate(acceptance["programBindings"])}
    programs.update({role: reader.bind(path) for role, path in auth.ROLE_PATHS.items()})
    # A real immutable JS source, used as a shape-only phase binding. We never
    # assert it has ecology exports or dispatch it: that is final-entry work.
    supervisor = reader.bind("scripts/run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs")
    programs["fixtureSupervisor"] = supervisor
    run_id, package_id = "ecology-auth-test-run", "ecology-auth-test-package"
    output = ".runtime/ai-painter/ecology-regime-managed-executions/" + run_id
    model_binding = reader.put(output + "/model-identity.json",
        auth.derive_model_metadata(reader, candidate["frozenBindings"]["datasetManifest"]))
    plan = {"schema": auth.PLAN_SCHEMA, "executionProfile": auth.EXECUTION_PROFILE,
        "executionMode": "managed-training", "capabilityVersion": auth.CAPABILITY,
        "runId": run_id, "packageId": package_id, "outputRoot": output,
        "historicalCheckpointMayInitialize": False, "trainingRestartAllowed": False,
        "formalSpecification": deepcopy(auth.SPECIFICATION), "sourceCandidate": source,
        "configuration": configuration, "componentCpuAcceptance": deepcopy(auth.COMPONENT_ACCEPTANCE),
        "modelBinding": model_binding,
        "programBindings": programs,
        **{key: candidate["frozenBindings"][key] for key in ("datasetManifest", "trainSplit", "validationSplit")}}
    pb = reader.put(output + "/ecology-plan.json", plan)
    package = {"schemaVersion": "ai-painter-autonomous-closed-loop-package-v1",
        "packageIdentity": package_id, "capabilityVersion": auth.CAPABILITY,
        "ownerAuthorizationRequired": False, "ownerInStateMachine": False,
        "maxInfrastructureRecoveryAttempts": 0, "outputRoot": output,
        "programLineage": {role: b["sha256"] for role, b in programs.items()},
        "inputEvidence": [pb] + [plan[key] for key in ("formalSpecification", "sourceCandidate",
            "componentCpuAcceptance", "datasetManifest", "trainSplit", "validationSplit", "modelBinding")],
        "phaseAdapters": {phase: {"kind": "project_module_export", **supervisor, "exportName": phase}
            for phase in auth.PHASES}}
    binding = reader.put(f".runtime/ai-painter/autonomous-closed-loop-packages/{package_id}/package.json", package)
    return binding, package, plan


class ExecutionAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        cls.prior_threads = torch.get_num_threads()
        torch.set_num_threads(2)

    @classmethod
    def tearDownClass(cls):
        import torch
        torch.set_num_threads(cls.prior_threads)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ecology-auth-synthetic-")
        self.addCleanup(self.temp.cleanup)
        self.reader = Reader(self.temp.name)
        self.binding, self.package, self.plan = fixture(self.reader)

    def rewritten(self, *, package=None, plan=None):
        package = deepcopy(self.package if package is None else package)
        if plan is not None:
            package["inputEvidence"][0] = self.reader.put(self.plan["outputRoot"] + "/ecology-plan.json", plan)
        binding = self.reader.put(self.binding["path"], package)
        # A different candidate package is checked by a fresh reader, not by
        # erasing observed sources inside an already authenticated context.
        self.reader.observed = {}
        return auth.load_execution_package(self.reader, binding)

    def test_real_component_sources_and_binding_only_package(self):
        context = auth.load_execution_package(self.reader, self.binding)
        self.assertEqual(context.configuration["capabilityVersion"], auth.CAPABILITY)
        self.assertEqual(context.configuration["executionCeiling"]["maxWallSeconds"], 2700)
        self.assertNotIn("gpuQualified", context.plan)

    def test_reject_wrong_package_capability_and_owner_recovery(self):
        for key, value in (("capabilityVersion", "old-model"), ("ownerAuthorizationRequired", True),
                ("ownerInStateMachine", True), ("maxInfrastructureRecoveryAttempts", False),
                ("maxInfrastructureRecoveryAttempts", 1), ("packageIdentity", "wrong-package")):
            with self.subTest(key=key, value=value):
                package = deepcopy(self.package); package[key] = value
                with self.assertRaises(ValueError): self.rewritten(package=package)

    def test_reject_plan_boundaries_and_caller_resource_extension(self):
        for key, value in (("schema", "old-schema"), ("executionProfile", "old-profile"),
                ("executionMode", "synthetic-cpu-bootstrap"), ("capabilityVersion", "old-model"),
                ("runId", self.plan["packageId"]), ("outputRoot", ".runtime/ai-painter/wrong"),
                ("historicalCheckpointMayInitialize", True), ("trainingRestartAllowed", True),
                ("resourcePolicy", {}), ("effectiveExecutionCeiling", {"maxWallSeconds": 4200})):
            with self.subTest(key=key):
                plan = deepcopy(self.plan); plan[key] = value
                with self.assertRaises(ValueError): self.rewritten(plan=plan)

    def test_reject_fixed_configuration_numeric_type_and_data(self):
        for mutate in (lambda p: p["configuration"].update(seed=True),
                lambda p: p["configuration"]["executionCeiling"].update(epochs=48.0),
                lambda p: p["trainSplit"].update(sha256="a" * 64),
                lambda p: p.update(componentCpuAcceptance={"path": "old/cpu.json", "sha256": "a" * 64})):
            plan = deepcopy(self.plan); mutate(plan)
            with self.assertRaises(ValueError): self.rewritten(plan=plan)

    def test_reject_missing_duplicate_inputs_and_phase_omission(self):
        for mutate in (lambda p: p["inputEvidence"].pop(),
                lambda p: p["inputEvidence"].append(p["inputEvidence"][0]),
                lambda p: p["phaseAdapters"].pop("review"),
                lambda p: p["phaseAdapters"]["execute"].update(exportName="preflight")):
            package = deepcopy(self.package); mutate(package)
            with self.assertRaises(ValueError): self.rewritten(package=package)

    def test_reject_missing_component_source_and_own_auth_role(self):
        for role in ("component-0", "executionAuth", "managedCheckpoint", "registration"):
            plan = deepcopy(self.plan); plan["programBindings"].pop(role)
            with self.assertRaises(ValueError): self.rewritten(plan=plan)

    def test_reject_self_consistent_but_not_actual_model_metadata(self):
        for mutate in (lambda m: m.update(capabilityVersion="old-model"),
                lambda m: m["initialState"].update(generator="a" * 64),
                lambda m: m["graph"][0].update(dtype="torch.float64"),
                lambda m: m["graph"][0].update(elements=True)):
            model = auth.derive_model_metadata(self.reader, self.plan["datasetManifest"]); mutate(model)
            plan = deepcopy(self.plan)
            plan["modelBinding"] = self.reader.put(plan["modelBinding"]["path"], model)
            package = deepcopy(self.package)
            package["inputEvidence"][-1] = plan["modelBinding"]
            with self.assertRaises(ValueError): self.rewritten(package=package, plan=plan)

    def test_reject_source_changed_after_successful_load(self):
        context = auth.load_execution_package(self.reader, self.binding)
        source = self.plan["programBindings"]["trainingLifecycle"]
        self.reader.virtual[source["path"]] = b"# altered source\n"
        with self.assertRaises(ValueError): context.reader.unchanged()

    def live_fixture(self):
        context = auth.load_execution_package(self.reader, self.binding)
        identity = {"capabilityVersion": auth.CAPABILITY, "runId": self.plan["runId"],
            "packageId": self.plan["packageId"], "processId": 12345, "processStartIdentity": "12345:synthetic-creation"}
        lock = self.reader.put(self.plan["outputRoot"] + "/execution-lock.json",
            {"schemaVersion": "ai-painter-current-active-execution-lock-v1", **identity})
        heartbeat = {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **identity,
            "executionState": "executing", "ttlSeconds": 120, "heartbeatAtUtc": datetime.now(timezone.utc).isoformat()}
        self.reader.put(self.plan["outputRoot"] + "/heartbeat.json", heartbeat)
        current = {"schemaVersion": "ai-painter-current-execution-registry-v1", "registryRevision": 1,
            "executionState": "executing", **{k: identity[k] for k in ("capabilityVersion", "runId", "packageId")},
            "activeExecution": {"schemaVersion": "ai-painter-current-active-execution-v1", **identity,
                "executionState": "executing", "programLineage": self.plan["programBindings"],
                "lock": lock, "heartbeat": {"path": self.plan["outputRoot"] + "/heartbeat.json", "ttlSeconds": 120}}}
        self.reader.put(auth.REGISTRY, current)
        return context, current, heartbeat

    def test_live_identity_never_proves_progress_gpu_or_cleanup(self):
        context, current, _ = self.live_fixture()
        with patch.object(auth, "process_identity", return_value=current["activeExecution"]["processStartIdentity"]):
            result = auth.verify_live_context(context)
        for field in ("trainingProgressInferred", "gpuQualified", "productionEntryQualified", "cleanupProven"):
            self.assertIs(result[field], False)

    def test_reject_registry_identity_state_types_and_lineage(self):
        for mutate in (lambda c: c.update(registryRevision=True), lambda c: c.update(runId="other-run"),
                lambda c: c.update(activeExecution=None), lambda c: c.update(executionState="completed"),
                lambda c: c["activeExecution"].update(processId=True),
                lambda c: c["activeExecution"].update(packageId="other-package"),
                lambda c: c["activeExecution"].update(programLineage={})):
            context, current, _ = self.live_fixture(); mutate(current); self.reader.put(auth.REGISTRY, current)
            with patch.object(auth, "process_identity", return_value="12345:synthetic-creation"):
                with self.assertRaises(ValueError): auth.verify_live_context(context)

    def test_reject_process_reuse_or_exit_without_alive_fallback(self):
        context, _, _ = self.live_fixture()
        with patch.object(auth, "process_identity", return_value="12345:new-creation"):
            with self.assertRaises(ValueError): auth.verify_live_context(context)
        with patch.object(auth, "process_identity", side_effect=RuntimeError("exited")):
            with self.assertRaises(RuntimeError): auth.verify_live_context(context)

    def test_reject_mutated_context_not_just_mutated_disk_bytes(self):
        context, _, _ = self.live_fixture()
        context.plan["configuration"]["executionCeiling"]["maxWallSeconds"] = 4200
        with self.assertRaises(ValueError): auth.verify_live_context(context)

    def test_reject_stale_future_naive_or_rebound_heartbeat(self):
        for mutate in (lambda h: h.update(heartbeatAtUtc=(datetime.now(timezone.utc)-timedelta(seconds=121)).isoformat()),
                lambda h: h.update(heartbeatAtUtc=(datetime.now(timezone.utc)+timedelta(seconds=301)).isoformat()),
                lambda h: h.update(heartbeatAtUtc="2026-10-09T00:00:00"),
                lambda h: h.update(runId="other-run"), lambda h: h.update(ttlSeconds=120.0)):
            context, _, heartbeat = self.live_fixture(); mutate(heartbeat)
            self.reader.put(self.plan["outputRoot"] + "/heartbeat.json", heartbeat)
            with patch.object(auth, "process_identity", return_value="12345:synthetic-creation"):
                with self.assertRaises(ValueError): auth.verify_live_context(context)

    def test_reject_registry_change_during_identity_check(self):
        context, current, _ = self.live_fixture()
        calls = []
        def pid_read(pid):
            calls.append(pid)
            if len(calls) == 1:
                other = deepcopy(current); other["registryRevision"] += 1
                self.reader.put(auth.REGISTRY, other)
            return "12345:synthetic-creation"
        with patch.object(auth, "process_identity", side_effect=pid_read):
            with self.assertRaises(ValueError): auth.verify_live_context(context)

    def test_reject_duplicate_nonfinite_unsafe_and_oversized_json(self):
        for payload in (b'{"runId":"a","runId":"b"}', b'{"x":NaN}', b' ' * (2*1024**2+1)):
            with self.assertRaises(ValueError): auth.decode(payload)
        for path in ("../escape", "C:/escape", "a\\b", "/root", "a//b"):
            with self.assertRaises(ValueError): auth.exact_binding({"path": path, "sha256": "a" * 64})


if __name__ == "__main__":
    import torch
    torch.set_num_threads(2)
    unittest.main(verbosity=2)
