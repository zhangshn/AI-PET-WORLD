"""Isolated map164 continuation, launched only by the registered experiment controller."""
from pathlib import Path
import os,sys,json,hashlib,io,time,subprocess,argparse,random
from datetime import datetime,timezone
ROOT=Path(__file__).absolute().parents[3]
for p in ('ml/ai-painter/src','ml/ai-painter/scripts'):sys.path.insert(0,str(ROOT/p))
from training_observation_recorder_v1 import ObservationRecorder,descriptor,start_clock,finish_clock,IMAGE_SCOPE
POLICY='data/ai-painter/system-governance/ai-painter-single-map-checkpoint-fit-policy-v1.json'
SUCCESSOR_POLICY='data/ai-painter/system-governance/ai-painter-single-map-checkpoint-fit-policy-v2.json'
PARENT_RUN='single-map164-v1-891acf6750df23c35dba'
PARENT_ROOT='.runtime/ai-painter/learning-capacity-experiments/'+PARENT_RUN
PARENT={key:{'path':PARENT_ROOT+'/'+name,'sha256':sha} for key,name,sha in (
 ('package','package.json','6f4c8a8f6893c0115ef26e8f06b2c0c82498e4219e81dc141f5ac074e5749c37'),
 ('terminal','terminal.json','e49f73bf82c15884bf025de46f26ffc689d7caa905fae45ae61bdad9028f592b'),
 ('result','result.json','97228ce782e26b205106b9187e7d26c4e2d31397a5df868da5663249aee54366'),
 ('checkpoint','checkpoint-final.pt','75133e471900ece0dd0de70ba973d2dfa93f957265d93d1c4763983d6392ba4b'),
 ('prediction','prediction-200.png','7814048f09638e6575fc6ab34c8f9496448f7b97f12247aadd3403e8a3c216cb'))}
SELF='ml/ai-painter/scripts/painter_single_map_checkpoint_fit_v1.py'
TEST='ml/ai-painter/tests/test_single_map_checkpoint_fit_v1.py'
RUN='d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8'
BASE='.runtime/ai-painter/registered-training-d1-src-v1-executions/'+RUN
OUTPUT='.runtime/ai-painter/learning-capacity-experiments/'
def need(v,msg):
 if not v:raise ValueError(msg)
