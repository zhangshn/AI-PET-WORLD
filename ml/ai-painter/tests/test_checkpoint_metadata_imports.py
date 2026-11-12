"""Metadata remains usable without model imports; legacy component access is lazy."""
import importlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
MODULE = 'ai_painter.complete_world.decode1_entry_weight_quality_checkpoint_v1'


class CheckpointMetadataImportTests(unittest.TestCase):
    def test_all_registered_roles_work_with_torch_import_forbidden(self):
        program = '''
import importlib.abc,json,sys
from pathlib import Path
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/src')]
class NoTorch(importlib.abc.MetaPathFinder):
    def find_spec(self,fullname,path=None,target=None):
        if fullname=='torch' or fullname.startswith('torch.'):
            raise AssertionError('metadata imported PyTorch')
sys.meta_path.insert(0,NoTorch())
import decode1_entry_weight_quality_auth_v1 as auth
codec=auth.checkpoint
caps=[codec.CAPABILITY,codec.COMPLETION_CAPABILITY,codec.COMPLETION_V2_CAPABILITY,codec.SAME_CALL_CAPABILITY]
caps += [row['capability'] for row in codec.registered_training_interfaces()]
for cap in caps:
    assert auth.required_program_roles(cap)['executionAuth'].endswith('decode1_entry_weight_quality_auth_v1.py')
    assert codec.execution_values(cap)['capability']==cap
    assert codec.model_capability(cap)
for name in ('torch','strict','identity','build_conditional_texture_discriminator'):
    assert name in dir(codec) and name not in vars(codec)
try: getattr(codec,'missing_attribute')
except AttributeError: pass
else: raise AssertionError('unknown attribute accepted')
assert 'torch' not in sys.modules
print(json.dumps({'count':len(caps),'torchLoaded':False}))
'''
        result = subprocess.run([sys.executable, '-I', '-B', '-c', program, str(ROOT)],
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreaterEqual(json.loads(result.stdout)['count'], 14)

    def test_failed_lazy_import_does_not_publish_partial_components(self):
        program = '''
import builtins,sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(sys.argv[1])/'ml/ai-painter/src'))
from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as codec
original=builtins.__import__
primary=ImportError('synthetic strict import failure')
def fail(name,globals=None,locals=None,fromlist=(),level=0):
    if name=='ai_painter.complete_world' and 'detail_weight_checkpoint_codec' in (fromlist or ()):
        raise primary
    return original(name,globals,locals,fromlist,level)
with patch.object(builtins,'__import__',fail):
    try: codec.identity
    except ImportError as error: assert error is primary
    else: raise AssertionError('failed import accepted')
assert all(name not in vars(codec) for name in codec._COMPONENT_NAMES)
import torch
def forbidden(*a,**k): raise AssertionError('model or GPU executed')
torch.nn.Module.__call__=forbidden;torch.cuda._lazy_init=forbidden
assert codec.identity.CAPABILITY==codec.MODEL_CAPABILITY
namespace={}
exec('from ai_painter.complete_world.decode1_entry_weight_quality_checkpoint_v1 import *',namespace)
assert all(namespace[name] is getattr(codec,name) for name in codec.__all__)
assert not torch.cuda.is_initialized()
'''
        result = subprocess.run([sys.executable, '-I', '-B', '-c', program, str(ROOT)],
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_legacy_attributes_are_original_objects_and_not_proxies(self):
        codec = importlib.import_module(MODULE)
        torch = importlib.import_module('torch')
        identity = importlib.import_module('ai_painter.complete_world.object_ecology_decode1_entry_weight_precision_v1')
        strict = importlib.import_module('ai_painter.complete_world.detail_weight_checkpoint_codec')
        renderer = importlib.import_module('ai_painter.complete_world.native_rgb_conditional_texture_cpu')
        self.assertIs(codec.torch, torch)
        self.assertIs(codec.identity, identity)
        self.assertIs(codec.strict, strict)
        self.assertIs(codec.build_conditional_texture_discriminator, renderer.build_conditional_texture_discriminator)
        self.assertEqual(codec.MODEL_CAPABILITY, identity.CAPABILITY)
        self.assertEqual(codec.model_capability(codec.DECODE2_SUPPORT_WEIGHT1_CAPABILITY), identity.DECODE2_CAPABILITY)
        self.assertEqual(codec.model_capability(codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY), identity.RGB_OUTPUT_CAPABILITY)
        for cap in (codec.CAPABILITY, codec.DECODE2_SUPPORT_WEIGHT1_CAPABILITY, codec.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY):
            with self.subTest(capability=cap):
                actual = codec.components(cap)
                self.assertIs(actual[0], torch)
                self.assertIs(actual[1], strict)
                self.assertIs(actual[2], identity.validate_model_identity)
        # Existing callers can still patch a resolved component binding.
        with patch.object(codec, 'identity', identity), patch.object(codec, 'strict', strict):
            self.assertIs(codec.components()[1], strict)

    def test_state_validator_uses_real_codec_without_model_execution(self):
        codec = importlib.import_module(MODULE)
        torch = importlib.import_module('torch')
        reference = {'synthetic': torch.tensor([1., 2.])}
        with patch.object(torch.nn.Module, '_call_impl', side_effect=AssertionError('no model forward')), \
             patch.object(torch.cuda, '_lazy_init', side_effect=AssertionError('no GPU')):
            actual = codec._state({key: value.clone() for key, value in reference.items()}, reference, 'synthetic')
            self.assertTrue(torch.equal(actual['synthetic'], reference['synthetic']))
            with self.assertRaises(ValueError):
                codec._state({'synthetic': torch.tensor([float('nan'), 2.])}, reference, 'synthetic')
