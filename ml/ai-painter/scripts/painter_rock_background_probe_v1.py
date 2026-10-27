"""Two-rock background auxiliary experiment; existing registered controller only."""
import argparse, hashlib, io, json, os, random, subprocess, time
from pathlib import Path
import painter_single_map_checkpoint_fit_v1 as common
from training_observation_recorder_v1 import ObservationRecorder, descriptor, start_clock, finish_clock, IMAGE_SCOPE

ROOT=common.ROOT
POLICY='data/ai-painter/system-governance/ai-painter-rock-background-policy-v2.json'
SUCCESSOR_POLICY=POLICY
SELF='ml/ai-painter/scripts/painter_rock_background_probe_v1.py'
TEST='ml/ai-painter/tests/test_rock_background_probe_v1.py'
SAMPLES=['ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3', 'mvp64-slot164-objects-v5-20261020']
PARENT_RUN='two-map149-164-v2-ce5771642998e8b625f4'
PARENT={'package': {'path': '.runtime/ai-painter/learning-capacity-experiments/two-map149-164-v2-ce5771642998e8b625f4/package.json', 'sha256': '6b5dafe7603a76559e2e259c04ee3911ffd52e7b5b021629063d194d033cbc85'}, 'terminal': {'path': '.runtime/ai-painter/learning-capacity-experiments/two-map149-164-v2-ce5771642998e8b625f4/terminal.json', 'sha256': '28aef957b9fd9987e73d5507a26edc35e720a5856d0fdff19c2105c6ac244e3e'}, 'result': {'path': '.runtime/ai-painter/learning-capacity-experiments/two-map149-164-v2-ce5771642998e8b625f4/result.json', 'sha256': 'a6fee85e118a8d37d292521ebdb94c710777fd86b65633c418f6fb21b2de7f00'}, 'checkpoint': {'path': '.runtime/ai-painter/learning-capacity-experiments/two-map149-164-v2-ce5771642998e8b625f4/checkpoint-final.pt', 'sha256': '4ac628ed6305a30db295986fa73b21547d0fcc4de9e30419ca52ca2643f206fc'}, 'prediction': {'path': '.runtime/ai-painter/learning-capacity-experiments/two-map149-164-v2-ce5771642998e8b625f4/prediction-164-200.png', 'sha256': '09090db1deb89a00d5625c6390dabd4ba974422f977ede6f0addb29b687331ad'}}
need=common.need;binding=common.binding;read=common.read;save=common.save;now=common.now

def validate_policy(p):
 need(p['schemaVersion']=='rock-background-policy-v1' and p['sourceRunId']==common.RUN,'policy identity')
 need(p['arm']=='background' and p['backgroundAuxiliaryChanged'] is True and p['lossChanged'] is True and p['backwardRoutingChanged'] is False,'explicit auxiliary objective')
 need(p['backgroundHypothesis']=={'sampleId':SAMPLES[1],'objects':[36,38],'support':'existing disjoint fully owned raw rock support','ring':'two-pixel exterior ring excluding all object support','target':'per-channel median original train RGB','weight':1.0,'knownCounterfactualGroundTruth':False},'fixed background hypothesis')
 need(p['purpose']=='train_only_learning_capacity_no_generalization_claim' and p['sampleIds']==SAMPLES,'exact train selection')
 need(p['initialization']=='exact_completed_two_map_v2_weights_fresh_original_AdamW' and p['parentExperiment']==PARENT,'same completed parent')
 need(p['training']=={'pairs':100,'visitsPerSample':50,'order':'alternating_declared_sample_order','seed':20260929,'supportStructureWeight':0.1,'checkpointSelection':'final_step_only','observations':[0,25,50,75,100]},'equal bounded training')
 need(p['resources']=={'maxWallSeconds':900,'cudaMemoryFraction':.7,'minimumFreeVramMiB':2048,'maximumTemperatureC':85,'minimumFreeDiskMiB':2048,'maxOutputMiB':128,'cpuThreads':2,'automaticRetries':0},'resource boundary')
 for k in ('modelArchitectureChanged','gradientThresholdChanged','sourceImagesOrConditionsChanged','validationContentAllowed','checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','parentExecutionPermissionInherited'):need(p[k] is False,k)
 need(p['assessment']['wholeMapSemanticQualification'] is False and p['assessment']['alignmentConcernsResolved'] is False,'alignment concerns retained')

def imports(policy):
 api=list(common.imports())
 import painter_stage4_rock_background_training_profile_v1 as background
 api[4]=background
 return tuple(api)

def sample_index(step):
 need(type(step) is int and 1<=step<=100,'step boundary')
 return (step-1)%2

