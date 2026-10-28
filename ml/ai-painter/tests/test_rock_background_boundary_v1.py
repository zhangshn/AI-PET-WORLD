"""Synthetic CPU tensor checks; no real model, data preparation or CUDA."""
from contextlib import nullcontext
from pathlib import Path
import sys
import hashlib
import io
import json
import unittest
from unittest.mock import patch
import torch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT/'ml/ai-painter/scripts'), str(ROOT/'ml/ai-painter/src')]
import painter_stage4_rock_background_training_profile_v1 as profile
import painter_replay_retention_fit_v1 as fit
from ai_painter.complete_world.road_attribution_observation_v1 import projected_boundary_mask
from painter_stage4_decode1_entry_weight_lifecycle_v1 import existing_values

torch.set_num_threads(2)


def sample(empty=False):
    expected = torch.zeros((768, 1024), dtype=torch.bool)
    if not empty:
        expected[3, 510:518] = True  # Inside6px, deliberately not the outer edge.
        expected[764, 710:718] = True
        expected[300, 300:320] = True  # Interior road is excluded.
    binding = dict(path='data/synthetic.png', sha256='a'*64)
    return dict(sampleId='synthetic-train', split='train', objectInstanceTable={}, boundaryRgbSource=dict(
        sampleId='synthetic-train', image=binding, road=binding, conditionPack=binding,
        reference=torch.zeros((1, 3, 768, 1024)), expectedRoad=expected))


class BoundaryMathTests(unittest.TestCase):
    def tearDown(self):
        self.assertIsNone(profile._BOUNDARY.get())
        self.assertIsNone(profile._FORWARD.get())

    def test_exact094_mask_repeat4_reference_reduction_and_gradient(self):
        s = sample()
        prediction = torch.full((1, 3, 192, 256), .37, requires_grad=True)
        reference = s['boundaryRgbSource']['reference']
        reference[:, :, 3, 510:518] = .83
        mask, _, sides = projected_boundary_mask(s['boundaryRgbSource']['expectedRoad'])
        expected = ((prediction.repeat_interleave(4, -2).repeat_interleave(4, -1)-reference).abs()
                    *mask[None, None]).sum()/(mask.sum()*3).clamp_min(1)
        with profile.boundary_rgb_scope(s):
            actual, facts = profile.boundary_rgb_loss(prediction, s)
        self.assertTrue(torch.equal(actual, expected))
        a = torch.autograd.grad(actual, prediction)[0]
        b = torch.autograd.grad(expected, prediction)[0]
        self.assertTrue(torch.equal(a, b))
        self.assertEqual(facts['requiredSides'], ['north', 'south'])
        self.assertEqual(facts['requiredSides'], sides)
        self.assertEqual(facts['projectedBoundaryPixels'], 16)
        self.assertTrue(facts['applicable'])

    def test_structural_empty_is_connected_zero_not_unused(self):
        s = sample(empty=True)
        prediction = torch.full((1, 3, 192, 256), .2, requires_grad=True)
        with profile.boundary_rgb_scope(s):
            loss, facts = profile.boundary_rgb_loss(prediction, s)
        gradient = torch.autograd.grad(loss, prediction, allow_unused=True)[0]
        self.assertEqual(float(loss.detach()), 0)
        self.assertIsNotNone(gradient)
        self.assertEqual(int(gradient.count_nonzero()), 0)
        self.assertFalse(facts['applicable'])
        self.assertEqual(facts['notApplicableReason'], 'structurally_empty_required_road_boundary')

    def test_missing_wrong_shape_nonfinite_or_other_sample_fail_and_clear(self):
        changes = [lambda s:s.pop('boundaryRgbSource'),
                   lambda s:s['boundaryRgbSource'].__setitem__('sampleId', 'foreign'),
                   lambda s:s['boundaryRgbSource'].__setitem__('reference', torch.zeros(1, 3, 1, 1)),
                   lambda s:s['boundaryRgbSource']['reference'].__setitem__((0, 0, 0, 0), float('nan')),
                   lambda s:s['boundaryRgbSource'].__setitem__('expectedRoad', torch.zeros(768, 1024))]
        for change in changes:
            s = sample(); change(s)
            profile._FORWARD.set(('stale',))
            with self.subTest(change=change), self.assertRaises(ValueError):
                with profile.boundary_rgb_scope(s):
                    profile.boundary_rgb_loss(torch.zeros(1, 3, 192, 256), s)
            self.assertIsNone(profile._FORWARD.get())
            self.assertIsNone(profile._BOUNDARY.get())

    def test_authentication_same_forward_and_exception_cleanup(self):
        s = sample()
        for method in ('zero_update_probe', 'perform_pair'):
            error = RuntimeError('original failure')
            with patch.object(profile.parent, method, side_effect=error):
                with self.assertRaises(RuntimeError) as caught:
                    with profile.boundary_rgb_scope(s):
                        profile._FORWARD.set(('stale',))
                        getattr(profile, method)()
                self.assertIs(caught.exception, error)
            self.assertIsNone(profile._BOUNDARY.get()); self.assertIsNone(profile._FORWARD.get())
        model = torch.nn.Linear(1, 1)
        prediction = torch.zeros(1, 3, 192, 256)
        with self.assertRaisesRegex(ValueError, 'authenticated forward'):
            with profile.boundary_rgb_scope(s):
                profile._FORWARD.set((model, prediction, 'other', {}))
                profile._generator_candidate(model, object(), s, [], prediction)


