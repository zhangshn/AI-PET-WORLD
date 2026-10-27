import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import Mock
ROOT=Path(__file__).absolute().parents[3];sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
import painter_single149_terrain_ecology_fit_v1 as fit
class Single149Tests(unittest.TestCase):
 def setUp(self):self.p=json.loads((ROOT/fit.POLICY).read_text(encoding='utf8'))
 def test_exact_bounded_policy(self):fit.validate_policy(self.p)
 def test_consumed_v1_and_unbound_repair_are_rejected(self):
  old=json.loads((ROOT/'data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v1.json').read_text(encoding='utf8'))
  with self.assertRaises(ValueError):fit.validate_policy(old)
  p=copy.deepcopy(self.p);p['sourceClosureProof']['sha256']='0'*64
  with self.assertRaises(ValueError):fit.validate_policy(p)
 def test_late_dependencies_are_declared_before_import(self):
  import importlib
  fit.imports()
  before={b['path'] for b in fit.project_sources()}
  importlib.import_module('painter_stage4_support_terrain_gradient_training_profile_v1')
  after={b['path'] for b in fit.project_sources()}
  self.assertTrue(set(fit.LATE_SOURCES)<=before);self.assertEqual(after-before,set())
 def test_scope_expansion_or_cross_parent_rejected(self):
  changes=[('sampleId','validation'),('modelCapability','old'),('initialization','random'),('zeroUpdateAdmission','inherited')]
  for key,value in changes:
   p=copy.deepcopy(self.p);p[key]=value
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_policy(p)
  for field,key,value in [('training','pairs',201),('training','supportStructureWeight',1.0),('resources','maxWallSeconds',3600),('resources','automaticRetries',1),('parentExperiment','checkpoint',{'path':'foreign','sha256':'0'*64}),('diagnostics','headFit',{'path':'missing','sha256':'0'*64})]:
   p=copy.deepcopy(self.p);p[field][key]=value
   with self.subTest(field=field,key=key),self.assertRaises(ValueError):fit.validate_policy(p)
 def test_no_publication_or_source_mutation(self):
  for key in ('modelArchitectureChanged','lossChanged','gradientThresholdChanged','sourceImagesOrConditionsChanged','validationContentAllowed','checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','parentExecutionPermissionInherited'):
   p=copy.deepcopy(self.p);p[key]=True
   with self.subTest(key=key),self.assertRaises(ValueError):fit.validate_policy(p)
 def test_profile_factory_is_explicit_without_changing_shared_module(self):
  background=Mock();background.fresh_networks.return_value=('model','critic');profile=fit.BoundProfile(background)
  self.assertEqual(profile.fresh_networks(['channels']),('model','critic'));background.fresh_networks.assert_called_once_with(['channels'],model_capability=fit.CAPABILITY)
  self.assertIs(profile.perform_pair,background.perform_pair)
 def test_parent_cannot_be_partial_or_wrong_scope(self):
  pkg={'experimentIdentity':fit.PARENT_RUN,'modelCapability':fit.CAPABILITY,'arm':'terrain-ecology','selectedSampleIds':[fit.SAMPLE]}
  terminal={'runId':fit.PARENT_RUN,'executionState':'completed','result':fit.PARENT['result']}
  result={'experimentIdentity':fit.PARENT_RUN,'status':'experiment_executed_not_visual_qualified','optimizerSteps':{'generator':448,'discriminator':448},'checkpointReloadExact':True,'artifacts':[fit.PARENT['checkpoint'],fit.PARENT['prediction']],'sampleVisits':{fit.SAMPLE:8}}
  fit.validate_parent(pkg,terminal,result)
  for patch in ({'checkpointReloadExact':False},{'optimizerSteps':{'generator':447,'discriminator':448}},{'artifacts':[]},{'sampleVisits':{fit.SAMPLE:9}}):
   with self.assertRaises(ValueError):fit.validate_parent(pkg,terminal,{**result,**patch})
  with self.assertRaises(ValueError):fit.validate_parent(pkg,{**terminal,'executionState':'failed_closed'},result)
if __name__=='__main__':unittest.main()
