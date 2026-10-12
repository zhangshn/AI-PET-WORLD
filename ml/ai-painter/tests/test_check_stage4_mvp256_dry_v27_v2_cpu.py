"""V2 execute success/faults on isolated synthetic inputs, never real claims.

Only contract/data input, evidence root and nested test dispatch are replaced.
Networks, objectives, gradients, state_hash and execute state assertions remain
production code. Nested dispatch runs one actual frozen V27 test (not a fake
passed flag); the outer production suite runs all old 15 plus this module.
"""
from __future__ import annotations
import ast
from contextlib import contextmanager, ExitStack
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/tests"))
import torch
import check_stage4_mvp256_dry_v27_v2_cpu as checker
import check_stage4_mvp256_dry_v27_cpu as predecessor
from test_object_head_shared_hidden_v27_cpu import ORDER, scene
import test_object_head_shared_hidden_priority_v27_cpu as priority_tests
from ai_painter.complete_world.split_training import state_hash

FROZEN = {
    "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_cpu.py": "2095d0ff9ac523e9214e373c3c7ba66af2adf05e451a83a3653fa4a734238bd4",
    "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_v27_cpu.py": "0ab84057e50f689015e75b18891f1ff660310ec61a6aa13045eb393b5580e2b0",
    "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_priority_v27_cpu.py": "fa4aeede83c63546141d40e06b08110822cc5655084438d33f8dde7ccb4f31c5",
    "ml/ai-painter/tests/test_object_head_shared_hidden_v27_cpu.py": "4851b9c07aff14f43a120ef86edadf7432b1c1a9300d7f82494e7a77f62ab707",
    "ml/ai-painter/tests/test_object_head_shared_hidden_v27_integration_cpu.py": "ba0f9add113e68f8c28ba66c743ae3947ba67f1e385e47a67ed5fda51a86c254",
    "ml/ai-painter/tests/test_object_head_shared_hidden_priority_v27_cpu.py": "729d4077b5412ab3dd3a7ec0d77288ad8eb7c38b614636c71cac2ec32cbb01e9",
}


def nested_fixture_suite():
    suite = unittest.TestSuite([priority_tests.PriorityTests("test_zero_nonconflict_orthogonal_byte_and_identity_preservation")])
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream).run(suite)
    return {"testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
        "skipped": len(result.skipped), "passed": result.wasSuccessful(), "rawOutput": stream.getvalue(),
        "scope": "isolated_fixture_nested_dispatch_one_actual_test_outer_suite_runs_all_frozen_tests"}


class FixtureReader:
    def __init__(self, root):
        self.root, self.observed = Path(root), {}

    def read(self, binding):
        path = self.root / binding["path"]
        value = path.read_bytes()
        if hashlib.sha256(value).hexdigest() != binding["sha256"]:
            raise ValueError("synthetic input SHA mismatch")
        self.observed[binding["path"]] = binding["sha256"]
        return value

    def json(self, binding):
        return json.loads(self.read(binding))

    def unchanged(self):
        for path, sha in self.observed.copy().items():
            self.read({"path": path, "sha256": sha})


