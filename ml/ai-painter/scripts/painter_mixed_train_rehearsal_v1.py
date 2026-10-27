"""Original 48-train rehearsal with declared anchor repetition; registered controller only."""
import argparse, hashlib, io, json, os, random, subprocess, time
from pathlib import Path
import painter_single_map_checkpoint_fit_v1 as common
from training_observation_recorder_v1 import ObservationRecorder, descriptor, start_clock, finish_clock, IMAGE_SCOPE

ROOT=common.ROOT
POLICY='data/ai-painter/system-governance/ai-painter-mixed-train-rehearsal-policy-v1.json'
SUCCESSOR_POLICY='data/ai-painter/system-governance/ai-painter-mixed-train-support-weight1-policy-v1.json'
STEM_POLICIES={
 'stem-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-baseline-policy-v1.json',
 'stem-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-support1-policy-v1.json'}
STEM_PAIR_POLICIES={
 'stem-pair-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-pair-support1-policy-v1.json',
 'stem-pair-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-pair-baseline-policy-v1.json'}
STEM_DECODER_POLICIES={
 'stem-decoder-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-decoder-support1-policy-v1.json',
 'stem-decoder-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-decoder-baseline-policy-v1.json'}
SELF='ml/ai-painter/scripts/painter_mixed_train_rehearsal_v1.py'
TERRAIN_ECOLOGY_POLICY='data/ai-painter/system-governance/ai-painter-mixed-train-terrain-ecology-policy-v1.json'
TEST='ml/ai-painter/tests/test_mixed_train_rehearsal_v1.py'
SAMPLES=['ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3', 'ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v4', 'ai-cold-start-v7-v7-capacity-slot-148-grassland-forest-transition-v3', 'ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3', 'ai-cold-start-v7-v7-capacity-slot-150-tropical-forest-glade-v3', 'ai-cold-start-v7-v7-capacity-slot-151-tropical-forest-glade-v2', 'ai-cold-start-v7-v7-capacity-slot-152-tropical-forest-glade-v2', 'ai-cold-start-v7-v7-capacity-slot-153-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2', 'ai-cold-start-v7-v7-capacity-slot-155-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-156-seasonal-evergreen-semi-evergreen-forest-v2', 'ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-158-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-159-dry-dipterocarp-woodland-v2', 'ai-cold-start-v7-v7-capacity-slot-160-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-161-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-162-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2', 'mvp64-slot164-objects-v5-20261020', 'ai-cold-start-v7-v7-capacity-slot-165-seasonal-evergreen-semi-evergreen-forest-v2', 'ai-cold-start-v7-v7-capacity-slot-166-seasonal-evergreen-semi-evergreen-forest-v2', 'ai-cold-start-v7-v7-capacity-slot-167-tropical-forest-glade-v2', 'ai-cold-start-v7-v7-capacity-slot-168-dry-dipterocarp-woodland-v3', 'ai-cold-start-v7-v7-capacity-slot-169-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-170-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-171-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-172-seasonal-evergreen-semi-evergreen-forest-v2', 'ai-cold-start-v7-v7-capacity-slot-173-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-175-dry-dipterocarp-woodland-v2', 'ai-cold-start-v7-v7-capacity-slot-176-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-177-dry-dipterocarp-woodland-v2', 'ai-cold-start-v7-v7-capacity-slot-178-forested-low-mountain-v3', 'ai-cold-start-v7-v7-capacity-slot-179-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-180-seasonal-evergreen-semi-evergreen-forest-v2', 'ai-cold-start-v7-v7-capacity-slot-181-dry-dipterocarp-woodland-v2', 'ai-cold-start-v7-v7-capacity-slot-182-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-183-bamboo-grove-v2', 'ai-cold-start-v7-v7-capacity-slot-184-seasonal-evergreen-semi-evergreen-forest-v3', 'ai-cold-start-v7-v7-capacity-slot-185-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-186-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-187-grassland-forest-transition-v2', 'ai-cold-start-v7-v7-capacity-slot-188-grassland-forest-transition-v3', 'ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7', 'ai-cold-start-v7-v7-capacity-slot-191-forested-low-mountain-v2', 'ai-cold-start-v7-v7-capacity-slot-192-forested-low-mountain-v3', 'ai-cold-start-v7-v7-capacity-slot-193-tropical-forest-glade-v2', 'ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6']
OBSERVED=['ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3', 'mvp64-slot164-objects-v5-20261020']
ANCHOR='mvp64-slot164-objects-v5-20261020'
PARENT_RUN='rock-background-v2-66deba97930c3e7e9781'
PARENT={'package': {'path': '.runtime/ai-painter/learning-capacity-experiments/rock-background-v2-66deba97930c3e7e9781/package.json', 'sha256': 'c02f4cf57d8330bff1d9aacf0cfe52d1f0ae2c06b78127e8958748101495bccb'}, 'terminal': {'path': '.runtime/ai-painter/learning-capacity-experiments/rock-background-v2-66deba97930c3e7e9781/terminal.json', 'sha256': '76235a09016faf42a8ead165c583a4f0d55643035b4cd0be59488148dac987bc'}, 'result': {'path': '.runtime/ai-painter/learning-capacity-experiments/rock-background-v2-66deba97930c3e7e9781/result.json', 'sha256': '9b7ea3d0653c262c897d81289ec8ce7375f3c1fe1cc3211a1abd46c73428c61b'}, 'checkpoint': {'path': '.runtime/ai-painter/learning-capacity-experiments/rock-background-v2-66deba97930c3e7e9781/checkpoint-final.pt', 'sha256': '5ae5dcaa7ad1611f12fb6f55342f1a1465b2a638d8ea36ed7988310cecda3eb9'}, 'prediction': {'path': '.runtime/ai-painter/learning-capacity-experiments/rock-background-v2-66deba97930c3e7e9781/prediction-164-100.png', 'sha256': '38bf6e799c999ccadcab3abd93fba520a003058dd4363ece888b4ba79a848d23'}}
need=common.need;binding=common.binding;read=common.read;save=common.save;now=common.now

