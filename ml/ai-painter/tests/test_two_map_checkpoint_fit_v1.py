import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).absolute().parents[3]
sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_two_map_checkpoint_fit_v1 as fit

class TwoMapBoundaryTests(unittest.TestCase):
 def setUp(self):self.policy=json.loads((ROOT/fit.POLICY).read_text(encoding='utf-8'))
 def test_policy(self):fit.validate_policy(self.policy)
 def test_successor_binds_zero_update_resource_failure(self):
  p=json.loads((ROOT/fit.SUCCESSOR_POLICY).read_text(encoding='utf-8'));fit.validate_policy(p)
  p['predecessorAttempt']['sha256']='0'*64
  with self.assertRaises(ValueError):fit.validate_policy(p)
  value={'runId':'two-map149-164-v1-228ffd2bbc86d1ec26af','executionState':'failed_closed','errorCode':'GPU resource boundary','trainingStarted':False,'actualFinalOptimizerSteps':{'generator':0,'discriminator':0}}
  fit.validate_predecessor(value)
  for key,bad in [('executionState','completed'),('errorCode','gradient mismatch'),('trainingStarted',True),('actualFinalOptimizerSteps',{'generator':1,'discriminator':0})]:
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_predecessor({**value,key:bad})
 def test_exact_selection_and_parent(self):
  for key,value in [('sampleIds',[fit.SAMPLES[0]]*2),('sampleIds',['validation-map',fit.SAMPLES[1]]),('parentExperiment',{})]:
   p=copy.deepcopy(self.policy);p[key]=value
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_policy(p)
 def test_balanced_schedule(self):
  order=[fit.sample_index(i) for i in range(1,201)]
  self.assertEqual(order,[0,1]*100)
  for bad in (0,201,True,1.0):
   with self.subTest(bad=bad),self.assertRaises(ValueError):fit.sample_index(bad)
 def test_no_budget_loss_or_qualification_expansion(self):
  for group,key,value in [('training','pairs',201),('training','visitsPerSample',200),('training','supportStructureWeight',1.0),('resources','maxWallSeconds',3600),('assessment','alignmentConcernsResolved',True)]:
   p=copy.deepcopy(self.policy);p[group][key]=value
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_policy(p)
  for key in ('validationContentAllowed','checkpointPromotable','automaticResumeAllowed','parentExecutionPermissionInherited'):
   p=copy.deepcopy(self.policy);p[key]=True
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_policy(p)
 def parent_fixture(self):
  pkg={'experimentIdentity':fit.PARENT_RUN,'selectedSampleId':fit.SAMPLES[1],'policy':{'path':fit.common.SUCCESSOR_POLICY}}
  terminal={'experimentIdentity':fit.PARENT_RUN,'executionState':'completed','result':fit.PARENT['result']}
  result={'experimentIdentity':fit.PARENT_RUN,'status':'experiment_executed_not_visual_qualified','checkpointReloadExact':True,'optimizerSteps':{'generator':200,'discriminator':200},'artifacts':[fit.PARENT['checkpoint'],fit.PARENT['prediction']]}
  return pkg,terminal,result
 def test_parent_success_and_artifact_binding(self):
  pkg,t,r=self.parent_fixture();fit.validate_parent(pkg,t,r)
  for key,value in [('status','experiment_failed_closed'),('checkpointReloadExact',False),('artifacts',[]),('optimizerSteps',{'generator':199,'discriminator':200})]:
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_parent(pkg,t,{**r,key:value})
  with self.assertRaises(ValueError):fit.validate_parent(pkg,{**t,'executionState':'failed_closed'},r)
 def test_final_checkpoint_includes_both_visit_counts(self):
  bound={'sha256':'a'*64};value={'schema':'two-map-checkpoint-fit-state-v1','packageSha256':bound['sha256'],'counts':{'generator':200,'discriminator':200},'sampleVisits':dict.fromkeys(fit.SAMPLES,100),'checkpointPromotable':False}
  fit.validate_checkpoint(value,bound)
  for key,bad in [('packageSha256','b'*64),('sampleVisits',{fit.SAMPLES[0]:200,fit.SAMPLES[1]:0}),('counts',{'generator':199,'discriminator':200}),('checkpointPromotable',True)]:
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_checkpoint({**value,key:bad},bound)

if __name__=='__main__':unittest.main()