class CandidateTests(unittest.TestCase):
    def test_original_math_bitwise_and_new_structured_single_scalar_with_original_five_vjps(self):
        model = torch.nn.Linear(1, 1, bias=False)
        with torch.no_grad(): model.weight.fill_(.2)
        s = sample()
        totals, calls = [], []
        for enabled in (False, True):
            prediction = model.weight.reshape(1, 1, 1, 1).expand(1, 3, 192, 256)
            x = model.weight.sum()
            parts = dict(v21UnchangedTotal=x*1.5, wholeFrameFidelity=x*.3,
                         objectCoreRgbWeighted=x*.4, objectSupportStructureWeighted=x*.5)
            background = x*.2
            captured = {}
            def gradients(**kwargs):
                captured.update(kwargs)
                labels = ('actual_total', 'structured_objective', 'whole_frame_fidelity',
                          'object_core_rgb', 'object_support_structure')
                values = {key:float(kwargs[key].detach()) for key in labels}
                rows = [torch.autograd.grad(kwargs[key], tuple(model.parameters()), retain_graph=True) for key in labels]
                calls.append(rows)
                return rows[0], dict(scalarValues=values)
            with patch.object(profile.parent, 'generator_fp32_scope', return_value=nullcontext()), \
                 patch.object(profile.parent, 'train_object_support_structure_candidate_objective', return_value=(x, parts)), \
                 patch.object(profile, 'targets', return_value=(None, torch.ones(1), [])), \
                 patch.object(profile, 'auxiliary_loss', return_value=background), \
                 patch.object(profile.parent, 'compute_generator_candidate_gradients', side_effect=gradients):
                with profile.boundary_rgb_scope(s) if enabled else nullcontext():
                    profile._FORWARD.set((model, prediction, s['sampleId'], {'terrainRgb':prediction}))
                    total, _, facts = profile._generator_candidate(model, object(), s, [], prediction)
            original_structured = parts['v21UnchangedTotal']+background
            structured = original_structured + .01*x if enabled else original_structured
            expected = ((structured+parts['wholeFrameFidelity'])+parts['objectCoreRgbWeighted'])+parts['objectSupportStructureWeighted']
            self.assertTrue(torch.equal(total, expected))
            self.assertTrue(torch.equal(captured['structured_objective'], structured))
            self.assertEqual(len(calls[-1]), 5)
            self.assertEqual(len(facts['scalarValues']), 8 if enabled else 7)
            result = dict(generatorLoss=float(total.detach()), discriminatorLoss=.2, fiveGradientFacts=facts)
            values, _ = existing_values(result)
            if enabled:
                fit.validate_boundary_facts(facts)
                self.assertAlmostEqual(values['generatorComponent.boundaryPathRgbWeighted'], .002, places=7)
            else:
                self.assertNotIn('boundaryPathRgbWeighted', facts['scalarValues'])
                self.assertEqual(facts['trainingObjective'], profile.CAPABILITY)
            totals.append(float(total.detach()))
            self.assertIsNone(profile._FORWARD.get()); self.assertIsNone(profile._BOUNDARY.get())
        self.assertAlmostEqual(totals[1]-totals[0], .002, places=7)

    def test_worker_wrapper_scopes_both_calls_and_rejects_missing_new_scalar(self):
        s = sample()
        class Background:
            boundary_rgb_scope = staticmethod(profile.boundary_rgb_scope)
            def zero_update_probe(self, model, critic, current, *args, **kwargs):
                assert profile._BOUNDARY.get() is current['boundaryRgbSource']
                return dict(fiveGradientFacts=dict(trainingObjective=fit.BOUNDARY_OBJECTIVE,
                    scalarValues={'boundaryPathRgbWeighted':0.01}, boundaryRgb={'weight':.01}))
            perform_pair = zero_update_probe
        wrapper = fit.BoundaryProfile(Background())
        for method in ('zero_update_probe', 'perform_pair'):
            getattr(wrapper, method)(object(), object(), s)
            self.assertIsNone(profile._BOUNDARY.get())
        with self.assertRaises(ValueError): fit.validate_boundary_facts({})


