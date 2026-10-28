"""Small CPU operator comparisons; never instantiate a complete model."""
import hashlib
import itertools
import json
import os
from pathlib import Path
import types
import unittest

import numpy as np
import torch
from torch.nn import functional as F
from torch.utils._python_dispatch import TorchDispatchMode

from ai_painter.complete_world import stem_weight_reduction_precision_v1 as stem
from ai_painter.complete_world import decode2_inner_weight_reduction_precision_v1 as inner
from ai_painter.complete_world.remaining_native_weight_vjp_v1 import (
    bounded_remaining_weight_gradient, REGISTERED_TARGETS, INPUT_CHANNEL_BLOCK)

TEST_EVIDENCE = []
RAW_ARRAYS = {}
SPECS = ((REGISTERED_TARGETS[0], 31, 48, stem, 'stem_weight_reduction_precision'),
         (REGISTERED_TARGETS[1], 96, 96, inner, 'decode2_inner_weight_reduction_precision'))


class Observe(TorchDispatchMode):
    def __init__(self):
        super().__init__()
        self.masks = []; self.products = []; self.weight_casts = []; self.im2col = 0

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        kwargs = kwargs or {}
        if func is torch.ops.aten.convolution_backward.default:
            self.masks.append(tuple(args[10]))
        if func in (torch.ops.aten.bmm.default, torch.ops.aten.mm.default):
            self.products.append(dict(left=list(args[0].shape), right=list(args[1].shape),
                                      dtype=str(args[0].dtype), device=str(args[0].device)))
        if func is torch.ops.aten.im2col.default:
            self.im2col += 1
        if (func is torch.ops.aten._to_copy.default and args[0].ndim == 4
                and args[0].dtype == torch.float64 and kwargs.get('dtype') == torch.float32):
            self.weight_casts.append(list(args[0].shape))
        return func(*args, **kwargs)


def old_module(current):
    path = Path(os.environ['REMAINING_VJP_PREIMAGES']) / Path(current.__file__).name
    raw = path.read_bytes()
    module = types.ModuleType('local_preimage_' + current.__name__.split('.')[-1])
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module, hashlib.sha256(raw).hexdigest()


def bitwise(a, b):
    return tuple(a.shape) == tuple(b.shape) and a.numpy().tobytes() == b.numpy().tobytes()


def capture_error(call):
    try:
        call()
    except Exception as error:
        return type(error).__name__, str(error)
    raise AssertionError('expected rejection')