def now():return datetime.now(timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def binding(p):return {'path':p,'sha256':digest((ROOT/p).read_bytes())}
def read(b):
 raw=(ROOT/b['path']).read_bytes();need(digest(raw)==b['sha256'],'input SHA differs: '+b['path']);return json.loads(raw)
def save(p,obj):
 target=ROOT/p;target.parent.mkdir(parents=True,exist_ok=True)
 raw=obj if isinstance(obj,bytes) else json.dumps(obj,ensure_ascii=False,allow_nan=False,indent=2).encode('utf-8')
 with target.open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
 return binding(p)
def validate_policy(p):
 need(p['schemaVersion'] in ('single-map-checkpoint-fit-policy-v1','single-map-checkpoint-fit-policy-v2') and p['sourceRunId']==RUN,'policy identity')
 need(p['sampleId']=='mvp64-slot164-objects-v5-20261020','selected train map')
 need(p['checkpointSha256']=='275886bb27c2ba1942c768f4cbb1bb7fc2c49024509d8b06e2ed6a5f832d49d4','exact checkpoint')
 need(p['training']=={'pairs':200,'seed':20260929,'supportStructureWeight':0.1,'checkpointSelection':'final_step_only','observations':[0,25,50,100,150,200]},'fixed training plan')
 need(p['resources']=={'maxWallSeconds':1800,'cudaMemoryFraction':.7,'minimumFreeVramMiB':2048,'maximumTemperatureC':85,'minimumFreeDiskMiB':2048,'maxOutputMiB':128,'cpuThreads':2,'automaticRetries':0},'resource boundary')
 for k in ('modelArchitectureChanged','lossChanged','gradientThresholdChanged','sourceImagesOrConditionsChanged','validationContentAllowed','checkpointPromotable','runtimePublicationAllowed','automaticResumeAllowed','parentExecutionPermissionInherited'):need(p[k] is False,k)
 successor=p['schemaVersion']=='single-map-checkpoint-fit-policy-v2'
 need(p['initialization']==('exact_completed_single_map_v1_generator_and_critic_weights_fresh_original_AdamW' if successor else 'exact_completed_epoch24_generator_and_critic_weights_fresh_original_AdamW'),'initialization')
 need(p.get('parentExperiment')==PARENT if successor else 'parentExperiment' not in p,'exact completed parent binding')
def validate_parent(package,terminal,result,sample_id):
 need(package['experimentIdentity']==terminal['experimentIdentity']==result['experimentIdentity']==PARENT_RUN,'parent run identity')
 need(package['selectedSampleId']==sample_id and package['policy']['path']==POLICY,'parent source policy/sample')
 need(terminal['executionState']=='completed' and terminal['result']==PARENT['result'],'parent terminal')
 need(result['status']=='experiment_executed_not_visual_qualified' and result['checkpointReloadExact'] is True and result['optimizerSteps']=={'generator':200,'discriminator':200},'parent execution did not complete')
 need(PARENT['checkpoint'] in result['artifacts'] and PARENT['prediction'] in result['artifacts'],'parent artifact identity')
def imports():
 import torch,numpy as np,psutil
 torch.set_num_threads(2);torch.set_num_interop_threads(2)
 psutil.Process().cpu_affinity(psutil.Process().cpu_affinity()[:2])
 import decode1_entry_weight_quality_auth_v1 as auth
 import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
 import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
 import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
 from painter_stage4_appearance_regime_probe import derive_regime_record
 from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as codec
 from painter_stage4_decode1_entry_weight_lifecycle_v1 import existing_values
 from current_checkpoint_fit_metrics_v1 import sample_metrics
 from painter_learning_capacity_experiment import verify_controller_process
 return torch,np,psutil,auth,profile,worker,cpu,derive_regime_record,codec,existing_values,sample_metrics
def source(reader,p,api):
 torch,np,psutil,auth,profile,worker,cpu,derive,codec,values,metrics=api
 plan=reader.json(binding(BASE+'/quality-plan.json'));terminal=reader.json(binding(BASE+'/worker-terminal.json'))
 need(terminal['completedEpochs']==24 and terminal['checkpointReloadVerified'] is True,'completed parent required')
 selected=terminal['selectedCheckpointRecord'];need(selected['checkpoint']['sha256']==p['checkpointSha256'],'parent checkpoint differs')
 manifest=reader.json(plan['datasetManifest']);index=reader.json(manifest['sourceIndex'])
 row=next(r for r in index['samples'] if r['sampleId']==p['sampleId'])
 need(row['split']=='train' and row['sampleId'] in reader.json(plan['trainSplit'])['sampleIds'],'train isolation')
 intake=reader.json(row['sourceCorrection']);parent=reader.json(intake['parentDataset'])
 old=next(r for r in reader.json(parent['sourceIndex'])['samples'] if r['sampleId']==row['parentSampleId'])
 need(old['split']=='train','parent train only')
 order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds']
 _,identity=cpu.load_sample(reader,old,order,continuous)
 identity.update(sampleId=row['sampleId'],image=row['image'])
 sample,identity=auth.load_corrected_sample(reader,row,order,continuous,identity,cpu)
 record,_,_=derive(reader,identity);sample=profile.bind_sample_ecology(reader,sample,identity,record)
 model,critic=profile.fresh_networks(order)
 codec.reload(reader.read(selected['checkpoint']),model=model,critic=critic,configuration=plan['configuration'],run_id=RUN,
  package_binding=terminal['executionPackage'],dataset_binding=plan['datasetManifest'],epoch=24,selection=selected['selection'],counts=selected['counts'],program_bindings=plan['programBindings'],plan_binding=binding(BASE+'/quality-plan.json'))
 need(sum(x.numel() for x in model.parameters())==2242687,'model size differs')
 if 'parentExperiment' in p:
  parent_pkg=reader.json(PARENT['package']);parent_terminal=reader.json(PARENT['terminal']);parent_result=reader.json(PARENT['result'])
  validate_parent(parent_pkg,parent_terminal,parent_result,p['sampleId'])
  need(parent_pkg['sampleIdentity']==identity,'parent/current source identity differs')
  states=torch.load(io.BytesIO(reader.read(PARENT['checkpoint'])),map_location='cpu',weights_only=True)
  validate_saved_checkpoint(states,PARENT['package'])
  model.load_state_dict(states['model'],strict=True);critic.load_state_dict(states['critic'],strict=True)
  reader.read(PARENT['prediction']);selected={**selected,'checkpoint':PARENT['checkpoint']}
 return plan,selected,sample,identity,order,model,critic
def project_sources():
 paths={SELF,TEST,'scripts/run-ai-painter-learning-capacity-experiment.mjs','src/server/ai-painter-current-execution-registry.mjs','scripts/lib/real-earth-region-governance.mjs',
  'src/server/ai-console/training-observation-contract.mjs','ml/ai-painter/tests/test_training_observation_recorder_v1.py',
  'scripts/tests/test-training-observation-contract.mjs','scripts/tests/helpers/training-observation-fixture.mjs'}
 for m in tuple(sys.modules.values()):
  f=getattr(m,'__file__',None)
  if f:
   path=Path(f).absolute()
   if path.is_relative_to(ROOT/'ml/ai-painter') and not path.is_relative_to(ROOT/'ml/ai-painter/.venv'):paths.add(path.relative_to(ROOT).as_posix())
 need(len(paths)<=256,'source ceiling');return [binding(p) for p in sorted(paths)]
def prepare(policy):
 need(policy in (POLICY,SUCCESSOR_POLICY),'exact policy');p=read(binding(policy));validate_policy(p)
 need((policy==SUCCESSOR_POLICY)==('parentExperiment' in p),'policy route differs')
 api=imports();torch,np,psutil,auth,profile,*_=api;reader=api[6].BoundReader(ROOT)
 plan,selected,sample,identity,order,model,critic=source(reader,p,api)
 torch.manual_seed(p['training']['seed']);np.random.seed(p['training']['seed']);random.seed(p['training']['seed'])
 # CPU construction/reload/source checks only; original zero-update numerical gate runs on the actual GPU.
 model.eval();critic.eval()
 with torch.inference_mode():baseline=profile.sample_forward(model,sample)
 api[-1](baseline.cpu(),sample,order)
 need(tuple(baseline.shape)==(1,3,192,256) and bool(torch.isfinite(baseline).all()),'CPU baseline')
 reader.unchanged();sources=project_sources()
 artifact_plan=[{'role':'metrics','sampleId':p['sampleId'],'split':'train','optimizerStep':step,
  'measurementScope':'original_pre_update_objectives_for_successfully_committed_pair'} for step in range(1,p['training']['pairs']+1)]
 for step in p['training']['observations']:
  for role in ('prediction','metrics'):artifact_plan.append({'role':role,'sampleId':p['sampleId'],'split':'train','optimizerStep':step,'measurementScope':'fixed_sample_evaluation'})
 artifact_plan.append({'role':'checkpoint','optimizerStep':p['training']['pairs']})
 payload={'schemaVersion':'single-map-checkpoint-fit-package-v1','policy':binding(policy),'resources':p['resources'],'training':p['training'],
  'sourcePlan':binding(BASE+'/quality-plan.json'),'sourceTerminal':binding(BASE+'/worker-terminal.json'),'checkpoint':selected['checkpoint'],
  'selectedSampleId':p['sampleId'],'sampleIdentity':identity,'inputs':[{'path':k,'sha256':v} for k,v in sorted(reader.observed.items())],
  'programs':sources,'specification':binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),
  'optimizerInitialization':'fresh_AdamW_no_parent_moments_available','qualificationGranted':False,
  'interfaceContract':descriptor([{k:identity[k] for k in ('sampleId','split','image','conditionPack') if k in identity}],
   plan['configuration']['scope']['resolution'],{'generator':p['training']['pairs'],'discriminator':p['training']['pairs']},
   artifact_plan,binding('ml/ai-painter/scripts/training_observation_recorder_v1.py'))}
 run=('single-map164-v2-' if 'parentExperiment' in p else 'single-map164-v1-')+digest(json.dumps(payload,sort_keys=True).encode())[:20]
 payload.update(experimentIdentity=run,outputRoot=OUTPUT+run)
 path=payload['outputRoot']+'/package.json'
 if (ROOT/path).exists():need(read(binding(path))==payload,'package changed');return binding(path)
 result=save(path,payload)
 save(payload['outputRoot']+'/cpu-source-check.json',{'status':'passed','recordedAtUtc':now(),'modelParameterElements':2242687,'selectedSampleId':p['sampleId'],'baselineRgbMae':float((baseline[0]-sample['image']).abs().mean()),'optimizerUpdates':0,'cudaInitialized':torch.cuda.is_initialized(),'note':'CPU source and strict reload checks; not GPU numerical admission'})
 return result
