"""Inactive draft identity and rollback tests, not executed yet."""
import unittest
import sys
from pathlib import Path
sys.path[:0]=[str(Path(__file__).absolute().parents[3]/'ml/ai-painter/src')]
import torch
from ai_painter.complete_world import terrain_ecology_conditioned_v1 as candidate
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as old

torch.set_num_threads(2)

class TerrainEcologyModelIdentityTests(unittest.TestCase):
    def test_migration_retains_all_original_parameters_and_adds_only_zero_projection(self):
        source=old.build_fresh_object_ecology_decode1_entry_weight_precision()
        with torch.no_grad():next(source.parameters()).add_(.0001)
        before={k:v.detach().clone() for k,v in source.state_dict().items()}
        model=candidate.migrate_original_d1_parameters_to_terrain_ecology(source)
        named=tuple(model.named_parameters());self.assertEqual(len(named),109)
        self.assertEqual(sum(p.numel() for _,p in named),2243023)
        for (n,p),(m,q) in zip(source.named_parameters(),named[:108]):
            self.assertEqual(n,m);self.assertTrue(torch.equal(p,q));self.assertIsNot(p,q)
        self.assertEqual(named[108][0],candidate.PROJECTION_PARAMETER)
        self.assertEqual(int(named[108][1].count_nonzero()),0)
        self.assertTrue(all(torch.equal(v,source.state_dict()[k]) for k,v in before.items()))
        with self.assertRaises(ValueError):source.load_state_dict(model.state_dict(),strict=True)
        with self.assertRaises(ValueError):model.load_state_dict(source.state_dict(),strict=True)

    def test_failed_hook_restores_original_storage_state_and_graph(self):
        model=candidate.build_fresh_terrain_ecology_conditioned()
        original={k:v.detach().clone() for k,v in model.state_dict().items()}
        state={k:v.clone() for k,v in original.items()};state[candidate.PROJECTION_PARAMETER].fill_(.1)
        parameters=tuple(model.parameters());pointers=[p.data_ptr() for p in parameters]
        def broken(module,*unused):
            module.terrain_ecology_projection.weight=torch.nn.Parameter(torch.ones((48,7)))
            raise RuntimeError('intentional load failure')
        handle=model.register_load_state_dict_post_hook(broken)
        with self.assertRaisesRegex(RuntimeError,'intentional load failure'):model.load_state_dict(state,strict=True)
        handle.remove();candidate.validate_model_identity(model)
        self.assertTrue(all(a is b for a,b in zip(model.parameters(),parameters)))
        self.assertEqual([p.data_ptr() for p in model.parameters()],pointers)
        self.assertTrue(all(torch.equal(v,model.state_dict()[k]) for k,v in original.items()))
        model.load_state_dict(state,strict=True)
        self.assertTrue(torch.equal(model.terrain_ecology_projection.weight,state[candidate.PROJECTION_PARAMETER]))

if __name__=='__main__':unittest.main()
