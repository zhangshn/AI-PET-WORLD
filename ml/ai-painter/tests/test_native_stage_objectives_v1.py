"""Synthetic tensor objectives only. Archived reference is supplied by the CPU harness."""
import gc
import unittest
import torch
from torch.nn import functional as F

from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER
from ai_painter.complete_world import native_rgb_conditional_texture_cpu as conditional
from ai_painter.complete_world import native_rgb_instance_object_prototype as instance
from ai_painter.complete_world import native_rgb_local_texture_objective_v12 as texture
from ai_painter.complete_world import native_rgb_structured_object_objective_cpu_v17 as spatial
from ai_painter.complete_world import native_rgb_whole_frame_fidelity_candidate_cpu as whole
from ai_painter.complete_world import native_rgb_object_core_fidelity_candidate_cpu as core
from ai_painter.complete_world import native_rgb_object_support_structure_candidate_cpu_v1 as support
from ai_painter.complete_world import native_rgb_object_support_structure_device_v1 as device
from ai_painter.complete_world import isolated_rock_background_proxy_v1 as background
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views

ARCHIVED_REFERENCE = None
EVIDENCE_SINK = None
CURRENT_CASE = None


class TensorCritic(torch.nn.Module):
    """Parameter-free arithmetic fixture, never the learned discriminator."""
    def __init__(self, derivative=False):
        super().__init__()
        self.coefficient = torch.tensor(0.7, requires_grad=derivative)

    def forward(self, value):
        return self.coefficient * value.mean(dim=1, keepdim=True)


def fixture(geometry=None, scenario='mixed'):
    g = NativeStageGeometry(0) if geometry is None else geometry
    q, h, w = g.scale, g.height, g.width
    seed = 20261028 + ('mixed', 'overlap', 'edge', 'empty', 'constant', 'background', 'other').index(scenario)
    generator = torch.Generator().manual_seed(seed)
    image = torch.rand(3, h, w, generator=generator)*0.8+0.1
    prediction = (torch.rand(1, 3, h, w, generator=generator)*0.8+0.1).requires_grad_()
    conditions = torch.zeros(23, h, w)
    conditions[ORDER.index('terrain_grass')] = 1
    conditions[ORDER.index('walkable')] = 1
    conditions[ORDER.index('terrain_water'), 20*q:28*q, 10*q:50*q] = 1
    conditions[ORDER.index('terrain_path_ground'), 30*q:32*q] = 1
    conditions[ORDER.index('terrain_shoreline'), 19*q:20*q, 10*q:50*q] = 1
    conditions[ORDER.index('coordinate_x')] = torch.linspace(0, 1, w)[None]
    conditions[ORDER.index('coordinate_y')] = torch.linspace(0, 1, h)[:, None]
    objects = ((1, 'tree', 40, 40), (2, 'rock', 100, 70), (3, 'shrub', 160, 120))
    if scenario == 'overlap':
        objects = ((1, 'tree', 40, 40), (2, 'rock', 48, 40), (3, 'shrub', 44, 48))
    elif scenario == 'edge':
        objects = ((1, 'tree', 0, 0), (2, 'rock', 100, 70), (3, 'shrub', 252, 188))
    elif scenario == 'background':
        objects = ((36, 'rock', 20, 20), (38, 'rock', 80, 60))
    elif scenario == 'empty':
        objects = ()
    if scenario == 'constant':
        image.fill_(0.5)
    table = []
    for value, kind, x, y in objects:
        role = {'tree': 'object_tree', 'rock': 'object_rock', 'shrub': 'object_vegetation'}[kind]
        for channel in ('object_footprints', role):
            conditions[ORDER.index(channel), y*q:(y+4)*q, x*q:(x+4)*q] = 1
        conditions[ORDER.index('object_instance'), y*q:(y+4)*q, x*q:(x+4)*q] = value/255
        table.append(dict(value=value, kind=kind, footprint=dict(x=x*4, y=y*4, width=16, height=16)))
    sample = dict(sampleId=background.SAMPLE_ID if scenario == 'background' else 'synthetic_'+scenario,
                  split='train', image=image, conditions=conditions, objectInstanceTable=table)
    return prediction, sample, table


