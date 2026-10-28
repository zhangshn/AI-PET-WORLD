"""CPU identity and projection tests; no full renderer or backward calls."""
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world import terrain_ecology_native_stage_v1 as candidate
from ai_painter.complete_world import terrain_ecology_conditioned_v1 as parent
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.terrain_ecology_projection_v1 import (
    TerrainEcologyProjection, NativeStageTerrainEcologyProjection,
)


class TerrainEcologyNativeStageTests(unittest.TestCase):
    def test_projection_original_arithmetic_and_native_shape(self):
        original = TerrainEcologyProjection()
        with torch.no_grad():
            original.weight.copy_(torch.arange(48*7).reshape(48, 7).float()/1000)
            for stage in range(3):
                g = NativeStageGeometry(stage)
                module = NativeStageTerrainEcologyProjection(g)
                module.weight.copy_(original.weight)
                for ecology in (0, 6):
                    code = torch.zeros(7)
                    code[ecology] = 1
                    actual = module(code)
                    expected = (original.weight @ code).reshape(1, 48, 1, 1).expand(
                        1, 48, g.height, g.width)
                    self.assertTrue(torch.equal(actual, expected))
                    if stage == 0:
                        self.assertTrue(torch.equal(actual, original(code)))
                for bad in (torch.zeros(7), torch.ones(7), code.double()):
                    with self.assertRaises(ValueError):
                        module(bad)

    def test_isolated_exact109_migration_and_strict_full_reload_all_stages(self):
        with patch.object(torch, 'load', side_effect=AssertionError('checkpoint prohibited in unit tests')):
            source = parent.build_fresh_terrain_ecology_conditioned()
            with torch.no_grad():
                source.terrain_ecology_projection.weight.fill_(0.0125)
                next(source.parameters()).add_(0.0001)
            original = {k: v.detach().clone() for k, v in source.state_dict().items()}
            for stage in range(3):
                model = candidate.migrate_parent_parameters_for_diagnostic(
                    source, geometry=NativeStageGeometry(stage))
                self.assertEqual(len(tuple(model.parameters())), 109)
                self.assertEqual(sum(p.numel() for p in model.parameters()), 2243023)
                self.assertFalse(model.execution_qualified)
                self.assertFalse(model.parent_checkpoint_loaded)
                self.assertEqual(model.numeric_rule, source.numeric_rule)
                for (n, p), (m, q) in zip(source.named_parameters(), model.named_parameters()):
                    self.assertEqual(n, m)
                    self.assertTrue(torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8)))
                    self.assertNotEqual(p.data_ptr(), q.data_ptr())
                state = {k: v.detach().clone() for k, v in model.state_dict().items()}
                parameters = tuple(model.parameters())
                pointers = tuple(p.data_ptr() for p in parameters)
                model.load_state_dict(state, strict=True)
                self.assertTrue(all(a is b for a, b in zip(parameters, model.parameters())))
                self.assertEqual(pointers, tuple(p.data_ptr() for p in model.parameters()))
                self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in state.items()))
                with self.assertRaises(ValueError):
                    parent.validate_model_identity(model)
                with self.assertRaises(ValueError):
                    model.load_state_dict(original, strict=True)
                with self.assertRaises(ValueError):
                    source.load_state_dict(state, strict=True)
            self.assertTrue(all(torch.equal(v, source.state_dict()[k]) for k, v in original.items()))

    def test_geometry_buffer_module_alias_and_strictness_tampering_rejects(self):
        model = candidate.build_fresh_terrain_ecology_native_stage(geometry=NativeStageGeometry(0))
        state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        for kwargs in ({'strict': False}, {'assign': True}):
            with self.assertRaises(ValueError):
                model.load_state_dict(state, **kwargs)
        for kind in ('regime_identity', 'numeric_identity', 'ecology_identity'):
            bad = {k: v.clone() for k, v in state.items()}
            bad[kind][0] ^= 1
            with self.assertRaisesRegex(ValueError, 'identity rejected'):
                model.load_state_dict(bad)
        stage1 = {k: v.clone() for k, v in state.items()}
        for name, kind in candidate.IDENTITIES:
            stage1[name] = candidate.identity_bytes(kind, NativeStageGeometry(1))
        with self.assertRaisesRegex(ValueError, 'identity rejected'):
            model.load_state_dict(stage1)
        consumer = model.get_submodule('core.core.appearance.base')
        consumer.native_stage_geometry = NativeStageGeometry(1)
        with self.assertRaisesRegex(ValueError, 'geometry consumers'):
            candidate.validate_model_identity(model)
        consumer.native_stage_geometry = model.native_stage_geometry
        model.native_stage_geometry = NativeStageGeometry(1)
        with self.assertRaises(ValueError):
            candidate.validate_model_identity(model)
        model.native_stage_geometry = NativeStageGeometry(0)
        candidate.validate_model_identity(model)
        bad = {k: v.clone() for k, v in state.items()}
        bad[parent.PROJECTION_PARAMETER][0, 0] = float('nan')
        with self.assertRaises(ValueError):
            model.load_state_dict(bad)
        self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in state.items()))

    def test_failed_install_restores_parameters_storage_modes_and_geometry(self):
        model = candidate.build_fresh_terrain_ecology_native_stage(geometry=NativeStageGeometry(0))
        original = {k: v.detach().clone() for k, v in model.state_dict().items()}
        state = {k: v.clone() for k, v in original.items()}
        state[parent.PROJECTION_PARAMETER].fill_(0.1)
        parameters = tuple(model.parameters())
        pointers = tuple(p.data_ptr() for p in parameters)
        def broken(module, *unused):
            module.terrain_ecology_projection.weight = torch.nn.Parameter(torch.ones(48, 7))
            module.core.core.native_stage_geometry = NativeStageGeometry(1)
            module.eval()
            raise RuntimeError('intentional native stage load failure')
        handle = model.register_load_state_dict_post_hook(broken)
        with self.assertRaisesRegex(RuntimeError, 'intentional native stage load failure'):
            model.load_state_dict(state, strict=True)
        handle.remove()
        candidate.validate_model_identity(model)
        self.assertTrue(model.training)
        self.assertTrue(all(a is b for a, b in zip(parameters, model.parameters())))
        self.assertEqual(pointers, tuple(p.data_ptr() for p in model.parameters()))
        self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in original.items()))
        model.load_state_dict(state, strict=True)
        self.assertTrue(torch.equal(model.terrain_ecology_projection.weight, state[parent.PROJECTION_PARAMETER]))


if __name__ == '__main__':
    unittest.main()
