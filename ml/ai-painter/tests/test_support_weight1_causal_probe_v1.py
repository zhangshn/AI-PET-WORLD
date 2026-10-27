import json,sys,unittest
from pathlib import Path
import torch
ROOT=Path(__file__).absolute().parents[3];sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_support_weight1_causal_probe_v1 as probe
torch.set_num_threads(2)
class CausalProbeTests(unittest.TestCase):
 def test_fixed_scope_rejects_training_and_extra_calls(self):
  p=json.loads((ROOT/probe.POLICY).read_bytes());probe.validate_policy(p)
  for patch in ({'trainingAllowed':True},{'counts':{**p['counts'],'generatorForwards':2}},{'coordinate':[0,0,0,0]},{'resources':{**p['resources'],'maxWallSeconds':181}}):
   with self.assertRaises(ValueError):probe.validate_policy({**p,**patch})
 def test_local_vjp_separates_native_error_from_upstream_for_known_constant_planes(self):
  x=torch.zeros(1,31,192,256);x[:,11]=1
  adjoints=[];raw=[]
  for value in (10,1,2,3,4):
   a=torch.zeros(1,48,192,256);a[:,13]=value;adjoints.append(a)
   g=torch.zeros(48,31,3,3);g[13,11,0,0]=value*191*255;raw.append(g)
  raw[0][13,11,0,0]+=1
  result=probe.local_reference(x,adjoints,raw,[13,11,0,0])
  self.assertEqual(result['fp64LocalWeightVjp'],[v*191*255 for v in (10,1,2,3,4)])
  self.assertEqual(result['localTotalMinusComponentSumFp64'],0)
  self.assertEqual(result['localReductionContribution'],1)
 def test_target44_fixed_geometry_and_coordinate(self):
  p=json.loads((ROOT/probe.TARGET44_POLICY).read_bytes());probe.validate_policy(p)
  with self.assertRaises(ValueError):probe.validate_policy({**p,'coordinate':[13,11,0,0]})
  with self.assertRaises(ValueError):probe.validate_policy({**p,'targetIndex':45})
  x=torch.ones(1,96,96,128);adjoints=[torch.full((1,96,96,128),float(v)) for v in (10,1,2,3,4)]
  raw=[torch.zeros(96,96,3,3) for _ in range(5)]
  for g,v in zip(raw,(10,1,2,3,4)):g[52,0,0,0]=v*95*127
  r=probe.local_reference(x,adjoints,raw,[52,0,0,0],44)
  self.assertEqual(r['fp64LocalWeightVjp'],[v*95*127 for v in (10,1,2,3,4)])
  self.assertEqual(r['localReductionContribution'],0)

if __name__=='__main__':unittest.main()
