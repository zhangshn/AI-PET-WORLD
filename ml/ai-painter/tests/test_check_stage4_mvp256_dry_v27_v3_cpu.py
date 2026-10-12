"""Complete dependency closure and real-project guards; synthetic execute only."""
from __future__ import annotations
import ast
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/tests"))
import torch
import check_stage4_mvp256_dry_v27_v3_cpu as checker
import check_stage4_mvp256_dry_v27_v2_cpu as previous
import test_check_stage4_mvp256_dry_v27_v2_cpu as v2_tests


@contextmanager
def fixture(before_load=None):
    # Reuse frozen input fixtures and actual nested-test execution, not their
    # production hashes, networks, loss, gradient or state assertions as mocks.
    with patch.object(v2_tests, "checker", checker), v2_tests.fixture(before_load) as value:
        yield value


class DependencyClosureTests(unittest.TestCase):
    def test_relative_package_child_parent_lazy_transitive_cycles_and_symbols(self):
        graph = {
            "ml/ai-painter/scripts/entry.py": "import pkg.client\nfrom pkg import branch\nfrom pkg.leaf import VALUE\n",
            "ml/ai-painter/src/pkg/__init__.py": "from . import leaf\n",
            "ml/ai-painter/src/pkg/client.py": "def lazy():\n from .child import code\n from .sub import run\n",
            "ml/ai-painter/src/pkg/leaf.py": "from . import branch\nVALUE=1\n",
            "ml/ai-painter/src/pkg/branch.py": "from . import leaf\n",
            "ml/ai-painter/src/pkg/child/__init__.py": "from .code import VALUE\n",
            "ml/ai-painter/src/pkg/child/code.py": "VALUE=2\n",
            "ml/ai-painter/src/pkg/sub/__init__.py": "from .. import leaf\n",
            "ml/ai-painter/src/pkg/sub/run.py": "from ..child import code\nfrom . import inner\n",
            "ml/ai-painter/src/pkg/sub/inner.py": "import math\n",
        }
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "ROOT", Path(directory)):
            for path, source in {**graph, "ml/ai-painter/src/pkg/unrelated.py": "UNUSED=1"}.items():
                target = Path(directory) / path; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source, encoding="utf8")
            result = checker.local_dependency_closure(["ml/ai-painter/scripts/entry.py"])
            self.assertEqual(result, sorted(graph))
            self.assertEqual(result, checker.local_dependency_closure(["ml/ai-painter/scripts/entry.py"]*2))
            for source in ("from ..bad import x", "import pkg.missing"):
                (Path(directory) / "ml/ai-painter/scripts/entry.py").write_text(source)
                with self.assertRaises(ValueError):
                    checker.local_dependency_closure(["ml/ai-painter/scripts/entry.py"])
            with self.assertRaises(ValueError):
                checker.local_dependency_closure(["../escape.py"])

    def test_real_project_closure_contains_all_independently_reviewed_dependencies(self):
        # Read only program references/source, never sample tensors or images.
        review = json.loads((ROOT / checker.V2_BINDINGS["dependencyReview"]["path"]).read_bytes())
        old_bindings = json.loads((ROOT / checker.V2_BINDINGS["contract"]["path"]).read_bytes())["programBindings"]
        seeds = [b["path"] for b in old_bindings]
        result = checker.local_dependency_closure(seeds)
        self.assertEqual(len(result), review["completeStaticProgramCount"])
        self.assertEqual(len(result), 60)
        self.assertTrue({b["path"] for b in review["missingFromFrozenCandidate"]}.issubset(result))
        self.assertIn("ml/ai-painter/src/ai_painter/blueprint/schema.py", result)
        current = checker.required_program_paths()
        self.assertTrue(set(result).issubset(current))
        self.assertIn(checker.PROGRAM, current)
        self.assertIn(checker.SUCCESS_TEST, current)

    def test_real_project_module_path_coverage_missing_sha_and_late_import_rejected(self):
        logical = "ml/ai-painter/src/ai_painter/blueprint/schema.py"
        module = types.ModuleType("synthetic_project_module")
        module.__file__ = str(ROOT / logical)
        reader = checker.data.BoundReader(ROOT)
        binding = checker.bind(logical)
        self.assertEqual(checker.verify_loaded_programs(reader, [binding], modules={"synthetic": module}), [logical])
        with self.assertRaisesRegex(ValueError, "unbound imported"):
            checker.verify_loaded_programs(reader, [], modules={"synthetic": module})
        with self.assertRaisesRegex(ValueError, "SHA mismatch"):
            checker.verify_loaded_programs(reader, [{"path": logical, "sha256": "0"*64}], modules={"synthetic": module})
        # Default sys.modules path also enforces the real ROOT; not only a
        # temporary fixture-root guard. All already loaded project sources bind.
        bindings = [checker.bind(p) for p in checker.required_program_paths()]
        with patch.dict(sys.modules, {"v27_synthetic_project_source": module}):
            self.assertIn(logical, checker.verify_loaded_programs(reader, bindings))
            missing = [b for b in bindings if b["path"] != logical]
            with self.assertRaisesRegex(ValueError, "unbound imported"):
                checker.verify_loaded_programs(reader, missing)
        bad_program = {"path": "docs/BUSINESS_SPEC.md", "sha256": checker.bind("docs/BUSINESS_SPEC.md")["sha256"]}
        with self.assertRaisesRegex(ValueError, "outside source roots"):
            checker.verify_loaded_programs(reader, [bad_program], modules={})
        with self.assertRaisesRegex(ValueError, "unsafe"):
            checker.verify_loaded_programs(reader, [{"path": "../escape.py", "sha256": "0"*64}], modules={})
        outside = types.ModuleType("synthetic_undeclared_project_directory")
        outside.__file__ = str(ROOT / "scripts/synthetic_undeclared.py")
        with self.assertRaisesRegex(ValueError, "outside declared source roots"):
            checker.verify_loaded_programs(reader, [], modules={"synthetic": outside})
        virtual = {name: sys.modules[name] for name in ("torch.ops", "torch.classes")}
        self.assertTrue(all(not Path(m.__file__).is_absolute() and m.__spec__ is None for m in virtual.values()))
        self.assertEqual(checker.verify_loaded_programs(reader, [], modules=virtual), [])
        # A real file with the same basename is never a name-based exemption.
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "ROOT", Path(directory)):
            path = Path(directory) / "_ops.py"; path.write_text("REAL_PROJECT_SOURCE=1")
            real = types.ModuleType("synthetic_real_source"); real.__file__ = str(path)
            with self.assertRaisesRegex(ValueError, "outside declared source roots"):
                checker.verify_loaded_programs(checker.data.BoundReader(Path(directory)), [], modules={"real": real})