class RemainingNativeWeightVjpTests(unittest.TestCase):
    def test_small_actual_forward_and_all_nonempty_masks(self):
        rng = torch.Generator(device='cpu').manual_seed(127)
        cases = ((1, 1, 'random'), (2, 3, 'random'), (3, 5, 'zero'),
                 (1, 7, 'cancellation'), (4, 3, 'edges'))
        for target, channels, outputs, current, name in SPECS:
            previous, pre_sha = old_module(current)
            for height, width, kind in cases:
                x = torch.randn((1, channels, height, width), generator=rng)
                w = torch.randn((outputs, channels, 3, 3), generator=rng) / 10
                b = torch.randn((outputs,), generator=rng)
                # A noncontiguous upstream is legal in the unchanged caller.
                up = torch.randn((1, outputs, width, height), generator=rng).transpose(2, 3)
                if kind == 'zero': x.zero_(); up.zero_()
                elif kind == 'cancellation':
                    x.copy_((torch.arange(x.numel()).reshape(x.shape) % 2 * 2 - 1).float())
                    up.copy_((torch.arange(up.numel()).reshape(up.shape) % 2 * 2 - 1).float())
                elif kind == 'edges':
                    x.zero_(); x[:, :, 0, 0] = -2; x[:, :, -1, -1] = 3
                fixture_key = f'p{0 if channels == 31 else 44}_{height}x{width}_{kind}'
                for label, value in zip(('features', 'weight', 'bias', 'upstream'), (x, w, b, up)):
                    RAW_ARRAYS[fixture_key + '_' + label] = value.numpy().copy()
                for mask in itertools.product((False, True), repeat=3):
                    if not any(mask): continue
                    actual_inputs = [v.clone().requires_grad_(needed) for v, needed in zip((x, w, b), mask)]
                    old_inputs = [v.clone().requires_grad_(needed) for v, needed in zip((x, w, b), mask)]
                    actual = getattr(current, name)(*actual_inputs)
                    reference = getattr(previous, name)(*old_inputs)
                    self.assertTrue(bitwise(actual.detach(), reference.detach()))
                    with Observe() as observed:
                        ag = torch.autograd.grad(actual, [v for v in actual_inputs if v.requires_grad], up)
                    rg = torch.autograd.grad(reference, [v for v in old_inputs if v.requires_grad], up)
                    self.assertEqual(observed.masks, [mask])
                    self.assertEqual(observed.im2col, 0)
                    blocks = 9 * ((channels + 15) // 16)
                    self.assertEqual(len(observed.products), blocks if mask[1] else 0)
                    self.assertEqual([p['right'][2] for p in observed.products],
                                     [min(16, channels - start) for _ in range(9)
                                      for start in range(0, channels, 16)] if mask[1] else [])
                    self.assertEqual(observed.weight_casts, [[outputs, channels, 3, 3]] if mask[1] else [])
                    for product in observed.products:
                        self.assertEqual(product['left'], [1, outputs, height * width])
                        self.assertEqual(product['right'][:2], [1, height * width])
                        self.assertLessEqual(product['right'][2], 16)
                        self.assertEqual(product['dtype'], 'torch.float64')
                        self.assertEqual(product['device'], 'cpu')
                    key = f'p{0 if channels == 31 else 44}_{height}x{width}_{kind}_{int(mask[0])}{int(mask[1])}{int(mask[2])}'
                    metrics = dict(target=target, shape=[height, width], kind=kind, mask=list(mask),
                                   preimageSha256=pre_sha, forwardBitwise=True, inputBiasBitwise=True,
                                   blocks=len(observed.products), fullSpatialReduction=True,
                                   weightWholeFp32Casts=len(observed.weight_casts), im2colCalls=observed.im2col)
                    for index, (a, r) in zip([i for i, needed in enumerate(mask) if needed], zip(ag, rg)):
                        RAW_ARRAYS[key + f'_grad{index}_actual'] = a.numpy().copy()
                        RAW_ARRAYS[key + f'_grad{index}_reference'] = r.numpy().copy()
                        if index != 1:
                            self.assertTrue(bitwise(a, r))
                        else:
                            delta = (a.double() - r.double()).abs()
                            tolerance = 1e-6 + 1e-5 * r.double().abs()
                            violations = int((delta > tolerance).sum())
                            signed_zero = int(((a == 0) & (r == 0) & (torch.signbit(a) != torch.signbit(r))).sum())
                            metrics.update(maxAbsError=float(delta.max()), maxToleranceRatio=float((delta/tolerance).max()),
                                           violations=violations, signedZeroDifferences=signed_zero, weightElements=a.numel())
                            self.assertEqual(violations, 0)
                    RAW_ARRAYS[key + '_forward_actual'] = actual.detach().numpy().copy()
                    RAW_ARRAYS[key + '_forward_reference'] = reference.detach().numpy().copy()
                    TEST_EVIDENCE.append(metrics)

    def test_direct_helper_rejections_and_state(self):
        rng = torch.Generator().manual_seed(7127)
        for target, channels, outputs, current, name in SPECS:
            x = torch.randn((1, channels, 2, 3), generator=rng).requires_grad_()
            up = torch.randn((1, outputs, 2, 3), generator=rng).requires_grad_()
            version = (x._version, up._version); before = (x.detach().clone(), up.detach().clone())
            value = bounded_remaining_weight_gradient(x, up, target=target)
            self.assertFalse(value.requires_grad)
            self.assertTrue(torch.is_grad_enabled())
            self.assertEqual(version, (x._version, up._version))
            self.assertTrue(bitwise(x.detach(), before[0]) and bitwise(up.detach(), before[1]))
            rejection_rows = []
            for position in (0, 1):
                for nonfinite in (float('nan'), float('inf'), -float('inf')):
                    values = [x.detach().clone(), up.detach().clone()]
                    values[position].flatten()[-1] = nonfinite
                    error = capture_error(lambda: bounded_remaining_weight_gradient(*values, target=target))
                    self.assertIn('nonfinite', error[1]); rejection_rows.append(error)
            bad_pairs = ((x.double(), up), (x, up.double()), (x[:, :-1], up),
                         (x, up[:, :-1]), (x.transpose(2, 3), up),
                         (x, torch.empty(up.shape, device='meta')), (torch.empty(x.shape, device='meta'), up))
            for a, b in bad_pairs:
                rejection_rows.append(capture_error(lambda: bounded_remaining_weight_gradient(a, b, target=target)))
            for invalid in ('unregistered', 'core.core.terrain.decode_2.layers.0', None, 44):
                error = capture_error(lambda: bounded_remaining_weight_gradient(x, up, target=invalid))
                self.assertIn('unregistered', error[1]); rejection_rows.append(error)
            TEST_EVIDENCE.append(dict(target=target, directHelperRejections=rejection_rows,
                                      inputDataVersionsAndGradStateUnchanged=True, noHelperGraph=True))

    def test_original_errors_order_and_higher_order(self):
        rng = torch.Generator().manual_seed(8127)
        for target, channels, outputs, current, name in SPECS:
            previous, pre_sha = old_module(current)
            values = [torch.randn((1, channels, 2, 3), generator=rng),
                      torch.randn((outputs, channels, 3, 3), generator=rng),
                      torch.randn(outputs, generator=rng)]
            variants = []
            for i in range(3):
                for nonfinite in (float('nan'), float('inf'), -float('inf')):
                    vs = [v.clone() for v in values]; vs[i].flatten()[0] = nonfinite; variants.append(vs)
                vs = [v.clone() for v in values]; vs[i] = vs[i].double(); variants.append(vs)
            variants.extend(([values[0][:, :-1], *values[1:]],
                             [values[0], values[1][:-1], values[2]],
                             [values[0], values[1], values[2][:-1]],
                             [values[0].transpose(2, 3), *values[1:]],
                             [torch.empty(values[0].shape, device='meta'), *values[1:]],
                             [None, *values[1:]]))
            errors = []
            for vs in variants:
                a = capture_error(lambda: getattr(current, name)(*vs))
                r = capture_error(lambda: getattr(previous, name)(*vs))
                self.assertEqual(a, r); errors.append(a)
            def backward_error(module, bad_up=None, higher=False):
                vs = [v.clone().requires_grad_() for v in values]
                output = getattr(module, name)(*vs)
                up = torch.ones_like(output) if bad_up is None else bad_up
                return capture_error(lambda: torch.autograd.grad(output, vs, up, create_graph=higher))
            for bad in (float('nan'), float('inf'), -float('inf')):
                up = torch.ones((1, outputs, 2, 3)); up.flatten()[-1] = bad
                a, r = backward_error(current, up), backward_error(previous, up)
                self.assertEqual(a, r); errors.append(a)
            a, r = backward_error(current, higher=True), backward_error(previous, higher=True)
            self.assertEqual(a, r); self.assertIn('higher-order', a[1]); errors.append(a)
            TEST_EVIDENCE.append(dict(target=target, originalErrorPairs=len(errors), errors=errors,
                                      originalTextAndOrderEqual=True, higherOrderRejected=True, preimageSha256=pre_sha))

    def test_existing_identity_chain_without_model(self):
        from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as entry
        from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as native
        from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
        self.assertEqual(INPUT_CHANNEL_BLOCK, 16)
        self.assertEqual(len(REGISTERED_TARGETS), 2)
        old_rules = []; new_rules = []
        for _, _, _, current, _ in SPECS:
            previous, _ = old_module(current)
            self.assertNotEqual(current.NUMERIC_RULE, previous.NUMERIC_RULE)
            self.assertIn(current.NUMERIC_RULE, entry.STEM_DECODER_RULE)
            self.assertIn(current.NUMERIC_RULE, native.NUMERIC_RULE)
            old_rules.append(previous.NUMERIC_RULE); new_rules.append(current.NUMERIC_RULE)
        geometry = NativeStageGeometry(2)
        payload = '|'.join(('numeric', native.CAPABILITY, native.ARCHITECTURE, native.NUMERIC_RULE,
                            repr(geometry.identity()), *native.parent.SEASONS, *native.parent.ECOLOGIES))
        current_identity = native.identity_bytes('numeric', geometry)
        self.assertEqual(current_identity.numpy().tobytes(), hashlib.sha256(payload.encode()).digest())
        old_payload = payload
        for a, b in zip(new_rules, old_rules): old_payload = old_payload.replace(a, b)
        self.assertNotEqual(hashlib.sha256(old_payload.encode()).digest(), current_identity.numpy().tobytes())
        TEST_EVIDENCE.append(dict(identityPropagatedViaExistingChain=True,
                                  currentNumericIdentity=current_identity.numpy().tobytes().hex(),
                                  oldRulesCounterfactualIdentity=hashlib.sha256(old_payload.encode()).hexdigest(),
                                  identityBuffersChange=True, fullModelInstantiated=False, executionQualified=False))


if __name__ == '__main__':
    unittest.main()
