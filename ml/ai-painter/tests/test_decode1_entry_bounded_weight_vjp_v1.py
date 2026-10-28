"""Isolated CPU primitive evidence; no model, checkpoint or optimizer."""
import gc
import itertools
import unittest

import numpy as np
import torch

from ai_painter.complete_world import decode1_entry_bounded_weight_vjp_v1 as candidate
from ai_painter.complete_world import decode1_entry_weight_reduction_precision_v1 as original
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL,
)

EVIDENCE_SINK = None
CURRENT_CASE = None


def emit(record, arrays=None):
    if EVIDENCE_SINK is not None:
        EVIDENCE_SINK(record, arrays or {})


def errors(actual, reference):
    """Check every element with original thresholds using bounded audit buffers."""
    assert actual.shape == reference.shape and actual.dtype == reference.dtype
    a, b = actual.detach().reshape(-1), reference.detach().reshape(-1)
    result = dict(elements=a.numel(), nonfinite=0, outsideOriginalTolerance=0,
                  bitwiseEqual=True, maxAbsoluteError=0.0, maxRelativeError=0.0,
                  infiniteRelativeErrors=0, worstAbsoluteFlatIndex=0)
    for start in range(0, a.numel(), 262144):
        left, right = a[start:start+262144], b[start:start+262144]
        result['nonfinite'] += int((~torch.isfinite(left) | ~torch.isfinite(right)).sum())
        difference = (left.double()-right.double()).abs()
        index = int(difference.argmax())
        maximum = float(difference[index])
        if maximum > result['maxAbsoluteError']:
            result.update(maxAbsoluteError=maximum, worstAbsoluteFlatIndex=start+index)
        zero_reference = right == 0
        result['infiniteRelativeErrors'] += int((zero_reference & (difference != 0)).sum())
        relative = difference[~zero_reference] / right[~zero_reference].double().abs()
        finite = relative[torch.isfinite(relative)]
        if finite.numel():
            result['maxRelativeError'] = max(result['maxRelativeError'], float(finite.max()))
        result['outsideOriginalTolerance'] += int((~torch.isclose(
            left, right, atol=TOTAL_GRADIENT_ATOL, rtol=TOTAL_GRADIENT_RTOL)).sum())
        result['bitwiseEqual'] &= torch.equal(left.view(torch.uint8), right.view(torch.uint8))
    result['maxRelativeErrorOnNonzeroReference'] = result['maxRelativeError']
    if result['infiniteRelativeErrors']:
        result['maxRelativeError'] = 'infinity'
    return result


def weight_arrays(actual, reference):
    actual = actual.detach().numpy().copy()
    reference = reference.detach().numpy().copy()
    absolute = np.abs(actual.astype(np.float64)-reference.astype(np.float64))
    relative = np.zeros_like(absolute)
    np.divide(absolute, np.abs(reference.astype(np.float64)), out=relative, where=reference != 0)
    relative[(reference == 0) & (absolute != 0)] = np.inf
    return dict(actualWeight=actual, referenceWeight=reference,
                absoluteWeightError=absolute, relativeWeightError=relative)


