"""Exact probe control flow with synthetic networks and scalar arithmetic only."""
import ast
from contextlib import contextmanager, nullcontext
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from ai_painter.complete_world.state_restoration import restore_state_callbacks

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml/ai-painter/scripts"
PROBES = (
    ("painter_stage4_v21_full_train_exposure_probe.py", "zero_update_probe"),
    ("painter_stage4_v21_whole_frame_fidelity_probe.py", "zero_update_probe"),
    ("painter_stage4_v24_object_head_core_priority_probe.py", "_zero_update_probe"),
)
OBJECTIVE = "ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17"


class Scalar(float):
    def detach(self):
        return self

    cpu = detach
    clone = detach
    all = detach

    def backward(self):
        pass


def source_function(filename, name):
    return next(node for node in ast.parse((SCRIPTS / filename).read_text(encoding="utf-8-sig")).body
                if isinstance(node, ast.FunctionDef) and node.name == name)


class ProbeFixture:
    def __init__(self, filename, name):
        self.trace = []
        self.cleanup = False
        self.failures = set()
        self.errors = {}
        self.entered = False
        self.closed = False
        self.resource_calls = 0
        self.action = lambda: None
        self.end_action = lambda: None
        fixture = self

        def attempt(step):
            fixture.trace.append(step)
            if fixture.cleanup and step in fixture.failures:
                raise fixture.errors.setdefault(step, RuntimeError(step + " failed"))

        class Parameter:
            is_cuda = False

            def __init__(self, index, flag):
                self.index, self.requires_grad, self.grad = index, flag, None

            def requires_grad_(self, flag):
                attempt("parameter_" + str(self.index))
                self.requires_grad = flag
                return self

        class Network:
            def __init__(self, label, offset):
                self.label, self.state, self.training = label, "unchanged", True
                self.values = [Parameter(offset, True), Parameter(offset + 1, False)]

            def parameters(self):
                return iter(self.values)

            def eval(self):
                self.training = False
                return self

            def train(self):
                self.training = True
                return self

            def requires_grad_(self, flag):
                for value in self.values:
                    value.requires_grad_(flag)
                return self

            def zero_grad(self, *, set_to_none):
                attempt(self.label + "_zero")
                for value in self.values:
                    value.grad = None

        self.model, self.critic = Network("model", 0), Network("critic", 2)

        @contextmanager
        def preserve(*networks):
            modes = [network.training for network in networks]
            self.entered = True
            try:
                yield
            finally:
                for network, mode in zip(networks, modes):
                    network.training = mode
                self.closed = True

        def require(condition, message):
            if not condition:
                raise ValueError(message)

        def state_hash(network):
            attempt(network.label + "_hash")
            return network.state

        class Optimizer:
            def __init__(self, *args, **kwargs):
                raise AssertionError("unprotected optimizer construction")

        def forbidden(*args, **kwargs):
            raise AssertionError("unprotected checkpoint access")

        self.torch = SimpleNamespace(optim=SimpleNamespace(Optimizer=Optimizer), load=forbidden, save=forbidden,
            autocast=lambda *a, **k: nullcontext(), no_grad=nullcontext, bfloat16="fake", isfinite=lambda v: Scalar(1),
            get_rng_state=lambda: Scalar(1), equal=lambda a, b: a == b, count_nonzero=lambda v: 1,
            autograd=SimpleNamespace(grad=lambda loss, values, **kwargs: [Scalar(1) for _ in values]))
        self.originals = (Optimizer.__init__, self.torch.load, self.torch.save)
        terms = {key: Scalar(1) for key in ("v21UnchangedTotal", "wholeFrameRgbMae", "wholeFrameSignedEdgeMae",
                                           "wholeFrameFidelity", "objectCoreRgbWeighted", "total")}
        objective = lambda *args: (Scalar(1), terms)
        core = SimpleNamespace(cpu=SimpleNamespace(state_hash=state_hash, tensor_hash=lambda v: float(v)),
            require=require, preserve_rng_and_modes=preserve, restore_state_callbacks=restore_state_callbacks,
            capacity=SimpleNamespace(require_critic_mode=lambda *a, **k: None),
            gpu=SimpleNamespace(gradient_facts=lambda *a: {"synthetic": True}, detached_discriminator_objective=objective),
            v21=SimpleNamespace(v21gpu=SimpleNamespace(_head_gradients=lambda *a: {"synthetic": True})))

        def candidate(model, critic, sample, order, forward, phase):
            forward(phase, sample)
            facts = {"generatorGradientFacts": {"nonzeroTensorCount": 1, "nonzeroElementCount": 1,
                     "headCandidateL2": {"fake": 1}}, "unusedGradientIndexes": {"actualTotal": []},
                     "nonHeadActualTotalIdentityPreserved": True, "nonConflictHeadActualTotalBytesPreserved": True}
            return Scalar(1), Scalar(1), terms, [Scalar(1)], facts

        self.namespace = dict(vars(core), core=core, torch=self.torch, patch=patch, nullcontext=nullcontext,
            train_whole_frame_fidelity_candidate_objective=objective, CANDIDATE_ID="synthetic",
            generator_candidate_for_sample=candidate, _require_critic_phase=lambda *a, **k: None,
            ORIGINAL_AUTOCAST=self.torch.autocast, precision_plan=lambda: {}, critic_state_plan=lambda: {},
            object_core=SimpleNamespace(CANDIDATE_ID="synthetic"))
        exec(compile(ast.Module(body=[source_function(filename, name)], type_ignores=[]), str(SCRIPTS / filename), "exec"), self.namespace)
        self.function = self.namespace[name]
        self.objective_module = SimpleNamespace(train_structured_object_objective=objective)

    def call(self):
        def forward(*args):
            self.action()
            return Scalar(1)

        def resource():
            self.resource_calls += 1
            if self.resource_calls == 2:
                self.end_action()

        sample = {"image": Scalar(1), "conditions": Scalar(2), "objectInstanceTable": []}
        with patch.dict(sys.modules, {"torch": self.torch, OBJECTIVE: self.objective_module}):
            return self.function(self.model, self.critic, sample, [], resource, forward)

    def arm_cleanup(self, failures):
        self.cleanup = True
        self.failures = set(failures)
        self.trace.clear()

    def assert_scopes_restored(self, test):
        test.assertEqual((self.torch.optim.Optimizer.__init__, self.torch.load, self.torch.save), self.originals)
        test.assertTrue(self.closed)
        test.assertTrue(self.model.training and self.critic.training)


