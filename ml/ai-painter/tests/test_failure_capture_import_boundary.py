"""Readonly imports and synthetic CPU capture; no learned model or GPU execution."""
from contextlib import ExitStack
import importlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
MODULE = 'ai_painter.complete_world.object_support_structure_failure_capture_v1'


class FailureCaptureImportBoundaryTests(unittest.TestCase):
    def test_readonly_file_tools_and_role_queries_do_not_import_torch(self):
        program = '''
import importlib.abc, json, sys
from pathlib import Path
root = Path(sys.argv[1])
sys.path[:0] = [str(root/'ml/ai-painter/scripts'), str(root/'ml/ai-painter/src')]
class NoTorch(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'torch' or fullname.startswith('torch.'):
            raise AssertionError('readonly operation imported PyTorch')
sys.meta_path.insert(0, NoTorch())
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
import object_support_structure_quality_auth_v1 as auth
assert capture.digest(b'abc') == 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
assert auth.RuntimeMap is capture.RuntimeMap
roles = [auth.required_program_roles(cap) for cap in (auth.CAPABILITY, auth.FINAL_RGB_CAPABILITY, auth.JOINT_CAPABILITY)]
assert all(row['executionAuth'] for row in roles)
assert not any(n == 'torch' or n.startswith('torch.') for n in sys.modules)
print(json.dumps({'queries': len(roles), 'torchLoaded': False}))
'''
        result = subprocess.run([sys.executable, '-I', '-B', '-c', program, str(ROOT)],
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {'queries': 3, 'torchLoaded': False})

    def setUp(self):
        # Imports below are for explicit synthetic tensor work, not the cold child.
        import torch
        self.torch = torch
        self.capture = importlib.import_module(MODULE)
        self.guards = ExitStack()
        self.addCleanup(self.guards.close)
        for owner, name in ((torch.nn.Module, '_call_impl'), (torch.autograd, 'grad'),
                            (torch.autograd, 'backward'), (torch.optim.Optimizer, '__init__'),
                            (torch.cuda, '_lazy_init')):
            self.guards.enter_context(patch.object(owner, name, side_effect=AssertionError('model/GPU execution forbidden')))

    def test_cpu_archive_roundtrip_keeps_bytes_and_rejects_changed_evidence(self):
        torch, capture = self.torch, self.capture
        for dtype in (torch.float32, torch.float64, torch.uint8, torch.int32, torch.int64, torch.bool):
            with self.subTest(dtype=str(dtype)):
                tensor = torch.tensor([0, 1, 1, 0], dtype=dtype).reshape(2, 2)
                metadata = {'archiveEncoding': 'gzip-torch-flat-cpu-v1',
                    'decompressedBytes': tensor.numel() * tensor.element_size(), 'tensorDescriptors': {
                        'synthetic': {'shape': list(tensor.shape), 'dtype': str(dtype),
                                      'bytes': tensor.numel() * tensor.element_size(),
                                      'sha256': capture.tensor_sha(tensor), 'allFinite': True}}}
                raw = capture.archive_bytes({'synthetic': tensor})
                loaded = capture.safe_load_bytes(raw, capture.digest(raw), metadata)
                self.assertTrue(torch.equal(loaded['synthetic'], tensor))
                self.assertEqual(capture.tensor_sha(loaded['synthetic']), capture.tensor_sha(tensor))
                with self.assertRaisesRegex(ValueError, 'bytes/SHA'):
                    capture.safe_load_bytes(raw + b'x', capture.digest(raw), metadata)
                bad = json.loads(json.dumps(metadata))
                bad['tensorDescriptors']['synthetic']['sha256'] = '0' * 64
                with self.assertRaisesRegex(ValueError, 'descriptor/SHA'):
                    capture.safe_load_bytes(raw, capture.digest(raw), bad)

    def test_copy_detaches_and_rejects_unsupported_input(self):
        torch, capture = self.torch, self.capture
        source = torch.tensor([1., 2.], requires_grad=True)
        copied = capture._copy(source)
        self.assertTrue(torch.equal(source, copied))
        self.assertFalse(copied.requires_grad)
        self.assertNotEqual(source.data_ptr(), copied.data_ptr())
        for invalid in (None, torch.tensor([1 + 2j]), torch.empty(1, device='meta')):
            with self.subTest(input_type=type(invalid).__name__):
                with self.assertRaisesRegex(ValueError, 'unsupported snapshot tensor'):
                    capture._copy(invalid)

    def test_full_synthetic_snapshot_keeps_five_gradient_sets_and_rng(self):
        torch, capture = self.torch, self.capture
        import numpy as np
        import random
        model, critic = torch.nn.Module(), torch.nn.Module()
        for i in range(108):
            model.register_parameter('p' + str(i), torch.nn.Parameter(torch.zeros(2242580 if i == 0 else 1)))
        critic.register_parameter('weight', torch.nn.Parameter(torch.zeros(1)))
        named = tuple(model.named_parameters())
        graph = [{'name': name, 'shape': list(value.shape), 'dtype': str(value.dtype), 'elements': value.numel()}
                 for name, value in named]
        rows = [tuple([None] * 107 + [torch.tensor([i + .25])]) for i in range(5)]
        error = RuntimeError('synthetic snapshot only')
        error.object_support_gradient_evidence = {'parameterNames': [name for name, _ in named],
            'componentsInOrder': list(capture.LABELS), 'gradientSetsAvailable': 5, 'rawGradients': rows}
        context = {key: {} for key in ('failurePosition', 'optimizerSteps', 'sampleBindings', 'programBindings', 'modelBinding')}
        torch_before, python_before, numpy_before = torch.get_rng_state().clone(), random.getstate(), np.random.get_state()
        payload, metadata = capture.collect_snapshot(error, model=model, critic=critic, graph=graph, context=context)
        capture.validate_manifest(metadata)
        self.assertEqual(metadata['status'], 'captured')
        self.assertFalse(metadata['qualificationAllowed'])
        for i, label in enumerate(capture.LABELS):
            self.assertTrue(torch.equal(payload['gradient.' + label + '.107'], rows[i][107]))
        self.assertTrue(all(p.grad is None for p in model.parameters()))
        self.assertTrue(torch.equal(torch_before, torch.get_rng_state()))
        self.assertEqual(python_before, random.getstate())
        numpy_after = np.random.get_state()
        self.assertEqual(numpy_before[0], numpy_after[0])
        self.assertTrue(np.array_equal(numpy_before[1], numpy_after[1]))
        self.assertEqual(numpy_before[2:], numpy_after[2:])
