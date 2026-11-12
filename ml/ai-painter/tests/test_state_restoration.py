"""Exact state-guard bodies with synthetic RNG/module APIs; no model or GPU calls."""
import ast
import builtins
import json
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from tempfile import TemporaryDirectory
import unittest

from ai_painter.complete_world.state_restoration import restore_state_callbacks, state_restoration_evidence

ROOT = Path(__file__).resolve().parents[3]
GUARDS = (
    ("painter_stage4_v21_full_train_exposure_probe.py", "preserve_rng_and_modes", True),
    ("painter_stage4_v24_dry_single_world_checkpoint_worker.py", "_preserve_rng_and_mode", False),
)


class SyntheticModule:
    def __init__(self, name, restore):
        self.name = name
        self._training = True
        self.restore = restore

    @property
    def training(self):
        return self._training

    @training.setter
    def training(self, value):
        self.restore(self.name, value)
        self._training = value


def fixture(script, function, include_python_numpy, *, failures=(), cuda=False):
    calls = []
    failures = {name: RuntimeError("injected " + name) for name in failures}

    def restore(name, value):
        calls.append((name, value))
        if name in failures:
            raise failures[name]

    cpu_state = object()
    cuda_state = object()
    py_state = object()
    np_state = object()
    torch = SimpleNamespace(
        get_rng_state=lambda: SimpleNamespace(clone=lambda: cpu_state),
        set_rng_state=lambda state: restore("torch_rng", state),
        cuda=SimpleNamespace(
            is_initialized=lambda: cuda,
            get_rng_state_all=lambda: cuda_state,
            set_rng_state_all=lambda state: restore("cuda_rng", state),
        ),
    )
    random = SimpleNamespace(getstate=lambda: py_state, setstate=lambda state: restore("python_rng", state))
    numpy = SimpleNamespace(random=SimpleNamespace(get_state=lambda: np_state, set_state=lambda state: restore("numpy_rng", state)))
    modules = [SyntheticModule("mode_0", restore), SyntheticModule("mode_1", restore)]
    model = SimpleNamespace(modules=lambda: iter(modules))
    source = ROOT / "ml/ai-painter/scripts" / script
    node = next(n for n in ast.parse(source.read_text(encoding="utf-8-sig")).body if isinstance(n, ast.FunctionDef) and n.name == function)
    sandbox = dict(vars(builtins))

    def controlled_import(name, *args, **kwargs):
        if name == "torch":
            return torch
        if name == "numpy":
            return numpy
        raise AssertionError("unexpected state-guard import: " + name)

    sandbox["__import__"] = controlled_import
    namespace = {"__builtins__": sandbox, "contextmanager": contextmanager, "torch": torch,
                 "random": random, "restore_state_callbacks": restore_state_callbacks}
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), "exec"), namespace)
    expected = [("torch_rng", cpu_state)]
    if include_python_numpy:
        expected.extend([("python_rng", py_state), ("numpy_rng", np_state)])
    if cuda:
        expected.append(("cuda_rng", cuda_state))
    expected.extend([("mode_0", True), ("mode_1", True)])
    return namespace[function], model, modules, calls, expected, failures


class StateGuardRestorationTests(unittest.TestCase):
    def test_normal_exit_preserves_original_restore_order_and_values(self):
        for spec in GUARDS:
            for cuda in (False, True):
                with self.subTest(spec=spec[1], cuda=cuda):
                    guard, model, modules, calls, expected, _ = fixture(*spec, cuda=cuda)
                    with guard(model):
                        for module in modules:
                            module._training = False
                    self.assertEqual(calls, expected)
                    self.assertTrue(all(module.training for module in modules))

    def test_each_restore_failure_attempts_remaining_steps_and_raises(self):
        for spec in GUARDS:
            for cuda in (False, True):
                steps = [name for name, _ in fixture(*spec, cuda=cuda)[4]]
                for failed in steps:
                    with self.subTest(spec=spec[1], cuda=cuda, failed=failed):
                        guard, model, _, calls, expected, failures = fixture(*spec, cuda=cuda, failures=(failed,))
                        with self.assertRaises(RuntimeError) as caught:
                            with guard(model):
                                pass
                        self.assertIs(caught.exception, failures[failed])
                        self.assertEqual(calls, expected)
                        self.assertEqual(caught.exception.state_restoration_errors[0]["step"], failed)

    def test_body_error_retains_identity_and_secondary_failures(self):
        for spec in GUARDS:
            steps = [name for name, _ in fixture(*spec, cuda=True)[4]]
            for error_type in (ValueError, KeyboardInterrupt, SystemExit):
                for failed in steps:
                    with self.subTest(spec=spec[1], error=error_type.__name__, failed=failed):
                        guard, model, _, calls, expected, _ = fixture(*spec, cuda=True, failures=(failed,))
                        primary = error_type("original body failure")
                        with self.assertRaises(error_type) as caught:
                            with guard(model):
                                raise primary
                        self.assertIs(caught.exception, primary)
                        self.assertEqual(calls, expected)
                        self.assertEqual(primary.state_restoration_errors[0]["step"], failed)

    def test_multiple_restore_failures_are_all_reported(self):
        for spec in GUARDS:
            guard, model, _, calls, expected, failures = fixture(*spec, cuda=True, failures=("torch_rng", "mode_0"))
            with self.subTest(spec=spec[1]), self.assertRaises(RuntimeError) as caught:
                with guard(model):
                    pass
            self.assertIs(caught.exception, failures["torch_rng"])
            self.assertEqual(calls, expected)
            self.assertEqual([r["step"] for r in caught.exception.state_restoration_errors], ["torch_rng", "mode_0"])


