"""One fixed train149 continuation through the existing managed single-map lifecycle."""
import argparse,io,json,random,sys
import painter_single_map_checkpoint_fit_v1 as common
ROOT=common.ROOT;need=common.need;binding=common.binding;read=common.read;save=common.save
POLICY='data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v2.json'
SELF='ml/ai-painter/scripts/painter_single149_terrain_ecology_fit_v1.py'
TEST='ml/ai-painter/tests/test_single149_terrain_ecology_fit_v1.py'
CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
SAMPLE='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
PARENT_RUN='mixed-train-terrain-ecology-v1-2b8a12c543a07576de72'
BASE=common.OUTPUT+PARENT_RUN
PARENT={key:{'path':BASE+'/'+name,'sha256':sha} for key,name,sha in (
 ('package','package.json','41bf35d3f30a2ee4e6286041ed859a3e83a82c05ccb8b0461de6271cc6455291'),
 ('terminal','terminal.json','8c576f90fe4d67fa276968edd0ecdac0d038abdc0ef5fa3aab22bd254bc8cf4d'),
 ('result','result.json','c315800abf1bdda2f10a9b960a64069f3fa9d841b5cef8d07d0b73d06f7d5622'),
 ('checkpoint','checkpoint-final.pt','20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef'),
 ('prediction','prediction-149-448.png','c4bb12fbf3c01219211d43b73e3094a1cdc60eb11e243a9c40c11afe6f38dd46'))}
DIAGNOSTICS={
 'allSamples':{'path':'.runtime/ai-painter/controller-repair-reviews/terrain-ecology-all-samples-079-20261027/result.json','sha256':'95f75c70b39a9553ae0c849bbc08e485e91c42b48bc05c75480ef497adf229bf'},
 'control':{'path':'.runtime/ai-painter/controller-repair-reviews/terrain-ecology-post-analysis-078-20261027/result.json','sha256':'eed7f2f0af8866f7698a8207e827564d3f8924a97ecdbc2a158bfe3893cb8ec4'},
 'headFit':{'path':'.runtime/ai-painter/controller-repair-reviews/fixed-feature-object-fit-081-20261027/result.json','sha256':'97e97710f08be94e494ad80e671aceca5909725c34d89ab4610d12291c7e24ce'}}
TRAINING={'pairs':200,'seed':20260929,'supportStructureWeight':0.1,'checkpointSelection':'final_step_only','observations':[0,25,50,100,150,200]}
RESOURCES={'maxWallSeconds':1800,'cudaMemoryFraction':.7,'minimumFreeVramMiB':2048,'maximumTemperatureC':85,'minimumFreeDiskMiB':2048,'maxOutputMiB':128,'cpuThreads':2,'automaticRetries':0}
FAILED={'path':'.runtime/ai-painter/learning-capacity-experiments/single149-terrain-ecology-v1-e22938bce48bf94fd25a/terminal.json','sha256':'fed36216697f4bbc307a0d4f0a177759f95525b5f54991569f54b8094ad2ca5f'}
CLOSURE={'path':'.runtime/ai-painter/controller-repair-reviews/single149-full-fit-082-20261027/source-diagnostic/result.json','sha256':'363e183b6567173a1033a1ec2ed0891cf6e201169e4bad0aceb92c2e2e992fea'}
LATE_SOURCES=('ml/ai-painter/scripts/painter_stage4_support_terrain_gradient_training_profile_v1.py','ml/ai-painter/src/ai_painter/complete_world/object_support_terrain_gradient_device_v1.py')

def validate_policy(p):
 need(p['schemaVersion']=='single149-terrain-ecology-fit-policy-v2' and p['sampleId']==SAMPLE,'fixed train149 scope')
 need(p['failedAttempt']==FAILED and p['sourceClosureProof']==CLOSURE,'independent closure repair evidence')
 need(p['modelCapability']==CAPABILITY and p['parentExperiment']==PARENT and p['diagnostics']==DIAGNOSTICS,'exact completed parent and diagnosis')
 need(p['training']==TRAINING and p['resources']==RESOURCES,'fixed budget and original optimizer scope')
 need(p['initialization']=='exact_completed_terrain_ecology_generator_and_critic_fresh_original_AdamW','initialization')
 need(p['zeroUpdateAdmission']=='selected_train149_original_five_gradient_gate_before_any_update','own single-sample admission')
 for k in ('modelArchitectureChanged','lossChanged','gradientThresholdChanged','sourceImagesOrConditionsChanged','validationContentAllowed','checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','parentExecutionPermissionInherited'):need(p[k] is False,k)