def validate_parent(pkg,terminal,result):
 need(pkg['experimentIdentity']==terminal['experimentIdentity']==result['experimentIdentity']==PARENT_RUN,'parent identity')
 need(pkg['selectedSampleIds']==SAMPLES and pkg['schemaVersion']=='two-map-checkpoint-fit-package-v1','parent sample/route')
 need(terminal['executionState']=='completed' and terminal['result']==PARENT['result'],'parent success')
 need(result['checkpointReloadExact'] is True and result['optimizerSteps']=={'generator':200,'discriminator':200},'parent completed weights')
 need(PARENT['checkpoint'] in result['artifacts'] and PARENT['prediction'] in result['artifacts'],'parent artifacts')

def validate_checkpoint(value,bound):
 need(value['schema']=='two-map-checkpoint-fit-state-v1' and value['packageSha256']==bound['sha256'],'checkpoint identity')
 need(value['counts']=={'generator':100,'discriminator':100} and value['sampleVisits']==dict.fromkeys(SAMPLES,50),'checkpoint counts')
 need(value['checkpointPromotable'] is False,'checkpoint not promotable')

def source(reader,p,api):
 torch,np,psutil,auth,profile,worker,cpu,derive,codec,values,metrics=api
 previous=reader.json(p['predecessorFailure']);previous_result=reader.json(previous['result'])
 need(p['attempt']==2 and previous['executionState']=='failed_closed' and previous_result['error']=='undeclared source' and previous_result['optimizerSteps']=={'generator':0,'discriminator':0},'bound prior zero-update failure')
 proof=reader.json(p['cpuCandidateEvidence']);head=reader.json(p['headFitEvidence'])
 need(proof['status']=='two_sample_cpu_zero_update_passed_not_gpu_qualified' and proof['checkpoint']==PARENT['checkpoint'] and proof['optimizerUpdates']==0 and proof['modelStateUnchanged'] is True,'CPU candidate evidence/checkpoint differs')
 need(head['cloneOptimizerSteps']==200 and head['originalModelOptimizerSteps']==0 and head['originalModelStateBefore']==head['originalModelStateAfter'],'head diagnostic provenance')
 baseline=reader.json(p['baselineTerminal']);baseline_package=reader.json(baseline['executionPackage']);baseline_result=reader.json(baseline['result'])
 need(baseline['executionState']=='completed' and baseline_package['parentExperiment']==PARENT and baseline_package['training']==p['training'] and baseline_result['optimizerSteps']=={'generator':100,'discriminator':100},'equal budget baseline required')
 parent_pkg=reader.json(PARENT['package']);parent_terminal=reader.json(PARENT['terminal']);parent_result=reader.json(PARENT['result'])
 validate_parent(parent_pkg,parent_terminal,parent_result)
 plan=reader.json(parent_pkg['sourcePlan']);terminal=reader.json(parent_pkg['sourceTerminal'])
 need(terminal['completedEpochs']==24 and terminal['checkpointReloadVerified'] is True,'original completed source')
 manifest=reader.json(plan['datasetManifest']);index=reader.json(manifest['sourceIndex']);members=reader.json(plan['trainSplit'])['sampleIds']
 order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds']
 samples=[];identities=[]
 for sid in SAMPLES:
  row=next(r for r in index['samples'] if r['sampleId']==sid)
  need(row['split']=='train' and sid in members,'train isolation')
  if 'sourceCorrection' in row:
   intake=reader.json(row['sourceCorrection']);parent=reader.json(intake['parentDataset'])
   old=next(r for r in reader.json(parent['sourceIndex'])['samples'] if r['sampleId']==row['parentSampleId'])
   need(old['split']=='train','parent train isolation')
   _,identity=cpu.load_sample(reader,old,order,continuous);identity.update(sampleId=sid,image=row['image'])
   sample,identity=auth.load_corrected_sample(reader,row,order,continuous,identity,cpu)
  else:sample,identity=cpu.load_sample(reader,row,order,continuous)
  regime,_,_=derive(reader,identity);samples.append(profile.bind_sample_ecology(reader,sample,identity,regime));identities.append(identity)
 need(parent_pkg['sampleIdentities']==identities,'164 continuity source')
 model,critic=profile.fresh_networks(order)
 value=torch.load(io.BytesIO(reader.read(PARENT['checkpoint'])),map_location='cpu',weights_only=True)
 need(value['schema']=='two-map-checkpoint-fit-state-v1' and value['packageSha256']==PARENT['package']['sha256'] and value['counts']=={'generator':200,'discriminator':200} and value['checkpointPromotable'] is False,'parent checkpoint binding')
 model.load_state_dict(value['model'],strict=True);critic.load_state_dict(value['critic'],strict=True)
 need(sum(x.numel() for x in model.parameters())==2242687,'model size')
 reader.read(PARENT['prediction'])
 return plan,samples,identities,order,model,critic

