"""NS-004 bounded actual CPU operator tests; no complete-renderer forward."""
from contextlib import ExitStack
from datetime import datetime, timezone
import argparse
from collections import OrderedDict
import hashlib
import itertools
import json
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world import decode1_weight_reduction_precision_v1 as operator
from ai_painter.complete_world import object_ecology_decode1_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_regime_conditioned as old

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())
COUNTS = dict(operatorForwardAttempts=0, actualNativeConvForwards=0, autogradCalls=0, completeRendererForwards=0,
              optimizerObjects=0, optimizerSteps=0, cudaInitializations=0, nativeJobCalls=0)
MASKS = []
MAX_SPACE = 0


def sha_tensor(value):
    return hashlib.sha256(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def state_bytes(model):
    return {name: sha_tensor(value) for name, value in model.state_dict().items()}


def values(mask=(True, True, True), size=(4, 5)):
    generator = torch.Generator(device="cpu").manual_seed(20261012)
    return tuple(torch.randn(shape, generator=generator).requires_grad_(needed) for shape, needed in zip(
        ((1, 48, *size), (48, 48, 3, 3), (48,)), mask))


class CoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entry_rng = torch.get_rng_state().clone()
        cls.model = candidate.build_fresh_object_ecology_decode1_weight_precision(condition_channel_order=ORDER)
        with torch.random.fork_rng(devices=[]):
            torch.random.default_generator.manual_seed(20260929)
            cls.predecessor = old.build_fresh_object_ecology_regime_conditioned(condition_channel_order=ORDER)
        assert torch.equal(cls.entry_rng, torch.get_rng_state())

    def test_eight_masks_native_forward_input_bias_and_fp64_weight(self):
        for mask in itertools.product((False, True), repeat=3):
            with self.subTest(mask=mask):
                source = values(mask)
                baseline = tuple(value.detach().clone().requires_grad_(needed) for value, needed in zip(source, mask))
                actual = operator.decode1_weight_reduction_precision(*source)
                expected = F.conv2d(*baseline, padding=1)
                self.assertTrue(torch.equal(actual, expected))
                if not any(mask):
                    self.assertFalse(actual.requires_grad)
                    continue
                cotangent = torch.linspace(-.5, .5, actual.numel()).reshape_as(actual)
                actual_grads = torch.autograd.grad(actual, tuple(value for value, needed in zip(source, mask) if needed), grad_outputs=cotangent)
                native_grads = torch.autograd.grad(expected, tuple(value for value, needed in zip(baseline, mask) if needed), grad_outputs=cotangent)
                requested = [index for index, needed in enumerate(mask) if needed]
                for index, actual_grad, native_grad in zip(requested, actual_grads, native_grads):
                    if index != 1:
                        self.assertTrue(torch.equal(actual_grad, native_grad), "native input/bias bytes changed")
                    else:
                        columns = F.unfold(source[0].detach().double(), (3, 3), padding=1)
                        reference = (cotangent.double().reshape(1, 48, -1) @ columns.transpose(1, 2)).reshape(48, 48, 3, 3).float()
                        self.assertTrue(torch.equal(actual_grad, reference))
                        self.assertEqual(actual_grad.device, source[1].device)
                self.assertEqual(MASKS[-1], list(mask))

    def test_weight_analytic_impulse_and_original_four_group_gate(self):
        features, weight, bias = values((False, True, False), (3, 3))
        features = torch.zeros_like(features)
        features[0, 26, 1, 1] = 2
        output = operator.decode1_weight_reduction_precision(features, weight, bias)
        cotangent = torch.zeros_like(output)
        cotangent[0, 12, 1, 1] = 3
        grad = torch.autograd.grad(output, weight, grad_outputs=cotangent)[0]
        reference = torch.zeros_like(weight)
        reference[12, 26, 1, 1] = 6
        self.assertTrue(torch.equal(grad, reference))
        source = values(size=(4, 4))
        output = operator.decode1_weight_reduction_precision(*source)
        weights = [torch.linspace(-1., 1., output.numel()).reshape_as(output), torch.ones_like(output) * .01, torch.ones_like(output) * -.02]
        parts = [(output * value).sum() for value in weights]
        total = (parts[0] + parts[1]) + parts[2]
        gradients = [torch.autograd.grad(loss, source[1], retain_graph=index < 3)[0] for index, loss in enumerate((total, *parts))]
        self.assertTrue(torch.isclose(gradients[0], (gradients[1] + gradients[2]) + gradients[3], atol=1e-6, rtol=1e-5).all())

    def test_gradgrad_autocast_alias_shape_and_nonfinite_reject(self):
        source = values()
        output = operator.decode1_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "higher-order"):
            torch.autograd.grad(output.sum(), source[1], create_graph=True)
        with torch.autocast("cpu", dtype=torch.bfloat16), self.assertRaisesRegex(ValueError, "autocast"):
            operator.decode1_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "shape"):
            operator.decode1_weight_reduction_precision(source[0][:, :47].contiguous(), source[1], source[2])
        with self.assertRaisesRegex(ValueError, "FP32"):
            operator.decode1_weight_reduction_precision(source[0].double(), source[1], source[2])
        for index in range(3):
            altered = list(values())
            altered[index] = altered[index].detach().clone()
            altered[index].reshape(-1)[0] = float("nan")
            with self.assertRaisesRegex(ValueError, "finite"):
                operator.decode1_weight_reduction_precision(*altered)
        storage = torch.zeros(48 * 48 * 3 * 3)
        with self.assertRaisesRegex(ValueError, "alias"):
            operator.decode1_weight_reduction_precision(storage[:48 * 4 * 4].reshape(1, 48, 4, 4),
                storage.reshape(48, 48, 3, 3), torch.zeros(48))
        output = operator.decode1_weight_reduction_precision(*source)
        with self.assertRaisesRegex(ValueError, "grad_output.*finite"):
            torch.autograd.grad(output, source[1], grad_outputs=torch.full_like(output, float("inf")))

    def test_full_graph_initialization_rng_and_unique_target(self):
        model = self.model
        named = tuple(model.named_parameters(remove_duplicate=False))
        previous = tuple(self.predecessor.named_parameters(remove_duplicate=False))
        self.assertEqual(len(named), 108)
        self.assertEqual(sum(value.numel() for _, value in named), 2242687)
        self.assertEqual(named[52][0], candidate.TARGET + ".weight")
        for (name, parameter), (other, reference) in zip(named, previous):
            self.assertEqual(name, other)
            self.assertEqual(sha_tensor(parameter), sha_tensor(reference))
        self.assertEqual(sum(type(module) is operator.Decode1WeightReductionConv for module in model.modules()), 1)
        self.assertTrue(torch.equal(self.entry_rng, torch.get_rng_state()))
        self.assertIs(candidate.validate_model_identity(model), model)
        self.assertIs(candidate.seasonal_parameter(model), model.get_submodule(old.TARGET).season_branch.weight)
        self.assertIs(candidate.ecological_parameter(model), model.get_submodule(old.TARGET).ecology_branch.weight)
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            self.assertTrue(torch.equal(getattr(model, name), candidate.identity_bytes(kind)))
            self.assertFalse(torch.equal(getattr(model, name), getattr(self.predecessor, name)))

    def test_two_factories_have_independent_same_seed_storage(self):
        before_rng = torch.get_rng_state().clone()
        second = candidate.build_fresh_object_ecology_decode1_weight_precision(condition_channel_order=ORDER)
        self.assertTrue(torch.equal(before_rng, torch.get_rng_state()))
        for first, other in zip(self.model.parameters(), second.parameters()):
            self.assertIsNot(first, other)
            self.assertNotEqual(first.untyped_storage().data_ptr(), other.untyped_storage().data_ptr())
            self.assertTrue(torch.equal(first, other))
        for first, other in zip(self.model.buffers(), second.buffers()):
            self.assertNotEqual(first.untyped_storage().data_ptr(), other.untyped_storage().data_ptr())
            self.assertTrue(torch.equal(first, other))
        with torch.no_grad():
            second.get_submodule(candidate.TARGET).weight.copy_(torch.zeros_like(second.get_submodule(candidate.TARGET).weight))
        self.assertFalse(torch.equal(self.model.get_submodule(candidate.TARGET).weight, second.get_submodule(candidate.TARGET).weight))

    def test_old_subclass_wrong_module_config_and_forged_identity_reject(self):
        with self.assertRaisesRegex(ValueError, "exact renderer"):
            candidate.validate_model_identity(self.predecessor)
        with self.assertRaisesRegex(ValueError, "ecology prototype identity"):
            old.validate_model_identity(self.model)
        class Derived(candidate.Decode1WeightPrecisionEcologyRenderer):
            pass
        derived = Derived(self.predecessor)
        with self.assertRaisesRegex(ValueError, "exact renderer"):
            candidate.validate_model_identity(derived)
        target = self.model.get_submodule(candidate.TARGET)
        target.padding = (0, 0)
        try:
            with self.assertRaisesRegex(ValueError, "module graph"):
                candidate.validate_model_identity(self.model)
        finally:
            target.padding = (1, 1)
        owner = self.model.get_submodule("core.core.terrain.decode_1.layers")
        owner._modules["3"] = nn.Identity()
        try:
            with self.assertRaises(ValueError):
                candidate.validate_model_identity(self.model)
        finally:
            owner._modules["3"] = target
        self.model.numeric_identity[0] ^= 1
        try:
            with self.assertRaisesRegex(ValueError, "identity buffer"):
                candidate.validate_model_identity(self.model)
        finally:
            self.model.numeric_identity[0] ^= 1

    def test_operator_exact_type_and_parameter_reuse(self):
        with torch.random.fork_rng(devices=[]):
            original = nn.Conv2d(48, 48, 3, padding=1)
        replacement = operator.Decode1WeightReductionConv(original)
        self.assertIs(replacement.weight, original.weight)
        self.assertIs(replacement.bias, original.bias)
        self.assertNotIsInstance(replacement, nn.Conv2d)
        features = values(size=(2, 2))[0].detach()
        self.assertTrue(torch.equal(replacement(features), F.conv2d(features, original.weight, original.bias, padding=1)))
        class DerivedConv(nn.Conv2d):
            pass
        with torch.random.fork_rng(devices=[]):
            rejected = DerivedConv(48, 48, 3, padding=1)
        with self.assertRaisesRegex(ValueError, "original convolution"):
            operator.Decode1WeightReductionConv(rejected)

    def test_strict_preflight_order_dtype_shape_identity_and_old_state(self):
        state = self.model.state_dict()
        before = state_bytes(self.model)
        with self.assertRaisesRegex(ValueError, "old/wrong identity"):
            self.model.load_state_dict(self.predecessor.state_dict())
        for malformed in (OrderedDict(reversed(tuple(state.items()))), {k: v for k, v in state.items() if k != candidate.TARGET + ".weight"}):
            with self.assertRaisesRegex(ValueError, "full state/order"):
                self.model.load_state_dict(malformed)
        key = candidate.TARGET + ".weight"
        for value in (torch.zeros(1), state[key].double(), torch.full_like(state[key], float("inf"))):
            with self.assertRaisesRegex(ValueError, "state tensor"):
                self.model.load_state_dict({**state, key: value})
        with self.assertRaisesRegex(ValueError, "full state/order"):
            self.model.load_state_dict(state, strict=False)
        with self.assertRaisesRegex(ValueError, "full state/order"):
            self.model.load_state_dict(state, assign=True)
        self.assertEqual(before, state_bytes(self.model))

    def test_strict_success_and_late_hook_direct_storage_rollback(self):
        state = {key: value.clone() for key, value in self.model.state_dict().items()}
        key = candidate.TARGET + ".weight"
        state[key] = state[key] + .001
        self.model.load_state_dict(state)
        self.assertEqual(sha_tensor(self.model.state_dict()[key]), sha_tensor(state[key]))
        before = state_bytes(self.model)
        identities = tuple(id(value) for value in self.model.parameters())
        calls = []
        def fail(module, incompatible):
            calls.append(True)
            module.get_submodule(candidate.TARGET).weight = nn.Parameter(torch.zeros(48, 48, 3, 3))
            raise ValueError("delayed load failure")
        handle = self.model.register_load_state_dict_post_hook(fail)
        try:
            with self.assertRaisesRegex(ValueError, "delayed load failure"):
                self.model.load_state_dict({**state, key: state[key] + .001})
        finally:
            handle.remove()
        self.assertEqual(len(calls), 1)
        self.assertEqual(before, state_bytes(self.model))
        self.assertEqual(identities, tuple(id(value) for value in self.model.parameters()))
        # Restore initialized model for every later reader without running any forward.
        initial = {name: value.clone() for name, value in self.predecessor.state_dict().items()}
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"), ("ecology_identity", "ecology")):
            initial[name] = candidate.identity_bytes(kind)
        self.model.load_state_dict(initial)

    def test_same_object_data_rebinding_late_error_and_success_reject(self):
        key = candidate.TARGET + ".weight"
        for late_error in (True, False):
            with self.subTest(late_error=late_error):
                state = {name: value.clone() for name, value in self.model.state_dict().items()}
                before = state_bytes(self.model)
                parameter = self.model.get_submodule(candidate.TARGET).weight
                buffer = self.model.numeric_identity
                identities = (candidate._storage_identity(parameter), candidate._storage_identity(buffer))
                calls = []
                def rebind(module, incompatible):
                    calls.append(True)
                    parameter.data = parameter.detach().clone()
                    buffer.data = buffer.detach().clone()
                    if late_error:
                        raise ValueError("same object rebound late failure")
                handle = self.model.register_load_state_dict_post_hook(rebind)
                try:
                    with self.assertRaisesRegex(ValueError, "rebound"):
                        self.model.load_state_dict({**state, key: state[key] + .001})
                finally:
                    handle.remove()
                self.assertEqual(len(calls), 1)
                self.assertIs(parameter, self.model.get_submodule(candidate.TARGET).weight)
                self.assertIs(buffer, self.model.numeric_identity)
                self.assertEqual(identities, (candidate._storage_identity(parameter), candidate._storage_identity(buffer)))
                self.assertEqual(before, state_bytes(self.model))


