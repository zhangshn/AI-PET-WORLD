"""Execute existing routing AST with metadata substitutes; no model/data/GPU/update."""
import ast
from contextlib import contextmanager, nullcontext
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import torch

ROOT = Path(__file__).absolute().parents[3]
SCRIPTS = ROOT / "ml/ai-painter/scripts"
PROFILE = SCRIPTS / "painter_stage4_decode1_entry_weight_training_profile_v1.py"
WORKER = SCRIPTS / "painter_stage4_decode1_entry_weight_quality_worker_v1.py"
QUALIFIER = SCRIPTS / "qualify_stage4_decode1_entry_weight_quality_gpu_v1.py"
NEW = "stage4_mvp256_dry_decode1_support_structure_weight1_v1"
OLD = "stage4_mvp256_dry_decode1_registered_source_v1"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def existing_functions(path, names, namespace):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert {node.name for node in selected} == set(names)
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(path), "exec"), namespace)
    return namespace


class MetadataNetwork:
    condition_channel_order = ("synthetic",)

    def __init__(self):
        self.value = torch.zeros(1)
        self.hook = None

    def parameters(self):
        return iter((self.value,))

    def register_forward_pre_hook(self, callback):
        self.hook = callback
        return SimpleNamespace(remove=lambda: setattr(self, "hook", None))

    def __call__(self, *args, **kwargs):
        raise AssertionError("model forward forbidden")


class SupportWeightRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def setUp(self):
        self.ns = existing_functions(PROFILE,
            ("execution_support_structure_weight", "_validate_support_structure_weight", "_generator_candidate",
             "perform_pair", "zero_update_probe"),
            {"require": require, "SUPPORT_WEIGHT1_CAPABILITY": NEW, "UPDATE_LIMIT": 1152,
             "torch": torch, "generator_fp32_scope": lambda device: nullcontext()})
        self.weight = self.ns["execution_support_structure_weight"]

    def configuration(self, capability=NEW):
        value = {"capabilityVersion": capability}
        if capability == NEW:
            value["objectSupportStructureWeight"] = 1
        return value

    def test_configuration_selects_only_registered_integer_one_and_legacy_absence(self):
        self.assertIs(type(self.weight(self.configuration())), float)
        self.assertEqual(self.weight(self.configuration()), 1.0)
        self.assertEqual(self.weight(self.configuration(OLD)), .1)
        self.assertEqual(self.weight({}), .1)
        for value in (True, False, 1.0, .1, 0, 2, "1", None):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "weight1 configuration"):
                self.weight({"capabilityVersion": NEW, "objectSupportStructureWeight": value})
        with self.assertRaisesRegex(ValueError, "weight1 configuration"):
            self.weight({"capabilityVersion": NEW})
        for capability in (OLD, NEW + "-typo", None):
            with self.subTest(capability=capability), self.assertRaisesRegex(ValueError, "legacy candidate"):
                self.weight({"capabilityVersion": capability, "objectSupportStructureWeight": 1})
        for configuration in (None, [], SimpleNamespace(capabilityVersion=NEW)):
            with self.assertRaisesRegex(ValueError, "configuration required"):
                self.weight(configuration)

    def test_numeric_api_rejects_bool_int_unknown_before_computation(self):
        self.ns["_component_profile"] = lambda components: None
        for name in ("_generator_candidate", "perform_pair", "zero_update_probe"):
            function = self.ns[name]
            args = (None,) * {"_generator_candidate": 5, "perform_pair": 10, "zero_update_probe": 5}[name]
            for value in (True, False, 1, 0, 0.0, .2, float("nan"), float("inf"), "1.0", None):
                with self.subTest(api=name, value=value), self.assertRaisesRegex(ValueError, "fixed support structure weight"):
                    function(*args, support_structure_weight=value)

    def test_generator_routes_raw_weight_to_original_objective_and_all_four_parts(self):
        model = MetadataNetwork()
        sample = {"split": "train", "objectInstanceTable": []}
        parts = {name: torch.tensor(float(i)) for i, name in enumerate(
            ("v21UnchangedTotal", "wholeFrameFidelity", "objectCoreRgbWeighted", "objectSupportStructureWeighted"), 1)}
        total = torch.tensor(10.)
        objective = Mock(return_value=(total, parts))
        gradients = Mock(return_value=([], {}))
        self.ns.update(train_object_support_structure_candidate_objective=objective,
            compute_generator_candidate_gradients=gradients)
        for weight in (.1, 1.0):
            with self.subTest(weight=weight):
                result, _, facts = self.ns["_generator_candidate"](model, object(), sample,
                    model.condition_channel_order, object(), support_structure_weight=weight)
                self.assertIs(result, total)
                self.assertEqual(objective.call_args.kwargs, {"support_structure_weight": 1.0} if weight == 1.0 else {})
                for parameter, key in (("structured_objective", "v21UnchangedTotal"),
                        ("whole_frame_fidelity", "wholeFrameFidelity"), ("object_core_rgb", "objectCoreRgbWeighted"),
                        ("object_support_structure", "objectSupportStructureWeighted")):
                    self.assertIs(gradients.call_args.kwargs[parameter], parts[key])
                self.assertIs(gradients.call_args.kwargs["actual_total"], total)
                self.assertEqual(facts.get("objectSupportStructureWeight"), 1 if weight == 1.0 else None)

    def profile_metadata(self):
        model, critic = MetadataNetwork(), MetadataNetwork()
        sample = {"split": "train", "sampleId": "metadata-only", "conditions": torch.zeros(1, 1, 1),
            "appearance_regime": torch.tensor([1., 0, 0, 0]), "ecology_regime": torch.tensor([1., 0, 0, 0, 0, 0, 0])}
        calls, observed = [], [None]
        rows = [sample["appearance_regime"][None], sample["ecology_regime"][None]]
        labels = ("total", "structured", "whole", "core", "support")
        def candidate(*args, **kwargs):
            calls.append(kwargs)
            if observed[0] is not None:
                for label in labels:
                    observed[0]("complete", label, rows)
            return torch.tensor(2.), rows, ({"objectSupportStructureWeight": 1} if kwargs else {})
        def forward(*args, return_evidence=False):
            if model.hook is not None:
                model.hook(model, ())
            return (torch.tensor(1.), {"objectCount": 0}) if return_evidence else torch.tensor(1.)
        @contextmanager
        def observe(callback):
            observed[0] = callback
            try:
                yield
            finally:
                observed[0] = None
        api = SimpleNamespace(_bound_device=lambda *args: sample, sample_forward=forward,
            _generator_candidate=candidate, bind_parameters=lambda model: (tuple(model.parameters()), {}, 0, 1),
            observe_generator_gradients=observe, CAPABILITY="unchanged-module-capability", MODEL_CAPABILITY="unchanged-model")
        v24 = SimpleNamespace(_critic_mode_snapshot=lambda critic: None, _restore_critic_mode_snapshot=lambda value: None,
            _require_critic_phase=lambda *args, **kwargs: None)
        self.ns.update(_component_profile=lambda components: api, inherited=SimpleNamespace(v24=v24,
            core=SimpleNamespace(gpu=SimpleNamespace(gradient_facts=object()))),
            _phase=lambda *args: None, _critic_state=lambda critic: "unchanged",
            _d_objective=lambda *args: (torch.tensor(1.), {}),
            _update_discriminator=lambda *args: args[5].__setitem__("discriminator", args[5]["discriminator"] + 1),
            commit_generator_step=lambda **kwargs: kwargs["counts"].__setitem__("generator", kwargs["counts"]["generator"] + 1),
            _probe_state=lambda *args: nullcontext(), COMPONENTS_IN_ORDER=labels,
            _failure_summary=lambda *args: None)
        return model, critic, sample, calls

    def test_actual_perform_pair_routes_new_weight_and_legacy_omits_keyword(self):
        for weight in (.1, 1.0):
            model, critic, sample, calls = self.profile_metadata()
            counts = {"generator": 0, "discriminator": 0}
            ledger = {"sampleId": sample["sampleId"], **counts}
            zero_only = SimpleNamespace(zero_grad=lambda **kwargs: None)
            result = self.ns["perform_pair"](model, critic, sample, model.condition_channel_order,
                zero_only, zero_only, counts, ledger, lambda: None, None, support_structure_weight=weight)
            self.assertEqual(calls, [{"support_structure_weight": 1.0} if weight == 1.0 else {}])
            self.assertEqual(result["fiveGradientFacts"].get("objectSupportStructureWeight"), 1 if weight == 1.0 else None)

    def test_actual_zero_update_probe_routes_new_weight_and_legacy_omits_keyword(self):
        for weight in (.1, 1.0):
            model, critic, sample, calls = self.profile_metadata()
            with patch.object(torch.autograd, "grad", return_value=(torch.tensor(1.),)) as metadata_gradient:
                result = self.ns["zero_update_probe"](model, critic, sample, model.condition_channel_order,
                    lambda: None, support_structure_weight=weight)
            metadata_gradient.assert_called_once()
            self.assertEqual(calls, [{"support_structure_weight": 1.0} if weight == 1.0 else {}])
            self.assertTrue(result["passed"])
            self.assertFalse(result["optimizerCreated"])
            self.assertEqual(result["optimizerUpdates"], 0)
            self.assertIsNone(model.hook)

    def worker_functions(self):
        profile = SimpleNamespace(CAPABILITY="original-profile", execution_support_structure_weight=self.weight,
            perform_pair=lambda *args, **kwargs: kwargs)
        namespace = {"CAPABILITY": "original-worker", "auth": SimpleNamespace(CAPABILITY="other-route"),
            "observed_pair": lambda actual, model, *args, **kwargs: actual(*args, **kwargs), "require": require}
        existing_functions(WORKER, ("training_pair_runner", "training_loop_callbacks"), namespace)
        return profile, namespace

    def test_worker_pair_and_loop_callbacks_select_new_only_and_preserve_preview(self):
        for capability in (NEW, OLD):
            profile, namespace = self.worker_functions()
            preview = SimpleNamespace(observe=object())
            context = SimpleNamespace(plan={"capabilityVersion": capability, "configuration": self.configuration(capability)})
            capture, context_for_sample = object(), object()
            callbacks = namespace["training_loop_callbacks"](context, None, object(), profile=profile,
                plan_binding=None, execution_binding=None, preview=preview, capture_sink=capture,
                context_for_sample=context_for_sample)
            options = callbacks["pair_runner"]()
            self.assertIs(callbacks["capture_sink"], capture)
            self.assertIs(callbacks["context_for_sample"], context_for_sample)
            self.assertIs(options["prediction_observer"], preview.observe)
            self.assertEqual(options.get("support_structure_weight"), 1.0 if capability == NEW else None)
        profile, namespace = self.worker_functions()
        self.assertNotIn("support_structure_weight", namespace["training_pair_runner"](profile, object(), None)())

    def test_worker_pair_rejects_unregistered_weight_configuration(self):
        profile, namespace = self.worker_functions()
        for configuration in ({"capabilityVersion": NEW},
                {"capabilityVersion": NEW, "objectSupportStructureWeight": True},
                {"capabilityVersion": OLD, "objectSupportStructureWeight": 1}):
            with self.subTest(configuration=configuration), self.assertRaises(ValueError):
                namespace["training_pair_runner"](profile, object(), None, configuration=configuration)

    def qualifier_loop(self):
        run = next(node for node in ast.parse(QUALIFIER.read_text(encoding="utf-8")).body
            if isinstance(node, ast.FunctionDef) and node.name == "run")
        loop = next(node for node in ast.walk(run) if isinstance(node, ast.For)
            and isinstance(node.iter, ast.Call) and isinstance(node.iter.func, ast.Name) and node.iter.func.id == "enumerate")
        # Execute the existing full 48-sample loop verbatim; no setup/CUDA/registration is loaded.
        return compile(ast.Module(body=[loop], type_ignores=[]), str(QUALIFIER), "exec")

    def test_qualifier_existing_48_loop_routes_new_only_without_new_forward(self):
        for capability in (NEW, OLD):
            probe = Mock(return_value={"passed": True})
            samples = [{"sampleId": "metadata-" + str(i)} for i in range(48)]
            namespace = {"plan": {"capabilityVersion": capability, "configuration": self.configuration(capability)},
                "profile": SimpleNamespace(execution_support_structure_weight=self.weight, zero_update_probe=probe),
                "model": MetadataNetwork(), "critic": MetadataNetwork(), "train": samples, "order": ("synthetic",),
                "resource": Mock(), "calls": SimpleNamespace(begin=Mock(), event=object()), "observation": None,
                "worker": SimpleNamespace(require=require), "cases": []}
            exec(self.qualifier_loop(), namespace)
            self.assertEqual(probe.call_count, 48)
            self.assertEqual(len(namespace["cases"]), 48)
            for index, call in enumerate(probe.call_args_list):
                self.assertIs(call.args[2], samples[index])
                self.assertEqual(call.kwargs["failure_evidence"], {"sampleId": samples[index]["sampleId"]})
                self.assertEqual(call.kwargs.get("support_structure_weight"), 1.0 if capability == NEW else None)


if __name__ == "__main__":
    unittest.main()