class InputBindingTests(unittest.TestCase):
    def test_authenticated_full_png_decoding_and_missing_corrupt_wrong_mode_or_pack_rejection(self):
        from PIL import Image
        import numpy as np
        def png(size=(1024, 768), mode='RGB'):
            stream = io.BytesIO(); Image.new(mode, size).save(stream, format='PNG'); return stream.getvalue()
        def fixture(image=None, road=None, mismatch=False):
            data = {'reference.png':png() if image is None else image, 'road.png':png(mode='L') if road is None else road}
            def binding(path):return dict(path=path, sha256=hashlib.sha256(data[path]).hexdigest())
            image_b, road_b = binding('reference.png'), binding('road.png')
            data['pack.json'] = json.dumps(dict(channels=[dict(id='terrain_path_ground',
                **{**road_b, **({'sha256':'0'*64} if mismatch else {})})])).encode()
            identity = dict(sampleId='synthetic-train', split='train', image=image_b,
                conditionPack=binding('pack.json'), channels=[dict(id='terrain_path_ground', **road_b)])
            class Reader:
                def read(self, b):
                    raw = data[b['path']]
                    if hashlib.sha256(raw).hexdigest() != b['sha256']:raise ValueError('changed bytes')
                    return raw
                def json(self,b):return json.loads(self.read(b))
            return Reader(), identity, data
        reader, identity, data = fixture()
        result = fit.bind_boundary_input(reader, sample(), identity, torch, np)
        self.assertEqual(result['boundaryRgbSource']['reference'].shape, (1, 3, 768, 1024))
        self.assertEqual(result['boundaryRgbSource']['expectedRoad'].dtype, torch.bool)
        self.assertFalse(result['boundaryRgbSource']['reference'].requires_grad)
        for kwargs in (dict(image=png((256,192))), dict(road=png(mode='P')), dict(image=png(mode='L')), dict(image=b'broken PNG'), dict(mismatch=True)):
            reader, identity, _ = fixture(**kwargs)
            with self.subTest(kwargs=kwargs.keys()), self.assertRaises(Exception):
                fit.bind_boundary_input(reader, sample(), identity, torch, np)
        reader, identity, data = fixture(); data.pop('road.png')
        with self.assertRaises(KeyError):fit.bind_boundary_input(reader, sample(), identity, torch, np)
        reader, identity, data = fixture(); data['reference.png'] = b'changed'
        with self.assertRaisesRegex(ValueError,'changed bytes'):fit.bind_boundary_input(reader, sample(), identity, torch, np)


if __name__ == '__main__':
    unittest.main()
