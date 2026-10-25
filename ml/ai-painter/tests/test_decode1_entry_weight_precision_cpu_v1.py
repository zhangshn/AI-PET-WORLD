"""Synthetic target-48 CPU components only; not real-sample CPU admission."""
from collections import OrderedDict
from contextlib import ExitStack
from copy import deepcopy
import hashlib
import itertools
import json
import math
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
from ai_painter.complete_world import decode1_entry_weight_reduction_precision_v1 as operator
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as parent
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as graph
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as detail
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER

_GUARDS = None
_AFFINITY = None


def setUpModule():
    global _GUARDS, _AFFINITY
    import psutil
    process = psutil.Process()
    allowed = process.cpu_affinity()
    if not allowed:
        raise AssertionError("empty CPU affinity")
    selected = allowed[:2]
    process.cpu_affinity(selected)
    _AFFINITY = process.cpu_affinity()
    assert set(_AFFINITY) == set(selected) and 1 <= len(_AFFINITY) <= 2
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)
    assert not torch.cuda.is_initialized()
    _GUARDS = ExitStack()
    for owner, name in ((torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__"), (torch, "load"), (torch, "save")):
        _GUARDS.enter_context(patch.object(owner, name, side_effect=AssertionError("synthetic CPU prohibited operation")))
    # Construction and strict reload are allowed; a full renderer is not.
    for cls in (candidate.Decode1EntryWeightPrecisionEcologyRenderer, parent.FinalRgbBaseWeightPrecisionEcologyRenderer):
        _GUARDS.enter_context(patch.object(cls, "forward", side_effect=AssertionError("full renderer forward prohibited")))


def tearDownModule():
    if _GUARDS is not None:
        _GUARDS.close()
    assert not torch.cuda.is_initialized()


def digest(value):
    return hashlib.sha256(value.detach().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def state(model):
    return {name: digest(value) for name, value in model.state_dict().items()}


def values(mask=(True, True, True), size=(4, 5)):
    rng = torch.Generator(device="cpu").manual_seed(20261018)
    return tuple(torch.randn(shape, generator=rng).requires_grad_(needed) for shape, needed in zip(
        ((1, 144, *size), (48, 144, 3, 3), (48,)), mask))


class OperatorTests(unittest.TestCase):
    def test_eight_masks_native_forward_input_bias_and_fp64_weight(self):
        native = torch.ops.aten.convolution_backward.default
        seen = []
        def observed(*args, **kwargs):
            seen.append(tuple(args[-1]))
            return native(*args, **kwargs)
        for mask in itertools.product((False, True), repeat=3):
            with self.subTest(mask=mask):
                source = values(mask)
                output = operator.decode1_entry_weight_reduction_precision(*source)
                original = F.conv2d(*source, padding=1)
                self.assertEqual(digest(output), digest(original))
                if not any(mask):
                    self.assertFalse(output.requires_grad)
                    continue
                upstream = torch.linspace(-.5, .5, output.numel()).reshape_as(output)
                with patch.object(torch.ops.aten.convolution_backward, "default", observed):
                    gradients = torch.autograd.grad(output, tuple(v for v, needed in zip(source, mask) if needed), grad_outputs=upstream)
                self.assertEqual(seen[-1], mask)
                expected = native(upstream, *source[:2], [48], [1, 1], [1, 1], [1, 1], False, [0, 0], 1, mask)
                for index, actual in zip([i for i, needed in enumerate(mask) if needed], gradients):
                    if index == 1:
                        columns = F.unfold(source[0].detach().double(), (3, 3), padding=1)
                        reference = (upstream.double().reshape(1, 48, -1) @ columns.transpose(1, 2)).reshape(48, 144, 3, 3).float()
                        self.assertEqual(digest(actual), digest(reference))
                    else:
                        self.assertEqual(digest(actual), digest(expected[index]))
                self.assertEqual(len(seen), sum(any(m) for m in itertools.product((False, True), repeat=3) if m <= mask))

    def test_reference_two_coordinates_independent_fsum_and_native_difference(self):
        features, weight, bias = values((False, True, False))
        output = operator.decode1_entry_weight_reduction_precision(features, weight, bias)
        upstream = torch.linspace(-1., 1., output.numel()).reshape_as(output)
        gradient = torch.autograd.grad(output, weight, grad_outputs=upstream)[0]
        native = torch.nn.grad.conv2d_weight(features, weight.shape, upstream, padding=1)
        self.assertNotEqual(digest(gradient), digest(native))
        for out_channel, in_channel, ky, kx in ((10, 81, 0, 0), (10, 81, 1, 0), (47, 143, 2, 2)):
            terms = []
            for y in range(4):
                for x in range(5):
                    iy, ix = y + ky - 1, x + kx - 1
                    if 0 <= iy < 4 and 0 <= ix < 5:
                        terms.append(float(features[0, in_channel, iy, ix]) * float(upstream[0, out_channel, y, x]))
            expected = torch.tensor(math.fsum(terms), dtype=torch.float64).float()
            self.assertEqual(digest(gradient[out_channel, in_channel, ky, kx]), digest(expected))

    def test_impulse_geometry_and_original_parameter_objects(self):
        features, weight, bias = values((False, True, False), (3, 3))
        features.zero_()
        features[0, 81, 1, 1] = 2
        output = operator.decode1_entry_weight_reduction_precision(features, weight, bias)
        upstream = torch.zeros_like(output)
        upstream[0, 10, 1, 1] = 3
        gradient = torch.autograd.grad(output, weight, grad_outputs=upstream)[0]
        expected = torch.zeros_like(weight)
        expected[10, 81, 1, 1] = 6
        self.assertEqual(digest(gradient), digest(expected))
        original = nn.Conv2d(144, 48, 3, padding=1).eval()
        wrapped = operator.Decode1EntryWeightReductionConv(original)
        self.assertIs(wrapped.weight, original.weight)
        self.assertIs(wrapped.bias, original.bias)
        self.assertFalse(wrapped.training)
        self.assertEqual(digest(wrapped(features)), digest(original(features)))

    def test_invalid_tensor_type_dtype_layout_shape_and_alias(self):
        source = values()
        bad = (None, source[0].double(), source[0].to("meta"), source[0].transpose(2, 3),
               torch.zeros(2, 144, 4, 5), torch.zeros(1, 48, 4, 5), torch.zeros(1, 144, 0, 5))
        for features in bad:
            with self.subTest(features=type(features)), self.assertRaises(ValueError):
                operator.decode1_entry_weight_reduction_precision(features, *source[1:])
        for weight, bias in ((torch.zeros(48, 48, 3, 3), source[2]), (source[1], None), (source[1], torch.zeros(47))):
            with self.assertRaises(ValueError):
                operator.decode1_entry_weight_reduction_precision(source[0], weight, bias)
        storage = torch.zeros(48 * 144 * 3 * 3)
        with self.assertRaisesRegex(ValueError, "alias"):
            operator.decode1_entry_weight_reduction_precision(storage[:144 * 4 * 5].reshape(1, 144, 4, 5),
                storage.reshape(48, 144, 3, 3), torch.zeros(48))
        with self.assertRaisesRegex(ValueError, "alias"):
            operator.decode1_entry_weight_reduction_precision(source[0], storage.reshape(48, 144, 3, 3), storage[:48])

    def test_nonfinite_inputs_forward_backward_and_autocast_higherorder(self):
        for index, value in itertools.product(range(3), (float("nan"), float("inf"))):
            source = list(values())
            source[index] = source[index].detach().clone()
            source[index].reshape(-1)[0] = value
            with self.assertRaises(ValueError):
                operator.decode1_entry_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "forward nonfinite"):
            operator.decode1_entry_weight_reduction_precision(torch.full((1, 144, 2, 2), 1e30),
                torch.full((48, 144, 3, 3), 1e30), torch.zeros(48))
        source = values()
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaisesRegex(ValueError, "autocast"):
            operator.decode1_entry_weight_reduction_precision(*source)
        output = operator.decode1_entry_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "grad_output"):
            torch.autograd.grad(output, source[1], grad_outputs=torch.full_like(output, float("nan")))
        output = operator.decode1_entry_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "higher-order"):
            torch.autograd.grad(output.sum(), source[1], create_graph=True)

    def test_broadcast_noncontiguous_adjoint_and_backward_validation(self):
        source = values()
        output = operator.decode1_entry_weight_reduction_precision(*source)
        gradient = torch.autograd.grad(output.sum(), source[1])[0]
        columns = F.unfold(source[0].detach().double(), (3, 3), padding=1)
        expected = (torch.ones(1, 48, 20, dtype=torch.float64) @ columns.transpose(1, 2)).reshape_as(source[1]).float()
        self.assertEqual(digest(gradient), digest(expected))
        source = values()
        output = operator.decode1_entry_weight_reduction_precision(*source)
        with torch.no_grad():
            source[0][0, 0, 0, 0] = float("nan")
        with self.assertRaises(RuntimeError):
            torch.autograd.grad(output.sum(), source[1])

    def test_wrapper_rejects_noncanonical_geometry_and_subclass(self):
        class Other(nn.Conv2d):
            pass
        for original in (nn.Conv2d(48, 48, 3, padding=1), nn.Conv2d(144, 48, 3),
                         nn.Conv2d(144, 48, 3, padding=1, bias=False), nn.Conv2d(144, 48, 3, padding=1, stride=2),
                         Other(144, 48, 3, padding=1)):
            with self.assertRaises(ValueError):
                operator.Decode1EntryWeightReductionConv(original)


class FactoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rng = torch.get_rng_state().clone()
        cls.parent = parent.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=ORDER)
        cls.pristine = candidate.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=ORDER)
        assert torch.equal(rng, torch.get_rng_state())

    def setUp(self):
        self.model = deepcopy(self.pristine)

    def test_only_48_replaced_graph_bytes_seed_independent_storage(self):
        self.assertEqual(candidate.TARGET_INDEX, 48)
        self.assertEqual(candidate.TARGET, "core.core.terrain.decode_1.layers.0")
        self.assertFalse(self.model.execution_qualified)
        self.assertFalse(self.model.parent_checkpoint_loaded)
        named, before = tuple(self.model.named_parameters()), tuple(self.parent.named_parameters())
        self.assertEqual(len(named), 108)
        self.assertEqual(sum(value.numel() for _, value in named), 2242687)
        self.assertEqual(named[48][0], candidate.TARGET + ".weight")
        self.assertEqual(tuple(named[48][1].shape), (48, 144, 3, 3))
        for (name, value), (old_name, old_value) in zip(named, before):
            self.assertEqual(name, old_name)
            self.assertEqual(digest(value), digest(old_value))
            self.assertNotEqual(value.untyped_storage().data_ptr(), old_value.untyped_storage().data_ptr())
        differences = [name for (name, cls, config), (old_name, old_cls, old_config)
                       in zip(graph._module_graph(self.model), graph._module_graph(self.parent))
                       if cls is not old_cls or config != old_config or name != old_name]
        self.assertEqual(differences, ["", candidate.TARGET])
        for target, cls in ((graph.TARGET, graph.Decode1WeightReductionConv),
                            (detail.TARGET, detail.TerrainDetailWeightReductionConv),
                            (parent.TARGET, parent.FinalRgbBaseWeightReductionConv)):
            self.assertIs(type(self.model.get_submodule(target)), cls)
        self.assertEqual(candidate.NUMERIC_RULE, parent.NUMERIC_RULE + "|" + operator.NUMERIC_RULE)
        second = candidate.build_fresh_object_ecology_decode1_entry_weight_precision()
        for left, right in zip((*self.model.parameters(), *self.model.buffers()), (*second.parameters(), *second.buffers())):
            self.assertNotEqual(left.untyped_storage().data_ptr(), right.untyped_storage().data_ptr())
            self.assertEqual(digest(left), digest(right))

    def test_constructor_retains_every_parameter_and_does_not_mutate_parent(self):
        fresh = deepcopy(self.parent)
        before, modules = state(fresh), graph._module_graph(fresh)
        wrapped = candidate.Decode1EntryWeightPrecisionEcologyRenderer(fresh)
        for (left_name, left), (right_name, right) in zip(fresh.named_parameters(), wrapped.named_parameters()):
            self.assertEqual(left_name, right_name)
            self.assertIs(left, right)
        self.assertEqual(state(fresh), before)
        self.assertEqual(graph._module_graph(fresh), modules)
        self.assertIs(type(fresh.get_submodule(candidate.TARGET)), nn.Conv2d)

    def test_modified_parent_old_types_channel_order_and_identities_rejected(self):
        fresh = deepcopy(self.parent)
        with torch.no_grad():
            next(fresh.parameters()).reshape(-1)[0] += .01
        with self.assertRaisesRegex(ValueError, "pristine"):
            candidate.Decode1EntryWeightPrecisionEcologyRenderer(fresh)
        for wrong in (self.parent, nn.Identity()):
            with self.assertRaises(ValueError):
                candidate.validate_model_identity(wrong)
        with self.assertRaises(ValueError):
            parent.validate_model_identity(self.model)
        with self.assertRaises(ValueError):
            candidate.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=ORDER[::-1])
        for name in ("regime_identity", "numeric_identity", "ecology_identity"):
            self.assertNotEqual(digest(getattr(self.parent, name)), digest(getattr(self.model, name)))
            self.model.load_state_dict(self.model.state_dict())

    def test_exact_graph_config_alias_finite_identity_forward_and_qualification_guards(self):
        target = self.model.get_submodule(candidate.TARGET)
        for key, value in (("padding", (0, 0)), ("stride", (2, 2)), ("groups", 2), ("in_channels", 48)):
            saved = getattr(target, key)
            setattr(target, key, value)
            try:
                with self.assertRaises(ValueError):
                    candidate.validate_model_identity(self.model)
            finally:
                setattr(target, key, saved)
        for name, value in (("execution_qualified", True), ("parent_checkpoint_loaded", True), ("_parent_forward", lambda *a: None)):
            saved = getattr(self.model, name)
            setattr(self.model, name, value)
            try:
                with self.assertRaises(ValueError):
                    candidate.validate_model_identity(self.model)
            finally:
                setattr(self.model, name, saved)
        original = target.bias.detach()
        target.bias.data = self.model.get_submodule(detail.TARGET).bias.detach()
        try:
            with self.assertRaises(ValueError):
                candidate.validate_model_identity(self.model)
        finally:
            target.bias.data = original
        with torch.no_grad():
            target.weight.reshape(-1)[0] = float("nan")
        with self.assertRaises(ValueError):
            candidate.validate_model_identity(self.model)

    def test_season_and_ecology_parameter_accessors_are_original(self):
        self.assertIs(candidate.seasonal_parameter(self.model), self.model.get_submodule(candidate.ecology.TARGET).season_branch.weight)
        self.assertIs(candidate.ecological_parameter(self.model), self.model.get_submodule(candidate.ecology.TARGET).ecology_branch.weight)

    def test_strict_reload_preflight_old_state_order_dtype_shape_finite_and_flags(self):
        model = self.model
        before, current = state(model), model.state_dict()
        key = candidate.TARGET + ".weight"
        for wrong in (self.parent.state_dict(), OrderedDict(reversed(tuple(current.items()))),
                      {k: v for k, v in current.items() if k != key}, {**current, key: current[key].double()},
                      {**current, key: current[key][:47].clone()}, {**current, key: current[key].transpose(2, 3)},
                      {**current, key: current[key].clone().requires_grad_()},
                      {**current, key: torch.full_like(current[key], float("inf"))}):
            with self.assertRaises(ValueError):
                model.load_state_dict(wrong)
            self.assertEqual(state(model), before)
        for kwargs in ({"strict": False}, {"assign": True}):
            with self.assertRaises(ValueError):
                model.load_state_dict(current, **kwargs)

    def test_strict_reload_success_keeps_objects_storage_modes_gradients(self):
        model = self.model.eval()
        parameter = model.get_submodule(candidate.TARGET).weight
        parameter.grad = torch.ones_like(parameter)
        first = next(model.parameters())
        first.requires_grad_(False)
        old = tuple((*model.parameters(), *model.buffers()))
        storage = tuple(graph._storage_identity(value) for value in old)
        gradient = parameter.grad
        payload = {key: value.clone() for key, value in model.state_dict().items()}
        payload[candidate.TARGET + ".weight"] += .001
        result = model.load_state_dict(payload)
        self.assertEqual((result.missing_keys, result.unexpected_keys), ([], []))
        self.assertTrue(all(left is right for left, right in zip(old, (*model.parameters(), *model.buffers()))))
        self.assertEqual(tuple(graph._storage_identity(value) for value in old), storage)
        self.assertIs(parameter.grad, gradient)
        self.assertFalse(first.requires_grad)
        self.assertTrue(all(not module.training for module in model.modules()))
        self.assertEqual(state(model), {key: digest(value) for key, value in payload.items()})

    def test_failed_reload_restores_rebound_storage_replaced_modules_config_flags_and_bytes(self):
        model = self.model
        target = model.get_submodule(candidate.TARGET)
        target.weight.grad = torch.ones_like(target.weight)
        gradient = target.weight.grad
        before = state(model)
        objects = tuple((*model.parameters(), *model.buffers()))
        bindings = tuple(graph._storage_identity(value) for value in objects)
        modules = tuple(model.modules())
        for corruption in ("storage", "parameter", "module", "config", "mode", "flags", "raise"):
            def corrupt(network, incompatible):
                if corruption == "storage":
                    target.weight.data = target.weight.detach().clone()
                elif corruption == "parameter":
                    target.weight = nn.Parameter(target.weight.detach().clone())
                elif corruption == "module":
                    network.core = deepcopy(network.core)
                elif corruption == "config":
                    target.padding = (0, 0)
                elif corruption == "mode":
                    target.eval()
                elif corruption == "flags":
                    target.weight.requires_grad_(False)
                    target.weight.grad = None
                else:
                    raise ValueError("deliberate late load hook failure")
            hook = model.register_load_state_dict_post_hook(corrupt)
            payload = {key: value.clone() for key, value in model.state_dict().items()}
            payload[candidate.TARGET + ".weight"] += .001
            try:
                with self.subTest(corruption=corruption), self.assertRaises(ValueError):
                    model.load_state_dict(payload)
            finally:
                hook.remove()
            self.assertEqual(state(model), before)
            self.assertEqual(tuple(model.modules()), modules)
            self.assertTrue(all(left is right for left, right in zip(objects, (*model.parameters(), *model.buffers()))))
            self.assertEqual(tuple(graph._storage_identity(value) for value in objects), bindings)
            self.assertIs(target.weight.grad, gradient)
            self.assertTrue(target.weight.requires_grad)
            candidate.validate_model_identity(model)