class Fixture:
    def __init__(self, root, stack, before_load=None):
        self.root, self.stack = root, stack
        self.modules, self.digests, self.samples = {}, [], []
        self.module_states = {}
        self.load_calls = 0
        path = root / checker.CONTRACT_PATH
        path.parent.mkdir(parents=True)
        payload = b'{"scope":"synthetic_inputs_only_not_real_cpu_qualification"}'
        path.write_bytes(payload)
        self.binding = {"path": checker.CONTRACT_PATH, "sha256": hashlib.sha256(payload).hexdigest()}
        c = {"formalSpecification": self.binding, "historicalParentSpecification": self.binding,
             "programBindings": []}
        manifest = {"identityPayload": {"channelOrder": list(ORDER), "continuousChannelIds": list(ORDER[15:])}}
        rows = [{"ordinal": 0}, {"ordinal": 43}]
        def input_contract(reader, binding):
            reader.json(binding)
            return c, manifest, rows
        def load_sample(_reader, row, order, continuous):
            self.load_calls += 1
            if before_load:
                before_load(self, row)
            self.assert_order = (tuple(order), tuple(continuous))
            # Distinct synthetic layouts/targets exercise both production rows.
            offset = 0 if row["ordinal"] == 0 else 8
            conditions, table = scene(((40+offset, 40, 7, "tree"),
                (100, 70+offset, 13, "rock"), (160-offset, 120, 21, "shrub")))
            target = torch.linspace(.1+offset/100, .9, 256)[None, None, :].expand(3, 192, 256).contiguous()
            sample = {"split": "train", "sampleId": "synthetic-ordinal-"+str(row["ordinal"]),
                "image": target, "conditions": conditions[0], "objectInstanceTable": table}
            self.samples.append((sample, {"image": target.clone(), "conditions": conditions[0].clone(),
                                         "table": deepcopy(table)}))
            return sample, {"sampleId": sample["sampleId"], "split": "train", "syntheticOnly": True}
        stack.enter_context(patch.object(checker, "ROOT", root))
        stack.enter_context(patch.object(checker.data, "BoundReader", FixtureReader))
        stack.enter_context(patch.object(checker, "validate_contract", side_effect=input_contract))
        stack.enter_context(patch.object(checker.data, "load_sample", side_effect=load_sample))
        stack.enter_context(patch.object(checker, "synthetic_suite", side_effect=nested_fixture_suite))
        previous_profile = sys.getprofile()
        def trace(frame, event, value):
            if frame.f_code is state_hash.__code__ and frame.f_back.f_code.co_name == "execute":
                caller = frame.f_back.f_locals
                if event == "call":
                    for name in ("model", "critic"):
                        if name not in self.modules:
                            self.modules[name] = caller[name]
                            self.module_states[name] = deepcopy(caller[name].state_dict())
                elif event == "return":
                    self.digests.append(value)
            return trace
        # Observe real API returns without replacing the state hash implementation.
        sys.setprofile(trace)
        stack.callback(sys.setprofile, previous_profile)

    def report(self, name):
        return json.loads((self.root / checker.DIRECTORY / (name+".json")).read_bytes())


@contextmanager
def fixture(before_load=None):
    with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
        yield Fixture(Path(directory), stack, before_load)


