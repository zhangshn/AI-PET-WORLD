"""Inactive draft synthetic provenance checks; no visual/model qualification."""
import unittest
import sys
from pathlib import Path
sys.path[:0]=[str(Path(__file__).absolute().parents[3]/'ml/ai-painter/src')]
import torch
from ai_painter.complete_world import terrain_ecology_conditioned_v1 as identity
from ai_painter.complete_world import terrain_ecology_joint_priority_device_v1 as bridge

torch.set_num_threads(2)

class TerrainEcologyJointPriorityTests(unittest.TestCase):
    def exercise(self,corrupt=False):
        model=identity.build_fresh_terrain_ecology_conditioned()
        critic=torch.nn.Linear(1,1).eval().requires_grad_(False)
        sample={'split':'train','image':torch.zeros(3,192,256),'conditions':torch.zeros(23,192,256)}
        parameters=tuple(model.parameters())
        scalar=sum(p.sum() for p in parameters)
        structured,whole,core,support=(scalar*coefficient for coefficient in (.25,.5,.125,.0625))
        total=((structured+whole)+core)+support
        if corrupt:
            projection=model.terrain_ecology_projection.weight.sum()
            total=total+(projection-projection.detach())*.001
        before={k:v.detach().clone() for k,v in model.state_dict().items()}
        calls=[]
        with bridge.observe_generator_gradients(lambda stage,label,rows:calls.append((stage,label))):
            result,facts=bridge.compute_generator_candidate_gradients(model=model,critic=critic,sample=sample,
                actual_total=total,structured_objective=structured,whole_frame_fidelity=whole,
                object_core_rgb=core,object_support_structure=support)
        self.assertEqual(len(result),109)
        self.assertTrue(torch.equal(result[108],torch.full((48,7),.9375)))
        self.assertEqual(facts['independentFullParameterGradientTensorCounts'],[109]*5)
        self.assertTrue(facts['additionalNonheadGradientGatePassed'])
        self.assertEqual(facts['arithmeticCarrierParameterTensorCount'],108)
        self.assertEqual(facts['parameterIdentity']['modelParameterTensorCount'],109)
        self.assertEqual([s for s,_ in calls],['attempt','complete']*5)
        self.assertTrue(all(p.grad is None for p in parameters))
        self.assertTrue(all(torch.equal(v,model.state_dict()[k]) for k,v in before.items()))

    def test_all_109_gradients_and_extra_nonhead_are_preserved(self):self.exercise()

    def test_only_extra_parameter_wrong_gradient_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'parameter 108'):self.exercise(corrupt=True)

if __name__=='__main__':unittest.main()