def validate_policy(p):
 need(p['schemaVersion']=='mixed-train-rehearsal-policy-v1' and p['sourceRunId']==common.RUN,'policy identity')
 need(p['arm'] in ('rehearsal','support-weight1','terrain-ecology',*STEM_POLICIES,*STEM_PAIR_POLICIES,*STEM_DECODER_POLICIES),'declared comparison arm')
 stronger=p['arm'] in ('support-weight1','stem-support1','stem-pair-support1','stem-decoder-support1')
 need(p['backgroundAuxiliaryChanged'] is True and p['lossChanged'] is stronger and p['trainingSelectionChanged'] is True and p['backwardRoutingChanged'] is False,'explicit objective and selection')
 need(p['sampleIds']==SAMPLES and p['observedSampleIds']==OBSERVED and p['anchorSampleId']==ANCHOR,'fixed train/observed/anchor identities')
 need(len(SAMPLES)==len(set(SAMPLES))==48 and set(OBSERVED)<=set(SAMPLES),'48 unique training samples')
 need(p['initialization']=='exact_completed_rock_background_v2_weights_fresh_original_AdamW' and p['parentExperiment']==PARENT,'completed parent')
 need(p['training']=={'pairs':448,'passes':8,'cycleLength':56,'anchorVisits':72,'otherSampleVisits':8,'order':'original_train_order_with_anchor_after_each_six_then_repeat_eight_times','seed':20260929,'supportStructureWeight':1.0 if stronger else 0.1,'checkpointSelection':'final_step_only','observations':[0,56,112,224,336,448]},'fixed mixed coverage budget')
 need(p['resources']=={'maxWallSeconds':3600,'cudaMemoryFraction':.7,'minimumFreeVramMiB':2048,'maximumTemperatureC':85,'minimumFreeDiskMiB':2048,'maxOutputMiB':128,'cpuThreads':2,'automaticRetries':0} and p['preparationMaxWallSeconds']==300,'resource boundary')
 need(p['modelArchitectureChanged'] is (p['arm']=='terrain-ecology'),'explicit architecture boundary')
 for k in ('gradientThresholdChanged','sourceImagesOrConditionsChanged','validationContentAllowed','checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','parentExecutionPermissionInherited'):need(p[k] is False,k)
 if p['arm']=='terrain-ecology':
  need(p['numericOperatorsChanged'] is True and p['terrainEcologyConditionAdded'] is True,'explicit terrain ecology input/operator addition')
  need(p['modelCapability']=='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1','terrain ecology identity')
  need(p['parameterMigration']=='exact_original_D1_parameters_plus_zero_48x7_terrain_ecology_new_identity','terrain ecology explicit migration')
  need(p['comparisonScope']=='terrain_ecology_addition_against_completed_stem_decoder_baseline','terrain ecology comparator scope')
 if p['arm']=='support-weight1':
  need(set(p['equalBudgetBaseline'])=={'package','terminal','result'} and p['completedComparisonReview']['path']=='.runtime/ai-painter/controller-repair-reviews/mixed-train-review-053-20261027/result.json','completed comparator bindings')

 if p['arm'] in STEM_POLICIES:
  need(p['numericOperatorsChanged'] is True and p['modelCapability']=='stage4_mvp256_dry_factorized_ecology_stem_weight_precision_v1','new numeric identity')
  need(p['parameterMigration']=='exact_original_D1_parameters_new_stem_identity_buffers','explicit parameter migration')
  need(p['comparisonScope']=='two_new_stem_precision_arms_only_support_coefficient_differs','same numeric comparison')

 if p['arm'] in (*STEM_PAIR_POLICIES,*STEM_DECODER_POLICIES):
  decoder=p['arm'] in STEM_DECODER_POLICIES
  need(p['numericOperatorsChanged'] is True and p['modelCapability']==('stage4_mvp256_dry_factorized_ecology_stem_pair_decode2_inner_weight_precision_v1' if decoder else 'stage4_mvp256_dry_factorized_ecology_stem_pair_weight_precision_v1'),'new pair numeric identity')
  need(p['parameterMigration']==('exact_original_D1_parameters_new_stem_decoder_identity_buffers' if decoder else 'exact_original_D1_parameters_new_stem_pair_identity_buffers'),'explicit pair migration')
  need(p['comparisonScope']==('two_new_stem_decoder_precision_arms_only_support_coefficient_differs' if decoder else 'two_new_stem_pair_precision_arms_only_support_coefficient_differs'),'same pair comparison')


