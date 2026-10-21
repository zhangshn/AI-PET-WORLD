"""CPU-only admission/timing tests. Never execute the actual numerical probe."""
import copy
import ast
import io
import json
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
import diagnose_decode1_entry_training_cost_gpu_v1 as probe


def setUpModule():
    probe.configure_cpu()


class CostProbeTests(unittest.TestCase):
    def test_actual_loaded_sources_torch_namespaces_and_runtime_are_bound_cpu_only(self):
        code = """import {bindPolicy,POLICY,resolveInputs} from './scripts/diagnose-ai-painter-decode1-entry-training-cost-v1.mjs';
bindPolicy({path:POLICY.path,sha256:'3546f4761df0fc42124885c3c7042b9d5101f9c8b325c7f1a004d373bfa99b5f'});
const b=resolveInputs(process.cwd());console.log(JSON.stringify(b.programs));"""
        result = probe.subprocess.run([probe.shutil.which("node"), "--input-type=module", "-e", code], cwd=ROOT,
            capture_output=True, text=True, encoding="utf-8", timeout=20, creationflags=getattr(probe.subprocess, "CREATE_NO_WINDOW", 0))
        self.assertEqual(result.returncode, 0, result.stderr)
        programs = json.loads(result.stdout)
        self.assertLessEqual(len(programs), 256)
        mapping = probe.capture.RuntimeMap.current(ROOT)
        with patch.object(probe.torch.cuda, "synchronize", side_effect=AssertionError("identity cannot synchronize")), \
                patch.object(probe.torch.autograd, "grad", side_effect=AssertionError("identity cannot autograd")):
            probe.verify_imports(mapping, programs)
            policy = json.loads(mapping.binding(dict(path=probe.POLICY_PATH,
                sha256="3546f4761df0fc42124885c3c7042b9d5101f9c8b325c7f1a004d373bfa99b5f")))
            plan = json.loads(mapping.binding(policy["parentEvidence"]["plan"]))
            self.assertEqual(probe.process_io.runtime_identity(ROOT), plan["runtimeIdentity"])

    def test_gpu_poll_parser_and_strict_original_safety_floors_without_gpu(self):
        uuid = "GPU-00000000-0000-0000-0000-000000000001"
        bits, actual, temperature = probe.driver_device_zero("0, " + uuid + ", 84\n")
        self.assertEqual((actual, temperature), (uuid, 84))
        self.assertEqual(len(bits), 16)
        probe.require_gpu_poll(2048 * 1024**2, uuid, 84)
        for free, temp, reason in ((2048 * 1024**2 - 1, 84, "free_vram_below_minimum"),
                (2048 * 1024**2, 85, "temperature_at_or_above_maximum")):
            with self.assertRaisesRegex(ValueError, reason): probe.require_gpu_poll(free, uuid, temp)
        for raw in ("0, " + uuid + ", NaN", "0, " + uuid + ", -1", "0, " + uuid + ", 84\n0, " + uuid + ", 84",
                "1, " + uuid + ", 84", "0, not-a-uuid, 84"):
            with self.assertRaises(ValueError): probe.driver_device_zero(raw)

    def test_reader_and_timing_do_not_add_cuda_or_numerical_operations(self):
        tree = ast.parse(Path(probe.__file__).read_text(encoding="utf-8"))
        found = []
        class Calls(ast.NodeVisitor):
            scope = ()
            def visit_FunctionDef(self, node):
                old = self.scope; self.scope = (*old, node.name)
                self.generic_visit(node); self.scope = old
            def visit_Call(self, node):
                name = ast.unparse(node.func)
                if name == "torch.cuda.synchronize": found.append(self.scope)
                if "Reader" in self.scope or "instrument" in self.scope:
                    self_outer.assertNotIn(name, ("torch.cuda.synchronize", "torch.cuda.Event", "torch.cuda._lazy_init"))
                self.generic_visit(node)
        self_outer = self
        Calls().visit(tree)
        self.assertEqual(found, [("main", "resource")])
        reader_node = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Reader")
        self.assertFalse(any(isinstance(n, ast.Call) and ast.unparse(n.func).endswith(".resource") for n in ast.walk(reader_node)))

    def test_new_run_identity_lock_heartbeat_creation_and_final_reread(self):
        run_id = "decode1-entry-cost-00000000-0000-0000-0000-000000000000"
        request = dict(mode="gpu_probe", runId=run_id, outputRoot=probe.OUTPUT + "/" + run_id)
        package = dict(programBindings=[dict(path=probe.PROGRAM, sha256="b" * 64)],
            interpreter=dict(path=sys.executable, sha256="a" * 64))
        identity = dict(capabilityVersion=probe.CAPABILITY, runId=run_id, packageId=run_id + "-package", processId=123, processStartIdentity="123:created")
        lock_binding = dict(path=request["outputRoot"] + "/active-lock.json", sha256="c" * 64)
        registry_binding = dict(path=".runtime/ai-painter/current-execution-registry/current.json", sha256="d" * 64)
        registry = dict(schemaVersion="ai-painter-current-execution-registry-v1", registryRevision=2, executionState="executing", **identity,
            activeExecution=dict(schemaVersion="ai-painter-current-active-execution-v1", executionState="executing", **identity,
                programLineage={"costSource0": package["programBindings"][0]}, lock=lock_binding,
                heartbeat=dict(path=request["outputRoot"] + "/heartbeat.json", ttlSeconds=120)))
        lock = dict(schemaVersion="ai-painter-current-active-execution-lock-v1", **identity)
        heartbeat = dict(schemaVersion="ai-painter-current-active-execution-heartbeat-v1", **identity, executionState="executing", ttlSeconds=120,
            heartbeatAtUtc=probe.datetime.now(probe.timezone.utc).isoformat())
        guard = dict(runnerPid=123, executable=sys.executable, executableSha256="a" * 64,
            commandSha256=probe.capture.digest(json.dumps(["-B", *sys.argv], ensure_ascii=False, separators=(",", ":")).encode()))
        class FakePath:
            def read_bytes(self): return json.dumps(guard).encode()
        class Mapping:
            def binding(self, b): return json.dumps(registry if b == registry_binding else lock).encode()
            def path(self, logical): return FakePath()
        class Stream(io.BytesIO):
            def fileno(self): return 7
        def opened(_path): return Stream(json.dumps(heartbeat).encode())
        def info(_fd): return types.SimpleNamespace(st_size=len(json.dumps(heartbeat).encode()))
        identities = []
        def live(pid): identities.append(pid); return "123:created"
        with patch.object(probe.process_io, "_heartbeat_parents", return_value=()), \
                patch.object(probe.process_io, "_heartbeat_check_parents"), \
                patch.object(probe.process_io, "_heartbeat_plain_file"), \
                patch.object(probe.process_io, "_open_heartbeat_handle", side_effect=opened), \
                patch.object(probe.os, "fstat", side_effect=info), \
                patch.object(probe.capture, "_file_identity", side_effect=lambda v: v.st_size):
            probe.verify_live_identity(Mapping(), registry_binding, request, package, identity_reader=live)
            self.assertEqual(identities, [123, 123])
            for target, key, value in ((registry["activeExecution"], "runId", "old-run"),
                    (registry["activeExecution"], "processStartIdentity", "reused-pid"),
                    (lock, "processId", 9), (heartbeat, "ttlSeconds", 30),
                    (heartbeat, "heartbeatAtUtc", "2000-01-01T00:00:00Z"), (guard, "commandSha256", "e" * 64)):
                old = target[key]; target[key] = value
                with self.assertRaises(ValueError):
                    probe.verify_live_identity(Mapping(), registry_binding, request, package, identity_reader=live)
                target[key] = old

    def test_real_parent_metadata_with_no_forward_autograd_cuda_or_raster_content(self):
        mapping = probe.capture.RuntimeMap.current(ROOT)
        policy = json.loads(mapping.binding(dict(path=probe.POLICY_PATH,
            sha256="3546f4761df0fc42124885c3c7042b9d5101f9c8b325c7f1a004d373bfa99b5f")))
        plan = json.loads(mapping.binding(policy["parentEvidence"]["plan"]))
        closure = json.loads(mapping.binding(plan["dataClosure"]))
        diagnostic = [b for b in closure["bindings"] if b["sha256"] == "4639d25a8c0f0bc2f60592c15b23971de3a17b131124ea54df52568c4139a09e"]
        self.assertEqual(len(diagnostic), 1)
        start = time.monotonic()
        def light_check():
            self.assertLess(time.monotonic() - start, 110)
            mapping.check()
        reader = probe.Reader(mapping, [], light_check)
        reader.spec_mapping = (policy["parentEvidence"]["originalSpecification"], policy["parentEvidence"]["originalSpecificationSnapshot"])
        self.assertEqual(probe.capture.digest(reader.read(policy["parentEvidence"]["originalSpecification"])),
            policy["parentEvidence"]["originalSpecification"]["sha256"])
        for b in closure["bindings"]: reader.allow(b)
        canonical = "scripts/lib/real-earth-region-governance.mjs"
        reader.allow(dict(path=canonical, sha256="c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"))
        data = {k: plan[k] for k in ("datasetManifest", "trainSplit", "validationSplit")}
        data.update(regimeDiagnostic=diagnostic[0], conditionContract={k: probe.profile.inherited.core.cpu.CONDITION_CONTRACT[k] for k in ("path", "sha256")})
        with patch.object(probe.torch.autograd, "grad", side_effect=AssertionError("metadata cannot autograd")), \
                patch.object(probe.torch.cuda, "synchronize", side_effect=AssertionError("metadata cannot synchronize")), \
                patch.object(probe.torch.nn.Module, "_call_impl", side_effect=AssertionError("metadata cannot forward")):
            prepared = probe.prepare_metadata(reader, data, policy["scope"]["sampleId"])
            self.assertEqual(prepared[0]["sampleId"], policy["scope"]["sampleId"])
            self.assertFalse(reader.allowed_rasters)
            self.assertFalse(any(name in reader.rasters for name in reader.observed))
            reader.unchanged()
            model, critic = probe.profile.fresh_networks(prepared[2])
            self.assertEqual(len(tuple(model.parameters())), 108)
            self.assertEqual(sum(p.numel() for p in model.parameters()), 2242687)
            self.assertTrue(all(p.grad is None for n in (model, critic) for p in n.parameters()))
            expected = reader.json(policy["parentEvidence"]["modelIdentity"])
            probe.capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), expected["graph"])
            self.assertEqual(dict(generator=probe.profile.inherited.core.cpu.state_hash(model),
                discriminator=probe.profile.inherited.core.cpu.state_hash(critic)), expected["initialState"])
        self.assertFalse(probe.torch.cuda.is_initialized())

    def test_primitive_nested_spans_and_original_exception(self):
        ticks = iter((0., 1., 3., 5.))
        times = probe.Timings(lambda: next(ticks))
        error = RuntimeError("original")
        with self.assertRaises(RuntimeError) as caught:
            with times.span("parent"):
                with times.span("child"):
                    raise error
        self.assertIs(caught.exception, error)
        report = times.report()
        self.assertEqual([row["elapsedSeconds"] for row in report["spans"]], [5., 2.])
        self.assertEqual(report["spans"][1]["parent"], 0)
        self.assertEqual([row["completedCalls"] for row in report["spans"]], [0, 0])
        self.assertEqual(times.stack, [])
        json.dumps(report, allow_nan=False)

    def test_many_original_resource_calls_are_aggregated_not_skipped(self):
        times = probe.Timings()
        observed = []
        wrapped = times.wrap("resource", lambda: observed.append(len(observed)))
        for _ in range(12000): wrapped()
        self.assertEqual(len(observed), 12000)
        self.assertEqual(len(times.rows), 1)
        self.assertEqual(times.rows[0]["calls"], 12000)
        self.assertLess(len(json.dumps(times.report()).encode()), 32768)

    def test_scoped_timing_delegates_exact_arguments_once_and_restores(self):
        sentinel, output = object(), object()
        seen = []
        def original(*args, **kwargs):
            seen.append((args, kwargs)); return output
        times, counts = probe.Timings(), dict(autogradAttempts=0, autogradCompleted=0)
        old_forward, old_grad = probe.profile.sample_forward, probe.torch.autograd.grad
        with patch.object(probe.torch.autograd, "grad", original):
            with probe.instrument(times, counts):
                for _ in range(6):
                    self.assertIs(probe.torch.autograd.grad(sentinel, preserve=sentinel), output)
                with self.assertRaisesRegex(ValueError, "six total VJP"):
                    probe.torch.autograd.grad(sentinel)
            self.assertIs(probe.torch.autograd.grad, original)
        self.assertIs(probe.profile.sample_forward, old_forward)
        self.assertIs(probe.torch.autograd.grad, old_grad)
        self.assertEqual(len(seen), 6)
        self.assertTrue(all(args == (sentinel,) and kwargs == {"preserve": sentinel} for args, kwargs in seen))
        self.assertEqual(counts, dict(autogradAttempts=6, autogradCompleted=6))
        self.assertEqual(times.rows[0]["name"], "discriminator_vjp")
        self.assertEqual([row["name"] for row in times.rows[1:]], ["generator_vjp_" + s for s in probe.bridge.COMPONENTS_IN_ORDER])

    def test_contract_rejects_scope_resources_duplicates_and_old_admission(self):
        policy = json.loads((ROOT / probe.POLICY_PATH).read_text(encoding="utf-8"))
        run_id = "decode1-entry-cost-00000000-0000-0000-0000-000000000000"
        bound = dict(path=probe.POLICY_PATH, sha256="a" * 64)
        programs = policy["modelBoundary"]["frozenAlgorithmBindings"] + [dict(path=p, sha256="b" * 64) for p in (probe.PROGRAM, probe.TEST)]
        package = dict(schemaVersion="decode1-entry-training-cost-package-v1", runId=run_id, policy=bound,
            capabilityVersion=probe.CAPABILITY, scope=policy["scope"], resources=policy["resources"], programBindings=programs)
        request = dict(schemaVersion="decode1-entry-training-cost-request-v1", runId=run_id, mode="cpu_prepare",
            outputRoot=probe.OUTPUT + "/" + run_id, policy=bound, package=dict(path=probe.OUTPUT + "/" + run_id + "/package.json", sha256="c" * 64),
            deadlineUnixMs=100000)
        probe.validate_contract(request, package, policy, now=0)
        for location, key, value in (("request", "mode", "gpu_qualify"), ("policy", "resources", {}),
                ("package", "programBindings", programs + [programs[0]])):
            r, g, p = copy.deepcopy((request, package, policy))
            {"request": r, "package": g, "policy": p}[location][key] = value
            with self.assertRaises((ValueError, KeyError)):
                probe.validate_contract(r, g, p, now=0)

    def test_no_raster_or_archive_read_before_resource_or_mapping(self):
        class Mapping:
            project = ROOT
            def binding(self, *args, **kwargs): raise AssertionError("must not read")
        reader = probe.Reader(Mapping(), [], lambda: self.fail("forbidden content reached resource"))
        reader.rasters.add("data/other.png")
        for name in ("data/other.png", "data/old.pt", "data/old.npz"):
            with self.assertRaises(ValueError): reader.read(dict(path=name, sha256="a" * 64))


if __name__ == "__main__":
    with patch.object(probe.torch.cuda, "_lazy_init", side_effect=AssertionError("CPU tests cannot initialize CUDA")), \
            patch.object(probe.torch.nn.Module, "_call_impl", side_effect=AssertionError("CPU tests cannot forward")), \
            patch.object(probe.torch.optim.Optimizer, "__init__", side_effect=AssertionError("CPU tests cannot create optimizer")):
        unittest.main()