class Decode2EntryTests(unittest.TestCase):
    def test_all_masks_native_forward_input_bias_and_fp64_weight(self):
        rng = torch.Generator().manual_seed(20261022)
        for mask in itertools.product((False, True), repeat=3):
            original = nn.Conv2d(192, 96, 3, padding=1)
            wrapped = operator.Decode2EntryWeightReductionConv(original)
            self.assertIs(wrapped.weight, original.weight)
            self.assertIs(wrapped.bias, original.bias)
            source = (torch.randn((1, 192, 4, 5), generator=rng).requires_grad_(mask[0]),
                      original.weight.requires_grad_(mask[1]), original.bias.requires_grad_(mask[2]))
            actual = wrapped(source[0])
            self.assertEqual(digest(actual), digest(F.conv2d(*source, padding=1)))
            if not any(mask):
                self.assertFalse(actual.requires_grad)
                continue
            upstream = torch.linspace(-.5, .5, actual.numel()).reshape_as(actual)
            native = torch.ops.aten.convolution_backward.default
            with patch.object(torch.ops.aten.convolution_backward, "default", wraps=native) as observed:
                gradients = torch.autograd.grad(actual, tuple(v for v, needed in zip(source, mask) if needed), grad_outputs=upstream)
            self.assertEqual(tuple(observed.call_args.args[-1]), mask)
            reference = native(upstream, source[0], source[1], [96], [1, 1], [1, 1], [1, 1], False, [0, 0], 1, mask)
            weight_reference = (upstream.double().reshape(1, 96, -1)
                                @ F.unfold(source[0].detach().double(), (3, 3), padding=1).transpose(1, 2)).reshape_as(source[1]).float()
            for index, gradient in zip((i for i, needed in enumerate(mask) if needed), gradients):
                self.assertEqual(digest(gradient), digest(weight_reference if index == 1 else reference[index]))
            if mask[1]:
                terms = [float(source[0][0, 101, y-1, x-1]) * float(upstream[0, 95, y, x])
                         for y in range(1, 4) for x in range(1, 5)]
                self.assertEqual(float(weight_reference[95, 101, 0, 0]), float(torch.tensor(math.fsum(terms), dtype=torch.float32)))

    def test_exact_new_identity_same_parameters_and_only_target40_module_added(self):
        old = candidate.build_fresh_object_ecology_decode1_entry_weight_precision()
        new = candidate.build_fresh_object_ecology_decode2_entry_weight_precision()
        self.assertEqual(new.capability_version, candidate.DECODE2_CAPABILITY)
        self.assertNotEqual(old.capability_version, new.capability_version)
        self.assertEqual(tuple((n, digest(p)) for n, p in old.named_parameters()), tuple((n, digest(p)) for n, p in new.named_parameters()))
        self.assertEqual(sum(p.numel() for p in new.parameters()), 2242687)
        changed = [(a, type(x), type(y)) for (a, x), (b, y) in zip(old.named_modules(), new.named_modules()) if type(x) is not type(y)]
        self.assertEqual([row[0] for row in changed], ["", candidate.DECODE2_TARGET])
        candidate.validate_model_identity(new)
        for current, wrong in ((new, old.state_dict()), (old, new.state_dict())):
            before = state(current)
            with self.assertRaises(ValueError):
                current.load_state_dict(wrong)
            self.assertEqual(state(current), before)
        new.load_state_dict({key: value.clone() for key, value in new.state_dict().items()})
        candidate.validate_model_identity(new)

    def test_native_target_and_wrong_metadata_cannot_claim_new_identity(self):
        new = candidate.build_fresh_object_ecology_decode2_entry_weight_precision()
        new.capability_version = candidate.CAPABILITY
        with self.assertRaises(ValueError): candidate.validate_model_identity(new)
        new.capability_version = candidate.DECODE2_CAPABILITY
        target = new.get_submodule(candidate.DECODE2_TARGET)
        target.padding = (0, 0)
        with self.assertRaises(ValueError): candidate.validate_model_identity(new)
        with self.assertRaises(ValueError): operator.Decode2EntryWeightReductionConv(nn.Conv2d(144, 48, 3, padding=1))
        with self.assertRaises(ValueError): operator.Decode1EntryWeightReductionConv(nn.Conv2d(192, 96, 3, padding=1))