def imports(policy):
 api=list(common.imports())
 import painter_stage4_rock_background_training_profile_v1 as background
 api[4]=background
 return tuple(api)

def sample_index(step):
 need(type(step) is int and 1<=step<=448,'step boundary')
 pos=(step-1)%56
 return SAMPLES.index(ANCHOR) if pos%7==6 else (pos//7)*6+pos%7

def expected_visits():return {sid:72 if sid==ANCHOR else 8 for sid in SAMPLES}

def validate_checkpoint(value,bound):
 need(value['schema']=='mixed-train-rehearsal-state-v1' and value['packageSha256']==bound['sha256'],'checkpoint identity')
 need(value['counts']=={'generator':448,'discriminator':448} and value['sampleVisits']==expected_visits(),'checkpoint counts')
 need(value['checkpointPromotable'] is False,'checkpoint not promotable')

def source(reader,p,api):
 torch,np,psutil,auth,profile,worker,cpu,derive,codec,values,metrics=api
 parent_pkg=reader.json(PARENT['package']);parent_terminal=reader.json(PARENT['terminal']);parent_result=reader.json(PARENT['result'])
 need(parent_pkg['experimentIdentity']==parent_terminal['experimentIdentity']==parent_result['experimentIdentity']==PARENT_RUN,'parent identity')
 need(parent_pkg['schemaVersion']=='rock-background-probe-package-v1' and parent_pkg['selectedSampleIds']==OBSERVED,'parent route')
 need(parent_terminal['executionState']=='completed' and parent_terminal['result']==PARENT['result'] and parent_result['checkpointReloadExact'] is True and parent_result['optimizerSteps']=={'generator':100,'discriminator':100},'completed parent')
 need(PARENT['checkpoint'] in parent_result['artifacts'] and PARENT['prediction'] in parent_result['artifacts'],'parent artifacts')
 review=reader.json(p['predecessorReview']);need(review['status']=='completed_readonly_not_qualified' and review['actualCalls']['generatorForwards']==20,'completed predecessor diagnostic')
 if p['arm']=='support-weight1':
  baseline=p['equalBudgetBaseline'];bp=reader.json(baseline['package']);bt=reader.json(baseline['terminal']);br=reader.json(baseline['result'])
  need(bt['executionState']=='completed' and bt['executionPackage']==baseline['package'] and bt['result']==baseline['result'],'completed baseline terminal')
  need(bp['parentExperiment']==PARENT and bp['selectedSampleIds']==SAMPLES and bp['arm']=='rehearsal','same baseline initialization and data')
  need(bp['training']=={**p['training'],'supportStructureWeight':0.1} and bp['resources']==p['resources'],'same baseline budget')
  need(br['checkpointReloadExact'] is True and br['optimizerSteps']=={'generator':448,'discriminator':448} and br['sampleVisits']==expected_visits(),'completed baseline counts')
  comparison=reader.json(p['completedComparisonReview']);need(comparison['status']=='completed_readonly_not_qualified' and comparison['actualCalls']['generatorForwards']==32,'baseline comparison completed')
  cpu_comparison=reader.json(p['cpuComparison'])
  need(cpu_comparison['status']=='two_sample_two_weight_cpu_zero_update_passed_not_gpu_qualified' and cpu_comparison['checkpoint']==PARENT['checkpoint'],'own CPU comparison source')
  need([(x['slot'],x['supportStructureWeight']) for x in cpu_comparison['proofs']]==[(149,.1),(149,1.0),(164,.1),(164,1.0)] and cpu_comparison['modelStateUnchanged'] is True and cpu_comparison['optimizerUpdates']==0,'own CPU comparison coverage')
  for b in cpu_comparison['programs']:reader.read(b)
 parent_policy=reader.json(parent_pkg['policy']);need(p['backgroundHypothesis']==parent_policy['backgroundHypothesis'],'auxiliary hypothesis unchanged')
 plan=reader.json(parent_pkg['sourcePlan']);terminal=reader.json(parent_pkg['sourceTerminal']);need(terminal['completedEpochs']==24 and terminal['checkpointReloadVerified'] is True,'original source')
 manifest=reader.json(plan['datasetManifest']);index=reader.json(manifest['sourceIndex']);members=reader.json(plan['trainSplit'])['sampleIds'];valid=reader.json(plan['validationSplit'])['sampleIds']
 need(members==SAMPLES and not (set(members)&set(valid)),'exact original train order and split isolation')
 order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds'];samples=[];identities=[]
 for sid in SAMPLES:
  row=next(r for r in index['samples'] if r['sampleId']==sid);need(row['split']=='train','train only')
  if 'sourceCorrection' in row:
   correction=reader.json(row['sourceCorrection']);parent=reader.json(correction['parentDataset']);old=next(r for r in reader.json(parent['sourceIndex'])['samples'] if r['sampleId']==row['parentSampleId']);need(old['split']=='train','parent train only')
   _,identity=cpu.load_sample(reader,old,order,continuous);identity.update(sampleId=sid,image=row['image']);sample,identity=auth.load_corrected_sample(reader,row,order,continuous,identity,cpu)
  else:sample,identity=cpu.load_sample(reader,row,order,continuous)
  regime,_,_=derive(reader,identity);samples.append(profile.bind_sample_ecology(reader,sample,identity,regime));identities.append(identity)
 need(parent_pkg['sampleIdentities']==[identities[SAMPLES.index(sid)] for sid in OBSERVED],'fixed observed source identities')
 model,critic=profile.fresh_networks(order);value=torch.load(io.BytesIO(reader.read(PARENT['checkpoint'])),map_location='cpu',weights_only=True)
 need(value['schema']=='two-map-checkpoint-fit-state-v1' and value['packageSha256']==PARENT['package']['sha256'] and value['counts']=={'generator':100,'discriminator':100} and value['checkpointPromotable'] is False,'parent checkpoint')
 model.load_state_dict(value['model'],strict=True);critic.load_state_dict(value['critic'],strict=True);need(sum(v.numel() for v in model.parameters())==2242687,'model size');reader.read(PARENT['prediction'])
 if p['arm'] in STEM_POLICIES:
  from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
  original=model;model=identity.migrate_original_d1_parameters_to_stem(original)
  proof=reader.json(p['cpuComparison'])
  need(proof['status']=='stem_cpu_comparison_completed_not_gpu_qualified' and proof['checkpoint']==PARENT['checkpoint'], 'new CPU proof source')
  need(proof['modelCapability']==model.capability_version and proof['modelStateUnchanged'] is True and proof['optimizerUpdates']==0,'new CPU identity/state')
  need([(r['slot'],r['lineage'],r['supportStructureWeight']) for r in proof['proofs']]==[(149,'stem',.1),(149,'stem',1.),(157,'original',.1),(157,'stem',.1),(157,'original',1.),(157,'stem',1.),(164,'stem',.1),(164,'stem',1.)], 'new CPU proof coverage')
  selected_proofs=[r for r in proof['proofs'] if r['lineage']=='stem' and r['supportStructureWeight']==p['training']['supportStructureWeight']]
  need(len(selected_proofs)==3 and all(r['passed'] is True for r in selected_proofs),'selected coefficient CPU gate failed; no training admission')
  need(proof['allParameterBytesPreserved'] is True and proof['initialRgbBitExact'] is True,'migration proof')
  for b in proof['programs']:reader.read(b)
  if p['arm']=='stem-support1':
   baseline=p['equalBudgetBaseline'];bp=reader.json(baseline['package']);bt=reader.json(baseline['terminal']);br=reader.json(baseline['result'])
   need(bt['executionState']=='completed' and bt['executionPackage']==baseline['package'] and bt['result']==baseline['result'],'completed stem baseline')
   need(bp['arm']=='stem-baseline' and bp['parentExperiment']==PARENT and bp['selectedSampleIds']==SAMPLES and bp['modelCapability']==model.capability_version,'same numeric baseline')
   need(bp['training']=={**p['training'],'supportStructureWeight':.1} and bp['resources']==p['resources'],'same stem comparison budget')
   need(br['checkpointReloadExact'] is True and br['optimizerSteps']=={'generator':448,'discriminator':448} and br['sampleVisits']==expected_visits(),'complete stem comparison')
   # Both arms must execute the identical implementation, not merely the same model name.
   need(bp['programs']==project_sources(),'stem comparison program bytes differ')

 if p['arm'] in (*STEM_PAIR_POLICIES,*STEM_DECODER_POLICIES):
  decoder=p['arm'] in STEM_DECODER_POLICIES
  from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
  model=identity.migrate_original_d1_parameters_to_stem(model,stem_inner=True,decode2_inner=decoder)
  proof=reader.json(p['cpuComparison'])
  need(proof['status']==('three_sample_two_weight_stem_decoder_cpu_passed_not_gpu_qualified' if decoder else 'three_sample_two_weight_stem_pair_cpu_passed_not_gpu_qualified') and proof['checkpoint']==PARENT['checkpoint'],'pair CPU proof source')
  need(proof['modelCapability']==model.capability_version and proof['modelStateUnchanged'] is True and proof['optimizerUpdates']==0,'pair CPU identity/state')
  need([(r['slot'],r['supportStructureWeight']) for r in proof['proofs']]==[(s,w) for s in (149,157,164) for w in (.1,1.)],'pair CPU proof coverage')
  need(all(r['passed'] is True for r in proof['proofs']) and proof['allParameterBytesPreserved'] is True and proof['initialRgbBitExact'] is True,'pair CPU gates and migration')
  for b in proof['programs']:reader.read(b)
  if p['arm'] in ('stem-pair-baseline','stem-decoder-baseline'):
   comparator=p['equalBudgetComparator'];bp=reader.json(comparator['package']);bt=reader.json(comparator['terminal']);br=reader.json(comparator['result'])
   need(bt['executionState']=='completed' and bt['executionPackage']==comparator['package'] and bt['result']==comparator['result'],'completed pair stronger comparator')
   need(bp['arm']==('stem-decoder-support1' if decoder else 'stem-pair-support1') and bp['parentExperiment']==PARENT and bp['selectedSampleIds']==SAMPLES and bp['modelCapability']==model.capability_version,'same pair parent and numeric identity')
   need(bp['training']=={**p['training'],'supportStructureWeight':1.} and bp['resources']==p['resources'],'same pair comparison budget')
   need(br['checkpointReloadExact'] is True and br['optimizerSteps']=={'generator':448,'discriminator':448} and br['sampleVisits']==expected_visits(),'complete pair stronger comparison')
   need(bp['programs']==project_sources(),'pair comparison program bytes differ')
 if p['arm']=='terrain-ecology':
  from ai_painter.complete_world import terrain_ecology_conditioned_v1 as terrain
  model=terrain.migrate_original_d1_parameters_to_terrain_ecology(model)
  proof=reader.json(p['cpuComparison'])
  need(proof['status']=='three_sample_terrain_ecology_cpu_passed_not_gpu_qualified' and proof['checkpoint']==PARENT['checkpoint'],'terrain ecology CPU source')
  need(proof['modelCapability']==model.capability_version and proof['modelStateUnchanged'] is True and proof['optimizerUpdates']==0,'terrain ecology CPU state')
  need([(r['slot'],r['supportStructureWeight']) for r in proof['proofs']]==[(149,.1),(157,.1),(164,.1)],'terrain ecology CPU coverage')
  need(all(r['passed'] is True for r in proof['proofs']) and proof['allOriginalParameterBytesPreserved'] is True and proof['projectionInitiallyZero'] is True and proof['initialRgbBitExact'] is True,'terrain ecology migration/gates')
  need(len(proof['sensitivity'])==1 and proof['sensitivity'][0]['terrainMaxAbsChange']>0 and proof['sensitivity'][0]['alternateZeroColumnTerrainBitExact'] is True,'terrain ecology input path evidence')
  for b in proof['programs']:reader.read(b)
  comparator=p['equalBudgetBaseline'];bp=reader.json(comparator['package']);bt=reader.json(comparator['terminal']);br=reader.json(comparator['result'])
  need(bt['executionState']=='completed' and bt['executionPackage']==comparator['package'] and bt['result']==comparator['result'],'terrain ecology completed baseline')
  need(bp['arm']=='stem-decoder-baseline' and bp['modelCapability']=='stage4_mvp256_dry_factorized_ecology_stem_pair_decode2_inner_weight_precision_v1','terrain ecology original comparator identity')
  need(bp['parentExperiment']==PARENT and bp['selectedSampleIds']==SAMPLES and bp['training']==p['training'] and bp['resources']==p['resources'],'terrain ecology equal initialization/data/budget')
  need(br['checkpointReloadExact'] is True and br['optimizerSteps']=={'generator':448,'discriminator':448} and br['sampleVisits']==expected_visits(),'terrain ecology complete baseline')
  comparison=reader.json(p['completedComparisonReview']);control=reader.json(p['completedObjectControl']);coverage=reader.json(p['terrainCategoryAudit'])
  need(comparison['status']=='saved_outputs_compared_not_formal_qualified' and len(comparison['rows'])==10,'completed controlled comparison')
  need(control['status']=='completed_readonly_not_qualified' and control['actualCalls']=={'generatorForwards':20,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0},'completed object control evidence')
  need(coverage['status']=='completed_train_only_descriptive_audit' and len(coverage['rows'])==48,'terrain category source audit')
 return plan,samples,identities,order,model,critic


def project_sources():
 paths={b['path'] for b in common.project_sources()}|{'ml/ai-painter/src/ai_painter/complete_world/decode2_inner_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_decode2_inner_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_stem_decoder_model_identity_v1.py'}|{'ml/ai-painter/src/ai_painter/complete_world/stem_inner_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_stem_inner_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_stem_pair_model_identity_v1.py','scripts/lib/ai-painter-stem-pair-comparison-v1.mjs','scripts/tests/test-ai-painter-stem-pair-comparison.mjs'}|{'ml/ai-painter/src/ai_painter/complete_world/stem_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_stem_weight_reduction_precision_v1.py','ml/ai-painter/tests/test_stem_model_identity_v1.py'}|{SELF,TEST,'scripts/lib/ai-painter-two-map-experiment-v1.mjs','scripts/tests/test-ai-painter-two-map-experiment.mjs','scripts/lib/ai-painter-terrain-routing-comparison-v1.mjs','scripts/lib/ai-painter-rock-background-probe-v1.mjs','scripts/lib/ai-painter-mixed-train-rehearsal-v1.mjs','scripts/tests/test-ai-painter-mixed-train-rehearsal.mjs','scripts/tests/test-ai-painter-rock-background-probe.mjs','ml/ai-painter/scripts/painter_stage4_rock_background_training_profile_v1.py','ml/ai-painter/src/ai_painter/complete_world/isolated_rock_background_proxy_v1.py','ml/ai-painter/tests/test_isolated_rock_background_proxy_v1.py','ml/ai-painter/scripts/painter_stage4_support_terrain_gradient_training_profile_v1.py','ml/ai-painter/src/ai_painter/complete_world/object_support_terrain_gradient_device_v1.py'}
 paths.update('ml/ai-painter/src/ai_painter/complete_world/'+name+'.py' for name in ('terrain_ecology_projection_v1','terrain_ecology_conditioned_v1','terrain_ecology_joint_priority_device_v1'))
 paths.update('ml/ai-painter/tests/'+name+'.py' for name in ('test_terrain_ecology_projection_v1','test_terrain_ecology_model_identity_v1','test_terrain_ecology_joint_priority_device_v1'))
 need(len(paths)<=256,'source ceiling')
 return [binding(p) for p in sorted(paths)]

def prepare(policy):
 need(policy==TERRAIN_ECOLOGY_POLICY,'consumed old arms are evidence only; independent terrain ecology policy required');p=read(binding(policy));validate_policy(p)
 need(p['arm']=='terrain-ecology','exact terrain ecology arm policy')
 api=imports(p);torch,np,psutil,auth,profile,*_=api;reader=api[6].BoundReader(ROOT)
 plan,samples,identities,order,model,critic=source(reader,p,api)
 model.eval();scores=[]
 with torch.inference_mode():
  for sample in samples:
   prediction=profile.sample_forward(model,sample)
   need(prediction.shape==(1,3,192,256) and bool(torch.isfinite(prediction).all()),'CPU RGB')
   scores.append(api[-1](prediction.cpu(),sample,order))
 reader.unchanged()
 artifacts=[{'role':'metrics','sampleId':SAMPLES[sample_index(step)],'split':'train','optimizerStep':step,'measurementScope':'original_pre_update_objectives_for_successfully_committed_pair'} for step in range(1,449)]
 for step in p['training']['observations']:
  for sid in OBSERVED:
   for role in ('prediction','metrics'):artifacts.append({'role':role,'sampleId':sid,'split':'train','optimizerStep':step,'measurementScope':'fixed_sample_evaluation'})
 artifacts.append({'role':'checkpoint','optimizerStep':448})
 payload={'schemaVersion':'mixed-train-rehearsal-package-v1','arm':p['arm'],'policy':binding(policy),'resources':p['resources'],'training':p['training'],
  'sourcePlan':binding(common.BASE+'/quality-plan.json'),'sourceTerminal':binding(common.BASE+'/worker-terminal.json'),'parentExperiment':PARENT,
  'selectedSampleIds':SAMPLES,'sampleIdentities':identities,'inputs':[{'path':k,'sha256':v} for k,v in sorted(reader.observed.items())],
  'programs':project_sources(),'specification':binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),
  'modelCapability':model.capability_version,'numericOperatorsChanged':p.get('numericOperatorsChanged',False),'parameterMigration':p.get('parameterMigration'),'optimizerInitialization':'fresh_AdamW_no_parent_moments_available','qualificationGranted':False,
  'interfaceContract':descriptor([{k:i[k] for k in ('sampleId','split','image','conditionPack') if k in i} for i in identities],plan['configuration']['scope']['resolution'],{'generator':448,'discriminator':448},artifacts,binding('ml/ai-painter/scripts/training_observation_recorder_v1.py'))}
 payload.update(modelArchitectureChanged=p['modelArchitectureChanged'],terrainEcologyConditionAdded=p.get('terrainEcologyConditionAdded',False))
 run=('mixed-train-'+p['arm']+'-v1-')+hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()[:20]
 payload.update(experimentIdentity=run,outputRoot=common.OUTPUT+run)
 target=payload['outputRoot']+'/package.json'
 if (ROOT/target).exists():need(read(binding(target))==payload,'package changed');return binding(target)
 b=save(target,payload)
 save(payload['outputRoot']+'/cpu-source-check.json',{'status':'passed','recordedAtUtc':now(),'selectedSampleIds':SAMPLES,'baselineMetrics':scores,'optimizerUpdates':0,'cudaInitialized':torch.cuda.is_initialized(),'note':'CPU strict source/reload only; no GPU admission'})
 return b