class V3ExecuteTests(unittest.TestCase):
    def test_complete_success_same_real_math_state_and_dependency_phases(self):
        rng = torch.random.get_rng_state().clone(); threads = torch.get_num_threads()
        with fixture() as f:
            checker.execute(f.binding)
            report = f.report("report")
            self.assertEqual(report["schemaVersion"], "ai-painter-mvp256-dry-v27-cpu-check-v3")
            self.assertEqual(report["capabilityVersion"], checker.CAPABILITY)
            self.assertEqual(report["actualModelIdentity"], {"capabilityVersion": checker.MODEL_CAPABILITY,
                "executionQualified": False, "parentCheckpointLoaded": False})
            self.assertEqual(report["realCallCounts"], {"modelForwardsAttempted": 2, "modelForwardsCompleted": 2,
                "autogradGradCallsAttempted": 8, "autogradGradCallsCompleted": 8})
            self.assertEqual(report["initialState"], report["finalState"])
            self.assertEqual(len(f.digests), 8)
            self.assertTrue(report["terminalAssertionsCompleted"])
            self.assertEqual([p["phase"] for p in report["dependencyChecks"]], ["before_synthetic_suite",
                "before_sample_0", "after_sample_0_before_forward", "before_sample_43",
                "after_sample_43_before_forward", "terminal"])
            self.assertTrue(all(p["status"] == "verified" for p in report["dependencyChecks"]))
            for row in report["sampleResults"]:
                for group in row["gradientFacts"]["groupDiagnostics"].values():
                    self.assertGreater(group["coreL2"], 0); self.assertGreater(group["candidateL2"], 0)
            for name, module in f.modules.items():
                self.assertTrue(all(torch.equal(v, f.module_states[name][k]) for k, v in module.state_dict().items()))
                self.assertTrue(all(p.grad is None for p in module.parameters()))
            for sample, saved in f.samples:
                self.assertTrue(torch.equal(sample["image"], saved["image"]))
                self.assertTrue(torch.equal(sample["conditions"], saved["conditions"]))
                self.assertEqual(sample["objectInstanceTable"], saved["table"])
            self.assertEqual(report["boundary"]["optimizerSteps"], 0)
            self.assertFalse(report["boundary"]["gpuStarted"])
            old = (f.root / checker.DIRECTORY / "report.json").read_bytes()
            with self.assertRaisesRegex(ValueError, "consumed"): checker.execute(f.binding)
            with self.assertRaises(FileExistsError): checker.write_exclusive(checker.DIRECTORY+"/report.json", {})
            self.assertEqual(old, (f.root / checker.DIRECTORY / "report.json").read_bytes())
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertEqual(threads, torch.get_num_threads())

    def test_preflight_missing_module_rejected_before_any_sample_load(self):
        with fixture() as f:
            path = f.root / "ml/ai-painter/src/synthetic_unbound.py"
            path.parent.mkdir(parents=True); path.write_text("SYNTHETIC=1")
            module = types.ModuleType("synthetic_unbound"); module.__file__ = str(path)
            with patch.dict(sys.modules, {"v27_synthetic_unbound": module}):
                with self.assertRaisesRegex(ValueError, "unbound imported"):
                    checker.execute(f.binding)
            self.assertEqual(f.load_calls, 0)
            failure = f.report("failure")
            self.assertEqual(failure["realCallCounts"], {"modelForwardsAttempted": 0, "modelForwardsCompleted": 0,
                "autogradGradCallsAttempted": 0, "autogradGradCallsCompleted": 0})
            self.assertFalse(failure["terminalAssertionsCompleted"])

    def test_late_dependency_failure_retains_first_sample_and_raw_counts(self):
        def inject(f, row):
            if row["ordinal"] == 43:
                path = f.root / "ml/ai-painter/src/synthetic_late.py"
                path.parent.mkdir(parents=True, exist_ok=True); path.write_text("SYNTHETIC=1")
                module = types.ModuleType("synthetic_late"); module.__file__ = str(path)
                f.stack.enter_context(patch.dict(sys.modules, {"v27_synthetic_late": module}))
        with fixture(inject) as f:
            with self.assertRaisesRegex(ValueError, "unbound imported"):
                checker.execute(f.binding)
            failure = f.report("failure")
            self.assertEqual(failure["realCallCounts"], {"modelForwardsAttempted": 1, "modelForwardsCompleted": 1,
                "autogradGradCallsAttempted": 4, "autogradGradCallsCompleted": 4})
            self.assertEqual([r["trainOrdinal"] for r in failure["partialSampleResults"]], [0])
            self.assertEqual(failure["dependencyChecks"][-1]["phase"], "after_sample_43_before_forward")
            self.assertEqual(failure["dependencyChecks"][-1]["status"], "started")
            self.assertFalse(failure["terminalAssertionsCompleted"])
            self.assertFalse((f.root / checker.DIRECTORY / "report.json").exists())

    def test_inherited_state_partial_gradient_and_three_api_fault_guarantees(self):
        # Invoke frozen v2 fault assertions against the actual new execute.
        # No imported TestCase class is exposed to discovery as a duplicate.
        with patch.object(v2_tests, "checker", checker):
            for name in ("test_model_and_critic_state_mutations_rejected_without_overwrite",
                         "test_partial_autograd_exception_retains_raw_attempted_completed_counts",
                         "test_each_of_three_v1_api_regressions_detected_by_execute"):
                case = v2_tests.V27V2ExecuteTests(name)
                case.setUp()
                getattr(case, name)()


