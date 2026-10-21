"""Synthetic CPU tests and bound metadata only; never read the real tensor archive."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import psutil

# Private synthetic tests use the same pre-import CPU boundary as the driver.
_process = psutil.Process()
_allowed = _process.cpu_affinity()
assert _allowed
_process.cpu_affinity(_allowed[:2])
assert 0 < len(_process.cpu_affinity()) <= 2
import torch

ROOT = Path(__file__).absolute().parents[3]
spec = importlib.util.spec_from_file_location("saved_algebra_v4", ROOT / "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v4.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
torch.set_num_threads(2)


def fixture(size=4, count=108):
    graph = [{"name": f"p{i}", "shape": [size], "dtype": "torch.float32", "elements": size} for i in range(count)]
    groups, tensors = [], {}
    for label in audit.LABELS:
        rows = []
        for i in range(count):
            key = f"{label}.{i}"
            tensors[key] = torch.zeros(size, dtype=torch.float32)
            rows.append({"index": i, "name": graph[i]["name"], "unused": False, "key": key})
        groups.append({"label": label, "parameters": rows})
    return {"graph": graph, "gradients": groups}, tensors


def inventory_fixture():
    return {"runId": audit.RUN_ID, "minimalSourceBindings": {
        "boundedArchiveLoader": {"path": audit.LOADER_PATH, "sha256": audit.LOADER_SHA},
        "originalFp32FormulaReadOnlySource": {"path": "synthetic/formula.py", "sha256": "1" * 64},
        "originalToleranceReadOnlySource": {"path": "synthetic/tolerance.py", "sha256": "2" * 64}}}


def metadata_fixture():
    """Complete bounded JSON only: no model, real Run metadata or tensor archive."""
    graph = [{"name": f"synthetic.p{i}", "shape": [1], "dtype": "torch.float32", "elements": 1}
             for i in range(108)]
    graph[0].update(shape=[2242687 - 144 - 106], elements=2242687 - 144 - 106)
    graph[90] = {"name": audit.TARGET, "shape": [3, 48, 1, 1], "dtype": "torch.float32", "elements": 144}
    manifest = dict.fromkeys(audit.MANIFEST_KEYS)
    descriptors, states, groups = {}, [], []

    def descriptor(key, parameter):
        descriptors[key] = {"shape": list(parameter["shape"]), "dtype": parameter["dtype"],
                            "bytes": parameter["elements"] * 4, "sha256": "0" * 64,
                            "sourceDevice": "cpu", "sourceVersion": 0,
                            "capturedAtUtc": "2026-10-19T00:00:00Z", "allFinite": True}

    for index, parameter in enumerate(graph):
        key = f"generator.parameter.{index}"
        descriptor(key, parameter)
        states.append({"kind": "parameter", "name": parameter["name"], "key": key})
    for label in audit.LABELS:
        rows = []
        for index, parameter in enumerate(graph):
            key = f"gradient.{label}.{index}"
            descriptor(key, parameter)
            rows.append({"index": index, "name": parameter["name"], "unused": False, "key": key})
        groups.append({"label": label, "parameters": rows})
    descriptor("rng.torch_cpu", {"shape": [1], "dtype": "torch.uint8", "elements": 1})
    descriptors["rng.torch_cpu"]["bytes"] = 1
    context = {"runId": audit.RUN_ID, "modelBinding": {"path": "synthetic/model-identity.json", "sha256": "3" * 64},
               "programBindings": inventory_fixture()["minimalSourceBindings"], "split": "train",
               "sampleId": "ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2",
               "failurePosition": {"epoch": 15, "zeroBasedEpochPosition": 8, "trainIndex": 28,
                                   "sampleId": "ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2"},
               "optimizerSteps": {"generator": 680, "discriminator": 681}}
    manifest.update(schema="object-support-structure-gradient-failure-capture-v1",
                    archiveEncoding="gzip-torch-flat-cpu-v1", graph=graph, labels=list(audit.LABELS),
                    gradients=groups, tensorDescriptors=descriptors, status="captured", stateTiming="after_exception",
                    missing=[], nonfiniteTensorKeys=[], qualificationAllowed=False, replayAllowed=False,
                    networks={"generator": {"timing": "after_exception", "modes": {"": True}, "state": states},
                              "discriminator": {"timing": "after_exception", "modes": {"": True}, "state": []}},
                    rng={"timing": "after_exception", "numpy": {"synthetic": True}, "cudaDevices": []},
                    decompressedBytes=sum(d["bytes"] for d in descriptors.values()), context=context)
    error = {"message": "actual four-term total gradient identity differs at parameter 90"}
    plan = {"runId": audit.RUN_ID, "packageId": "synthetic-package", "modelBinding": context["modelBinding"],
            "programBindings": context["programBindings"]}
    terminal = {"runId": audit.RUN_ID, "packageId": plan["packageId"],
                "failurePosition": copy.deepcopy(context["failurePosition"]),
                "optimizerSteps": copy.deepcopy(context["optimizerSteps"]), "originalError": error,
                "captureReceipt": {"primaryError": error}}
    return copy.deepcopy({"quality-plan.json": plan, "model-identity.json": {"graph": graph},
                          "worker-terminal.json": terminal, "manifest.json": manifest,
                          "primary.json": {"context": context, "primaryError": error},
                          "capture-execution.json": {"runId": audit.RUN_ID, "modelBinding": context["modelBinding"],
                                                     "programBindings": context["programBindings"]}})


class AlgebraTests(unittest.TestCase):
    def test_complete_108_graph_target90_and_failures_after_target(self):
        graph = metadata_fixture()["manifest.json"]["graph"]
        m, t = fixture(size=1)
        m["graph"] = graph
        for group in m["gradients"]:
            for index, row in enumerate(group["parameters"]):
                row["name"] = graph[index]["name"]
                t[row["key"]] = torch.zeros(graph[index]["shape"], dtype=torch.float32)
        t["actualTotal.90"][2, 47, 0, 0] = 0.1
        t["actualTotal.107"][0] = 0.1
        resources = []
        result = audit.audit_gradients(m, t, torch, check_resource=lambda: resources.append(True))
        self.assertEqual(result["parameterCount"], 108)
        self.assertEqual(len(resources), 108)
        self.assertEqual(sum(p["elements"] for p in graph), 2242687)
        self.assertEqual(result["allFailingParameters"], [90, 107])
        self.assertEqual(result["totalFailedElements"], 2)
        self.assertEqual(result["parameter90"]["shape"], [3, 48, 1, 1])
        self.assertEqual(result["parameter90"]["firstFailure"]["coordinate"], [2, 47, 0, 0])
        self.assertEqual(result["parameter90"]["firstFailure"]["flatIndex"], 143)
        self.assertEqual(len(result["parameter90"]["failingElementDetails"]), 1)
        self.assertNotIn("parameter48", result)
        self.assertIn("not an independently computed", result["fp64Meaning"])
        self.assertTrue(audit.recorded_failure_comparison(result)["recordedFailureConfirmed"])

    def test_zero_pass_and_nonreproduction_remain_valid(self):
        m, t = fixture()
        result = audit.audit_gradients(m, t, torch)
        self.assertTrue(result["allPassOriginalGate"])
        self.assertIsNone(result["firstFailingParameter"])
        self.assertFalse(audit.recorded_failure_comparison(result)["recordedFailureConfirmed"])
        json.dumps(result, allow_nan=False)

    def test_original_order_and_multiple_failures(self):
        m, t = fixture()
        for i in (2, 90):
            t[f"actualTotal.{i}"][1] = 0.1
        r = audit.audit_gradients(m, t, torch)
        self.assertEqual(r["allFailingParameters"], [2, 90])
        self.assertEqual(r["totalFailedElements"], 2)
        self.assertEqual(r["parameter90"]["firstFailure"]["coordinate"], [1])
        self.assertEqual(r["parameter90"]["finiteToleranceFailureCount"], 1)
        self.assertFalse(audit.recorded_failure_comparison(r)["recordedFailureConfirmed"])

    def test_fp32_association_is_not_replaced_by_fp64(self):
        m, t = fixture(count=1)
        t["structuredObjective.0"][:] = 1e8
        t["wholeFrameFidelity.0"][:] = 1
        t["objectCoreRgb.0"][:] = -1e8
        t["objectSupportStructure.0"][:] = 1
        t["actualTotal.0"][:] = 1
        r = audit.audit_gradients(m, t, torch)
        self.assertTrue(r["allPassOriginalGate"])
        self.assertEqual(r["parameters"][0]["maxAbsActualMinusSavedValueFp64Sum"], 1)

    def test_finite_input_overflow_is_classified_not_aborted(self):
        m, t = fixture()
        maximum = torch.finfo(torch.float32).max
        t["structuredObjective.90"][0] = maximum
        t["wholeFrameFidelity.90"][0] = maximum
        r = audit.audit_gradients(m, t, torch)
        p = r["parameter90"]
        self.assertEqual(p["nonfiniteOrderedSumCount"], 1)
        self.assertEqual(p["finiteToleranceFailureCount"], 0)
        self.assertEqual(p["firstFailure"]["classification"], "nonfinite_ordered_fp32_sum")
        self.assertIsNone(p["firstFailure"]["expectedOrderedFp32"])
        self.assertTrue(audit.recorded_failure_comparison(r)["recordedFailureConfirmed"])
        json.dumps(r, allow_nan=False)

    def test_full_counts_bounded_locations(self):
        m, t = fixture(size=20000)
        t["actualTotal.90"][:] = 1
        r = audit.audit_gradients(m, t, torch)
        self.assertEqual(r["totalFailedElements"], 20000)
        self.assertEqual(len(r["parameter90"]["failureFlatIndices"]), 64)
        self.assertTrue(r["parameter90"]["failureLocationsTruncated"])
        self.assertLess(len(json.dumps(r, allow_nan=False)), 2 * 1024**2)

    def test_input_nonfinite_dtype_shape_and_grad_rejected(self):
        for value in (torch.full((4,), float("nan")), torch.full((4,), float("inf")),
                      torch.zeros(4, dtype=torch.float64), torch.zeros(3), torch.zeros(4, requires_grad=True)):
            m, t = fixture(count=1)
            t["actualTotal.0"] = value
            with self.assertRaisesRegex(ValueError, "shape/device/dtype/finite"):
                audit.audit_gradients(m, t, torch)

    def test_unused_is_exact_zero(self):
        m, t = fixture(count=1)
        m["gradients"][1]["parameters"][0]["unused"] = True
        del t["structuredObjective.0"]
        self.assertTrue(audit.audit_gradients(m, t, torch)["allPassOriginalGate"])

    def test_no_forward_autograd_optimizer_or_cuda_calls(self):
        m, t = fixture(count=1)
        with patch.object(torch.nn.Module, "_call_impl", side_effect=AssertionError("forward forbidden")), \
             patch.object(torch.nn.Module, "__init__", side_effect=AssertionError("model forbidden")), \
             patch.object(torch.nn.Module, "load_state_dict", side_effect=AssertionError("state installation forbidden")), \
             patch.object(torch, "load", side_effect=AssertionError("archive forbidden")), \
             patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")), \
             patch.object(torch.optim.Optimizer, "step", side_effect=AssertionError("optimizer forbidden")), \
             patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA forbidden")):
            self.assertTrue(audit.audit_gradients(m, t, torch)["allPassOriginalGate"])


class BindingTests(unittest.TestCase):
    def test_graph_order_shape_target_and_gradient_metadata_rejected(self):
        loader = audit.load_archive_module()
        def changed_graph(m):
            m["graph"][1], m["graph"][2] = m["graph"][2], m["graph"][1]
        def changed_gradient_order(m):
            rows = m["gradients"][0]["parameters"]
            rows[1], rows[2] = rows[2], rows[1]
        changes = [
            lambda m: m["graph"][90].update(name="foreign.target"),
            lambda m: m["graph"][90].update(shape=[144]),
            lambda m: m["graph"][0].update(elements=1),
            changed_graph, changed_gradient_order,
            lambda m: m["gradients"].reverse(),
            lambda m: m["gradients"][0]["parameters"].pop(),
            lambda m: m["gradients"][0]["parameters"][90].update(name="foreign"),
            lambda m: m["tensorDescriptors"]["gradient.actualTotal.90"].update(shape=[144]),
            lambda m: m["tensorDescriptors"]["gradient.actualTotal.90"].update(allFinite=False),
            lambda m: m.update(extra="unknown"),
        ]
        for change in changes:
            m = metadata_fixture()["manifest.json"]
            change(m)
            with self.assertRaises(ValueError):
                audit.validate_metadata(m, copy.deepcopy(m["graph"]), loader)

    def test_all_failure_identity_components_are_bound(self):
        changes = [
            lambda d: d["quality-plan.json"].update(runId="foreign"),
            lambda d: d["capture-execution.json"].update(runId="foreign"),
            lambda d: d["worker-terminal.json"].update(packageId="foreign"),
            lambda d: d["primary.json"].update(context={}),
            lambda d: d["capture-execution.json"].update(programBindings={}),
            lambda d: d["model-identity.json"]["graph"][90].update(name="foreign"),
            lambda d: d["worker-terminal.json"]["failurePosition"].update(epoch=14),
            lambda d: d["worker-terminal.json"]["failurePosition"].update(zeroBasedEpochPosition=9),
            lambda d: d["worker-terminal.json"]["optimizerSteps"].update(generator=679),
            lambda d: d["worker-terminal.json"]["optimizerSteps"].update(discriminator=680),
            lambda d: d["worker-terminal.json"].update(originalError={"message": "parameter 48"}),
        ]
        for change in changes:
            docs = metadata_fixture()
            # Break shared JSON-object aliases as independent bound file reads do.
            docs = json.loads(json.dumps(docs))
            change(docs)
            with self.assertRaises(ValueError):
                audit.verify_documents(docs)

    def test_current_metadata_cross_bindings_and_foreign_identity(self):
        docs = metadata_fixture()
        audit.verify_documents(docs)
        self.assertEqual(docs["model-identity.json"]["graph"][90]["name"], audit.TARGET)
        broken = copy.deepcopy(docs)
        broken["worker-terminal.json"]["runId"] = "foreign"
        with self.assertRaisesRegex(ValueError, "Run/context"):
            audit.verify_documents(broken)
        broken = copy.deepcopy(docs)
        broken["worker-terminal.json"]["failurePosition"]["trainIndex"] = 23
        with self.assertRaisesRegex(ValueError, "position/counts"):
            audit.verify_documents(broken)

    def test_strict_json_and_bound_hash_size(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'):
            with self.assertRaises(ValueError):
                audit.strict_json(raw)
        raw = b"bounded"
        binding = {"path": "test.json", "sha256": audit.digest(raw), "bytes": len(raw)}
        self.assertEqual(audit.binding_bytes(raw, binding, 8), raw)
        for changed in ({**binding, "sha256": "0" * 64}, {**binding, "bytes": 1}):
            with self.assertRaises(ValueError):
                audit.binding_bytes(raw, changed, 8)
        with self.assertRaises(ValueError):
            audit.binding_bytes(raw, binding, 1)
        with self.assertRaises(ValueError):
            audit.read_bound(ROOT, {"path": "../outside", "sha256": "0" * 64}, 1)

    def test_original_tolerance_only(self):
        self.assertEqual(audit.tolerance_from_source(b"TOTAL_GRADIENT_ATOL=1e-6\nTOTAL_GRADIENT_RTOL=1e-5\n"), (1e-6, 1e-5))
        with self.assertRaises(ValueError):
            audit.tolerance_from_source(b"TOTAL_GRADIENT_ATOL=1e-3\nTOTAL_GRADIENT_RTOL=1e-5\n")

    def test_old_policy_cannot_be_reused(self):
        for version in (1, 2, 3):
            old = {"schemaVersion": f"ai-painter-saved-gradient-algebra-cpu-policy-v{version}"}
            with self.assertRaisesRegex(ValueError, "policy schema"):
                audit.policy_check(old, inventory_fixture())

    def test_exact_repaired_policy_rejects_borrowed_attempt_and_resource_changes(self):
        inv = inventory_fixture()
        policy = {
            "schemaVersion": "ai-painter-saved-gradient-algebra-cpu-policy-v4",
            "runId": audit.RUN_ID, "scope": "saved_gradient_algebra_only", "resources": dict(audit.LIMITS),
            "registrationInputs": {"path": (audit.AUDIT_ROOT / "registration-inputs-v4.json").relative_to(ROOT).as_posix(),
                                   "sha256": audit.PINNED_INVENTORY_SHA},
            "target": {"parameterIndex": 90, "name": audit.TARGET, "shape": [3, 48, 1, 1]},
            "comparison": {"atol": 1e-6, "rtol": 1e-5},
            "outputRoot": (audit.AUDIT_ROOT / "attempt-001").relative_to(ROOT).as_posix(),
            "formalSpecification": {"version": "AI-PAINTER-SPEC-1.100"},
            "programBindings": {"driver": {"path": "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v4.py"},
                                "tests": {"path": "ml/ai-painter/tests/test_saved_gradient_algebra_cpu_v4.py"}}}
        self.assertIn("boundedArchiveLoader", audit.policy_check(policy, inv))
        for field, value in (("outputRoot", policy["outputRoot"].replace("001", "002")),
                             ("runId", "foreign"), ("scope", "training")):
            altered = copy.deepcopy(policy); altered[field] = value
            with self.assertRaises(ValueError):
                audit.policy_check(altered, inv)
        for field, value in (("maxWallSecondsIncludingStartup", 121), ("cpuThreads", 3), ("maxOutputMiB", 9)):
            altered = copy.deepcopy(policy); altered["resources"][field] = value
            with self.assertRaises(ValueError):
                audit.policy_check(altered, inv)
        altered = copy.deepcopy(inv); altered["minimalSourceBindings"]["boundedArchiveLoader"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "registered loader"):
            audit.policy_check(policy, altered)
        for key, value in (("parameterIndex", 48), ("name", "foreign"), ("shape", [144])):
            altered = copy.deepcopy(policy); altered["target"][key] = value
            with self.assertRaisesRegex(ValueError, "target/comparison"):
                audit.policy_check(altered, inv)
        for key in audit.LIMITS:
            altered = copy.deepcopy(policy); altered["resources"][key] += 1
            with self.assertRaisesRegex(ValueError, "resources"):
                audit.policy_check(altered, inv)
        for key in ("atol", "rtol"):
            altered = copy.deepcopy(policy); altered["comparison"][key] *= 10
            with self.assertRaisesRegex(ValueError, "target/comparison"):
                audit.policy_check(altered, inv)


    def test_loader_binding_and_complete_metadata_are_current_before_any_attempt(self):
        inventory = inventory_fixture()
        bound = inventory["minimalSourceBindings"]["boundedArchiveLoader"]
        self.assertEqual(bound["path"], audit.LOADER_PATH)
        self.assertEqual(bound["sha256"], audit.LOADER_SHA)
        loader = audit.load_archive_module()
        docs = metadata_fixture()
        audit.verify_documents(docs)
        audit.validate_metadata(docs["manifest.json"], docs["model-identity.json"]["graph"], loader)
        # Every source must belong to the same context, even in this JSON fixture.
        programs = docs["manifest.json"]["context"]["programBindings"].values()
        for bound in inventory["minimalSourceBindings"].values():
            self.assertTrue(any(b["path"] == bound["path"] and b["sha256"] == bound["sha256"] for b in programs))
        self.assertFalse(torch.cuda.is_initialized())

    def test_control_characters_unsafe_paths_and_internal_reparse_rejected(self):
        for value in ("../escape", ".runtime//escape", ".runtime/./escape", "/outside", "C:/outside",
                      ".runtime\\\\escape", "data/evil\\x00.json", "data/evil\\x1f.json", "data/evil\\x7f.json"):
            with self.assertRaises(ValueError, msg=repr(value)):
                audit.safe_path(ROOT, value)
        # Simulate a reparse attribute on an actual internal ancestor; no symlink
        # privilege or real junction creation is required for this negative case.
        target = ROOT / "ml/ai-painter"
        original = Path.lstat
        def redirected(item, *args, **kwargs):
            result = original(item, *args, **kwargs)
            if item == target:
                from types import SimpleNamespace
                return SimpleNamespace(st_mode=result.st_mode, st_file_attributes=0x400)
            return result
        with patch.object(Path, "lstat", redirected):
            with self.assertRaisesRegex(ValueError, "redirection"):
                audit.safe_path(ROOT, "ml/ai-painter/scripts/not-written.json")

    def test_exact_formal_runtime_mapping_is_allowed_without_creating_output(self):
        # Simulate the formal mapping in an OS-temp fixture; never touch an attempt.
        with tempfile.TemporaryDirectory(prefix="saved-gradient-cpu-v4-") as temporary:
            root = Path(temporary)
            physical = root / "storage/hot/runtime"
            physical.mkdir(parents=True)
            original_exists, original_resolve = Path.exists, Path.resolve
            def exists(item):
                return True if item == root / ".runtime" else original_exists(item)
            def resolve(item, *args, **kwargs):
                return physical if item == root / ".runtime" else original_resolve(item, *args, **kwargs)
            with patch.dict("os.environ", {"AI_PET_WORLD_DATA_ROOT": str(root / "storage")}), \
                 patch.object(Path, "exists", exists), patch.object(Path, "resolve", resolve):
                output = audit.safe_path(root, ".runtime/private/not-created.json")
                self.assertEqual(output, physical / "private/not-created.json")
                self.assertFalse(output.exists())
        self.assertEqual(audit.safe_path(ROOT, "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v4.py"),
                         ROOT / "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v4.py")


if __name__ == "__main__":
    unittest.main()
