import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).absolute().parents[3];sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_terrain_routing_comparison_v1 as fit

class ComparisonTests(unittest.TestCase):
 def test_two_arms_only_differ_in_explicit_backward_routing(self):
  for policy in (fit.POLICY,fit.SUCCESSOR_POLICY):
   p=json.loads((ROOT/policy).read_text(encoding='utf-8'));fit.validate_policy(p)
   for k,v in [('parentExperiment',{}),('sampleIds',['validation']),('backwardRoutingChanged',not p['backwardRoutingChanged'])]:
    with self.assertRaises(ValueError):fit.validate_policy({**p,k:v})
   for k,v in [('pairs',101),('visitsPerSample',100),('supportStructureWeight',1.0)]:
    q=copy.deepcopy(p);q['training'][k]=v
    with self.assertRaises(ValueError):fit.validate_policy(q)
 def test_schedule_and_checkpoint_counts(self):
  self.assertEqual([fit.sample_index(i) for i in range(1,101)],[0,1]*50)
  for i in (0,101,True):
   with self.assertRaises(ValueError):fit.sample_index(i)
  b={'sha256':'a'*64};v={'schema':'two-map-checkpoint-fit-state-v1','packageSha256':b['sha256'],'counts':{'generator':100,'discriminator':100},'sampleVisits':dict.fromkeys(fit.SAMPLES,50),'checkpointPromotable':False}
  fit.validate_checkpoint(v,b)
  with self.assertRaises(ValueError):fit.validate_checkpoint({**v,'counts':{'generator':200,'discriminator':200}},b)

if __name__=='__main__':unittest.main()