class BoundProfile:
 def __init__(self,background):self.background=background
 def __getattr__(self,name):return getattr(self.background,name)
 def fresh_networks(self,order):return self.background.fresh_networks(order,model_capability=CAPABILITY)

def imports():
 api=list(common.imports())
 import painter_stage4_rock_background_training_profile_v1 as background
 api[4]=BoundProfile(background)
 return tuple(api)

def validate_parent(pkg,terminal,result):
 need(pkg['experimentIdentity']==terminal['runId']==result['experimentIdentity']==PARENT_RUN,'parent identity')
 need(pkg['modelCapability']==CAPABILITY and pkg['arm']=='terrain-ecology','parent architecture')
 need(terminal['executionState']=='completed' and terminal['result']==PARENT['result'],'completed bound terminal')
 need(result['status']=='experiment_executed_not_visual_qualified' and result['optimizerSteps']=={'generator':448,'discriminator':448} and result['checkpointReloadExact'] is True,'completed parent training')
 need(PARENT['checkpoint'] in result['artifacts'] and PARENT['prediction'] in result['artifacts'],'parent final artifacts')
 need(SAMPLE in pkg['selectedSampleIds'] and result['sampleVisits'][SAMPLE]==8,'train149 parent exposure')

def source(reader,p,api):
 torch,np,psutil,auth,profile,worker,cpu,derive,codec,values,metrics=api
 pkg=reader.json(PARENT['package']);terminal=reader.json(PARENT['terminal']);result=reader.json(PARENT['result']);validate_parent(pkg,terminal,result)
 failed=reader.json(FAILED);failure=reader.json(failed['result']);closure=reader.json(CLOSURE)
 need(failed['executionState']=='failed_closed' and failure['optimizerSteps']=={'generator':0,'discriminator':0} and failure['error']=='undeclared loaded source before optimization','zero-update prior source failure')
 need(closure['cpuProbe']['passed'] is True and closure['originalStateUnchanged'] is True and closure['optimizerUpdates']==0 and closure['cudaInitialized'] is False,'actual CPU closure proof')
 need({b['path'] for b in closure['missingFromPreparedPackage']}==set(LATE_SOURCES),'exact known lazy dependencies')
 for b in closure['missingFromPreparedPackage']:reader.read(b)
 all_samples=reader.json(DIAGNOSTICS['allSamples']);control=reader.json(DIAGNOSTICS['control']);head=reader.json(DIAGNOSTICS['headFit'])
 need(all_samples['actualCalls']['generatorForwards']==112 and control['actualCalls']['generatorForwards']==30 and head['cloneOptimizerUpdates']==800,'completed diagnostics')
 plan=reader.json(pkg['sourcePlan']);manifest=reader.json(plan['datasetManifest']);index=reader.json(manifest['sourceIndex'])
 members=reader.json(plan['trainSplit'])['sampleIds'];validation=reader.json(plan['validationSplit'])['sampleIds'];need(SAMPLE in members and SAMPLE not in validation,'train only')
 row=next(r for r in index['samples'] if r['sampleId']==SAMPLE);need(row['split']=='train' and 'sourceCorrection' not in row,'uncorrected fixed train149')
 order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds']
 sample,identity=cpu.load_sample(reader,row,order,continuous);regime,_,_=derive(reader,identity);sample=profile.bind_sample_ecology(reader,sample,identity,regime)
 previous=next(r for r in all_samples['rows'] if r['arm']=='candidate' and r['sampleId']==SAMPLE);need(identity==previous['identity'],'previous sample identity')
 states=torch.load(io.BytesIO(reader.read(PARENT['checkpoint'])),map_location='cpu',weights_only=True)
 need(states['schema']=='mixed-train-rehearsal-state-v1' and states['packageSha256']==PARENT['package']['sha256'] and states['counts']=={'generator':448,'discriminator':448} and states['sampleVisits']==result['sampleVisits'] and states['checkpointPromotable'] is False,'parent state schema/counts')
 model,critic=profile.fresh_networks(order);model.load_state_dict(states['model'],strict=True);critic.load_state_dict(states['critic'],strict=True)
 need(len(tuple(model.parameters()))==109 and sum(p.numel() for p in model.parameters())==2243023,'109 parameter identity')
 reader.read(PARENT['prediction']);reader.read(previous['prediction'])
 return plan,{'checkpoint':PARENT['checkpoint'],'cpuPrediction':previous['prediction'],'sourcePlan':pkg['sourcePlan']},sample,identity,order,model,critic