class V3StructureTests(unittest.TestCase):
    def test_v2_bytes_constants_and_execute_math_unchanged_after_guard_metadata_normalization(self):
        for binding in (checker.V2_BINDINGS["program"], checker.V2_BINDINGS["tests"]):
            self.assertEqual(checker.bind(binding["path"]), binding)
        for path, expected in v2_tests.FROZEN.items():
            self.assertEqual(checker.bind(path)["sha256"], expected)
        self.assertEqual(checker.MODEL_PLAN, previous.MODEL_PLAN)
        self.assertEqual(checker.GRADIENT_PLAN, previous.GRADIENT_PLAN)
        self.assertEqual(checker.RESOURCES, previous.RESOURCES)
        self.assertEqual(checker.ACTIVATION, previous.ACTIVATION)
        def functions(path):
            return {n.name: n for n in ast.parse((ROOT/path).read_text(encoding="utf8")).body if isinstance(n, ast.FunctionDef)}
        old, new = functions(previous.PROGRAM), functions(checker.PROGRAM)
        for name in ("selected_metadata", "selected_asset_bindings", "project_file", "bind", "write_exclusive", "zero_update_guard", "synthetic_suite"):
            self.assertEqual(ast.dump(old[name]), ast.dump(new[name]), name)
        normalized = deepcopy(new["execute"])
        class Normalize(ast.NodeTransformer):
            def visit_Expr(self, node):
                if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name) and node.value.func.id == "check_program_coverage":
                    return None
                return self.generic_visit(node)
            def visit_Assign(self, node):
                if any(isinstance(t, ast.Tuple) and any(isinstance(e, ast.Name) and e.id == "dependency_checks" for e in t.elts) for t in node.targets):
                    return None
                return self.generic_visit(node)
            def visit_Dict(self, node):
                remove = {"dependencyChecks", "terminalAssertionsCompleted", "partialSampleResults", "availableInitialState"}
                pairs = [(k, v) for k, v in zip(node.keys, node.values) if not (isinstance(k, ast.Constant) and k.value in remove)]
                node.keys, node.values = [k for k, _ in pairs], [v for _, v in pairs]
                return self.generic_visit(node)
            def visit_Constant(self, node):
                if node.value == "ai-painter-mvp256-dry-v27-cpu-check-v3": node.value = "ai-painter-mvp256-dry-v27-cpu-check-v2"
                return node
        normalized = Normalize().visit(normalized)
        # Restore the original sample-list declaration position, and original
        # terminal runtime-coverage block (the only replaced execute block).
        old_with = next(n for n in ast.walk(old["execute"]) if isinstance(n, ast.With) and any(
            isinstance(i.context_expr, ast.Call) and isinstance(i.context_expr.func, ast.Attribute)
            and i.context_expr.func.attr == "fork_rng" for i in n.items))
        new_with = next(n for n in ast.walk(normalized) if isinstance(n, ast.With) and any(
            isinstance(i.context_expr, ast.Call) and isinstance(i.context_expr.func, ast.Attribute)
            and i.context_expr.func.attr == "fork_rng" for i in n.items))
        declaration = next(n for n in old_with.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "sample_results" for t in n.targets))
        loop_index = next(i for i, n in enumerate(new_with.body) if isinstance(n, ast.For))
        new_with.body.insert(loop_index, deepcopy(declaration))
        terminal_start = next(i for i, n in enumerate(old_with.body) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "frozen" for t in n.targets))
        terminal = old_with.body[terminal_start:terminal_start+2]
        insert_at = next(i for i, n in enumerate(new_with.body) if isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)
            and isinstance(n.value.func, ast.Attribute) and n.value.func.attr == "unchanged")
        new_with.body[insert_at:insert_at] = deepcopy(terminal)
        self.assertEqual(ast.dump(old["execute"]), ast.dump(normalized))


if __name__ == "__main__":
    unittest.main()