class RestoreCallbacksTests(unittest.TestCase):
    def test_failure_details_are_optional_json_safe_and_copied(self):
        error = ValueError("primary")
        self.assertEqual(state_restoration_evidence(error), {})
        error.state_restoration_errors = [{"step": "rng", "errorType": "RuntimeError", "message": "failed"}]
        evidence = state_restoration_evidence(error)
        self.assertEqual(json.loads(json.dumps(evidence))["stateRestorationErrors"], error.state_restoration_errors)
        evidence["stateRestorationErrors"][0]["message"] = "changed copy"
        self.assertEqual(error.state_restoration_errors[0]["message"], "failed")
        error.state_restoration_errors = [{"step": object()}]
        self.assertEqual(state_restoration_evidence(error), {})

    def test_original_v21_failure_handler_saves_secondary_details(self):
        source = ROOT / "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
        tree = ast.parse(source.read_text(encoding="utf-8-sig"))
        run = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "run")
        handler = next(n for n in ast.walk(run) if isinstance(n, ast.ExceptHandler)
                       and isinstance(n.type, ast.Name) and n.type.id == "BaseException")
        wrapper = ast.parse("def capture():\n    try:\n        raise primary\n    except BaseException:\n        pass\n")
        wrapper.body[0].body[0].handlers = [handler]
        ast.fix_missing_locations(wrapper)
        primary = ValueError("original failure")
        def bad():
            raise RuntimeError("restore failed")
        restore_state_callbacks([("python_rng", bad)], primary=primary)
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            def write_exclusive(target, value):
                with target.open("x", encoding="utf-8") as handle:
                    json.dump(value, handle)
            namespace = {"primary": primary, "state": {}, "counts": {"generator": 0, "discriminator": 0},
                         "ledger": [], "QUALIFICATION": {"checkpointPromotable": False}, "now": lambda: "fixture-time",
                         "v21": SimpleNamespace(write_exclusive=write_exclusive), "directory": directory,
                         "immutable_names": [], "bind": lambda p: {"path": p}, "package": {"outputRoot": "fixture"},
                         "observation_evidence": lambda *a: {}, "observations": [], "image_artifacts": [],
                         "state_restoration_evidence": state_restoration_evidence}
            exec(compile(wrapper, str(source), "exec"), namespace)
            with self.assertRaises(ValueError) as caught:
                namespace["capture"]()
            self.assertIs(caught.exception, primary)
            for filename in ("worker-failure.json", "result.json"):
                record = json.loads((directory / filename).read_text(encoding="utf-8"))
                self.assertEqual(record["error"], repr(primary))
                self.assertEqual(record["stateRestorationErrors"], primary.state_restoration_errors)
                self.assertEqual(record["executionState"], "failed_closed")

    def test_secondary_messages_cannot_replace_primary(self):
        class UnprintableError(RuntimeError):
            def __str__(self):
                raise RuntimeError("broken message")

        primary = ValueError("original")
        attempts = []

        def bad():
            raise UnprintableError()

        restore_state_callbacks([("bad", bad), ("later", lambda: attempts.append("later"))], primary=primary)
        self.assertEqual(attempts, ["later"])
        self.assertEqual(primary.state_restoration_errors[0]["message"], "<exception message unavailable>")

    def test_nested_guards_append_secondary_details(self):
        primary = ValueError("original")
        def bad():
            raise RuntimeError("secondary")
        restore_state_callbacks([("inner", bad)], primary=primary)
        restore_state_callbacks([("outer", bad)], primary=primary)
        self.assertEqual([row["step"] for row in primary.state_restoration_errors], ["inner", "outer"])
