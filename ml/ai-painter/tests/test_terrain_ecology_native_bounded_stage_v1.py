"""CPU construction/identity only; no renderer/operator forward or backward."""
import unittest
import torch

from ai_painter.complete_world import terrain_ecology_native_stage_v1 as parent
from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as candidate
from ai_painter.complete_world import decode1_entry_bounded_weight_vjp_v1 as bounded
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry

OBSERVATIONS = []


class NativeBoundedStageIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_all_stages109_exact_isolated_parameters_and_strict_reload(self):
        for stage in range(3):
            geometry = NativeStageGeometry(stage)
            source = parent.build_fresh_terrain_ecology_native_stage(geometry=geometry)
            with torch.no_grad():
                next(source.parameters()).add_(0.0001)
                source.terrain_ecology_projection.weight.fill_(0.0125)
            original = {k: v.detach().clone() for k, v in source.state_dict().items()}
            model = candidate.migrate_parent_parameters_for_diagnostic(source, geometry=geometry)
            candidate.validate_model_identity(model)
            self.assertEqual(len(tuple(model.parameters())), 109)
            self.assertEqual(sum(p.numel() for p in model.parameters()), 2243023)
            self.assertFalse(model.execution_qualified)
            self.assertNotEqual(model.numeric_rule, source.numeric_rule)
            self.assertEqual(model.numeric_rule.count(bounded.NUMERIC_RULE), 1)
            self.assertIs(type(model.get_submodule(candidate.BOUNDED_TARGET)), bounded.Decode1EntryBoundedWeightVjpConv)
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
                model.load_state_dict(original, strict=True)
            with self.assertRaises(ValueError):
                source.load_state_dict(state, strict=True)
            with self.assertRaises(ValueError):
                parent.validate_model_identity(model)
            self.assertTrue(all(torch.equal(v, source.state_dict()[k]) for k, v in original.items()))
            OBSERVATIONS.append(dict(stage=stage, parameterGroups=109, parameterElements=2243023,
                parentParameterBytesExact=True, isolatedStorage=True, strictReloadExact=True,
                oldIdentityRejected=True, fullModelForwards=0, fullModelBackwards=0))

    def test_direct_construction_preserves_nonzero_projection_and_all_parameters(self):
        geometry = NativeStageGeometry(0)
        source = parent.build_fresh_terrain_ecology_native_stage(geometry=geometry)
        with torch.no_grad():
            source.terrain_ecology_projection.weight.fill_(0.125)
        model = candidate.NativeBoundedStageTerrainEcologyRenderer(source, geometry)
        candidate.validate_model_identity(model)
        self.assertTrue(torch.equal(model.terrain_ecology_projection.weight, source.terrain_ecology_projection.weight))
        self.assertNotEqual(model.terrain_ecology_projection.weight.data_ptr(), source.terrain_ecology_projection.weight.data_ptr())

    def test_tampered_geometry_identity_graph_and_partial_state_rejected(self):
        model = candidate.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(0))
        state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        for kwargs in ({'strict': False}, {'assign': True}):
            with self.assertRaises(ValueError):
                model.load_state_dict(state, **kwargs)
        for name, kind in candidate.IDENTITIES:
            bad = {k: v.clone() for k, v in state.items()}
            bad[name] = candidate.identity_bytes(kind, NativeStageGeometry(1))
            with self.assertRaises(ValueError):
                model.load_state_dict(bad)
        bad = {k: v.clone() for k, v in state.items()}
        bad.pop(next(iter(bad)))
        with self.assertRaises(ValueError):
            model.load_state_dict(bad)
        model.core.core.native_stage_geometry = NativeStageGeometry(1)
        with self.assertRaises(ValueError):
            candidate.validate_model_identity(model)
        model.core.core.native_stage_geometry = model.native_stage_geometry
        container = model.get_submodule(candidate.BOUNDED_TARGET.rsplit('.', 1)[0])
        saved = container._modules['0']
        container._modules['0'] = torch.nn.Conv2d(144, 48, 3, padding=1)
        with self.assertRaises(ValueError):
            candidate.validate_model_identity(model)
        container._modules['0'] = saved
        candidate.validate_model_identity(model)

    def test_failed_install_restores_bytes_graph_storage_and_modes(self):
        model = candidate.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(0))
        original = {k: v.detach().clone() for k, v in model.state_dict().items()}
        state = {k: v.clone() for k, v in original.items()}
        state['terrain_ecology_projection.weight'].fill_(0.1)
        parameters = tuple(model.parameters())
        pointers = tuple(p.data_ptr() for p in parameters)
        def broken(module, *unused):
            module.get_submodule(candidate.BOUNDED_TARGET).weight = torch.nn.Parameter(torch.ones(48, 144, 3, 3))
            module.core.core.native_stage_geometry = NativeStageGeometry(1)
            module.eval()
            raise RuntimeError('intentional bounded stage install failure')
        handle = model.register_load_state_dict_post_hook(broken)
        with self.assertRaisesRegex(RuntimeError, 'intentional bounded stage install failure'):
            model.load_state_dict(state, strict=True)
        handle.remove()
        candidate.validate_model_identity(model)
        self.assertTrue(model.training)
        self.assertTrue(all(a is b for a, b in zip(parameters, model.parameters())))
        self.assertEqual(pointers, tuple(p.data_ptr() for p in model.parameters()))
        self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in original.items()))
        model.load_state_dict(state, strict=True)


if __name__ == '__main__':
    unittest.main()