def project_sources():
 paths={b['path'] for b in common.project_sources()}
 paths.update((SELF,TEST,'scripts/lib/ai-painter-single149-terrain-ecology-fit-v1.mjs','scripts/tests/test-ai-painter-single149-terrain-ecology-fit.mjs'))
 paths.update(LATE_SOURCES)
 need(len(paths)<=256,'source ceiling')
 return [binding(p) for p in sorted(paths)]

def prepare(policy):
 need(policy==POLICY,'exact policy');p=read(binding(policy));validate_policy(p)
 api=imports();torch,np,psutil,auth,profile,*_=api;reader=api[6].BoundReader(ROOT)
 plan,selected,sample,identity,order,model,critic=source(reader,p,api)
 torch.manual_seed(TRAINING['seed']);np.random.seed(TRAINING['seed']);random.seed(TRAINING['seed']);model.eval();critic.eval()
 with torch.inference_mode():prediction=profile.sample_forward(model,sample)
 from PIL import Image
 pixels=(prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')
 need(np.array_equal(pixels,np.asarray(Image.open(io.BytesIO(reader.read(selected['cpuPrediction']))).convert('RGB'))),'own prior CPU prediction mismatch')
 need(not torch.cuda.is_initialized(),'CPU prepare initialized CUDA');reader.unchanged()
 artifacts=[{'role':'metrics','sampleId':SAMPLE,'split':'train','optimizerStep':step,'measurementScope':'original_pre_update_objectives_for_successfully_committed_pair'} for step in range(1,201)]
 for step in TRAINING['observations']:
  for role in ('prediction','metrics'):artifacts.append({'role':role,'sampleId':SAMPLE,'split':'train','optimizerStep':step,'measurementScope':'fixed_sample_evaluation'})
 artifacts.append({'role':'checkpoint','optimizerStep':200})
 payload={'schemaVersion':'single-map-checkpoint-fit-package-v1','policy':binding(policy),'resources':RESOURCES,'training':TRAINING,'modelCapability':CAPABILITY,'parentExperiment':PARENT,'sourcePlan':selected['sourcePlan'],'sourceTerminal':PARENT['terminal'],'checkpoint':PARENT['checkpoint'],'selectedSampleId':SAMPLE,'sampleIdentity':identity,'inputs':[{'path':k,'sha256':v} for k,v in sorted(reader.observed.items())],'programs':project_sources(),'specification':binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),'optimizerInitialization':'fresh_AdamW_no_parent_moments_available','qualificationGranted':False,'interfaceContract':common.descriptor([{k:identity[k] for k in ('sampleId','split','image','conditionPack') if k in identity}],plan['configuration']['scope']['resolution'],{'generator':200,'discriminator':200},artifacts,binding('ml/ai-painter/scripts/training_observation_recorder_v1.py'))}
 run='single149-terrain-ecology-v2-'+common.digest(json.dumps(payload,sort_keys=True).encode())[:20];payload.update(experimentIdentity=run,outputRoot=common.OUTPUT+run)
 target=payload['outputRoot']+'/package.json'
 if (ROOT/target).exists():need(read(binding(target))==payload,'package changed');return binding(target)
 result=save(target,payload);save(payload['outputRoot']+'/cpu-source-check.json',{'status':'passed','recordedAtUtc':common.now(),'modelParameterElements':2243023,'selectedSampleId':SAMPLE,'baselineRgbMae':float((prediction[0]-sample['image']).abs().mean()),'ownCpuReviewPixelsExactlyEqual':True,'optimizerUpdates':0,'cudaInitialized':False,'note':'CPU source and strict reload only; own selected-sample GPU numerical gate still required'})
 return result

validate_saved_checkpoint=common.validate_saved_checkpoint

def execute(bound):
 pkg=read(bound);p=read(pkg['policy']);validate_policy(p)
 need(pkg['schemaVersion']=='single-map-checkpoint-fit-package-v1' and pkg['policy']['path']==POLICY and pkg['modelCapability']==CAPABILITY,'execution route')
 need(pkg['selectedSampleId']==SAMPLE and pkg['training']==TRAINING and pkg['resources']==RESOURCES and pkg['parentExperiment']==PARENT,'execution frozen scope')
 return common.execute(bound,implementation=sys.modules[__name__])

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','run']);parser.add_argument('--policy',default=POLICY);parser.add_argument('--package');parser.add_argument('--sha256');args=parser.parse_args()
 if args.mode=='prepare':print(json.dumps(prepare(args.policy)))
 else:execute({'path':args.package,'sha256':args.sha256})
