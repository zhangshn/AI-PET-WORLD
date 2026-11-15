"""Network snapshot interface tests without importing a model or tensor backend."""
import ast
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
PARENT = "painter_stage4_ecology_terrain_detail_weight_training_profile_v1.py"
CPU = "painter_stage4_object_support_structure_training_profile_cpu_v1.py"
DECODE = "painter_stage4_decode1_entry_weight_training_profile_v1.py"


def function(name, file, bindings):
    tree = ast.parse((SCRIPTS / file).read_text(encoding="utf-8-sig"))
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    namespace = dict(bindings)
    exec(compile(ast.Module(body=[node], type_ignores=[]), file, "exec"), namespace)
    return namespace[name]


class NetworkSnapshotBoundaryTests(unittest.TestCase):
    def test_snapshot_preserves_state_and_parameter_identity_without_writes(self):
        calls = []
        state = object()
        first, second = SimpleNamespace(requires_grad=True, grad=None), SimpleNamespace(requires_grad=False, grad=object())
        network = SimpleNamespace(parameters=lambda: (calls.append("parameters") or iter((first, second))))
        snapshot = function("network_snapshot", PARENT, {"_critic_state": lambda n: (calls.append(("state", n)) or state)})
        self.assertEqual(snapshot(network), (state, ((id(first), True, id(None)), (id(second), False, id(second.grad)))))
        self.assertEqual(calls, [("state", network), "parameters"])
        self.assertTrue(first.requires_grad)
        self.assertIsNone(first.grad)

    def test_snapshot_detects_flag_gradient_and_parameter_replacement(self):
        parameter = SimpleNamespace(requires_grad=True, grad=None)
        network = SimpleNamespace(parameters=lambda: iter((parameter,)))
        snapshot = function("network_snapshot", PARENT, {"_critic_state": lambda _: "unchanged-value-digest"})
        before = snapshot(network)
        parameter.requires_grad = False
        self.assertNotEqual(before, snapshot(network))
        parameter.requires_grad = True
        parameter.grad = object()
        self.assertNotEqual(before, snapshot(network))
        parameter = SimpleNamespace(requires_grad=True, grad=None)
        self.assertNotEqual(before, snapshot(network))

    def test_state_failure_prevents_parameter_read_and_preserves_error(self):
        failure = RuntimeError("state read failed")
        def fail(_):
            raise failure
        def forbidden():
            self.fail("parameter reads must not follow a failed state read")
        snapshot = function("network_snapshot", PARENT, {"_critic_state": fail})
        with self.assertRaises(RuntimeError) as caught:
            snapshot(SimpleNamespace(parameters=forbidden))
        self.assertIs(caught.exception, failure)

    def test_parameter_iterator_failure_preserves_error(self):
        failure = RuntimeError("parameter iteration failed")
        def parameters():
            yield SimpleNamespace(requires_grad=True, grad=None)
            raise failure
        snapshot = function("network_snapshot", PARENT, {"_critic_state": lambda _: "state"})
        with self.assertRaises(RuntimeError) as caught:
            snapshot(SimpleNamespace(parameters=parameters))
        self.assertIs(caught.exception, failure)

    def test_legacy_cpu_function_delegates_to_the_shared_implementation(self):
        value, network, calls = object(), object(), []
        wrapper = function("_network_snapshot", CPU, {"parent": SimpleNamespace(network_snapshot=lambda n: (calls.append(n) or value))})
        self.assertIs(wrapper(network), value)
        self.assertEqual(calls, [network])

    def test_decode_probe_uses_shared_snapshot_without_cpu_training_import(self):
        tree = ast.parse((SCRIPTS / DECODE).read_text(encoding="utf-8-sig"))
        self.assertFalse(any(isinstance(n, ast.Import) and any(a.name == CPU[:-3] for a in n.names) for n in ast.walk(tree)))
        guard = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_probe_state")
        snapshots = [n for n in ast.walk(guard) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "network_snapshot"]
        self.assertEqual(len(snapshots), 2)
        self.assertTrue(all(isinstance(n.func.value, ast.Name) and n.func.value.id == "inherited" for n in snapshots))

    def test_actual_decode_import_succeeds_when_cpu_training_interface_is_forbidden(self):
        source = SCRIPTS.parent / "src"
        script = "\n".join([
            "import sys, importlib.abc",
            "class BlockCpuProfile(importlib.abc.MetaPathFinder):",
            "    def find_spec(self, fullname, path=None, target=None):",
            "        if fullname == 'painter_stage4_object_support_structure_training_profile_cpu_v1':",
            "            raise RuntimeError('CPU training interface must not be loaded')",
            "sys.meta_path.insert(0, BlockCpuProfile())",
            "import painter_stage4_decode1_entry_weight_training_profile_v1 as profile",
            "assert callable(profile.inherited.network_snapshot)",
            "assert 'painter_stage4_object_support_structure_training_profile_cpu_v1' not in sys.modules",
            "assert not profile.torch.cuda.is_initialized()",
        ])
        result = subprocess.run([sys.executable, "-B", "-c", script],
            env={**os.environ, "PYTHONPATH": os.pathsep.join((str(source), str(SCRIPTS))),
                 "CUDA_VISIBLE_DEVICES": "", "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"},
            capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
