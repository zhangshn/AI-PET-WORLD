"""CPU-only execution tests for the parent-device CP60 algorithm; no GPU qualification."""
from collections import OrderedDict
from contextlib import ExitStack
import hashlib
import itertools
import json
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
os.environ["CUDA_VISIBLE_DEVICES"] = ""
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
STARTED = time.monotonic()
import torch
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world import terrain_detail_weight_reduction_precision_v1 as operator
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_terrain_detail_weight_priority_update_v1 as bridge
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as parent
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import Decode1WeightReductionConv
from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season, SEASONS
from ai_painter.complete_world.object_ecology_regime_input_cpu import encode_ecology, ECOLOGIES

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())


def digest(value):
    return hashlib.sha256(value.detach().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def state(model):
    return {name: digest(value) for name, value in model.state_dict().items()}


def values(mask=(True, True, True), size=(4, 5)):
    rng = torch.Generator(device="cpu").manual_seed(20261014)
    return tuple(torch.randn(shape, generator=rng).requires_grad_(needed) for shape, needed in zip(
        ((1, 48, *size), (48, 48, 3, 3), (48,)), mask))


class PrecisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2:
            torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process()
        process.cpu_affinity(process.cpu_affinity()[:2])
        cls.rng = torch.get_rng_state().clone()
        cls.parent = parent.build_fresh_object_ecology_decode1_weight_precision(condition_channel_order=ORDER)
        cls.model = candidate.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        assert torch.equal(cls.rng, torch.get_rng_state())

    def setUp(self):
        self.assertLess(time.monotonic() - STARTED, 120)

    def test_8_masks_native_forward_input_bias_and_fp64_weight(self):
        native = torch.ops.aten.convolution_backward.default
        masks = []
        def observe(*args, **kwargs):
            masks.append(tuple(args[-1]))
            return native(*args, **kwargs)
        for mask in itertools.product((False, True), repeat=3):
            source = values(mask)
            baseline = tuple(v.detach().clone().requires_grad_(needed) for v, needed in zip(source, mask))
            output = operator.terrain_detail_weight_reduction_precision(*source)
            expected = F.conv2d(*baseline, padding=1)
            self.assertEqual(digest(output), digest(expected))
            if not any(mask):
                self.assertFalse(output.requires_grad); continue
            upstream = torch.linspace(-.5, .5, output.numel()).reshape_as(output)
            with patch.object(torch.ops.aten.convolution_backward, "default", observe):
                gradients = torch.autograd.grad(output, tuple(v for v, needed in zip(source, mask) if needed), grad_outputs=upstream)
            original = torch.autograd.grad(expected, tuple(v for v, needed in zip(baseline, mask) if needed), grad_outputs=upstream)
            self.assertEqual(masks[-1], mask)
            for index, actual, ordinary in zip([i for i, needed in enumerate(mask) if needed], gradients, original):
                if index == 1:
                    columns = F.unfold(source[0].detach().double(), (3, 3), padding=1)
                    reference = (upstream.double().reshape(1, 48, -1) @ columns.transpose(1, 2)).reshape(48, 48, 3, 3).float()
                    self.assertEqual(digest(actual), digest(reference))
                else:
                    self.assertEqual(digest(actual), digest(ordinary))

    def test_analytic_impulse_and_operator_parameter_reuse(self):
        features, weight, bias = values((False, True, False), (3, 3))
        features.zero_(); features[0, 26, 1, 1] = 2
        output = operator.terrain_detail_weight_reduction_precision(features, weight, bias)
        upstream = torch.zeros_like(output); upstream[0, 12, 1, 1] = 3
        gradient = torch.autograd.grad(output, weight, grad_outputs=upstream)[0]
        reference = torch.zeros_like(weight); reference[12, 26, 1, 1] = 6
        self.assertEqual(digest(gradient), digest(reference))
        original = self.parent.get_submodule(candidate.TARGET)
        replacement = operator.TerrainDetailWeightReductionConv(original)
        self.assertIs(replacement.weight, original.weight); self.assertIs(replacement.bias, original.bias)

    def test_operator_invalid_dtype_shape_alias_nonfinite_autocast_gradgrad(self):
        source = values()
        with self.assertRaises(ValueError): operator.terrain_detail_weight_reduction_precision(source[0].double(), *source[1:])
        with self.assertRaises(ValueError): operator.terrain_detail_weight_reduction_precision(source[0][:, :47].contiguous(), *source[1:])
        for index in range(3):
            wrong = list(values()); wrong[index] = wrong[index].detach().clone(); wrong[index].reshape(-1)[0] = float("nan")
            with self.assertRaises(ValueError): operator.terrain_detail_weight_reduction_precision(*wrong)
        storage = torch.zeros(48 * 48 * 3 * 3)
        with self.assertRaises(ValueError): operator.terrain_detail_weight_reduction_precision(
            storage[:48 * 4 * 4].reshape(1, 48, 4, 4), storage.reshape(48, 48, 3, 3), torch.zeros(48))
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaises(ValueError): operator.terrain_detail_weight_reduction_precision(*source)
        output = operator.terrain_detail_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "higher-order"): torch.autograd.grad(output.sum(), source[1], create_graph=True)

    def test_full_graph_only_target_initial_bytes_rng_independent_storage(self):
        model = self.model
        self.assertIn("original_device_fp64", operator.NUMERIC_RULE)
        self.assertNotIn("_cpu_", operator.NUMERIC_RULE)
        self.assertFalse(model.execution_qualified)
        named, previous = tuple(model.named_parameters()), tuple(self.parent.named_parameters())
        self.assertEqual(len(named), 108); self.assertEqual(sum(v.numel() for _, v in named), 2242687)
        self.assertEqual(named[60][0], candidate.TARGET + ".weight"); self.assertEqual(named[60][1].shape, (48, 48, 3, 3))
        for (name, value), (old_name, old_value) in zip(named, previous):
            self.assertEqual(name, old_name); self.assertEqual(digest(value), digest(old_value))
        old_modules, modules = parent._module_graph(self.parent), parent._module_graph(model)
        changes = [name for (name, cls, config), (old_name, old_cls, old_config) in zip(modules, old_modules)
                   if cls is not old_cls or config != old_config]
        self.assertEqual(changes, ["", candidate.TARGET])
        self.assertIs(type(model.get_submodule(parent.TARGET)), Decode1WeightReductionConv)
        rng = torch.get_rng_state().clone()
        second = candidate.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        for left, right in zip((*model.parameters(), *model.buffers()), (*second.parameters(), *second.buffers())):
            self.assertNotEqual(left.untyped_storage().data_ptr(), right.untyped_storage().data_ptr())
            self.assertEqual(digest(left), digest(right))
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self.assertTrue(torch.equal(getattr(model, name), candidate.identity_bytes(kind)))
            self.assertFalse(torch.equal(getattr(model, name), getattr(self.parent, name)))

    def test_wrong_module_config_alias_type_identity_and_channel_order_rejected(self):
        with self.assertRaises(ValueError): candidate.validate_model_identity(self.parent)
        with self.assertRaises(ValueError): parent.validate_model_identity(self.model)
        target = self.model.get_submodule(candidate.TARGET)
        for key, value in (("padding", (0, 0)), ("stride", (2, 2)), ("groups", 2), ("padding_mode", "reflect")):
            saved = getattr(target, key); setattr(target, key, value)
            try:
                with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
            finally: setattr(target, key, saved)
        owner = self.model.get_submodule(candidate.TARGET.rsplit(".", 1)[0]); saved = owner._modules["3"]
        owner._modules["3"] = nn.Identity()
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: owner._modules["3"] = saved
        original_data = target.bias.detach(); target.bias.data = self.model.get_submodule(parent.TARGET).bias.detach()
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: target.bias.data = original_data
        self.model.numeric_identity[0] ^= 1
        try:
            with self.assertRaises(ValueError): candidate.validate_model_identity(self.model)
        finally: self.model.numeric_identity[0] ^= 1
        with self.assertRaises(ValueError): candidate.build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=ORDER[::-1])

    def test_strict_cpu_state_preflight_rejects_old_state_and_restores_failed_install(self):
        before = state(self.model); current = self.model.state_dict(); key = candidate.TARGET + ".weight"
        with self.assertRaises(ValueError): self.model.load_state_dict(self.parent.state_dict())
        for wrong in (OrderedDict(reversed(tuple(current.items()))), {k: v for k, v in current.items() if k != key},
                      {**current, key: current[key].double()}, {**current, key: torch.full_like(current[key], float("inf"))}):
            with self.assertRaises(ValueError): self.model.load_state_dict(wrong)
        for kwargs in ({"strict": False}, {"assign": True}):
            with self.assertRaises(ValueError): self.model.load_state_dict(current, **kwargs)
        self.assertEqual(state(self.model), before)
        identity = tuple(id(v) for v in (*self.model.parameters(), *self.model.buffers()))
        parameter = self.model.get_submodule(candidate.TARGET).weight
        binding = parent._storage_identity(parameter)
        for late_error in (True, False):
            def fail(model, incompatible):
                parameter.data = parameter.detach().clone()
                if late_error: raise ValueError("late hook error")
            hook = self.model.register_load_state_dict_post_hook(fail)
            try:
                with self.assertRaises(ValueError): self.model.load_state_dict({**current, key: current[key] + .001})
            finally: hook.remove()
            self.assertEqual(state(self.model), before); self.assertEqual(parent._storage_identity(parameter), binding)
            self.assertEqual(tuple(id(v) for v in (*self.model.parameters(), *self.model.buffers())), identity)
        clone = {k: v.clone() for k, v in current.items()}; self.model.load_state_dict(clone)
        self.assertEqual(state(self.model), before)

    def test_micro_complete_forward_is_explicitly_blocked_by_inherited_256_contract(self):
        # Do not patch inherited shape/assembly rules to claim a miniature full G.
        with self.assertRaisesRegex(ValueError, "256x192"):
            self.model(torch.zeros(1, 23, 16, 16), [], appearance_regime=encode_season(SEASONS[0]),
                       ecology_regime=encode_ecology(ECOLOGIES[0]))

    def test_all_108_parameter_four_gradients_and_original_cpu_projection(self):
        # Synthetic scalar graph over all actual parameters, NOT a renderer/Loss
        # validation. Real 256x192 train-157 forward/Loss remains controller work.
        model = self.model; before = state(model); critic = nn.Identity().eval()
        energy = sum(p.square().mean() for p in model.parameters())
        structured, whole, core = energy * .001, energy * -.003, energy * .001
        total = (structured + whole) + core
        recorded = []
        with bridge.observe_generator_gradients(lambda stage, label, raw: recorded.append((stage, label, raw))):
            gradients, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic,
                sample={"split": "train", "image": torch.zeros(1, 3, 16, 16), "conditions": torch.zeros(1, 23, 16, 16)},
                actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)
        completed = [row for row in recorded if row[0] == "complete"]
        self.assertEqual([row[1] for row in completed], ["actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb"])
        self.assertEqual([len(row[2]) for row in completed], [108] * 4)
        self.assertEqual(facts["candidateId"], candidate.CAPABILITY); self.assertEqual(facts["autogradGradCalls"], 4)
        parameters, groups, _, _ = bridge.bind_parameters(model)
        copied = [tuple(v.detach().clone() for v in row[2]) for row in completed]
        carrier = bridge._cpu_carrier(model)
        reference, original_facts = bridge.apply_object_head_core_priority_update_v24_cpu(model=carrier,
            parameters=tuple(carrier.parameters()), total_gradients=copied[0], structured_gradients=copied[1],
            whole_frame_gradients=copied[2], core_gradients=copied[3])
        self.assertEqual(facts["headDiagnostics"], original_facts["headDiagnostics"])
        owned = {i for indexes in groups.values() for i in indexes}
        for index, value in enumerate(gradients):
            self.assertEqual(digest(value), digest(reference[index]))
            if index not in owned:
                self.assertEqual(value.untyped_storage().data_ptr(), completed[0][2][index].untyped_storage().data_ptr())
        self.assertTrue(all(p.grad is None for p in parameters)); self.assertEqual(state(model), before)
        with self.assertRaisesRegex(ValueError, "non-train"):
            bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample={"split": "validation"},
                actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)


if __name__ == "__main__":
    with ExitStack() as guard:
        for obj, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch, "load"), (torch, "save")):
            guard.enter_context(patch.object(obj, name, side_effect=AssertionError("CPU component prohibited operation")))
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(PrecisionTests))
    assert not torch.cuda.is_initialized() and time.monotonic() - STARTED < 120
    print(json.dumps({"testsRun": result.testsRun, "passed": result.wasSuccessful(), "seconds": time.monotonic() - STARTED,
        "cpuThreads": torch.get_num_threads(), "cpuInteropThreads": torch.get_num_interop_threads(),
        "operatorSpatialShape": [4, 5], "microRendererShape": [16, 16], "microRendererForwardVerified": False,
        "syntheticFullParameterGradientsVerified": result.wasSuccessful(), "real256ForwardLossVerified": False,
        "optimizerUpdates": 0, "gpuInitialized": False, "sourceDataRead": False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
