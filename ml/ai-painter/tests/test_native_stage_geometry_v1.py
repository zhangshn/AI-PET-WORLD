"""Forward-only geometry contracts; no model, checkpoint or gradient probes."""
from dataclasses import FrozenInstanceError
import unittest

import torch
from torch.nn import functional as F

from ai_painter.complete_world.native_stage_geometry_v1 import (
    NativeStageGeometry, spatial_geometry, validate_geometry,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (
    iter_object_views, iter_train_object_supervision,
)
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    TYPED_ROLES, complete_typed_support_partition,
)
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import assemble_object_features
from ai_painter.complete_world.object_ecology_decode1_entry_weight_precision_v1 import FORMAL_CONDITION_CHANNEL_ORDER

ORDER = FORMAL_CONDITION_CHANNEL_ORDER


def scene(geometry):
    q = geometry.scale
    conditions = torch.zeros(23, geometry.height, geometry.width)
    table = []
    for value, kind, role, x, y in ((1, 'tree', 'object_tree', 40, 40),
                                   (2, 'rock', 'object_rock', 100, 70),
                                   (3, 'shrub', 'object_vegetation', 160, 120)):
        for channel in (role, 'object_footprints'):
            conditions[ORDER.index(channel), y*q:(y+4)*q, x*q:(x+4)*q] = 1
        conditions[ORDER.index('object_instance'), y*q:(y+4)*q, x*q:(x+4)*q] = value / 255
        table.append(dict(value=value, kind=kind,
                          footprint=dict(x=x*4, y=y*4, width=16, height=16)))
    return conditions, table