def main(output, selected_test=None):
    started = time.monotonic()
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    import psutil
    process = psutil.Process()
    available = process.cpu_affinity()
    process.cpu_affinity(available[:2])
    assert len(process.cpu_affinity()) <= 2
    original_conv, original_grad, original_apply = F.conv2d, torch.autograd.grad, operator.decode1_weight_reduction_precision
    original_native = torch.ops.aten.convolution_backward.default
    def counted_conv(features, *args, **kwargs):
        global MAX_SPACE
        MAX_SPACE = max(MAX_SPACE, *features.shape[2:])
        assert MAX_SPACE <= 16 and COUNTS["actualNativeConvForwards"] < 64
        COUNTS["actualNativeConvForwards"] += 1
        return original_conv(features, *args, **kwargs)
    def counted_apply(*args, **kwargs):
        COUNTS["operatorForwardAttempts"] += 1
        assert COUNTS["operatorForwardAttempts"] <= 64
        return original_apply(*args, **kwargs)
    def counted_grad(*args, **kwargs):
        assert time.monotonic() - started < 120 and COUNTS["autogradCalls"] < 96
        COUNTS["autogradCalls"] += 1
        return original_grad(*args, **kwargs)
    def counted_native(*args, **kwargs):
        MASKS.append(list(args[-1]))
        return original_native(*args, **kwargs)
    def rejected(label):
        def fail(*args, **kwargs):
            COUNTS[label] += 1
            raise AssertionError("NS004 prohibits " + label)
        return fail
    with ExitStack() as guard:
        guard.enter_context(patch.object(F, "conv2d", counted_conv))
        guard.enter_context(patch.object(operator, "decode1_weight_reduction_precision", counted_apply))
        guard.enter_context(patch.object(torch.autograd, "grad", counted_grad))
        guard.enter_context(patch.object(torch.ops.aten.convolution_backward, "default", counted_native))
        guard.enter_context(patch.object(candidate.Decode1WeightPrecisionEcologyRenderer, "forward", rejected("completeRendererForwards")))
        guard.enter_context(patch.object(old.EcologyRegimeConditionedRenderer, "forward", rejected("completeRendererForwards")))
        for obj, name, label in ((torch.optim.Optimizer, "__init__", "optimizerObjects"), (torch.optim.Optimizer, "step", "optimizerSteps"),
                                 (torch.cuda, "_lazy_init", "cudaInitializations")):
            guard.enter_context(patch.object(obj, name, rejected(label)))
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(CoreTests) if selected_test is None else unittest.TestSuite([CoreTests(selected_test)])
        result = unittest.TextTestRunner(verbosity=2).run(suite)
    assert not torch.cuda.is_initialized() and time.monotonic() - started < 120
    assert COUNTS["operatorForwardAttempts"] + COUNTS["actualNativeConvForwards"] <= 64
    sources = ["ml/ai-painter/src/ai_painter/complete_world/decode1_weight_reduction_precision_v1.py",
        "ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_precision_v1.py",
        "ml/ai-painter/tests/test_ecology_decode1_precision_core_cpu.py"]
    bindings = {path: {"sha256": hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), "bytes": (ROOT / path).stat().st_size} for path in sources}
    record = {"schema": "ecology-decode1-precision-core-cpu-component-v1", "status": "passed" if result.wasSuccessful() else "failed",
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "testsRun": result.testsRun,
        "testSelection": selected_test or "all",
        "failures": [{"case": str(case), "trace": trace} for case, trace in result.failures + result.errors],
        "counts": COUNTS, "nativeBackwardMasks": MASKS, "maximumSyntheticSpatialSide": MAX_SPACE,
        "conservativeForwardCountUpperBound": COUNTS["operatorForwardAttempts"] + COUNTS["actualNativeConvForwards"],
        "cpuThreads": torch.get_num_threads(), "cpuInteropThreads": torch.get_num_interop_threads(), "cpuAffinity": process.cpu_affinity(),
        "seconds": time.monotonic() - started, "sources": bindings,
        "capability": candidate.CAPABILITY, "architecture": candidate.ARCHITECTURE, "numericRule": candidate.NUMERIC_RULE,
        "trainingQualified": False, "gpuQualified": False, "fullRendererForwardVerified": False,
        "sourceDataRead": False, "newGpuOrTrainingExecuted": False, "limits": {"seconds": 120, "threads": 2,
            "maxForward": 64, "maxAutograd": 96, "maxSpace": 16, "outputBytes": 8388608, "jsonBytes": 2097152, "terminalReserveBytes": 65536}}
    raw = (json.dumps(record, indent=2) + "\n").encode()
    assert len(raw) <= 2097152 and output.startswith(".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/r6-")
    with (ROOT / output).open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({"status": record["status"], "testsRun": result.testsRun, "counts": COUNTS,
                      "report": output, "sha256": hashlib.sha256(raw).hexdigest(), "seconds": record["seconds"]}))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--test", choices=[name for name in dir(CoreTests) if name.startswith("test_")])
    args = parser.parse_args()
    raise SystemExit(main(args.output, args.test))
