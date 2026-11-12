"""Real profile contexts only: forbid model execution, checkpoints and CUDA."""
from contextlib import ExitStack, nullcontext
from copy import deepcopy
import importlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from ai_painter.complete_world.state_restoration import restore_state_callbacks

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
PROFILE_NAMES = (
    "painter_stage4_v21_whole_frame_fidelity_probe",
    "painter_stage4_v21_object_core_fidelity_probe",
    "painter_stage4_v23_complete_support_partition_probe",
    "painter_stage4_v24_object_head_core_priority_probe",
)


class ProfileOverrideRestorationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        cls.guards = ExitStack()
        cls.addClassCleanup(cls.guards.close)
        for owner, name in ((torch, "load"), (torch, "save"), (torch.nn.Module, "__call__"),
                            (torch.optim.Optimizer, "__init__"), (torch.cuda, "_lazy_init")):
            cls.guards.enter_context(patch.object(owner, name, side_effect=AssertionError("model/GPU/checkpoint operation forbidden")))
        cls.profiles = [importlib.import_module(name) for name in PROFILE_NAMES]
        cls.core = cls.profiles[0].core
        if not all(profile.core is cls.core for profile in cls.profiles):
            raise AssertionError("profiles no longer share the original core")

    def assert_restored(self, snapshot):
        actual = vars(self.core)
        self.assertEqual(actual.keys(), snapshot.keys())
        for name, value in snapshot.items():
            self.assertIs(actual[name], value, name)

    def test_normal_exit_restores_every_core_binding(self):
        for profile in self.profiles:
            with self.subTest(profile=profile.__name__):
                before = dict(vars(self.core))
                with profile.successor_profile() as current:
                    self.assertIs(current, self.core)
                    self.assertEqual(current.WORKER, profile.WORKER)
                    self.assertIsNot(current.QUALIFICATION, before["QUALIFICATION"])
                    self.assertIs(current.collect_inputs, profile.collect_inputs)
                self.assert_restored(before)

    def test_body_errors_keep_identity_and_restore_all_bindings(self):
        for profile in self.profiles:
            for error_type in (ValueError, KeyboardInterrupt, SystemExit):
                with self.subTest(profile=profile.__name__, error=error_type.__name__):
                    before = dict(vars(self.core))
                    original = error_type("body failed")
                    with self.assertRaises(error_type) as caught:
                        with profile.successor_profile():
                            raise original
                    self.assertIs(caught.exception, original)
                    self.assert_restored(before)

    def test_every_partial_entry_failure_restores_previous_bindings(self):
        original_patch = patch.object
        for profile in self.profiles:
            names = []
            def record(target, name, *args, **kwargs):
                names.append(name)
                return original_patch(target, name, *args, **kwargs)
            with original_patch(profile, "patch", SimpleNamespace(object=record)):
                with profile.successor_profile():
                    pass
            self.assertGreater(len(names), 10)
            for failure_index in range(len(names)):
                with self.subTest(profile=profile.__name__, failed=names[failure_index]):
                    before = dict(vars(self.core))
                    original = RuntimeError("entry failed")
                    called = []
                    class FailOnEnter:
                        def __enter__(self):
                            raise original
                        def __exit__(self, *args):
                            raise AssertionError("unentered context must not exit")
                    def inject(target, name, *args, **kwargs):
                        called.append(name)
                        if len(called) - 1 == failure_index:
                            return FailOnEnter()
                        return original_patch(target, name, *args, **kwargs)
                    with original_patch(profile, "patch", SimpleNamespace(object=inject)):
                        with self.assertRaises(RuntimeError) as caught:
                            with profile.successor_profile():
                                self.fail("body must not run after entry failure")
                    self.assertIs(caught.exception, original)
                    self.assert_restored(before)

    def test_all_nested_pairs_restore_outer_then_original(self):
        for outer in self.profiles:
            for inner in self.profiles:
                with self.subTest(outer=outer.__name__, inner=inner.__name__):
                    before = dict(vars(self.core))
                    with outer.successor_profile():
                        outer_state = dict(vars(self.core))
                        with self.assertRaisesRegex(ValueError, "nested"):
                            with inner.successor_profile():
                                raise ValueError("nested")
                        self.assert_restored(outer_state)
                    self.assert_restored(before)

    def test_worker_terminal_persists_primary_and_restoration_failure(self):
        worker = importlib.import_module("painter_stage4_v24_dry_single_world_checkpoint_worker")
        primary = ValueError("original operation failure")
        def failed_restore():
            raise RuntimeError("RNG restore failed")
        restore_state_callbacks([("torch_rng", failed_restore)], primary=primary)
        with TemporaryDirectory() as temporary:
            target = Path(temporary) / "terminal.json"
            writes = []
            def sink(record):
                writes.append(record)
                with target.open("x", encoding="utf-8") as handle:
                    json.dump(record, handle)
            with patch.object(worker, "bounded_training_loop", side_effect=primary):
                result = worker.run_with_terminal_boundary(terminal_sink=sink)
            saved = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(saved, result)
            self.assertEqual(writes, [result])
            self.assertEqual(saved["error"], "original operation failure")
            self.assertEqual(saved["errorType"], "ValueError")
            self.assertEqual(saved["stateRestorationErrors"], primary.state_restoration_errors)
            self.assertEqual(saved["executionState"], "failed_closed")
            self.assertFalse(saved["qualificationGranted"])
            self.assertEqual(saved["optimizerSteps"], {"generator": 0, "discriminator": 0})

    def test_worker_ordinary_failure_has_no_fabricated_restoration_details(self):
        worker = importlib.import_module("painter_stage4_v24_dry_single_world_checkpoint_worker")
        writes = []
        with patch.object(worker, "bounded_training_loop", side_effect=ValueError("ordinary")):
            result = worker.run_with_terminal_boundary(terminal_sink=writes.append)
        self.assertNotIn("stateRestorationErrors", result)
        self.assertEqual(result["error"], "ordinary")
        self.assertEqual(writes, [result])

    def test_forward_wrappers_restore_bound_methods_on_all_exit_paths(self):
        v23, v24 = self.profiles[2:]
        cases = ("normal", "driver_before", "driver_after", "model_error", "evidence_error",
                 "one_forward", "different_evidence", "extra_argument")
        for profile in (v23, v24):
            for case in cases:
                with self.subTest(profile=profile.__name__, case=case):
                    primary = ValueError("injected wrapper failure")
                    calls = []
                    class Model:
                        def forward(self, conditions, instances, *, return_evidence=False):
                            calls.append((conditions, instances, return_evidence))
                            if case == "model_error":
                                raise primary
                            return "rgb-sentinel", {"ordinal": len(calls)}
                    class Condition:
                        def detach(self):
                            return self
                        def cpu(self):
                            return self
                    model = Model()
                    original = model.forward
                    before = dict(vars(model))
                    facts = {"supportUnionMismatchPixels": 0, "ownerOverlapPixels": 0,
                             "roles": {"tree": {"coreOwnershipMissingPixels": 0, "ownerOutsideCoveragePixels": 0}}}
                    def ownership(evidence):
                        if case == "evidence_error":
                            raise primary
                        result = deepcopy(facts)
                        if case == "different_evidence":
                            result["ordinal"] = evidence["ordinal"]
                        return result
                    def driver(*args, **kwargs):
                        if case == "driver_before":
                            raise primary
                        if case == "extra_argument":
                            model.forward("conditions", "instances", "forbidden")
                        model.forward("conditions", "instances")
                        if case == "driver_after":
                            raise primary
                        if case != "one_forward":
                            model.forward("conditions", "instances")
                        return {"passed": True}
                    driver_owner, driver_name = ((profile.object_core, "zero_update_probe") if profile is v23
                                                  else (profile, "_zero_update_probe"))
                    with patch.object(driver_owner, driver_name, driver), \
                         patch.object(v23, "_ownership_facts", ownership), \
                         patch.object(self.core.cpu, "tensor_hash", return_value="condition-hash"):
                        if case == "normal":
                            result = profile.zero_update_probe(model, None, {"conditions": Condition()}, [], None, None)
                            self.assertTrue(result["passed"])
                            self.assertEqual(result["ownershipFacts"], facts)
                            self.assertEqual(calls, [("conditions", "instances", True)] * 2)
                        else:
                            with self.assertRaises(ValueError) as caught:
                                profile.zero_update_probe(model, None, {"conditions": Condition()}, [], None, None)
                            if case in ("driver_before", "driver_after", "model_error", "evidence_error"):
                                self.assertIs(caught.exception, primary)
                    self.assertEqual(vars(model), before)
                    self.assertIs(model.forward.__func__, original.__func__)
                    self.assertIs(model.forward.__self__, model)

    def test_autocast_wrapper_restores_original_on_success_and_errors(self):
        profile = self.profiles[3]
        for error_type in (None, ValueError, KeyboardInterrupt, SystemExit):
            with self.subTest(error=error_type.__name__ if error_type else "none"):
                original = profile.torch.autocast
                primary = error_type("original run failure") if error_type else None
                calls = []
                marker = object()
                def base(*args, **kwargs):
                    calls.append((args, kwargs))
                    self.assertIsNot(profile.torch.autocast, original)
                    self.assertIsInstance(profile.torch.autocast("cpu"), nullcontext)
                    if primary is not None:
                        raise primary
                    return marker
                with patch.object(profile, "BASE_RUN", base):
                    if primary is None:
                        self.assertIs(profile.run("argument", named="value"), marker)
                    else:
                        with self.assertRaises(error_type) as caught:
                            profile.run("argument", named="value")
                        self.assertIs(caught.exception, primary)
                self.assertIs(profile.torch.autocast, original)
                self.assertEqual(calls, [(("argument",), {"named": "value"})])

    def test_objective_wrapper_restores_function_and_candidate_identity(self):
        profile = self.profiles[1]
        fidelity = profile.fidelity
        class Scalar(float):
            def detach(self):
                return self
            def float(self):
                return self
            def cpu(self):
                return self
        for case in ("normal", "zero_calls", "two_calls", "driver_error", "objective_error", "invalid_terms"):
            with self.subTest(case=case):
                original_function = fidelity.train_whole_frame_fidelity_candidate_objective
                original_id = fidelity.CANDIDATE_ID
                primary = ValueError("original objective wrapper failure")
                marker = object()
                terms = dict(wholeFrameFidelityUnchangedTotal=Scalar(2), objectCoreRgbMae=Scalar(.25),
                             objectCoreRgbWeighted=Scalar(.25), objectCoreApplicableRoleCount=Scalar(1), total=Scalar(2.25))
                def objective(*args):
                    if case == "objective_error":
                        raise primary
                    if case == "invalid_terms":
                        terms["total"] = Scalar(float("nan"))
                    return "total-sentinel", terms
                def driver(*args, **kwargs):
                    self.assertEqual((args, kwargs), (("argument",), {"named": "value"}))
                    self.assertIsNot(fidelity.train_whole_frame_fidelity_candidate_objective, original_function)
                    self.assertEqual(fidelity.CANDIDATE_ID, profile.CANDIDATE_ID)
                    if case == "driver_error":
                        raise primary
                    for _ in range(0 if case == "zero_calls" else 2 if case == "two_calls" else 1):
                        fidelity.train_whole_frame_fidelity_candidate_objective("objective-input")
                    return marker
                with patch.object(profile, "train_object_core_fidelity_candidate_objective", objective):
                    if case == "normal":
                        result, values = profile._execute_with_core_objective(driver, "argument", named="value")
                        self.assertIs(result, marker)
                        self.assertEqual(values, terms)
                    else:
                        with self.assertRaises(ValueError) as caught:
                            profile._execute_with_core_objective(driver, "argument", named="value")
                        if case in ("driver_error", "objective_error"):
                            self.assertIs(caught.exception, primary)
                self.assertIs(fidelity.train_whole_frame_fidelity_candidate_objective, original_function)
                self.assertIs(fidelity.CANDIDATE_ID, original_id)