def project_sources():
 paths={b['path'] for b in common.project_sources()}|{SELF,TEST,'scripts/lib/ai-painter-two-map-experiment-v1.mjs','scripts/tests/test-ai-painter-two-map-experiment.mjs','scripts/lib/ai-painter-terrain-routing-comparison-v1.mjs','scripts/lib/ai-painter-rock-background-probe-v1.mjs','scripts/tests/test-ai-painter-rock-background-probe.mjs','ml/ai-painter/scripts/painter_stage4_rock_background_training_profile_v1.py','ml/ai-painter/src/ai_painter/complete_world/isolated_rock_background_proxy_v1.py','ml/ai-painter/tests/test_isolated_rock_background_proxy_v1.py','ml/ai-painter/scripts/painter_stage4_support_terrain_gradient_training_profile_v1.py','ml/ai-painter/src/ai_painter/complete_world/object_support_terrain_gradient_device_v1.py'}
 need(len(paths)<=256,'source ceiling')
 return [binding(p) for p in sorted(paths)]

def prepare(policy):
 need(policy in (POLICY,SUCCESSOR_POLICY),'exact policy');p=read(binding(policy));validate_policy(p)
 need(policy==POLICY and p['arm']=='background','policy route differs')
 api=imports(p);torch,np,psutil,auth,profile,*_=api;reader=api[6].BoundReader(ROOT)
 plan,samples,identities,order,model,critic=source(reader,p,api)
 model.eval();scores=[]
 with torch.inference_mode():
  for sample in samples:
   prediction=profile.sample_forward(model,sample)
   need(prediction.shape==(1,3,192,256) and bool(torch.isfinite(prediction).all()),'CPU RGB')
   scores.append(api[-1](prediction.cpu(),sample,order))
 reader.unchanged()
 artifacts=[{'role':'metrics','sampleId':SAMPLES[sample_index(step)],'split':'train','optimizerStep':step,'measurementScope':'original_pre_update_objectives_for_successfully_committed_pair'} for step in range(1,101)]
 for step in p['training']['observations']:
  for sid in SAMPLES:
   for role in ('prediction','metrics'):artifacts.append({'role':role,'sampleId':sid,'split':'train','optimizerStep':step,'measurementScope':'fixed_sample_evaluation'})
 artifacts.append({'role':'checkpoint','optimizerStep':100})
 payload={'schemaVersion':'rock-background-probe-package-v1','arm':p['arm'],'policy':binding(policy),'resources':p['resources'],'training':p['training'],
  'sourcePlan':binding(common.BASE+'/quality-plan.json'),'sourceTerminal':binding(common.BASE+'/worker-terminal.json'),'parentExperiment':PARENT,
  'selectedSampleIds':SAMPLES,'sampleIdentities':identities,'inputs':[{'path':k,'sha256':v} for k,v in sorted(reader.observed.items())],
  'programs':project_sources(),'specification':binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),
  'optimizerInitialization':'fresh_AdamW_no_parent_moments_available','qualificationGranted':False,
  'interfaceContract':descriptor([{k:i[k] for k in ('sampleId','split','image','conditionPack') if k in i} for i in identities],plan['configuration']['scope']['resolution'],{'generator':100,'discriminator':100},artifacts,binding('ml/ai-painter/scripts/training_observation_recorder_v1.py'))}
 run='rock-background-v2-'+hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()[:20]
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
  need(time.monotonic()-started<900,'wall budget exhausted')
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
   slot='149' if sample['sampleId']==SAMPLES[0] else '164';buf=io.BytesIO()
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
   proof=profile.zero_update_probe(model,critic,sample,order,guard,failure_evidence=probe_failure)
   put(f'zero-update-gpu-probe-{n}.json',proof)
  for sample in samples:
   prediction=observe(0,sample)
   if sample['sampleId']==SAMPLES[1]:
    from PIL import Image
    old=np.asarray(Image.open(io.BytesIO(reader.read(PARENT['prediction']))).convert('RGB'))
    current=(prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')
    need(np.array_equal(old,current),'parent 164 baseline differs')
    baseline_binding=next((a['binding'] for a in observer.artifacts if a['role']=='prediction' and a.get('sampleId')==SAMPLES[1] and a['optimizerStep']==0),None)
    observer.attempt(lambda:put('parent-output-continuity.json',{'parentCheckpoint':PARENT['checkpoint'],'parentPrediction':PARENT['prediction'],'newBaselinePrediction':baseline_binding,'newBaselinePredictionObservationStatus':'recorded' if baseline_binding else 'not_recorded','quantizedRgbPixelsExactlyEqual':True,'optimizerMomentsRestored':False}))
  need({b['path'] for b in project_sources()}<={b['path'] for b in pkg['programs']},'undeclared source')
  need(all(binding(b['path'])==b for b in pkg['programs']),'source changed before optimization')
  args=dict(lr=.0001,betas=(.9,.999),eps=1e-8,weight_decay=.01,foreach=False,fused=False)
  go=torch.optim.AdamW(model.parameters(),**args);do=torch.optim.AdamW(critic.parameters(),**args)
  phase='training';model.train();critic.train()
  for step in range(1,101):
   guard();sample=samples[sample_index(step)];active_sample=sample['sampleId'];ledger={'sampleId':active_sample,'generator':0,'discriminator':0}
   result=worker.observed_pair(profile.perform_pair,model,model,critic,sample,order,go,do,counts,ledger,guard,None)
   need(counts=={'generator':step,'discriminator':step},'committed count');visits[active_sample]+=1
   observer.committed_metric(counts,active_sample,values,put,result)
   observer.attempt(lambda:observer.progress(counts,phase,gpu_started=True))
   if step in p['training']['observations']:
    for fixed in samples:observe(step,fixed)
  phase='checkpoint';need(visits==dict.fromkeys(SAMPLES,50),'balanced visits')
  value={'schema':'two-map-checkpoint-fit-state-v1','packageSha256':bound['sha256'],'counts':dict(counts),'sampleVisits':visits,'checkpointPromotable':False,'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()}}
  buf=io.BytesIO();torch.save(value,buf);checkpoint=put('checkpoint-final.pt',buf.getvalue())
  loaded=torch.load(io.BytesIO((ROOT/checkpoint['path']).read_bytes()),map_location='cpu',weights_only=True);validate_checkpoint(loaded,bound)
  fresh,fresh_critic=profile.fresh_networks(order);fresh.load_state_dict(loaded['model'],strict=True);fresh_critic.load_state_dict(loaded['critic'],strict=True)
  for current,reloaded in ((model,fresh),(critic,fresh_critic)):
   need(all(torch.equal(v.detach().cpu(),reloaded.state_dict()[k]) for k,v in current.state_dict().items()),'strict reload state differs')
  fresh.to('cuda:0');fresh.eval();model.eval()
  with torch.inference_mode():
   for sample in samples:
    guard();need(torch.equal(profile.sample_forward(model,sample),profile.sample_forward(fresh,sample)),'strict reload RGB differs')
  reader.unchanged();need(all(binding(b['path'])==b for b in pkg['programs']),'source changed after training')
  observer.attempt(lambda:observer.artifact('checkpoint',checkpoint,100,promotable=False))
  observation=observer.attempt(lambda:observer.finish(counts,'completed',phase))
  put('result.json',{'status':'experiment_executed_not_visual_qualified','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'gpuStarted':True,'trainingStarted':True,'optimizerSteps':counts,'sampleVisits':visits,'arm':p['arm'],'backgroundAuxiliaryChanged':p['backgroundAuxiliaryChanged'],'checkpointReloadExact':True,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'formalQualificationGranted':False,'trainingObservation':observation,'observationSecondaryErrors':observer.errors})
 except BaseException as error:
  evidence=getattr(error,'object_support_gradient_evidence',{})
  try:
   raw=evidence.get('rawGradients',[])
   if raw:
    buf=io.BytesIO();torch.save({'gradients':[[None if x is None else x.detach().cpu() for x in rows] for rows in raw],'labels':evidence.get('componentsInOrder'),'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()},'sampleId':active_sample,'counts':counts},buf);put('gradient-failure-tensors.pt',buf.getvalue())
  except BaseException as secondary:observer.attempt(lambda:put('capture-error.json',{'errorType':type(secondary).__name__}))
  observation=observer.attempt(lambda:observer.finish(counts,'failed_closed',phase))
  try:
   put('result.json',{'status':'experiment_failed_closed','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'phase':phase,'sampleId':active_sample,'error':str(error),'errorType':type(error).__name__,'gpuStarted':gpu,'trainingStarted':any(counts.values()),'optimizerSteps':counts,'sampleVisits':visits,'arm':p['arm'],'backgroundAuxiliaryChanged':p['backgroundAuxiliaryChanged'],'checkpointReloadExact':False,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'probeFailure':locals().get('probe_failure',{}),'trainingObservation':observation,'observationSecondaryErrors':observer.errors})
  except Exception:
   import sys
   print('training_result_publication_failed_original_error_preserved',file=sys.stderr,flush=True)
  raise

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','run']);parser.add_argument('--policy',default=POLICY);parser.add_argument('--package');parser.add_argument('--sha256');args=parser.parse_args()
 if args.mode=='prepare':print(json.dumps(prepare(args.policy)))
 else:execute({'path':args.package,'sha256':args.sha256})