class ZeroUpdateProbeGuardTests(unittest.TestCase):
    def test_normal_probe_restores_flags_and_forbids_updates(self):
        for filename, name in PROBES:
            with self.subTest(probe=filename):
                f = ProbeFixture(filename, name)
                result = f.call()
                self.assertTrue(result["passed"])
                self.assertFalse(result["optimizerCreated"])
                self.assertEqual(result["optimizerSteps"], {"generator": 0, "discriminator": 0})
                self.assertEqual([p.requires_grad for n in (f.model, f.critic) for p in n.parameters()], [True, False, True, False])
                f.assert_scopes_restored(self)

    def test_forbidden_operations_raise_and_restore_bindings(self):
        for filename, name in PROBES:
            for operation, message in (("optimizer", "optimizer prohibited"), ("load", "load prohibited"), ("save", "write prohibited")):
                with self.subTest(probe=filename, operation=operation):
                    f = ProbeFixture(filename, name)
                    def attempt():
                        if operation == "optimizer":
                            f.torch.optim.Optimizer([])
                        else:
                            getattr(f.torch, operation)("never-opened")
                    f.action = attempt
                    with self.assertRaisesRegex(RuntimeError, message):
                        f.call()
                    f.assert_scopes_restored(self)

    def test_body_error_survives_each_cleanup_failure_and_remaining_steps_run(self):
        for filename, name in PROBES:
            for error_type in (ValueError, KeyboardInterrupt, SystemExit):
                for failed in (("model_zero",), ("critic_zero",), ("parameter_0",), ("parameter_2",), ("model_hash",),
                               ("model_zero", "critic_zero", "parameter_0", "parameter_2", "model_hash")):
                    with self.subTest(probe=filename, error=error_type.__name__, failed=failed):
                        f = ProbeFixture(filename, name)
                        primary = error_type("original probe error")
                        def attempt():
                            f.arm_cleanup(failed)
                            raise primary
                        f.action = attempt
                        with self.assertRaises(error_type) as caught:
                            f.call()
                        self.assertIs(caught.exception, primary)
                        self.assertEqual(f.trace[:7], ["model_zero", "critic_zero", "parameter_0", "parameter_1",
                                                      "parameter_2", "parameter_3", "model_hash"])
                        self.assertEqual(len(primary.state_restoration_errors), len(failed))
                        f.assert_scopes_restored(self)

    def test_cleanup_failure_after_success_is_not_reported_as_passed(self):
        for filename, name in PROBES:
            with self.subTest(probe=filename):
                f = ProbeFixture(filename, name)
                f.end_action = lambda: f.arm_cleanup(("model_zero", "parameter_0"))
                with self.assertRaises(RuntimeError) as caught:
                    f.call()
                self.assertIs(caught.exception, f.errors["model_zero"])
                self.assertIn("critic_zero", f.trace)
                self.assertIn("parameter_3", f.trace)
                self.assertIn("model_hash", f.trace)
                self.assertEqual(len(caught.exception.state_restoration_errors), 2)
                f.assert_scopes_restored(self)

    def test_state_mutation_remains_a_failure_without_claiming_rollback(self):
        for filename, name in PROBES:
            with self.subTest(probe=filename):
                f = ProbeFixture(filename, name)
                f.end_action = lambda: setattr(f.model, "state", "changed")
                with self.assertRaisesRegex(ValueError, "state"):
                    f.call()
                self.assertEqual(f.model.state, "changed")
                f.assert_scopes_restored(self)

    def test_partial_guard_entry_restores_previously_entered_scopes(self):
        for filename, name in PROBES:
            for index in range(3):
                with self.subTest(probe=filename, failed_entry=index):
                    f = ProbeFixture(filename, name)
                    primary = RuntimeError("guard entry failed")
                    calls = []
                    class FailOnEnter:
                        def __enter__(self):
                            raise primary

                        def __exit__(self, *args):
                            raise AssertionError("unentered context")
                    def injected(owner, attribute, *args, **kwargs):
                        calls.append(attribute)
                        return FailOnEnter() if len(calls) - 1 == index else patch.object(owner, attribute, *args, **kwargs)
                    f.namespace["patch"] = SimpleNamespace(object=injected)
                    f.action = lambda: self.fail("probe body must not run")
                    with self.assertRaises(RuntimeError) as caught:
                        f.call()
                    self.assertIs(caught.exception, primary)
                    f.assert_scopes_restored(self)

    def test_training_checkpoint_guards_at_observation_entry(self):
        """Execute the unchanged training with-block, stop at its first observation."""
        filename = "painter_stage4_v21_full_train_exposure_probe.py"
        run = source_function(filename, "run")
        block = next(n for n in ast.walk(run) if isinstance(n, ast.With)
                     and any(isinstance(x, ast.Constant) and x.value == "historical checkpoint load prohibited" for x in ast.walk(n)))
        for operation in ("load", "save", "body_error"):
            with self.subTest(operation=operation):
                f = ProbeFixture(*PROBES[0])
                primary = ValueError("observation stopped")
                def observe(epoch):
                    self.assertEqual(epoch, 0)
                    if operation == "body_error":
                        raise primary
                    getattr(f.torch, operation)("never-opened")
                namespace = {"torch": f.torch, "patch": patch, "observe": observe}
                with self.assertRaises(ValueError if operation == "body_error" else RuntimeError) as caught:
                    exec(compile(ast.Module(body=[block], type_ignores=[]), str(SCRIPTS / filename), "exec"), namespace)
                if operation == "body_error":
                    self.assertIs(caught.exception, primary)
                else:
                    self.assertIn("prohibited", str(caught.exception))
                self.assertEqual((f.torch.optim.Optimizer.__init__, f.torch.load, f.torch.save), f.originals)
