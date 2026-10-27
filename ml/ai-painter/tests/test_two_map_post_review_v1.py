import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).absolute().parents[1]/'scripts'))
from painter_two_map_post_review_v1 import validate_controller_lease

class ReviewLeaseTests(unittest.TestCase):
 def test_actual_controller_and_exact_venv_redirector_are_accepted(self):
  lease={'reviewId':'review','controllerPid':10,'launcherPid':11,'controllerStartIdentity':'10:created','registryRevision':42}
  registry={'runId':'review','registryRevision':42,'activeExecution':{'processId':10,'processStartIdentity':'10:created'}}
  for parent in (10,11):validate_controller_lease(lease,registry,'review',parent)
  for parent in (0,12,99):
   with self.assertRaises(AssertionError):validate_controller_lease(lease,registry,'review',parent)
 def test_pid_reuse_revision_and_review_mismatch_fail(self):
  lease={'reviewId':'review','controllerPid':10,'launcherPid':11,'controllerStartIdentity':'10:created','registryRevision':42}
  original={'runId':'review','registryRevision':42,'activeExecution':{'processId':10,'processStartIdentity':'10:created'}}
  for field,value in [('runId','other'),('registryRevision',43),('activeExecution',{'processId':10,'processStartIdentity':'10:reused'}),('activeExecution',{'processId':12,'processStartIdentity':'10:created'})]:
   registry=copy.deepcopy(original);registry[field]=value
   with self.assertRaises(AssertionError):validate_controller_lease(lease,registry,'review',11)

class CheckpointSourceTests(unittest.TestCase):
 def test_single149_source_cannot_substitute_sample_model_or_partial_counts(self):
  from painter_two_map_post_review_v1 import validate_checkpoint_source
  pkg={'trainingSourceKind':'single149-fit','sourcePackage':{'sha256':'a'*64}}
  source={'schemaVersion':'single-map-checkpoint-fit-package-v1','training':{'pairs':200},'selectedSampleId':'ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3','modelCapability':'stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1','policy':{'path':'data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v2.json'}}
  value={'schema':'single-map-checkpoint-fit-state-v1','packageSha256':'a'*64,'counts':{'generator':200,'discriminator':200},'checkpointPromotable':False}
  validate_checkpoint_source(value,pkg,source,{})
  for patch in ({'selectedSampleId':'another'},{'modelCapability':'old'},{'policy':{'path':'old'}}):
   with self.assertRaises(AssertionError):validate_checkpoint_source(value,pkg,{**source,**patch},{})
  for patch in ({'schema':'mixed-train-rehearsal-state-v1'},{'counts':{'generator':199,'discriminator':200}},{'packageSha256':'b'*64}):
   with self.assertRaises(AssertionError):validate_checkpoint_source({**value,**patch},pkg,source,{})
 def test_mixed_source_rejects_cross_run_partial_and_false_coverage(self):
  from painter_two_map_post_review_v1 import validate_checkpoint_source
  import copy
  ids=['mvp64-slot164-objects-v5-20261020']+[f'train-{i}' for i in range(47)]
  visits={sid:72 if i==0 else 8 for i,sid in enumerate(ids)}
  pkg={'trainingSourceKind':'mixed-train','sourcePackage':{'sha256':'a'*64}}
  source={'schemaVersion':'mixed-train-rehearsal-package-v1','training':{'pairs':448},'selectedSampleIds':ids}
  value={'schema':'mixed-train-rehearsal-state-v1','packageSha256':'a'*64,'counts':{'generator':448,'discriminator':448},'checkpointPromotable':False,'sampleVisits':visits}
  result={'sampleVisits':visits};validate_checkpoint_source(value,pkg,source,result)
  for patch in ({'packageSha256':'b'*64},{'counts':{'generator':447,'discriminator':448}},{'checkpointPromotable':True},{'sampleVisits':dict.fromkeys(ids,8)},{'schema':'two-map-checkpoint-fit-state-v1'}):
   with self.assertRaises(AssertionError):validate_checkpoint_source({**value,**patch},pkg,source,result)
  with self.assertRaises(AssertionError):validate_checkpoint_source(value,{**pkg,'trainingSourceKind':'unknown'},source,result)

if __name__=='__main__':unittest.main()