class RgbOutputIdentityTests(unittest.TestCase):
    def test_new_identity_preserves_parameters_and_changes_only_output_module(self):
        old=candidate.build_fresh_object_ecology_decode2_entry_weight_precision()
        new=candidate.build_fresh_object_ecology_decode2_output_weight_precision()
        self.assertEqual(new.capability_version,candidate.RGB_OUTPUT_CAPABILITY)
        self.assertEqual(new.numeric_rule,candidate.RGB_OUTPUT_RULE)
        before,after=tuple(old.named_parameters()),tuple(new.named_parameters())
        self.assertEqual(len(after),108)
        for (name,left),(other,right) in zip(before,after):
            self.assertEqual(name,other);self.assertEqual(digest(left),digest(right))
        changed=[name for (name,kind,config),(other,next_kind,next_config) in zip(graph._module_graph(old),graph._module_graph(new))
                 if kind is not next_kind]
        self.assertEqual(changed,["",candidate.RGB_OUTPUT_TARGET])
        self.assertEqual(tuple(after[90][1].shape),(3,48,1,1))
        candidate.validate_model_identity(new)

    def test_cross_numeric_identity_rejected_and_strict_own_reload_preserved(self):
        old=candidate.build_fresh_object_ecology_decode2_entry_weight_precision()
        new=candidate.build_fresh_object_ecology_decode2_output_weight_precision()
        before=state(new);objects=tuple(new.parameters())+tuple(new.buffers())
        with self.assertRaises(ValueError):new.load_state_dict(old.state_dict())
        self.assertEqual(before,state(new))
        new.load_state_dict({key:value.detach().clone() for key,value in new.state_dict().items()})
        self.assertEqual(before,state(new))
        self.assertTrue(all(a is b for a,b in zip(objects,(*new.parameters(),*new.buffers()))))
        with self.assertRaises(ValueError):old.load_state_dict(new.state_dict())

    def test_native_output_and_wrong_numeric_claim_are_rejected(self):
        from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv
        new=candidate.build_fresh_object_ecology_decode2_output_weight_precision()
        original=new.get_submodule(candidate.RGB_OUTPUT_TARGET)
        native=PrecisionFinalRGBConv(nn.Conv2d(48,3,1))
        new.core.core.final_rgb_decoder.base.layers[4]=native
        with self.assertRaises(ValueError):candidate.validate_model_identity(new)
        new.core.core.final_rgb_decoder.base.layers[4]=original
        new.numeric_rule=candidate.DECODE2_RULE
        with self.assertRaises(ValueError):candidate.validate_model_identity(new)


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    print(json.dumps({"testsRun": result.testsRun, "passed": result.wasSuccessful(), "seconds": time.monotonic() - STARTED,
        "cpuAffinity": _AFFINITY, "cpuThreads": torch.get_num_threads(), "cpuInteropThreads": torch.get_num_interop_threads(),
        "operatorSpatialShape": [4, 5], "realSampleRead": False, "real256Forward": False,
        "failedStateLoaded": False, "optimizerConstruction": 0, "optimizerUpdates": 0, "cudaInitialized": torch.cuda.is_initialized(),
        "realCpuAdmission": False, "rootCauseProven": False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
