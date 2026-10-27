import copy,json,sys,unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).absolute().parents[3];sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_mixed_train_rehearsal_v1 as fit

class RehearsalTests(unittest.TestCase):
 def test_exact_coverage_and_anchor_counts(self):
  order=[fit.sample_index(i) for i in range(1,57)]
  self.assertEqual([i for n,i in enumerate(order) if n%7!=6],list(range(48)))
  self.assertEqual([i for n,i in enumerate(order) if n%7==6],[fit.SAMPLES.index(fit.ANCHOR)]*8)
  self.assertEqual(dict(Counter(fit.SAMPLES[fit.sample_index(i)] for i in range(1,449))),fit.expected_visits())
  for bad in (0,449,True):
   with self.assertRaises(ValueError):fit.sample_index(bad)
 def test_policy_rejects_changed_coverage_or_budget(self):
  p=json.loads((ROOT/fit.POLICY).read_bytes());fit.validate_policy(p)
  for key,value in [('sampleIds',list(reversed(p['sampleIds']))),('anchorSampleId','validation'),('parentExperiment',{})]:
   with self.assertRaises(ValueError):fit.validate_policy({**p,key:value})
  for key,value in [('pairs',449),('passes',9),('anchorVisits',71)]:
   q=copy.deepcopy(p);q['training'][key]=value
   with self.assertRaises(ValueError):fit.validate_policy(q)
 def test_final_checkpoint_cannot_hide_partial_coverage(self):
  b={'sha256':'a'*64};v={'schema':'mixed-train-rehearsal-state-v1','packageSha256':b['sha256'],'counts':{'generator':448,'discriminator':448},'sampleVisits':fit.expected_visits(),'checkpointPromotable':False};fit.validate_checkpoint(v,b)
  for patch in ({'counts':{'generator':447,'discriminator':448}},{'sampleVisits':dict.fromkeys(fit.SAMPLES,8)},{'checkpointPromotable':True}):
   with self.assertRaises(ValueError):fit.validate_checkpoint({**v,**patch},b)
 def test_comparison_requires_declared_weight_and_completed_baseline(self):
  p=json.loads((ROOT/fit.SUCCESSOR_POLICY).read_bytes());fit.validate_policy(p)
  for patch in ({'lossChanged':False},{'equalBudgetBaseline':{}},{'arm':'unregistered'}):
   with self.assertRaises(ValueError):fit.validate_policy({**p,**patch})
  q=copy.deepcopy(p);q['training']['supportStructureWeight']=0.1
  with self.assertRaises(ValueError):fit.validate_policy(q)
  with self.assertRaises(ValueError):fit.prepare(fit.POLICY)

 def test_stem_policies_keep_comparison_and_reject_consumed_routes(self):
  for arm,path in fit.STEM_POLICIES.items():
   p=json.loads((ROOT/path).read_bytes());fit.validate_policy(p)
   for patch in ({'numericOperatorsChanged':False},{'modelCapability':'old'},{'parameterMigration':'silent'},{'gradientThresholdChanged':True}):
    with self.assertRaises(ValueError):fit.validate_policy({**p,**patch})
  with self.assertRaises(ValueError):fit.prepare(fit.SUCCESSOR_POLICY)

 def test_pair_policies_reject_wrong_identity_and_retired_stem_routes(self):
  for arm in fit.STEM_PAIR_POLICIES:
   p=json.loads((ROOT/fit.STEM_POLICIES['stem-baseline']).read_bytes())
   p.update(arm=arm,lossChanged=arm.endswith('support1'),modelCapability='stage4_mvp256_dry_factorized_ecology_stem_pair_weight_precision_v1',parameterMigration='exact_original_D1_parameters_new_stem_pair_identity_buffers',comparisonScope='two_new_stem_pair_precision_arms_only_support_coefficient_differs')
   p['training']['supportStructureWeight']=1. if arm.endswith('support1') else .1
   fit.validate_policy(p)
   for patch in ({'modelCapability':'old'},{'parameterMigration':'implicit'},{'comparisonScope':'different'},{'numericOperatorsChanged':False}):
    with self.assertRaises(ValueError):fit.validate_policy({**p,**patch})
  for policy in fit.STEM_POLICIES.values():
   with self.assertRaises(ValueError):fit.prepare(policy)

 def test_decoder_numeric_identity_and_consumed_pair_routes(self):
  for arm in fit.STEM_DECODER_POLICIES:
   p=json.loads((ROOT/fit.STEM_POLICIES['stem-baseline']).read_bytes())
   p.update(arm=arm,lossChanged=arm.endswith('support1'),modelCapability='stage4_mvp256_dry_factorized_ecology_stem_pair_decode2_inner_weight_precision_v1',parameterMigration='exact_original_D1_parameters_new_stem_decoder_identity_buffers',comparisonScope='two_new_stem_decoder_precision_arms_only_support_coefficient_differs')
   p['training']['supportStructureWeight']=1. if arm.endswith('support1') else .1
   fit.validate_policy(p)
   for patch in ({'modelCapability':'old'},{'parameterMigration':'implicit'},{'numericOperatorsChanged':False}):
    with self.assertRaises(ValueError):fit.validate_policy({**p,**patch})
  for policy in fit.STEM_PAIR_POLICIES.values():
   with self.assertRaises(ValueError):fit.prepare(policy)

 def test_terrain_ecology_requires_explicit_new_identity_and_same_budget(self):
  p=json.loads((ROOT/fit.STEM_POLICIES['stem-baseline']).read_bytes())
  p.update(arm='terrain-ecology',modelArchitectureChanged=True,terrainEcologyConditionAdded=True,
   modelCapability='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1',
   parameterMigration='exact_original_D1_parameters_plus_zero_48x7_terrain_ecology_new_identity',
   comparisonScope='terrain_ecology_addition_against_completed_stem_decoder_baseline')
  fit.validate_policy(p)
  for patch in ({'modelArchitectureChanged':False},{'terrainEcologyConditionAdded':False},{'modelCapability':'old'},
   {'parameterMigration':'silent'},{'comparisonScope':'other'},{'numericOperatorsChanged':False},{'gradientThresholdChanged':True}):
   with self.assertRaises(ValueError):fit.validate_policy({**p,**patch})
  for policy in fit.STEM_DECODER_POLICIES.values():
   with self.assertRaises(ValueError):fit.prepare(policy)

if __name__=='__main__':unittest.main()