class V27V2ExecuteTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads()
        self.rng = torch.random.get_rng_state().clone()

    def assert_restored(self):
        self.assertEqual(self.threads, torch.get_num_threads())
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())

    def test_complete_success_real_network_loss_gradients_hashes_and_exclusive_report(self):
        with fixture() as f:
            binding = checker.execute(f.binding)
            report = f.report("report")
            original = (f.root / binding["path"]).read_bytes()
            self.assertEqual(hashlib.sha256(original).hexdigest(), binding["sha256"])
            self.assertEqual(report["schemaVersion"], "ai-painter-mvp256-dry-v27-cpu-check-v2")
            self.assertEqual(report["capabilityVersion"], checker.CAPABILITY)
            self.assertEqual(report["actualModelIdentity"], {"capabilityVersion": checker.MODEL_CAPABILITY,
                "executionQualified": False, "parentCheckpointLoaded": False})
            self.assertEqual(f.modules["model"].capability_version, report["actualModelIdentity"]["capabilityVersion"])
            self.assertEqual(report["initialState"], report["finalState"])
            self.assertEqual(len(f.digests), 8)  # initial 2, each sample 2, terminal 2
            for i in range(0, 8, 2):
                self.assertEqual(f.digests[i:i+2], [report["initialState"]["model"], report["initialState"]["critic"]])
            self.assertEqual(report["realCallCounts"], {"modelForwardsAttempted": 2, "modelForwardsCompleted": 2,
                "autogradGradCallsAttempted": 8, "autogradGradCallsCompleted": 8})
            self.assertEqual([r["trainOrdinal"] for r in report["sampleResults"]], [0, 43])
            self.assertEqual(f.load_calls, 2)
            self.assertEqual(report["syntheticEvidence"]["testsRun"], 1)
            self.assertTrue(report["syntheticEvidence"]["passed"])
            for row in report["sampleResults"]:
                facts = row["gradientFacts"]
                self.assertEqual((facts["parameterElementCount"], facts["parameterTensorCount"]), (2236015, 100))
                self.assertEqual(facts["objectParameterTensorCount"], 10)
                self.assertEqual(len(facts["groupDiagnostics"]), 5)
                for group in facts["groupDiagnostics"].values():
                    self.assertGreater(group["coreL2"], 0)
                    self.assertGreater(group["candidateL2"], 0)
            for name, module in f.modules.items():
                self.assertTrue(all(torch.equal(v, f.module_states[name][k]) for k, v in module.state_dict().items()))
                self.assertTrue(all(p.grad is None for p in module.parameters()))
            for sample, saved in f.samples:
                self.assertTrue(torch.equal(sample["image"], saved["image"]))
                self.assertTrue(torch.equal(sample["conditions"], saved["conditions"]))
                self.assertEqual(sample["objectInstanceTable"], saved["table"])
            self.assertTrue(f.modules["model"].training)
            self.assertTrue(all(not m.training for m in f.modules["critic"].modules()))
            self.assertTrue(all(not p.requires_grad for p in f.modules["critic"].parameters()))
            self.assertTrue(all(value is False for key, value in report["boundary"].items() if key != "optimizerSteps"))
            self.assertEqual(report["boundary"]["optimizerSteps"], 0)
            with self.assertRaisesRegex(ValueError, "consumed"):
                checker.execute(f.binding)
            with self.assertRaises(FileExistsError):
                checker.write_exclusive(binding["path"], {"overwrite": True})
            self.assertEqual(original, (f.root / binding["path"]).read_bytes())
            self.assertFalse((f.root / checker.DIRECTORY / "failure.json").exists())
        self.assert_restored()

    def test_model_and_critic_state_mutations_rejected_without_overwrite(self):
        for name in ("model", "critic"):
            with self.subTest(module=name):
                def inject(f, row):
                    if row["ordinal"] == 0:
                        with torch.no_grad():
                            next(f.modules[name].parameters()).add_(.001)
                with fixture(inject) as f:
                    with self.assertRaisesRegex(ValueError, "zero-update state changed"):
                        checker.execute(f.binding)
                    failure = f.report("failure")
                    self.assertEqual(failure["realCallCounts"], {"modelForwardsAttempted": 1, "modelForwardsCompleted": 1,
                        "autogradGradCallsAttempted": 4, "autogradGradCallsCompleted": 4})
                    before = (f.root / checker.DIRECTORY / "failure.json").read_bytes()
                    with self.assertRaisesRegex(ValueError, "consumed"):
                        checker.execute(f.binding)
                    self.assertEqual(before, (f.root / checker.DIRECTORY / "failure.json").read_bytes())
                    self.assertFalse((f.root / checker.DIRECTORY / "report.json").exists())
                self.assert_restored()

    def test_partial_autograd_exception_retains_raw_attempted_completed_counts(self):
        original_grad = torch.autograd.grad
        calls = [0]
        def inject(f, row):
            if row["ordinal"] == 0:
                def failing_grad(*args, **kwargs):
                    calls[0] += 1
                    if calls[0] == 2:
                        raise RuntimeError("injected second real differentiation")
                    return original_grad(*args, **kwargs)
                f.stack.enter_context(patch.object(torch.autograd, "grad", side_effect=failing_grad))
        with fixture(inject) as f:
            with self.assertRaisesRegex(RuntimeError, "second real differentiation"):
                checker.execute(f.binding)
            self.assertEqual(f.report("failure")["realCallCounts"], {"modelForwardsAttempted": 1,
                "modelForwardsCompleted": 1, "autogradGradCallsAttempted": 2, "autogradGradCallsCompleted": 1})
            self.assertFalse((f.root / checker.DIRECTORY / "report.json").exists())
            self.assertTrue(all(p.grad is None for n in f.modules.values() for p in n.parameters()))
        self.assert_restored()

    def test_each_of_three_v1_api_regressions_detected_by_execute(self):
        tree = ast.parse((ROOT / checker.PROGRAM).read_text(encoding="utf8"))
        execute_node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "execute")
        locations = sorted({n.lineno for n in ast.walk(execute_node) if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Name) and n.func.id == "state_hash"})
        self.assertEqual(len(locations), 3)
        for location, expected in zip(locations, ((0, 0), (1, 4), (2, 8))):
            with self.subTest(api_line=location):
                mutated = deepcopy(execute_node)
                for node in ast.walk(mutated):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "state_hash" and node.lineno == location:
                        node.args[0] = node.args[0].func.value  # restore erroneous nn.Module argument
                namespace = dict(checker.__dict__)
                # Keep execute's production globals live under temporary fixture patches.
                with fixture() as f:
                    namespace.update(checker.__dict__)
                    exec(compile(ast.fix_missing_locations(ast.Module(body=[mutated], type_ignores=[])), "<synthetic-v1-api-regression>", "exec"), namespace)
                    with self.assertRaisesRegex(TypeError, "unsupported state value"):
                        namespace["execute"](f.binding)
                    counts = f.report("failure")["realCallCounts"]
                    self.assertEqual((counts["modelForwardsCompleted"], counts["autogradGradCallsCompleted"]), expected)
                    self.assertFalse((f.root / checker.DIRECTORY / "report.json").exists())
                self.assert_restored()