def execute(bound):
 pkg=read(bound);p=read(pkg['policy']);validate_policy(p);out=pkg['outputRoot']
 need(out==common.OUTPUT+pkg['experimentIdentity'] and pkg['selectedSampleIds']==SAMPLES,'execution identity')
 for b in pkg['inputs']+pkg['programs']+[pkg['specification']]:need(binding(b['path'])==b,'frozen source changed: '+b['path'])
 api=imports(p);torch,np,psutil,auth,profile,worker,cpu,derive,codec,values,metrics=api
 from painter_learning_capacity_experiment import verify_controller_process
 lease=read(binding(out+'/controller-lease.json'));raw=(ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes()
 need(hashlib.sha256(raw).hexdigest()==lease['registrySha256'],'registry lease');verify_controller_process(lease,json.loads(raw),os.getppid())
 save(out+'/worker-started.json',{'recordedAtUtc':now(),'pid':os.getpid(),'package':bound})
 observer=ObservationRecorder(ROOT,pkg,bound,json.loads(raw)['activeExecution'])
 started=time.monotonic();counts={'generator':0,'discriminator':0};visits=dict.fromkeys(SAMPLES,0);phase='loading';gpu=False;artifacts=[];model=critic=None;last_poll=0;device_id=None;active_sample=None
 def put(name,value):
  b=save(out+'/'+name,value);artifacts.append(b);return b
 def guard():
  nonlocal last_poll,device_id
  need(time.monotonic()-started<3600,'wall budget exhausted')
  need(sum(f.stat().st_size for f in (ROOT/out).rglob('*') if f.is_file())<126*1024**2,'output reserve')
  need(psutil.disk_usage(str(ROOT/out)).free>2048*1024**2 and psutil.pid_exists(lease['workerParentPid']),'disk/controller boundary')
  live=json.loads((ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes())
  need(live['runId']==pkg['experimentIdentity'] and live['activeExecution'] is not None,'active execution changed')
  from datetime import datetime
  hb=json.loads((ROOT/out/'heartbeat.json').read_bytes())
  need(time.time()-datetime.fromisoformat(hb['heartbeatAtUtc'].replace('Z','+00:00')).timestamp()<120,'heartbeat stale')
  if time.monotonic()-last_poll>3:
   data=subprocess.run(['nvidia-smi','--query-gpu=uuid,temperature.gpu,memory.free','--format=csv,noheader,nounits','-i','0'],capture_output=True,text=True,check=True,timeout=10).stdout.strip().split(',')
   need(len(data)==3 and float(data[1])<85 and float(data[2])>=2048,'GPU resource boundary')
   if device_id is None:device_id=data[0].strip()
   need(device_id==data[0].strip(),'GPU changed');last_poll=time.monotonic()
 def observe(step,sample):
  guard();modes=[(m,m.training) for m in model.modules()];clock=start_clock()
  try:
   model.eval()
   with torch.inference_mode():prediction=profile.sample_forward(model,sample).detach().cpu()
  finally:
   for m,mode in modes:m.training=mode
  def publish():
   from PIL import Image
   slot='149' if sample['sampleId']==OBSERVED[0] else '164';buf=io.BytesIO()
   Image.fromarray((prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')).save(buf,format='PNG')
   image=put(f'prediction-{slot}-{step:03}.png',buf.getvalue());timing=finish_clock(clock,IMAGE_SCOPE)
   observer.artifact('prediction',image,step,sampleId=sample['sampleId'],split='train',resolution=pkg['interfaceContract']['resolution'],measurementScope='fixed_sample_evaluation',imageTiming=timing)
   score=metrics(prediction,sample,order)
   metric=put(f'observation-{slot}-{step:03}.json',{'step':step,'optimizerSteps':dict(counts),'sampleId':sample['sampleId'],'prediction':image,'metrics':score,'recordedAtUtc':now()})
   observer.artifact('metrics',metric,step,sampleId=sample['sampleId'],split='train',measurementScope='fixed_sample_evaluation')
   print(json.dumps({'stage':'observation','step':step,'sampleId':sample['sampleId'],'rgbMae':score['fullRgbMae'],'prediction':image}),flush=True)
  observer.attempt(publish)
  return prediction
 try:
  reader=cpu.BoundReader(ROOT);plan,samples,identities,order,model,critic=source(reader,p,api)
  need(identities==pkg['sampleIdentities'],'source identities changed')
  torch.manual_seed(20260929);np.random.seed(20260929);random.seed(20260929)
  need(torch.cuda.is_available(),'CUDA unavailable');guard();torch.cuda.set_per_process_memory_fraction(.7);torch.cuda.set_device(0)
  model.to('cuda:0');critic.to('cuda:0');gpu=True;phase='zero_update_gpu'
  observer.attempt(lambda:observer.progress(counts,phase,gpu_started=True))
  for n,sample in enumerate(samples):
   active_sample=sample['sampleId'];probe_failure={}
   proof=profile.zero_update_probe(model,critic,sample,order,guard,failure_evidence=probe_failure,support_structure_weight=p['training']['supportStructureWeight'])
   put(f'zero-update-gpu-probe-{n}.json',proof)
  for sample in [samples[SAMPLES.index(sid)] for sid in OBSERVED]:
   prediction=observe(0,sample)
   if sample['sampleId']==ANCHOR:
    from PIL import Image
    old=np.asarray(Image.open(io.BytesIO(reader.read(PARENT['prediction']))).convert('RGB'))
    current=(prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')
    need(np.array_equal(old,current),'parent 164 baseline differs')
    baseline_binding=next((a['binding'] for a in observer.artifacts if a['role']=='prediction' and a.get('sampleId')==ANCHOR and a['optimizerStep']==0),None)
    observer.attempt(lambda:put('parent-output-continuity.json',{'parentCheckpoint':PARENT['checkpoint'],'parentPrediction':PARENT['prediction'],'newBaselinePrediction':baseline_binding,'newBaselinePredictionObservationStatus':'recorded' if baseline_binding else 'not_recorded','quantizedRgbPixelsExactlyEqual':True,'optimizerMomentsRestored':False}))
  need({b['path'] for b in project_sources()}<={b['path'] for b in pkg['programs']},'undeclared source')
  need(all(binding(b['path'])==b for b in pkg['programs']),'source changed before optimization')
  args=dict(lr=.0001,betas=(.9,.999),eps=1e-8,weight_decay=.01,foreach=False,fused=False)
  go=torch.optim.AdamW(model.parameters(),**args);do=torch.optim.AdamW(critic.parameters(),**args)
  phase='training';model.train();critic.train()
  for step in range(1,449):
   guard();sample=samples[sample_index(step)];active_sample=sample['sampleId'];ledger={'sampleId':active_sample,'generator':0,'discriminator':0}
   result=worker.observed_pair(profile.perform_pair,model,model,critic,sample,order,go,do,counts,ledger,guard,None,support_structure_weight=p['training']['supportStructureWeight'])
   need(counts=={'generator':step,'discriminator':step},'committed count');visits[active_sample]+=1
   observer.committed_metric(counts,active_sample,values,put,result)
   observer.attempt(lambda:observer.progress(counts,phase,gpu_started=True))
   if step in p['training']['observations']:
    for fixed in [samples[SAMPLES.index(sid)] for sid in OBSERVED]:observe(step,fixed)
  phase='checkpoint';need(visits==expected_visits(),'balanced visits')
  value={'schema':'mixed-train-rehearsal-state-v1','packageSha256':bound['sha256'],'counts':dict(counts),'sampleVisits':visits,'checkpointPromotable':False,'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()}}
  buf=io.BytesIO();torch.save(value,buf);checkpoint=put('checkpoint-final.pt',buf.getvalue())
  loaded=torch.load(io.BytesIO((ROOT/checkpoint['path']).read_bytes()),map_location='cpu',weights_only=True);validate_checkpoint(loaded,bound)
  fresh,fresh_critic=profile.fresh_networks(order,model_capability=model.capability_version);fresh.load_state_dict(loaded['model'],strict=True);fresh_critic.load_state_dict(loaded['critic'],strict=True)
  for current,reloaded in ((model,fresh),(critic,fresh_critic)):
   need(all(torch.equal(v.detach().cpu(),reloaded.state_dict()[k]) for k,v in current.state_dict().items()),'strict reload state differs')
  fresh.to('cuda:0');fresh.eval();model.eval()
  with torch.inference_mode():
   for sample in samples:
    guard();need(torch.equal(profile.sample_forward(model,sample),profile.sample_forward(fresh,sample)),'strict reload RGB differs')
  reader.unchanged();need(all(binding(b['path'])==b for b in pkg['programs']),'source changed after training')
  observer.attempt(lambda:observer.artifact('checkpoint',checkpoint,448,promotable=False))
  observation=observer.attempt(lambda:observer.finish(counts,'completed',phase))
  put('result.json',{'status':'experiment_executed_not_visual_qualified','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'gpuStarted':True,'trainingStarted':True,'optimizerSteps':counts,'sampleVisits':visits,'arm':p['arm'],'modelCapability':model.capability_version if model is not None else p.get('modelCapability'),'backgroundAuxiliaryChanged':p['backgroundAuxiliaryChanged'],'checkpointReloadExact':True,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'formalQualificationGranted':False,'trainingObservation':observation,'observationSecondaryErrors':observer.errors})
 except BaseException as error:
  evidence=getattr(error,'object_support_gradient_evidence',{})
  try:
   raw=evidence.get('rawGradients',[])
   if raw:
    buf=io.BytesIO();torch.save({'gradients':[[None if x is None else x.detach().cpu() for x in rows] for rows in raw],'labels':evidence.get('componentsInOrder'),'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()},'sampleId':active_sample,'counts':counts},buf);put('gradient-failure-tensors.pt',buf.getvalue())
  except BaseException as secondary:observer.attempt(lambda:put('capture-error.json',{'errorType':type(secondary).__name__}))
  observation=observer.attempt(lambda:observer.finish(counts,'failed_closed',phase))
  try:
   put('result.json',{'status':'experiment_failed_closed','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'phase':phase,'sampleId':active_sample,'error':str(error),'errorType':type(error).__name__,'gpuStarted':gpu,'trainingStarted':any(counts.values()),'optimizerSteps':counts,'sampleVisits':visits,'arm':p['arm'],'modelCapability':model.capability_version if model is not None else p.get('modelCapability'),'backgroundAuxiliaryChanged':p['backgroundAuxiliaryChanged'],'checkpointReloadExact':False,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'probeFailure':locals().get('probe_failure',{}),'trainingObservation':observation,'observationSecondaryErrors':observer.errors})
  except Exception:
   import sys
   print('training_result_publication_failed_original_error_preserved',file=sys.stderr,flush=True)
  raise

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','run']);parser.add_argument('--policy',default=POLICY);parser.add_argument('--package');parser.add_argument('--sha256');args=parser.parse_args()
 if args.mode=='prepare':print(json.dumps(prepare(args.policy)))
 else:execute({'path':args.package,'sha256':args.sha256})