class NativeStageGeometryTests(unittest.TestCase):
    def test_only_registered_exact_integer_stages_and_immutable_fields(self):
        for bad in (True, False, -1, 3, 0.0, '0', None):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                NativeStageGeometry(bad)
        with self.assertRaises(ValueError):
            spatial_geometry((192, 256))
        geometry = NativeStageGeometry(0)
        with self.assertRaises(FrozenInstanceError):
            geometry.stage = 1
        self.assertEqual(spatial_geometry(), (192, 256, 32))
        for stage, q in enumerate((1, 2, 4)):
            g = NativeStageGeometry(stage)
            self.assertEqual(g.identity(), (stage, 256*q, 192*q, 32*q,
                                            8*q, 4*q, 6*q, 2*q, 4.0/q, 2.0/q))
            self.assertEqual(validate_geometry(g), g)

    def test_source_centers_and_tolerance_preserve_original_integer_arithmetic(self):
        indices = torch.tensor([0, 1, 127, 255], dtype=torch.int64)
        centers = NativeStageGeometry(0).native_pixel_centers(indices)
        self.assertEqual(centers.dtype, indices.dtype)
        self.assertTrue(torch.equal(centers, indices*4+2))
        for stage in (1, 2):
            g = NativeStageGeometry(stage)
            actual = g.native_pixel_centers(torch.arange(g.width))
            self.assertEqual(float(actual[0]), g.native_half_pixel_tolerance)
            self.assertEqual(float(actual[-1]), 1024-g.native_half_pixel_tolerance)

    def test_registered_views_supervision_and_support_use_one_geometry(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            conditions, table = scene(g)
            saved = conditions.clone()
            views = validate_bound_object_views(conditions, table, ORDER, geometry=g)
            sample = dict(sampleId='synthetic', split='train', conditions=conditions,
                          image=torch.zeros(3, g.height, g.width))
            targets = list(iter_train_object_supervision(sample, table, ORDER, geometry=g))
            self.assertEqual(len(views), len(targets))
            for view, target in zip(views, targets):
                self.assertEqual(view.subject_conditions.shape, (23, g.patch_size, g.patch_size))
                self.assertEqual(target.target_rgb.shape, (3, g.patch_size, g.patch_size))
                radius = g.support_radius(view.role)
                expected = F.max_pool2d(view.subject_mask[None], radius*2+1,
                                        stride=1, padding=radius)[0] * view.valid_mask
                self.assertTrue(torch.equal(view.support_mask, expected))
                self.assertEqual(int(view.subject_mask.sum()), 16*g.scale*g.scale)
            self.assertTrue(torch.equal(conditions, saved))
            if stage == 0:
                original = list(iter_object_views(conditions, table, ORDER))
                for a, b in zip(original, views):
                    for name in ('subject_conditions', 'subject_mask', 'support_mask', 'valid_mask'):
                        self.assertTrue(torch.equal(getattr(a, name), getattr(b, name)))
                    self.assertEqual((a.top, a.left), (b.top, b.left))

    def test_stage_footprint_and_incomplete_patch_fail_closed(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            conditions, table = scene(g)
            table[0]['footprint']['x'] += 100
            with self.assertRaisesRegex(ValueError, 'escaped'):
                list(iter_object_views(conditions, table, ORDER, geometry=g))
            conditions, table = scene(g)
            with self.assertRaises(ValueError):
                list(iter_object_views(conditions[:, :-1], table, ORDER, geometry=g))

    def test_canvas_stride_duplicate_sum_and_empty_coverage_at_each_stage(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            indices = [torch.tensor([0, g.width+1, g.width+1, g.width*g.height-1])]
            features = [torch.arange(32, dtype=torch.float32).reshape(8, 4)]
            supports = [torch.ones(1, 4)]
            result, count = assemble_object_features(torch.zeros(1), indices, features,
                                                       supports, [0], geometry=g)
            self.assertEqual(result.shape, (1, 8, g.height, g.width))
            self.assertEqual(float(count[0, 0, 1, 1]), 2)
            self.assertTrue(torch.equal(result[0, :, 1, 1], features[0][:, 1:3].sum(1)/2))
            self.assertTrue(torch.equal(result[0, :, -1, -1], features[0][:, -1]))
            empty, empty_count = assemble_object_features(torch.zeros(1), [], [], [], [], geometry=g)
            self.assertEqual(int(empty.count_nonzero())+int(empty_count.count_nonzero()), 0)
            if stage == 0:
                a, b = assemble_object_features(torch.zeros(1), indices, features, supports, [0])
                self.assertTrue(torch.equal(a, result) and torch.equal(b, count))

    def test_support_exact_normalized_tie_and_union_at_each_stage(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            q = g.scale
            cores = {r: torch.zeros(1, 1, g.height, g.width) for r in TYPED_ROLES}
            coverage = {r: torch.zeros_like(v) for r, v in cores.items()}
            cores['object_tree'][0, 0, 20*q, 20*q] = 1
            cores['object_rock'][0, 0, 20*q, 26*q] = 1
            for role in TYPED_ROLES:
                coverage[role].copy_(cores[role])
            for role in ('object_tree', 'object_rock'):
                coverage[role][0, 0, 20*q, 23*q:26*q] = 1
            owners, distances = complete_typed_support_partition(cores, coverage, geometry=g)
            self.assertTrue(bool(owners['object_tree'][0, 0, 20*q, 24*q]))
            self.assertTrue(bool(owners['object_rock'][0, 0, 20*q, 25*q]))
            self.assertEqual(int(distances['object_tree'][0, 0, 20*q, 24*q]), 4*q)
            total = sum(v.to(torch.int8) for v in owners.values())
            union = sum(v.to(torch.int8) for v in coverage.values()) > 0
            self.assertTrue(torch.equal(total > 0, union))
            self.assertFalse(bool((total > 1).any()))
            coverage['object_tree'][0, 0, 100*q, 100*q] = 1
            with self.assertRaisesRegex(ValueError, 'bounded core owner'):
                complete_typed_support_partition(cores, coverage, geometry=g)


if __name__ == '__main__':
    unittest.main()