class V27V2StructureTests(unittest.TestCase):
    def test_frozen_six_files_and_execution_ast_only_allowed_api_identity_changes(self):
        for path, expected in FROZEN.items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected, path)
        old = ast.parse((ROOT / predecessor.PROGRAM).read_text(encoding="utf8"))
        new = ast.parse((ROOT / checker.PROGRAM).read_text(encoding="utf8"))
        old_functions = {n.name: n for n in old.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
        new_functions = {n.name: n for n in new.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
        for name in ("selected_metadata", "selected_asset_bindings", "project_file", "bind", "write_exclusive", "zero_update_guard", "synthetic_suite"):
            self.assertEqual(ast.dump(old_functions[name]), ast.dump(new_functions[name]), name)
        normalized = deepcopy(new_functions["execute"])
        # Explicit task addition: check/report actual instance identity separately
        # from the independent checker capability; these are metadata assertions.
        for node in ast.walk(normalized):
            if isinstance(node, ast.With):
                node.body = [n for n in node.body if not (
                    isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "actual_model" for t in n.targets))
                    and not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)
                        and any(isinstance(a, ast.Constant) and a.value == "actual V27 model identity differs" for a in n.value.args))]
            if isinstance(node, ast.Dict):
                pairs = [(k, v) for k, v in zip(node.keys, node.values)
                         if not (isinstance(k, ast.Constant) and k.value == "actualModelIdentity")]
                node.keys, node.values = [k for k, _ in pairs], [v for _, v in pairs]
        calls = 0
        for node in ast.walk(normalized):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "state_hash":
                self.assertIsInstance(node.args[0], ast.Call)
                self.assertEqual(node.args[0].func.attr, "state_dict")
                node.args[0] = node.args[0].func.value
                calls += 1
            if isinstance(node, ast.Constant) and node.value == "ai-painter-mvp256-dry-v27-cpu-check-v2":
                node.value = "ai-painter-mvp256-dry-v27-cpu-check-v1"
        self.assertEqual(calls, 6)
        self.assertEqual(ast.dump(old_functions["execute"]), ast.dump(normalized))
        self.assertEqual(checker.MODEL_PLAN, predecessor.MODEL_PLAN)
        self.assertEqual(checker.GRADIENT_PLAN, predecessor.GRADIENT_PLAN)
        self.assertEqual(checker.RESOURCES, predecessor.RESOURCES)
        self.assertEqual(checker.ACTIVATION, predecessor.ACTIVATION)
        self.assertNotEqual(checker.CAPABILITY, checker.MODEL_CAPABILITY)
        self.assertEqual(checker.MODEL_CAPABILITY, predecessor.CAPABILITY)

    def test_predecessor_gate_requires_exact_error_zero_counts_and_consumed_claim(self):
        contract = {"predecessorContract": checker.PREDECESSOR_CONTRACT,
            "predecessorFailure": checker.PREDECESSOR_FAILURE, "predecessorProgram": checker.PREDECESSOR_PROGRAM,
            "predecessorClaim": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/claim.json", "sha256": "synthetic"},
            "predecessorAcceptance": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/controller-acceptance.json", "sha256": "synthetic"}}
        parent = {"schemaVersion": "stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v1",
            "capabilityVersion": checker.MODEL_CAPABILITY, "programBindings": []}
        failure = {"status": "cpu_check_failed_closed", "contract": checker.PREDECESSOR_CONTRACT,
            "errorType": "TypeError", "error": "unsupported state value: SharedHiddenRenderer",
            "realCallCounts": {"modelForwardsAttempted": 0, "modelForwardsCompleted": 0,
                "autogradGradCallsAttempted": 0, "autogradGradCallsCompleted": 0}}
        claim = {"contract": checker.PREDECESSOR_CONTRACT, "attempt": 1, "automaticRetries": 0}
        class Reader:
            def read(self, _binding): return b"synthetic already bound input"
            def json(self, binding):
                if binding == checker.PREDECESSOR_CONTRACT: return parent
                if binding == checker.PREDECESSOR_FAILURE: return failure
                return claim
        checker.validate_predecessor(Reader(), contract)
        for key, value in (("error", "arbitrary failure"), ("realCallCounts", {**failure["realCallCounts"], "modelForwardsAttempted": 1})):
            saved = failure[key]; failure[key] = value
            with self.assertRaisesRegex(ValueError, "exact zero-call"):
                checker.validate_predecessor(Reader(), contract)
            failure[key] = saved
        claim["automaticRetries"] = 1
        with self.assertRaisesRegex(ValueError, "consumed"):
            checker.validate_predecessor(Reader(), contract)


if __name__ == "__main__":
    unittest.main()
