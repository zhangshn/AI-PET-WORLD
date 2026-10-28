"""Isolated CPU operator tests; no G/D construction, GPU or optimizer."""
import gc
import hashlib
import itertools
import unittest

import numpy as np
import torch
from torch.utils._python_dispatch import TorchDispatchMode

from ai_painter.complete_world import native_training_bounded_weight_vjp_v1 as candidate
from ai_painter.complete_world import stem_inner_weight_reduction_precision_v1 as stem
from ai_painter.complete_world import decode1_weight_reduction_precision_v1 as decode
from ai_painter.complete_world import terrain_detail_weight_reduction_precision_v1 as terrain
from ai_painter.complete_world import final_rgb_base_weight_reduction_precision_v1 as final
from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import PrecisionDetailWeightConv
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL
from test_decode1_entry_bounded_weight_vjp_v1 import errors, weight_arrays

EVIDENCE_SINK = None
CURRENT_CASE = None
RUN_NATIVE = True
TARGETS = tuple(zip(candidate.REGISTERED_TARGETS, (4, 52, 56, 60, 88), (48, 48, 68, 48, 48),
                    (stem.StemInnerWeightReductionConv, decode.Decode1WeightReductionConv,
                     PrecisionDetailWeightConv, terrain.TerrainDetailWeightReductionConv,
                     final.FinalRgbBaseWeightReductionConv)))


def emit(record, arrays=None):
    if EVIDENCE_SINK is not None:
        EVIDENCE_SINK(record, arrays or {})


def predecessor(spec, weight=None, bias=None):
    _, _, channels, cls = spec
    source = torch.nn.Conv2d(channels, 48, 3, padding=1)
    if weight is not None:
        with torch.no_grad():
            source.weight.copy_(weight)
            source.bias.copy_(bias)
    return cls(source)