def snapshot(value):
    if isinstance(value, torch.Tensor):
        return value.detach().clone()
    if isinstance(value, dict):
        return {k: snapshot(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(snapshot(v) for v in value)
    return value


def result_case(scenario, kind, geometry=None):
    global CURRENT_CASE
    CURRENT_CASE = scenario+'/'+kind
    prediction, sample, table = fixture(geometry, scenario)
    kwargs = {} if geometry is None else dict(geometry=geometry)
    if kind == 'instance':
        value, parts = instance.train_original_instance_objective(prediction, sample, table, ORDER, **kwargs)
    elif kind == 'texture':
        value = texture.local_target_texture_moments_loss(prediction, sample['image'][None], **kwargs)
        parts = dict(texture=value)
    elif kind == 'fact':
        value = conditional.fact_region_coarse_rgb_loss(prediction, sample['image'][None], sample['conditions'][None], ORDER, **kwargs)
        parts = dict(fact=value)
    elif kind == 'spatial':
        value, parts = spatial.original_object_class_spatial_loss(prediction, sample, ORDER, split='train', **kwargs)
    elif kind == 'whole':
        value, parts = whole.train_original_whole_frame_fidelity(prediction, sample, **kwargs)
    elif kind == 'core':
        value, parts = core.train_original_object_core_rgb(prediction, sample, ORDER, **kwargs)
    elif kind == 'support':
        value, parts = support.train_original_object_support_structure(prediction, sample, table, ORDER, **kwargs)
    elif kind == 'supportDevice':
        value, parts = device.train_original_object_support_structure(prediction, sample, table, ORDER, **kwargs)
    elif kind == 'composite':
        value, parts = support.train_object_support_structure_candidate_objective(TensorCritic(), prediction, sample, table, ORDER, **kwargs)
    elif kind == 'highpass':
        field = conditional.highpass_rgb(prediction, **kwargs)
        value, parts = field.square().mean(), dict(field=field)
    elif kind == 'discriminator':
        critic = TensorCritic(derivative=True)
        value, parts = conditional.discriminator_train_objective(critic, prediction, sample, **kwargs)
        derivatives = torch.autograd.grad(value, (prediction, critic.coefficient), allow_unused=True)
        assert derivatives[0] is None and derivatives[1] is not None
        return dict(value=snapshot(value), parts=snapshot(parts), derivatives=snapshot(derivatives), fakeRgbDetached=True)
    elif kind == 'background':
        masks = support._visible_support(sample['conditions'], table, ORDER, **kwargs)
        masks['object_footprints'] = sample['conditions'][ORDER.index('object_footprints')][None, None].bool()
        target, selected, records = background.targets(sample, ORDER, dict(visibleObjectSupportMasks=masks), **kwargs)
        value = background.auxiliary_loss(prediction, target, selected, **kwargs)
        parts = dict(target=target, mask=selected, records=records, backgroundIsProxy=True)
        if scenario == 'background':
            g = NativeStageGeometry(0) if geometry is None else geometry
            union = torch.zeros_like(selected)
            for mask in masks.values():
                union |= mask.bool()
            views = validate_bound_object_views(sample['conditions'], table, ORDER, **kwargs)
            for view, record in zip(views, records):
                owned = torch.zeros_like(selected)
                y0, y1 = max(0, view.top), min(g.height, view.top+g.patch_size)
                x0, x1 = max(0, view.left), min(g.width, view.left+g.patch_size)
                owned[0, 0, y0:y1, x0:x1] = view.support_mask[0, y0-view.top:y1-view.top, x0-view.left:x1-view.left].bool()
                radius = g.background_ring_radius
                ring = F.max_pool2d(owned.float(), radius*2+1, stride=1, padding=radius).bool() & ~union
                median = sample['image'][:, ring[0, 0]].median(1).values
                assert record['ringPixels'] == int(ring.sum())
                assert record['supportPixels'] == int(owned.sum())
                assert torch.equal(target[0, :, owned[0, 0]], median[:, None].expand(-1, int(owned.sum())))
            assert [r['objectId'] for r in records] == [36, 38]
            assert not bool(target[~selected.expand_as(target)].any())
        else:
            assert not bool(selected.any()) and records == []
    else:
        raise ValueError(kind)
    derivative, = torch.autograd.grad(value, (prediction,))
    assert bool(torch.isfinite(value)) and bool(torch.isfinite(derivative).all())
    return dict(value=snapshot(value), parts=snapshot(parts), derivatives=(snapshot(derivative),))


REFERENCE_PLAN = {
    'mixed': ('instance', 'texture', 'fact', 'spatial', 'whole', 'core', 'support', 'supportDevice', 'composite', 'highpass', 'discriminator'),
    'overlap': ('support', 'supportDevice', 'core', 'composite'),
    'edge': ('instance', 'support', 'core', 'whole'),
    'empty': ('support', 'supportDevice'),
    'constant': ('support',),
    'background': ('background',),
    'other': ('background',),
}


def collect_archived_reference():
    return {scenario+'/'+kind: result_case(scenario, kind)
            for scenario, kinds in REFERENCE_PLAN.items() for kind in kinds}


def assert_exact(actual, expected, path='result'):
    if isinstance(expected, torch.Tensor):
        assert isinstance(actual, torch.Tensor) and actual.shape == expected.shape and actual.dtype == expected.dtype, path
        assert torch.equal(actual.reshape(-1).view(torch.uint8), expected.reshape(-1).view(torch.uint8)), path
    elif isinstance(expected, dict):
        assert tuple(actual) == tuple(expected), path
        for key in expected:
            assert_exact(actual[key], expected[key], path+'.'+key)
    elif isinstance(expected, (list, tuple)):
        assert len(actual) == len(expected), path
        for i, (a, b) in enumerate(zip(actual, expected)):
            assert_exact(a, b, path+'.'+str(i))
    else:
        assert actual == expected, path


def emit(name, result, **metadata):
    if EVIDENCE_SINK is not None:
        EVIDENCE_SINK(name, result, metadata)


class NativeStageObjectiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_default_and_geometry0_loss_parts_and_derivatives_match_archived256(self):
        reference = ARCHIVED_REFERENCE if ARCHIVED_REFERENCE is not None else collect_archived_reference()
        for scenario, kinds in REFERENCE_PLAN.items():
            for kind in kinds:
                key = scenario+'/'+kind
                for geometry in (None, NativeStageGeometry(0)):
                    result = result_case(scenario, kind, geometry)
                    assert_exact(result, reference[key], key)
                    emit(key, result, stage=0, legacyDefault=geometry is None,
                         archivedComparison=ARCHIVED_REFERENCE is not None, bitwiseValuePartsAndDerivatives=True)
                    del result
        gc.collect()

    def test_registered_native_objectives_and_derivatives(self):
        for stage in (1, 2):
            g = NativeStageGeometry(stage)
            for scenario, kinds in REFERENCE_PLAN.items():
                for kind in kinds:
                    result = result_case(scenario, kind, g)
                    emit(scenario+'/'+kind, result, stage=stage, syntheticOnly=True,
                         finiteValueAndDerivative=True, nativeShape=list(g.spatial_shape))
                    del result
            gc.collect()

    def test_semantic_mask_failures_empty_core_and_invalid_geometry(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            prediction, sample, table = fixture(g)
            sample['conditions'][ORDER.index('object_tree'), 1, 1] = 0.5
            with self.assertRaises(ValueError):
                core.train_original_object_core_rgb(prediction, sample, ORDER, geometry=g)
            with self.assertRaises(ValueError):
                support.train_original_object_support_structure(prediction, sample, table, ORDER, geometry=g)
            prediction, sample, table = fixture(g, 'empty')
            with self.assertRaises(ValueError):
                core.train_original_object_core_rgb(prediction, sample, ORDER, geometry=g)
            with self.assertRaises(ValueError):
                spatial.original_object_class_spatial_loss(prediction, sample, ORDER, split='train', geometry=g)
            prediction, sample, table = fixture(g)
            for bad in (True, (g.height, g.width), {'stage': stage}):
                with self.assertRaises(ValueError):
                    whole.train_original_whole_frame_fidelity(prediction, sample, geometry=bad)
            with self.assertRaises(ValueError):
                whole.train_original_whole_frame_fidelity(prediction[:, :, :-1], sample, geometry=g)
            sample['split'] = 'challenge'
            with self.assertRaises(ValueError):
                instance.train_original_instance_objective(prediction, sample, table, ORDER, geometry=g)
            emit('semantic_rejections', {}, stage=stage, emptyCoreFails=True,
                 invalidGeometryFails=True, wrongSplitFails=True)

    def test_owned_support_core_union_and_edge_geometry(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            for scenario in ('overlap', 'edge'):
                _, sample, table = fixture(g, scenario)
                masks = support._visible_support(sample['conditions'], table, ORDER, geometry=g)
                count = sum(v.to(torch.int8) for v in masks.values())
                self.assertFalse(bool((count > 1).any()))
                for role in support.TYPED_ROLES:
                    authoritative = sample['conditions'][ORDER.index(role)][None, None].bool()
                    self.assertTrue(bool((~authoritative | masks[role]).all()))
                emit('owned_support_'+scenario, masks, stage=stage, uniqueOwner=True,
                     authoritativeCoresPreserved=True)


if __name__ == '__main__':
    unittest.main()
