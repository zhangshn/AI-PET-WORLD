import sys,json,copy,unittest
from pathlib import Path
ROOT=Path(__file__).absolute().parents[3]
sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_single_map_checkpoint_fit_v1 as fit
from test_training_observation_recorder_v1 import ObservationRecorderTests
class BoundaryTests(unittest.TestCase):
 def setUp(self):self.p=json.loads((ROOT/fit.POLICY).read_text(encoding='utf-8'))
 def test_fixed_policy(self):fit.validate_policy(self.p)
 def test_successor_policy(self):
  p=json.loads((ROOT/fit.SUCCESSOR_POLICY).read_text(encoding='utf-8'));fit.validate_policy(p)
  p['parentExperiment']['checkpoint']['sha256']='0'*64
  with self.assertRaises(ValueError):fit.validate_policy(p)
 def test_parent_must_be_completed_same_sample_and_bound(self):
  pkg={'experimentIdentity':fit.PARENT_RUN,'selectedSampleId':self.p['sampleId'],'policy':{'path':fit.POLICY}}
  terminal={'experimentIdentity':fit.PARENT_RUN,'executionState':'completed','result':fit.PARENT['result']}
  result={'experimentIdentity':fit.PARENT_RUN,'status':'experiment_executed_not_visual_qualified','checkpointReloadExact':True,'optimizerSteps':{'generator':200,'discriminator':200},'artifacts':[fit.PARENT['checkpoint'],fit.PARENT['prediction']]}
  fit.validate_parent(pkg,terminal,result,self.p['sampleId'])
  for key,value in [('status','experiment_failed_closed'),('checkpointReloadExact',False),('optimizerSteps',{'generator':199,'discriminator':200}),('artifacts',[])]:
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_parent(pkg,terminal,{**result,key:value},self.p['sampleId'])
  with self.assertRaises(ValueError):fit.validate_parent(pkg,{**terminal,'executionState':'failed_closed'},result,self.p['sampleId'])
  with self.assertRaises(ValueError):fit.validate_parent(pkg,terminal,result,'another_sample')
 def test_reject_other_sample(self):
  self.p['sampleId']='validation-map'
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_reject_wrong_checkpoint(self):
  self.p['checkpointSha256']='0'*64
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_reject_extended_steps(self):
  self.p['training']['pairs']=201
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_reject_loss_change(self):
  self.p['training']['supportStructureWeight']=1.0
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_reject_resource_expansion(self):
  self.p['resources']['maxWallSeconds']=3600
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_reject_qualification_or_resume(self):
  for field in ('checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','validationContentAllowed','gradientThresholdChanged'):
   p=copy.deepcopy(self.p);p[field]=True
   with self.subTest(field=field),self.assertRaises(ValueError):fit.validate_policy(p)
 def test_reject_initialization_change(self):
  self.p['initialization']='random'
  with self.assertRaises(ValueError):fit.validate_policy(self.p)
 def test_checkpoint_bound(self):
  b={'sha256':'a'*64};v={'schema':'single-map-checkpoint-fit-state-v1','packageSha256':b['sha256'],'counts':{'generator':200,'discriminator':200},'checkpointPromotable':False}
  fit.validate_saved_checkpoint(v,b)
  for key,value in [('packageSha256','b'*64),('counts',{'generator':199,'discriminator':200}),('checkpointPromotable',True)]:
   changed={**v,key:value}
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_saved_checkpoint(changed,b)
if __name__=='__main__':unittest.main()