def fixture(channels, height, width, seed, kind='random'):
    generator = torch.Generator().manual_seed(seed)
    x = torch.randn(1, channels, height, width, generator=generator) * .1
    w = torch.randn(48, channels, 3, 3, generator=generator) * .02
    b = torch.randn(48, generator=generator) * .01
    dy = torch.randn(1, 48, height, width, generator=generator) * .1
    if kind in ('zero', 'sparse'):
        x.zero_(); dy.zero_()
        if kind == 'sparse':
            for y, z in ((0, 0), (height-1, width-1), (height//2, width//2)):
                x[0, :, y, z] = torch.arange(channels).remainder(7).float()/16
                dy[0, :, y, z] = (torch.arange(48).remainder(5).float()-2)/32
    elif kind == 'cancellation':
        signs = (torch.arange(height*width).reshape(height, width).remainder(2)*2-1).float()
        x = ((x.abs()+1)*signs).contiguous()
        dy = ((dy.abs()+.25)*signs).contiguous()
        dy[:, :, 0, 0] *= .00001
    return x, w, b, dy


class ArithmeticAudit(TorchDispatchMode):
    """Only scalar metadata; ensure full native mask and full-spatial FP64."""
    def __init__(self):
        super().__init__()
        self.native_masks = []; self.multiplications = []; self.weight_casts = []; self.unfolds = 0

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        kwargs = kwargs or {}
        name = str(func)
        if name == 'aten.convolution_backward.default':
            self.native_masks.append(list(args[-1]))
        if name in ('aten.bmm.default', 'aten.mm.default'):
            self.multiplications.append([{'shape': list(v.shape), 'dtype': str(v.dtype),
                                           'device': str(v.device)} for v in args[:2]])
        if name == 'aten.im2col.default':
            self.unfolds += 1
        if name == 'aten._to_copy.default' and kwargs.get('dtype') == torch.float32:
            v = args[0]
            if v.ndim == 4 and v.shape[0] == 48 and tuple(v.shape[2:]) == (3, 3):
                self.weight_casts.append({'shape': list(v.shape), 'from': str(v.dtype)})
        return func(*args, **kwargs)

    def check(self, channels, height, width, mask):
        assert self.native_masks == ([list(mask)] if any(mask) else []), self.native_masks
        assert self.unfolds == 0, 'candidate must not materialize full unfold'
        widths = [min(16, channels-start) for start in range(0, channels, 16)] * 9 if mask[1] else []
        assert len(self.multiplications) == len(widths)
        for pair, block in zip(self.multiplications, widths):
            assert pair[0]['shape'] == [1, 48, height*width]
            assert pair[1]['shape'] == [1, height*width, block]
            assert all(v['dtype'] == 'torch.float64' and v['device'] == 'cpu' for v in pair)
        assert self.weight_casts == ([{'shape': [48, channels, 3, 3], 'from': 'torch.float64'}] if mask[1] else [])


def compare_case(spec, name, values, mask=(True, True, True)):
    global CURRENT_CASE
    target, index, channels, _ = spec
    CURRENT_CASE = f'target{index}_{name}'
    x, w, b, dy = values
    original_bytes = [v.contiguous().view(torch.uint8).clone() for v in values]
    predictions, gradients, modules, inputs = [], [], [], []
    audit = ArithmeticAudit()
    for is_candidate in (False, True):
        module = predecessor(spec, w, b)
        if is_candidate:
            module = candidate.build_native_training_bounded_weight_conv(module, target=target)
        xx = x.detach().clone().requires_grad_(mask[0])
        module.weight.requires_grad_(mask[1]); module.bias.requires_grad_(mask[2])
        selected = [v for v, needed in zip((xx, module.weight, module.bias), mask) if needed]
        def calculate():
            output = module(xx)
            grad = torch.autograd.grad(output, selected, grad_outputs=dy) if selected else ()
            iterator = iter(grad)
            return output.detach(), [next(iterator) if needed else None for needed in mask]
        if is_candidate:
            with audit:
                prediction, grad = calculate()
        else:
            prediction, grad = calculate()
        predictions.append(prediction); gradients.append(grad); modules.append(module); inputs.append(xx)
    audit.check(channels, x.shape[2], x.shape[3], mask)
    metrics = {k: errors(actual, expected) for k, needed, actual, expected in zip(
        ('input', 'weight', 'bias'), mask, gradients[1], gradients[0]) if needed}
    record = {'case': CURRENT_CASE, 'target': target, 'shape': list(x.shape), 'mask': list(mask),
              'reference': 'exact original target operator full-unfold on CPU small fixture',
              'atol': TOTAL_GRADIENT_ATOL, 'rtol': TOTAL_GRADIENT_RTOL,
              'forward': errors(predictions[1], predictions[0]), 'gradients': metrics,
              'inputsUnchanged': all(torch.equal(old, v.contiguous().view(torch.uint8)) for old, v in zip(original_bytes, values)),
              'noLeafGradAccumulation': all(v.grad is None for m, xx in zip(modules, inputs) for v in (xx, m.weight, m.bias)),
              'nativeMask': audit.native_masks, 'fp64MatmulGroups': len(audit.multiplications),
              'fullSpatialFp64Verified': True, 'fullUnfoldOps': audit.unfolds, 'finalWeightCasts': audit.weight_casts}
    emit(record, weight_arrays(gradients[1][1], gradients[0][1]) if mask[1] else {})
    assert record['forward']['bitwiseEqual'] and record['inputsUnchanged'] and record['noLeafGradAccumulation'], record
    for kind, metric in metrics.items():
        assert metric['nonfinite'] == metric['outsideOriginalTolerance'] == 0, record
        if kind in ('input', 'bias'):
            assert metric['bitwiseEqual'], record


def sparse_integer_oracle(channels, height=768, width=1024):
    """Independent integer sums/outer products; no unfold or float reference conv."""
    anchors = ((0, 0), (0, width-1), (height-1, 0), (height-1, width-1),
               (0, width//2), (height//2, 0), (height//2, width//2),
               (height//2+3, width//2+5))
    coords = sorted({(y+dy, x+dx) for y, x in anchors for dy in (-1, 0, 1)
                     for dx in (-1, 0, 1) if 0 <= y+dy < height and 0 <= x+dx < width})
    ic, oc = np.arange(channels, dtype=np.int64), np.arange(48, dtype=np.int64)
    wi = (oc[:, None, None, None]*17+ic[None, :, None, None]*5
          +np.arange(3)[None, None, :, None]*3+np.arange(3)[None, None, None, :]) % 7-3
    bi = oc % 7-3
    fv = {(y, x): (ic % 7+1)*np.where((ic+j) % 2, -1, 1) for j, (y, x) in enumerate(anchors)}
    uv = {(y, x): (oc % 5+1)*np.where((oc+j) % 2, -1, 1) for j, (y, x) in enumerate(coords)}
    features = torch.zeros(1, channels, height, width); upstream = torch.zeros(1, 48, height, width)
    for (y, x), value in fv.items():
        features[0, :, y, x] = torch.from_numpy(value.astype(np.float32))/16
    for (y, x), value in uv.items():
        upstream[0, :, y, x] = torch.from_numpy(value.astype(np.float32))/32
    dw = np.zeros_like(wi); prediction = {}; dx = {}
    for (y, x), value in fv.items():
        for ky, kx in itertools.product(range(3), repeat=2):
            oy, ox = y-ky+1, x-kx+1
            if 0 <= oy < height and 0 <= ox < width:
                prediction.setdefault((oy, ox), np.zeros(48, dtype=np.int64))[:] += wi[:, :, ky, kx] @ value
                if (oy, ox) in uv:
                    dw[:, :, ky, kx] += np.outer(uv[(oy, ox)], value)
    for (y, x), value in uv.items():
        for ky, kx in itertools.product(range(3), repeat=2):
            iy, ix = y+ky-1, x+kx-1
            if 0 <= iy < height and 0 <= ix < width:
                dx.setdefault((iy, ix), np.zeros(channels, dtype=np.int64))[:] += wi[:, :, ky, kx].T @ value
    db = sum(uv.values(), start=np.zeros(48, dtype=np.int64))
    values = features, torch.from_numpy(wi.astype(np.float32))/128, torch.from_numpy(bi.astype(np.float32))/128, upstream
    return values, (prediction, dx, dw, db)


def native_case(spec):
    global CURRENT_CASE
    target, index, channels, _ = spec
    CURRENT_CASE = f'native1024_channels{channels}'
    values, oracle = sparse_integer_oracle(channels)
    x, w, b, dy = values
    initial_hashes = [hashlib.sha256(memoryview(v.detach().numpy()).cast('B')).hexdigest() for v in values]
    prediction_int, input_int, weight_int, bias_int = oracle
    module = candidate.build_native_training_bounded_weight_conv(predecessor(spec, w, b), target=target)
    x.requires_grad_(True)
    audit = ArithmeticAudit()
    with audit:
        prediction = module(x)
    expected = b[None, :, None, None].expand_as(prediction).clone()
    for (y, z), value in prediction_int.items():
        expected[0, :, y, z] += torch.from_numpy(value.astype(np.float32))/2048
    forward = errors(prediction, expected)
    del expected
    with audit:
        grad = torch.autograd.grad(prediction, (x, module.weight, module.bias), grad_outputs=dy)
    audit.check(channels, 768, 1024, (True, True, True))
    expected_input = torch.zeros_like(x)
    for (y, z), value in input_int.items():
        expected_input[0, :, y, z] = torch.from_numpy(value.astype(np.float32))/4096
    expected_weight = torch.from_numpy(weight_int.astype(np.float32))/512
    expected_bias = torch.from_numpy(bias_int.astype(np.float32))/32
    metrics = {k: errors(actual, ref) for k, actual, ref in zip(
        ('input', 'weight', 'bias'), grad, (expected_input, expected_weight, expected_bias))}
    record = {'case': CURRENT_CASE, 'target': target, 'shape': list(x.shape), 'forward': forward, 'gradients': metrics,
              'reference': 'independent integer64 sparse convolution/outer-product/scatter oracle, exact dyadic conversion',
              'nativeFullUnfoldAllocated': False, 'nativeCandidateInvocationsForShape': 1,
              'atol': TOTAL_GRADIENT_ATOL, 'rtol': TOTAL_GRADIENT_RTOL,
              'nativeMask': audit.native_masks, 'fp64MatmulGroups': len(audit.multiplications),
              'fullSpatialFp64Verified': True, 'fullUnfoldOps': audit.unfolds,
              'inputsUnchanged': initial_hashes == [hashlib.sha256(memoryview(v.detach().numpy()).cast('B')).hexdigest() for v in values],
              'noLeafGradAccumulation': all(v.grad is None for v in (x, module.weight, module.bias)),
              'qualification': 'isolated sparse operator fixture, not complete model five-gradient qualification'}
    emit(record, weight_arrays(grad[1], expected_weight))
    assert record['inputsUnchanged'] and record['noLeafGradAccumulation'], record
    for metric in (forward, *metrics.values()):
        assert metric['nonfinite'] == metric['outsideOriginalTolerance'] == 0 and metric['bitwiseEqual'], record


class NativeTrainingBoundedWeightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_01_five_targets_random_and_stress(self):
        for spec in TARGETS:
            for seed, shape in enumerate(((1, 1), (2, 3), (7, 9), (11, 13)), 111):
                compare_case(spec, f'random_{shape[0]}x{shape[1]}', fixture(spec[2], *shape, seed))
            for seed, kind in enumerate(('zero', 'sparse', 'cancellation'), 211):
                compare_case(spec, kind, fixture(spec[2], 13, 17, seed, kind))

    def test_02_all_native_masks_and_noncontiguous_upstream(self):
        for spec in TARGETS:
            values = fixture(spec[2], 5, 7, 311)
            for mask in itertools.product((False, True), repeat=3):
                compare_case(spec, 'mask_'+''.join(str(int(v)) for v in mask), values, mask)
            x, w, b, dy = fixture(spec[2], 7, 11, 411)
            storage = torch.empty(1, 48, 7, 22); storage[:, :, :, ::2] = dy
            compare_case(spec, 'noncontiguous_upstream', (x, w, b, storage[:, :, :, ::2]))

    def test_03_exact_binding_parameter_identity_and_metadata(self):
        self.assertEqual(len(candidate.REGISTERED_TARGETS), 5)
        for spec in TARGETS:
            source = predecessor(spec); source.eval(); source.weight.requires_grad_(False)
            before = torch.get_rng_state().clone()
            original_state = {k: v.detach().clone() for k, v in source.state_dict().items()}
            wrapper = candidate.build_native_training_bounded_weight_conv(source, target=spec[0])
            self.assertIs(type(wrapper), candidate.NativeTrainingBoundedWeightConv)
            self.assertIs(wrapper.weight, source.weight); self.assertIs(wrapper.bias, source.bias)
            self.assertEqual(wrapper.bound_target, spec[0]); self.assertFalse(wrapper.training)
            self.assertFalse(wrapper.weight.requires_grad); self.assertFalse(wrapper.execution_qualified)
            self.assertEqual(tuple(wrapper.state_dict()), ('weight', 'bias'))
            self.assertTrue(torch.equal(before, torch.get_rng_state()))
            self.assertTrue(all(torch.equal(original_state[k].view(torch.uint8), v.detach().view(torch.uint8))
                                for k, v in wrapper.state_dict().items()))
            for key in candidate._CONFIG_FIELDS + candidate._OPTIONAL_CONFIG:
                if hasattr(source, key):
                    self.assertEqual(getattr(wrapper, key), getattr(source, key))
            with self.assertRaises(ValueError):
                candidate.build_native_training_bounded_weight_conv(torch.nn.Conv2d(spec[2], 48, 3, padding=1), target=spec[0])
            for wrong in ('', 'core.core.terrain.decode_1.layers.0', spec[0]+'.weight', None):
                with self.assertRaises(ValueError):
                    candidate.build_native_training_bounded_weight_conv(source, target=wrong)
            for other in TARGETS:
                if other[0] != spec[0]:
                    with self.assertRaises(ValueError):
                        candidate.build_native_training_bounded_weight_conv(predecessor(other), target=spec[0])
        emit({'case': 'five_exact_target_identity', 'parameterObjectsNamesMetadataModesRngPreserved': True})

    def test_04_invalid_configuration_dtype_layout_shape_alias_finite(self):
        for spec in TARGETS:
            for key, value in (('in_channels', 144), ('out_channels', 47), ('kernel_size', (1, 1)),
                               ('stride', (2, 2)), ('padding', (0, 0)), ('dilation', (2, 2)),
                               ('groups', 2), ('groups', True), ('padding_mode', 'reflect'),
                               ('stride', (True, True)), ('transposed', True), ('output_padding', (1, 1))):
                source = predecessor(spec); setattr(source, key, value)
                with self.assertRaises(ValueError):
                    candidate.build_native_training_bounded_weight_conv(source, target=spec[0])
            source = predecessor(spec); source.bias = torch.nn.Parameter(source.weight.flatten()[:48])
            with self.assertRaises(ValueError):
                candidate.build_native_training_bounded_weight_conv(source, target=spec[0])
            for mutate in ('dtype', 'layout', 'shape', 'nonfinite', 'device'):
                source = predecessor(spec)
                if mutate == 'dtype': source.weight = torch.nn.Parameter(source.weight.double())
                elif mutate == 'layout': source.weight = torch.nn.Parameter(source.weight.transpose(2, 3))
                elif mutate == 'shape': source.bias = torch.nn.Parameter(torch.zeros(47))
                elif mutate == 'device': source.weight = torch.nn.Parameter(torch.empty(source.weight.shape, device='meta'))
                else:
                    with torch.no_grad(): source.bias[0] = float('inf')
                with self.assertRaises(ValueError):
                    candidate.build_native_training_bounded_weight_conv(source, target=spec[0])
            wrapper = candidate.build_native_training_bounded_weight_conv(predecessor(spec), target=spec[0])
            x, _, _, dy = fixture(spec[2], 3, 5, 511)
            bad_inputs = (x.double(), torch.empty(x.shape, device='meta'), x.transpose(2, 3), x.repeat(2, 1, 1, 1), x[:, :-1], x[:, :, :0],
                          wrapper.weight.reshape(-1)[:spec[2]*3*3].reshape(1, spec[2], 3, 3))
            for bad in bad_inputs:
                with self.assertRaises(ValueError): wrapper(bad)
            for nonfinite in (float('inf'), -float('inf'), float('nan')):
                bad = x.clone(); bad[0, 0, 0, 0] = nonfinite
                with self.assertRaises(ValueError): wrapper(bad)
                output = wrapper(x.requires_grad_(True)); bad_dy = dy.clone(); bad_dy[0, 0, 0, 0] = nonfinite
                with self.assertRaises(ValueError): torch.autograd.grad(output, x, grad_outputs=bad_dy)
            with torch.autocast('cpu'), self.assertRaises(ValueError): wrapper(x)
            with self.assertRaises(ValueError): torch.autograd.grad(wrapper(x), x, grad_outputs=dy, create_graph=True)
            wrapper.bound_target = 'core.core.terrain.decode_1.layers.0'
            with self.assertRaises(ValueError): wrapper(x)
        emit({'case': 'five_target_negative_contracts', 'configurationTypeShapeLayoutDtypeAliasFiniteAutocastHigherOrderRejected': True})

    @unittest.skipUnless(RUN_NATIVE, 'native fixtures explicitly disabled')
    def test_05_native1024_each_shape_once_independent_oracle(self):
        for spec in (TARGETS[0], TARGETS[2]):
            native_case(spec)
            gc.collect()


if __name__ == '__main__':
    unittest.main()