def validate_saved_checkpoint(value,pkg):
 need(value['schema']=='single-map-checkpoint-fit-state-v1' and value['packageSha256']==pkg['sha256'],'checkpoint identity')
 need(value['counts']=={'generator':200,'discriminator':200} and value['checkpointPromotable'] is False,'checkpoint count/qualification')
def execute(bound, *, implementation=None):
 runtime=implementation if implementation is not None else sys.modules[__name__]
 pkg=read(bound);p=read(pkg['policy']);runtime.validate_policy(p);out=pkg['outputRoot']
 parent=runtime.PARENT
 need(out==OUTPUT+pkg['experimentIdentity'],'output boundary')
 for b in pkg['inputs']+pkg['programs']+[pkg['specification']]:need(binding(b['path'])==b,'frozen source changed: '+b['path'])
 api=runtime.imports();torch,np,psutil,auth,profile,worker,cpu,derive,codec,existing_values,metrics=api
 from painter_learning_capacity_experiment import verify_controller_process
 lease=read(binding(out+'/controller-lease.json'));regraw=(ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes()
 need(digest(regraw)==lease['registrySha256'],'registry lease changed');verify_controller_process(lease,json.loads(regraw),os.getppid())
 save(out+'/worker-started.json',{'recordedAtUtc':now(),'pid':os.getpid(),'package':bound})
 observer=ObservationRecorder(ROOT,pkg,bound,json.loads(regraw)['activeExecution'])
 started=time.monotonic();counts={'generator':0,'discriminator':0};gpu=False;artifacts=[];phase='loading';last_poll=0;device_id=None;model=critic=None
 observer.attempt(lambda:observer.progress(counts,phase))
 def put(name,value):
  b=save(out+'/'+name,value);artifacts.append(b);return b
 def guard():
  nonlocal last_poll,device_id
  need(time.monotonic()-started<1800,'wall budget exhausted')
  need(sum(f.stat().st_size for f in (ROOT/out).rglob('*') if f.is_file())<126*1024**2,'output reserve')
  need(psutil.disk_usage(str(ROOT/out)).free>2048*1024**2,'disk floor')
  need(psutil.pid_exists(lease['workerParentPid']),'controller disappeared')
  live=json.loads((ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes())
  need(live['runId']==pkg['experimentIdentity'] and live['activeExecution'] is not None,'execution no longer active')
  heartbeat=json.loads((ROOT/out/'heartbeat.json').read_bytes())
  need(time.time()-datetime.fromisoformat(heartbeat['heartbeatAtUtc'].replace('Z','+00:00')).timestamp()<120,'heartbeat stale')
  if time.monotonic()-last_poll>3:
   raw=subprocess.run(['nvidia-smi','--query-gpu=uuid,temperature.gpu,memory.free','--format=csv,noheader,nounits','-i','0'],capture_output=True,text=True,check=True,timeout=10).stdout.strip().split(',')
   need(len(raw)==3 and float(raw[1])<85 and float(raw[2])>=2048,'GPU resource floor/temperature')
   if device_id is None:device_id=raw[0].strip()
   need(device_id==raw[0].strip(),'GPU changed');last_poll=time.monotonic()
 def observe(step):
  guard();modes=[(m,m.training) for m in model.modules()]
  image_started=start_clock()
  try:
   model.eval()
   with torch.inference_mode():prediction=profile.sample_forward(model,sample).detach().cpu()
  finally:
   for m,mode in modes:m.training=mode
  def publish_observation():
   from PIL import Image
   buf=io.BytesIO();Image.fromarray((prediction[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')).save(buf,format='PNG')
   image=put(f'prediction-{step:03}.png',buf.getvalue())
   image_timing=finish_clock(image_started,IMAGE_SCOPE)
   observer.artifact('prediction',image,step,sampleId=p['sampleId'],split='train',
    resolution=pkg['interfaceContract']['resolution'],measurementScope='fixed_sample_evaluation',imageTiming=image_timing)
   score=metrics(prediction,sample,order)
   observation=put(f'observation-{step:03}.json',{'step':step,'optimizerSteps':dict(counts),'sampleId':p['sampleId'],'prediction':image,'metrics':score,'recordedAtUtc':now()})
   observer.artifact('metrics',observation,step,sampleId=p['sampleId'],split='train',measurementScope='fixed_sample_evaluation')
   print(json.dumps({'stage':'observation','step':step,'rgbMae':score['fullRgbMae'],'prediction':image}),flush=True)
  observer.attempt(publish_observation)
  return prediction
 try:
  reader=cpu.BoundReader(ROOT);plan,selected,sample,identity,order,model,critic=runtime.source(reader,p,api)
  need(identity==pkg['sampleIdentity'],'sample identity changed')
  torch.manual_seed(p['training']['seed']);np.random.seed(p['training']['seed']);random.seed(p['training']['seed'])
  need(torch.cuda.is_available(),'CUDA unavailable');guard();torch.cuda.set_per_process_memory_fraction(.7);torch.cuda.set_device(0)
  model.to('cuda:0');critic.to('cuda:0');gpu=True
  phase='zero_update_gpu';probe_failure={}
  probe=profile.zero_update_probe(model,critic,sample,order,guard,failure_evidence=probe_failure)
  put('zero-update-gpu-probe.json',probe);baseline=observe(0)
  if 'parentExperiment' in p:
   from PIL import Image
   old_pixels=np.asarray(Image.open(io.BytesIO(reader.read(parent['prediction']))).convert('RGB'))
   new_pixels=(baseline[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')
   need(np.array_equal(old_pixels,new_pixels),'successor baseline differs from parent final image')
   baseline_binding=next((a['binding'] for a in observer.artifacts if a['role']=='prediction' and a['optimizerStep']==0),None)
   observer.attempt(lambda:put('parent-output-continuity.json',{'parentCheckpoint':parent['checkpoint'],'parentPrediction':parent['prediction'],
    'newBaselinePrediction':baseline_binding,'newBaselinePredictionObservationStatus':'recorded' if baseline_binding else 'not_recorded',
    'quantizedRgbPixelsExactlyEqual':True,'optimizerMomentsRestored':False}))
  missing_sources=sorted({b['path'] for b in runtime.project_sources()}-{b['path'] for b in pkg['programs']})
  need(not missing_sources,'undeclared loaded source before optimization: '+','.join(missing_sources))
  need(all(binding(b['path'])==b for b in pkg['programs']),'source changed before optimization')
  args=dict(lr=.0001,betas=(.9,.999),eps=1e-8,weight_decay=.01,foreach=False,fused=False)
  go=torch.optim.AdamW(model.parameters(),**args);do=torch.optim.AdamW(critic.parameters(),**args)
  phase='training';model.train();critic.train()
  for step in range(1,201):
   guard();ledger={'sampleId':sample['sampleId'],'generator':0,'discriminator':0}
   result=worker.observed_pair(profile.perform_pair,model,model,critic,sample,order,go,do,counts,ledger,guard,None)
   need(counts=={'generator':step,'discriminator':step},'update counts differ')
   observer.committed_metric(counts,sample['sampleId'],existing_values,put,result)
   observer.attempt(lambda:observer.progress(counts,phase,gpu_started=gpu))
   if step in p['training']['observations']:observe(step)
  phase='checkpoint'
  states={'schema':'single-map-checkpoint-fit-state-v1','packageSha256':bound['sha256'],'counts':dict(counts),'checkpointPromotable':False,'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()}}
  buf=io.BytesIO();torch.save(states,buf);ck=put('checkpoint-final.pt',buf.getvalue());loaded=torch.load(io.BytesIO((ROOT/ck['path']).read_bytes()),map_location='cpu',weights_only=True);runtime.validate_saved_checkpoint(loaded,bound)
  fresh,fresh_critic=profile.fresh_networks(order);fresh.load_state_dict(loaded['model'],strict=True);fresh_critic.load_state_dict(loaded['critic'],strict=True)
  need(all(torch.equal(v.detach().cpu(),fresh.state_dict()[k]) for k,v in model.state_dict().items()),'reload G state differs')
  need(all(torch.equal(v.detach().cpu(),fresh_critic.state_dict()[k]) for k,v in critic.state_dict().items()),'reload D state differs')
  fresh.to('cuda:0');fresh.eval();model.eval()
  with torch.inference_mode():a=profile.sample_forward(model,sample);b=profile.sample_forward(fresh,sample)
  need(torch.equal(a,b),'reloaded prediction differs');reader.unchanged()
  need(all(binding(b['path'])==b for b in pkg['programs']),'source changed after training')
  observer.attempt(lambda:observer.artifact('checkpoint',ck,counts['generator'],promotable=False))
  observation_binding=observer.attempt(lambda:observer.finish(counts,'completed',phase))
  put('result.json',{'status':'experiment_executed_not_visual_qualified','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'gpuStarted':True,'trainingStarted':True,'optimizerSteps':dict(counts),'checkpointReloadExact':True,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'formalQualificationGranted':False,
   'trainingObservation':observation_binding,'observationSecondaryErrors':observer.errors})
 except BaseException as error:
  evidence=getattr(error,'object_support_gradient_evidence',{})
  try:
   raw=evidence.get('rawGradients',[])
   if raw:
    buf=io.BytesIO();torch.save({'gradients':[[None if x is None else x.detach().cpu() for x in rows] for rows in raw],'labels':evidence.get('componentsInOrder'), 'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},'critic':{k:v.detach().cpu() for k,v in critic.state_dict().items()},'sampleId':p['sampleId'],'counts':counts},buf);put('gradient-failure-tensors.pt',buf.getvalue())
  except BaseException as secondary:observer.attempt(lambda:put('capture-error.json',{'errorType':type(secondary).__name__}))
  observation_binding=observer.attempt(lambda:observer.finish(counts,'failed_closed',phase))
  try:
   put('result.json',{'status':'experiment_failed_closed','experimentIdentity':pkg['experimentIdentity'],'recordedAtUtc':now(),'phase':phase,'error':str(error),'errorType':type(error).__name__,'gpuStarted':gpu,'trainingStarted':counts['generator']>0 or counts['discriminator']>0,'optimizerSteps':dict(counts),'checkpointReloadExact':False,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'probeFailure':locals().get('probe_failure',{}),
    'trainingObservation':observation_binding,'observationSecondaryErrors':observer.errors})
  except Exception:
   try:print('training_result_publication_failed_original_error_preserved',file=sys.stderr,flush=True)
   except Exception:pass
  raise
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('mode',choices=['prepare','run']);a.add_argument('--policy',default=POLICY);a.add_argument('--package');a.add_argument('--sha256');args=a.parse_args()
 if args.mode=='prepare':print(json.dumps(prepare(args.policy)))
 else:execute({'path':args.package,'sha256':args.sha256})