def fixture(height, width, seed, kind='random'):
    generator = torch.Generator().manual_seed(seed)
    features = torch.randn(1, 144, height, width, generator=generator)*0.1
    weight = torch.randn(48, 144, 3, 3, generator=generator)*0.02
    bias = torch.randn(48, generator=generator)*0.01
    upstream = torch.randn(1, 48, height, width, generator=generator)*0.1
    if kind == 'zero':
        features.zero_(); upstream.zero_()
    elif kind == 'sparse':
        features.zero_(); upstream.zero_()
        for y, x in ((0, 0), (height-1, width-1), (height//2, width//2)):
            features[0, :, y, x] = torch.arange(144).remainder(7).float()/16
            upstream[0, :, y, x] = (torch.arange(48).remainder(5).float()-2)/32
    elif kind == 'cancellation':
        signs = ((torch.arange(height*width).reshape(height, width) % 2)*2-1).float()
        features = ((features.abs()+1)*signs).contiguous()
        upstream = ((upstream.abs()+0.25)*signs).contiguous()
        upstream[:, :, 0, 0] *= 0.00001
    return features, weight, bias, upstream


def compare_case(case, values, mask=(True, True, True)):
    global CURRENT_CASE
    CURRENT_CASE = case
    features, weight, bias, upstream = values
    before = tuple(value.clone() for value in values)
    sets, outputs, gradients = [], [], []
    for function in (original.decode1_entry_weight_reduction_precision,
                     candidate.decode1_entry_bounded_weight_vjp):
        inputs = [v.detach().clone().requires_grad_(needed)
                  for v, needed in zip((features, weight, bias), mask)]
        output = function(*inputs)
        selected = [v for v, needed in zip(inputs, mask) if needed]
        computed = torch.autograd.grad(output, selected, grad_outputs=upstream) if selected else ()
        iterator = iter(computed)
        gradients.append([next(iterator) if needed else None for needed in mask])
        sets.append(inputs); outputs.append(output.detach())
    record = dict(case=case, shape=list(features.shape), mask=list(mask),
                  reference='original_full_unfold_same_device', atol=TOTAL_GRADIENT_ATOL,
                  rtol=TOTAL_GRADIENT_RTOL, forward=errors(outputs[1], outputs[0]), gradients={})
    arrays = {}
    for name, needed, actual, reference in zip(('input', 'weight', 'bias'), mask,
                                               gradients[1], gradients[0]):
        if needed:
            record['gradients'][name] = errors(actual, reference)
            if name == 'weight':
                arrays = weight_arrays(actual, reference)
    record['inputsUnchanged'] = all(torch.equal(a, b) for a, b in zip(before, values))
    record['noLeafGradAccumulation'] = all(value.grad is None for group in sets for value in group)
    emit(record, arrays)
    assert record['forward']['bitwiseEqual'], record
    assert record['inputsUnchanged'] and record['noLeafGradAccumulation'], record
    for name, metrics in record['gradients'].items():
        assert metrics['nonfinite'] == metrics['outsideOriginalTolerance'] == 0, (case, name, metrics)
        if name in ('input', 'bias'):
            assert metrics['bitwiseEqual'], (case, name, metrics)
    return record


def dyadic_sparse_native_fixture(height=768, width=1024):
    """Independent integer oracles; no unfold, float matmul or convolution."""
    inputs, outputs = 144, 48
    anchors = ((0, 0), (0, width-1), (height-1, 0), (height-1, width-1),
               (0, width//2), (height//2, 0), (height//2, width//2),
               (height//2+3, width//2+5))
    coords = sorted({(y+dy, x+dx) for y, x in anchors for dy in (-1, 0, 1)
                     for dx in (-1, 0, 1) if 0 <= y+dy < height and 0 <= x+dx < width})
    channels = np.arange(inputs, dtype=np.int64)
    out = np.arange(outputs, dtype=np.int64)
    weight_int = ((out[:, None, None, None]*17+channels[None, :, None, None]*5
                   +np.arange(3)[None, None, :, None]*3+np.arange(3)[None, None, None, :]) % 7)-3
    bias_int = out % 7-3
    feature_values = {(y, x): (channels % 7+1)*np.where((channels+j) % 2, -1, 1)
                      for j, (y, x) in enumerate(anchors)}
    upstream_values = {(y, x): (out % 5+1)*np.where((out+j) % 2, -1, 1)
                       for j, (y, x) in enumerate(coords)}
    features = torch.zeros(1, inputs, height, width)
    upstream = torch.zeros(1, outputs, height, width)
    for (y, x), value in feature_values.items():
        features[0, :, y, x] = torch.from_numpy(value.astype(np.float32))/16
    for (y, x), value in upstream_values.items():
        upstream[0, :, y, x] = torch.from_numpy(value.astype(np.float32))/32
    weight = torch.from_numpy(weight_int.astype(np.float32))/128
    bias = torch.from_numpy(bias_int.astype(np.float32))/128
    dw_int = np.zeros((outputs, inputs, 3, 3), dtype=np.int64)
    forward_int, dx_int = {}, {}
    for (y, x), value in feature_values.items():
        for ky, kx in itertools.product(range(3), repeat=2):
            oy, ox = y-ky+1, x-kx+1
            if 0 <= oy < height and 0 <= ox < width:
                target = forward_int.setdefault((oy, ox), np.zeros(outputs, dtype=np.int64))
                target += weight_int[:, :, ky, kx] @ value
                if (oy, ox) in upstream_values:
                    dw_int[:, :, ky, kx] += np.outer(upstream_values[(oy, ox)], value)
    for (y, x), value in upstream_values.items():
        for ky, kx in itertools.product(range(3), repeat=2):
            iy, ix = y+ky-1, x+kx-1
            if 0 <= iy < height and 0 <= ix < width:
                target = dx_int.setdefault((iy, ix), np.zeros(inputs, dtype=np.int64))
                target += weight_int[:, :, ky, kx].T @ value
    db_int = sum(upstream_values.values(), start=np.zeros(outputs, dtype=np.int64))
    metadata = dict(anchors=[list(v) for v in anchors], upstreamLocations=len(coords),
                    featureDenominator=16, weightDenominator=128, upstreamDenominator=32,
                    weightGradientDenominator=512, inputGradientDenominator=4096,
                    oracle='Sparse integer64 outer products/dot/scatter; exact dyadic conversion; no original1024 unfold.')
    return (features, weight, bias, upstream), (forward_int, dx_int, dw_int, db_int), metadata


class BoundedWeightVjpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_01_small_random_registered_channels(self):
        for seed, shape in enumerate(((1, 1), (2, 3), (7, 9), (11, 13)), 101):
            compare_case('random_%sx%s' % shape, fixture(*shape, seed))

    def test_02_zero_sparse_boundary_and_cancellation(self):
        for seed, kind in enumerate(('zero', 'sparse', 'cancellation'), 201):
            compare_case(kind, fixture(13, 17, seed, kind))

    def test_03_every_native_gradient_mask(self):
        values = fixture(5, 7, 301)
        for mask in itertools.product((False, True), repeat=3):
            compare_case('mask_'+''.join(str(int(v)) for v in mask), values, mask)

    def test_04_noncontiguous_upstream(self):
        x, w, b, upstream = fixture(7, 11, 401)
        storage = torch.empty(1, 48, 7, 22)
        storage[:, :, :, ::2] = upstream
        noncontiguous = storage[:, :, :, ::2]
        self.assertFalse(noncontiguous.is_contiguous())
        compare_case('noncontiguous_upstream', (x, w, b, noncontiguous))

    def test_05_identity_wrapper_and_invalid_contract(self):
        self.assertNotEqual(candidate.NUMERIC_RULE, original.NUMERIC_RULE)
        self.assertEqual(candidate.INPUT_CHANNEL_BLOCK, 16)
        source = torch.nn.Conv2d(144, 48, 3, padding=1)
        source.eval()
        for inherited in (source, original.Decode1EntryWeightReductionConv(source)):
            wrapper = candidate.Decode1EntryBoundedWeightVjpConv(inherited)
            self.assertIs(wrapper.weight, source.weight)
            self.assertIs(wrapper.bias, source.bias)
            self.assertFalse(wrapper.training)
            self.assertFalse(wrapper.execution_qualified)
            self.assertEqual(tuple(wrapper.state_dict()), ('weight', 'bias'))
        x, w, b, _ = fixture(3, 5, 501)
        for bad in ((x.double(), w, b), (x.transpose(2, 3), w, b),
                    (x, w, b[:-1]), (x.repeat(2, 1, 1, 1), w, b)):
            with self.assertRaises(ValueError):
                candidate.decode1_entry_bounded_weight_vjp(*bad)
        with torch.autocast('cpu'), self.assertRaises(ValueError):
            candidate.decode1_entry_bounded_weight_vjp(x, w, b)
        with self.assertRaises(ValueError):
            candidate.Decode1EntryBoundedWeightVjpConv(torch.nn.Conv2d(192, 96, 3, padding=1))
        emit(dict(case='identity_and_validation', distinctNumericIdentity=True,
                  parameterObjectIdentityPreserved=True, invalidMetadataRejected=True))

    def test_06_full256_original_reference_once(self):
        compare_case('full256_original_reference', fixture(192, 256, 601))
        gc.collect()

    def test_07_full1024_candidate_only_integer_oracle_once(self):
        global CURRENT_CASE
        CURRENT_CASE = 'full1024_independent_dyadic_sparse'
        values, oracle, metadata = dyadic_sparse_native_fixture()
        features, weight, bias, upstream = values
        forward_int, dx_int, dw_int, db_int = oracle
        for value in (features, weight, bias):
            value.requires_grad_(True)
        prediction = candidate.decode1_entry_bounded_weight_vjp(features, weight, bias)
        expected = bias.detach()[None, :, None, None].expand_as(prediction).clone()
        for (y, x), value in forward_int.items():
            expected[0, :, y, x] += torch.from_numpy(value.astype(np.float32))/2048
        forward = errors(prediction, expected)
        del expected
        gradients = torch.autograd.grad(prediction, (features, weight, bias), grad_outputs=upstream)
        expected_input = torch.zeros_like(features)
        for (y, x), value in dx_int.items():
            expected_input[0, :, y, x] = torch.from_numpy(value.astype(np.float32))/4096
        expected_weight = torch.from_numpy(dw_int.astype(np.float32))/512
        expected_bias = torch.from_numpy(db_int.astype(np.float32))/32
        metrics = {name: errors(actual, reference) for name, actual, reference in zip(
            ('input', 'weight', 'bias'), gradients, (expected_input, expected_weight, expected_bias))}
        record = dict(case=CURRENT_CASE, shape=list(features.shape), mask=[True, True, True],
                      forward=forward, gradients=metrics, oracle=metadata,
                      atol=TOTAL_GRADIENT_ATOL, rtol=TOTAL_GRADIENT_RTOL,
                      originalFull1024UnfoldAllocated=False)
        emit(record, weight_arrays(gradients[1], expected_weight))
        for value in (forward, *metrics.values()):
            self.assertEqual(value['nonfinite'], 0, record)
            self.assertEqual(value['outsideOriginalTolerance'], 0, record)
            self.assertTrue(value['bitwiseEqual'], record)


    def test_08_required_native_mask_and_numeric_identity(self):
        import hashlib
        from torch.utils._python_dispatch import TorchDispatchMode
        from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as native
        from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry

        class Observe(TorchDispatchMode):
            def __init__(self):
                super().__init__(); self.calls = []

            def __torch_dispatch__(self, func, types, args=(), kwargs=None):
                result = func(*args, **(kwargs or {}))
                if func is torch.ops.aten.convolution_backward.default:
                    self.calls.append({'mask': list(args[10]),
                                       'returnsNone': [v is None for v in result]})
                return result

        values = fixture(2, 3, 130)
        generator = torch.Generator().manual_seed(1301)
        upstream = torch.randn((1, 48, 3, 2), generator=generator).transpose(2, 3)
        for mask in itertools.product((False, True), repeat=3):
            if not any(mask):
                continue
            inputs = [v.clone().requires_grad_(needed) for v, needed in zip(values[:3], mask)]
            output = candidate.decode1_entry_bounded_weight_vjp(*inputs)
            with Observe() as observed:
                gradients = torch.autograd.grad(output, [v for v in inputs if v.requires_grad], upstream)
            native_mask = [mask[0], False, mask[2]]
            self.assertEqual(observed.calls, [{'mask': native_mask,
                                               'returnsNone': [not v for v in native_mask]}])
            self.assertTrue(all(v is not None and torch.isfinite(v).all() for v in gradients))
            arrays = {'forward': output.detach().numpy().copy(),
                      'features': inputs[0].detach().numpy().copy(),
                      'weight': inputs[1].detach().numpy().copy(),
                      'bias': inputs[2].detach().numpy().copy(),
                      'upstream': upstream.numpy().copy()}
            for index, value in zip([i for i, needed in enumerate(mask) if needed], gradients):
                arrays['requestedGradient' + str(index)] = value.detach().numpy().copy()
            emit({'case': 'required_mask_' + ''.join(str(int(v)) for v in mask),
                  'requestedMask': list(mask), 'actualNative': observed.calls[0],
                  'allRequestedReturned': True, 'noncontiguousUpstream': not upstream.is_contiguous()}, arrays)
        self.assertIn('no_discarded_native_weight', candidate.NUMERIC_RULE)
        self.assertTrue(candidate.NUMERIC_RULE.endswith('_v2'))
        self.assertIn(candidate.NUMERIC_RULE, native.NUMERIC_RULE)
        old_rule = ('decode1_entry_conv0_fp32_native_forward_native_input_bias_vjp_full_mask_'
                    'original_device_fp64_kernel_row_major_channel16_full_spatial_matmul_'
                    'all_weights_once_fp32_v1')
        previous_rule = native.NUMERIC_RULE.replace(candidate.NUMERIC_RULE, old_rule)
        self.assertNotEqual(previous_rule, native.NUMERIC_RULE)
        geometry = NativeStageGeometry(2)
        identities = {}; arrays = {}
        for kind in ('regime', 'numeric', 'ecology'):
            raw = native.identity_bytes(kind, geometry).numpy().tobytes()
            payload = '|'.join((kind, native.CAPABILITY, native.ARCHITECTURE, native.NUMERIC_RULE,
                                repr(geometry.identity()), *native.parent.SEASONS, *native.parent.ECOLOGIES))
            self.assertEqual(raw, hashlib.sha256(payload.encode()).digest())
            old_payload = '|'.join((kind, native.CAPABILITY, native.ARCHITECTURE, previous_rule,
                                    repr(geometry.identity()), *native.parent.SEASONS, *native.parent.ECOLOGIES))
            previous = hashlib.sha256(old_payload.encode()).digest()
            self.assertNotEqual(raw, previous)
            identities[kind] = {'rawHex': raw.hex(), 'tensorBytesSha256': hashlib.sha256(raw).hexdigest(),
                                'oldRuleCounterfactualRawHex': previous.hex(),
                                'oldRuleCounterfactualTensorSha256': hashlib.sha256(previous).hexdigest()}
            arrays[kind + 'IdentityBytes'] = np.frombuffer(raw, dtype=np.uint8).copy()
        self.assertEqual(identities['numeric']['oldRuleCounterfactualTensorSha256'],
                         '18d7c7a19fd301a65e029b49ed507fd17077fd957582add97dfb359a5875c015')
        emit({'case': 'stage2_current_numeric_identity', 'identities': identities,
              'geometry': list(geometry.identity()), 'numericRule': candidate.NUMERIC_RULE,
              'nativeNumericRule': native.NUMERIC_RULE, 'fullModelInstantiated': False}, arrays)


if __name__ == '__main__':
    unittest.main()
