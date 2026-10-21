"""Synthetic CPU tests and bound metadata only; never read the real tensor archive."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import torch

ROOT = Path(__file__).absolute().parents[3]
spec = importlib.util.spec_from_file_location("saved_algebra_v3", ROOT / "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v3.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
torch.set_num_threads(2)


def fixture(size=4, count=49):
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


class AlgebraTests(unittest.TestCase):
    def test_zero_pass_and_nonreproduction_remain_valid(self):
        m, t = fixture()
        result = audit.audit_gradients(m, t, torch)
        self.assertTrue(result["allPassOriginalGate"])
        self.assertIsNone(result["firstFailingParameter"])
        self.assertFalse(audit.recorded_failure_comparison(result)["recordedFailureConfirmed"])
        json.dumps(result, allow_nan=False)

    def test_original_order_and_multiple_failures(self):
        m, t = fixture()
        for i in (2, 48):
            t[f"actualTotal.{i}"][1] = 0.1
        r = audit.audit_gradients(m, t, torch)
        self.assertEqual(r["allFailingParameters"], [2, 48])
        self.assertEqual(r["totalFailedElements"], 2)
        self.assertEqual(r["parameter48"]["firstFailure"]["coordinate"], [1])
        self.assertEqual(r["parameter48"]["finiteToleranceFailureCount"], 1)
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
        t["structuredObjective.48"][0] = maximum
        t["wholeFrameFidelity.48"][0] = maximum
        r = audit.audit_gradients(m, t, torch)
        p = r["parameter48"]
        self.assertEqual(p["nonfiniteOrderedSumCount"], 1)
        self.assertEqual(p["finiteToleranceFailureCount"], 0)
        self.assertEqual(p["firstFailure"]["classification"], "nonfinite_ordered_fp32_sum")
        self.assertIsNone(p["firstFailure"]["expectedOrderedFp32"])
        self.assertTrue(audit.recorded_failure_comparison(r)["recordedFailureConfirmed"])
        json.dumps(r, allow_nan=False)

    def test_full_counts_bounded_locations(self):
        m, t = fixture(size=20000)
        t["actualTotal.48"][:] = 1
        r = audit.audit_gradients(m, t, torch)
        self.assertEqual(r["totalFailedElements"], 20000)
        self.assertEqual(len(r["parameter48"]["failureFlatIndices"]), 64)
        self.assertTrue(r["parameter48"]["failureLocationsTruncated"])
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
             patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")), \
             patch.object(torch.optim.Optimizer, "step", side_effect=AssertionError("optimizer forbidden")), \
             patch.object(torch.cuda, "init", side_effect=AssertionError("CUDA forbidden")):
            self.assertTrue(audit.audit_gradients(m, t, torch)["allPassOriginalGate"])


class BindingTests(unittest.TestCase):
    def test_current_metadata_cross_bindings_and_foreign_identity(self):
        inv = json.loads((audit.AUDIT_ROOT / "registration-inputs-v2.json").read_text())
        docs = {Path(b["path"]).name: audit.strict_json(audit.read_bound(ROOT, b, 2 * 1024**2))
                for b in inv["inputs"] if not b["path"].endswith("tensors.pt")}
        audit.verify_documents(docs)
        self.assertEqual(docs["model-identity.json"]["graph"][48]["name"], audit.TARGET)
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
        old = json.loads((ROOT / "data/ai-painter/system-governance/ai-painter-saved-gradient-algebra-cpu-policy-v1.json").read_text())
        inv = json.loads((audit.AUDIT_ROOT / "registration-inputs-v2.json").read_text())
        with self.assertRaisesRegex(ValueError, "policy schema"):
            audit.policy_check(old, inv)

    def test_exact_repaired_policy_rejects_borrowed_attempt_and_resource_changes(self):
        inv = json.loads((audit.AUDIT_ROOT / "registration-inputs-v2.json").read_text())
        policy = {
            "schemaVersion": "ai-painter-saved-gradient-algebra-cpu-policy-v3",
            "runId": audit.RUN_ID, "scope": "saved_gradient_algebra_only", "resources": dict(audit.LIMITS),
            "registrationInputs": {"path": (audit.AUDIT_ROOT / "registration-inputs-v2.json").relative_to(ROOT).as_posix(),
                                   "sha256": audit.PINNED_INVENTORY_SHA},
            "target": {"parameterIndex": 48, "name": audit.TARGET, "shape": [48, 144, 3, 3]},
            "comparison": {"atol": 1e-6, "rtol": 1e-5},
            "outputRoot": (audit.AUDIT_ROOT / "attempt-002").relative_to(ROOT).as_posix(),
            "formalSpecification": {"version": "AI-PAINTER-SPEC-1.88"},
            "programBindings": {"driver": {"path": "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v3.py"},
                                "tests": {"path": "ml/ai-painter/tests/test_saved_gradient_algebra_cpu_v3.py"}}}
        self.assertIn("boundedArchiveLoader", audit.policy_check(policy, inv))
        for field, value in (("outputRoot", policy["outputRoot"].replace("002", "001")),
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


    def test_loader_binding_and_complete_metadata_are_current_before_any_attempt(self):
        inventory = json.loads((audit.AUDIT_ROOT / "registration-inputs-v2.json").read_text())
        bound = inventory["minimalSourceBindings"]["boundedArchiveLoader"]
        self.assertEqual(bound["path"], audit.LOADER_PATH)
        self.assertEqual(bound["sha256"], audit.LOADER_SHA)
        loader = audit.load_archive_module()
        docs = {Path(b["path"]).name: audit.strict_json(audit.read_bound(ROOT, b, 2 * 1024**2))
                for b in inventory["inputs"] if not b["path"].endswith("tensors.pt")}
        audit.verify_documents(docs)
        audit.validate_metadata(docs["manifest.json"], docs["model-identity.json"]["graph"], loader)
        # Each minimum source belongs to this actual failed run, not a replacement.
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
        logical = audit.AUDIT_ROOT.relative_to(ROOT).as_posix() + "/not-created-boundary-test.json"
        physical = audit.safe_path(ROOT, logical)
        self.assertEqual(physical, (ROOT / logical).resolve())
        self.assertFalse(physical.exists())
        self.assertEqual(audit.safe_path(ROOT, "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v3.py"),
                         ROOT / "ml/ai-painter/scripts/check_saved_gradient_algebra_cpu_v3.py")


if __name__ == "__main__":
    unittest.main()
