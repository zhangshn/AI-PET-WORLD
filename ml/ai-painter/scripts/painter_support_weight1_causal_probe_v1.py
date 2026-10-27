"""One newly registered zero-update call, original operator/gradient gate intact."""
import argparse,hashlib,io,json,os,subprocess,time
from unittest.mock import patch
import painter_mixed_train_rehearsal_v1 as fit
common=fit.common;ROOT=fit.ROOT;need=fit.need;binding=fit.binding;read=fit.read;save=fit.save;now=fit.now
POLICY='data/ai-painter/system-governance/ai-painter-support-weight1-causal-probe-policy-v1.json'
TARGET44_POLICY='data/ai-painter/system-governance/ai-painter-parameter44-causal-probe-policy-v1.json'
SELF='ml/ai-painter/scripts/painter_support_weight1_causal_probe_v1.py'
TEST='ml/ai-painter/tests/test_support_weight1_causal_probe_v1.py'
SAMPLE='ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2'

def validate_policy(p):
 need(p['schemaVersion']=='support-weight1-causal-probe-policy-v1' and p['sampleId']==SAMPLE,'diagnostic identity')
 need(p.get('targetIndex',0) in (0,44),'known causal target')
 need(p['coordinate']==([52,0,0,0] if p.get('targetIndex')==44 else [13,11,0,0]) and p['counts']=={'generatorForwards':1,'generatorAutograd':5,'discriminatorAutograd':1,'optimizerUpdates':0},'fixed one-call scope')
 need(p['resources']=={'maxWallSeconds':180,'cudaMemoryFraction':.7,'minimumFreeVramMiB':2048,'maximumTemperatureC':85,'minimumFreeDiskMiB':2048,'maxOutputMiB':128,'cpuThreads':2,'automaticRetries':0},'diagnostic resource boundary')
 need(p['initialization']=='completed_common_parent_weights_verified_equal_to_zero_update_failure' and p['preparationMaxWallSeconds']==300,'initialization')
 for k in ('trainingAllowed','historicalReplayClaimed','formalQualificationGranted'):need(p[k] is False,k)

def source(reader,p,api):
 torch=api[0];policy=reader.json(p['sourceTrainingPolicy']);fit.validate_policy(policy)
 terminal=reader.json(p['sourceFailureTerminal']);result=reader.json(terminal['result'])
 need(terminal['executionState']=='failed_closed' and result['phase']=='zero_update_gpu' and result['sampleId']==SAMPLE and result['optimizerSteps']=={'generator':0,'discriminator':0},'exact zero-update source failure')
 need(result['error']=='actual four-term total gradient identity differs at parameter '+str(p.get('targetIndex',0)) and p['sourceFailureTensors'] in result['artifacts'],'original failure archive')
 failed_pkg=reader.json(terminal['executionPackage']);need(failed_pkg['policy']==p['sourceTrainingPolicy'],'original policy binding')
 analysis=reader.json(p['sourceAnalysis']);need(analysis['sourceTensorArchive']==p['sourceFailureTensors'],'analysis archive binding')
 plan,samples,identities,order,model,critic=fit.source(reader,policy,api)
 archived=torch.load(io.BytesIO(reader.read(p['sourceFailureTensors'])),map_location='cpu',weights_only=True)
 need(archived['counts']=={'generator':0,'discriminator':0} and archived['sampleId']==SAMPLE,'archived counters')
 for network,key in ((model,'model'),(critic,'critic')):
  state=network.state_dict();need(tuple(state)==tuple(archived[key]) and all(torch.equal(v,archived[key][k]) for k,v in state.items()),'completed parent differs from zero-update failed state')
 n=fit.SAMPLES.index(SAMPLE)
 return samples[n],identities[n],order,model,critic

def project_sources():
 paths={b['path'] for b in fit.project_sources()}|{SELF,TEST,'scripts/lib/ai-painter-support-weight1-causal-probe-v1.mjs','scripts/tests/test-ai-painter-support-weight1-causal-probe.mjs','ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_observation_v1.py'}
 need(len(paths)<=256,'source ceiling');return [binding(p) for p in sorted(paths)]

def local_reference(input_tensor,adjoints,raw,coordinate,target_index=0):
 import torch
 o,i,ky,kx=coordinate
 shape=(1,96,96,128) if target_index==44 else (1,31,192,256)
 need(len(adjoints)==len(raw)==5 and input_tensor.shape==shape,'local reference geometry')
 h,w=shape[-2:]
 x=torch.nn.functional.pad(input_tensor[:,i:i+1].double(),(1,1,1,1))[0,0,ky:ky+h,kx:kx+w]
 reference=[float((x*a[0,o].double()).sum()) for a in adjoints]
 native=[float(g[tuple(coordinate)]) for g in raw]
 upstream=reference[0]-sum(reference[1:]);total=native[0]-sum(native[1:])
 return {'coordinate':list(coordinate),'nativeWeightGradients':native,'fp64LocalWeightVjp':reference,'nativeMinusLocal':[n-r for n,r in zip(native,reference)],'nativeTotalMinusComponentSumFp64':total,'localTotalMinusComponentSumFp64':upstream,'localReductionContribution':total-upstream,'referenceIsFinitePrecision':True}

def prepare(policy):
 need(policy==TARGET44_POLICY,'consumed target0 diagnostic is read-only; exact target44 policy required');p=read(binding(policy));validate_policy(p)
 api=fit.imports(p);torch=api[0];reader=api[6].BoundReader(ROOT)
 from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target0Observation
 sample,identity,order,model,critic=source(reader,p,api);model.eval()
 with torch.inference_mode():prediction=api[4].sample_forward(model,sample)
 need(prediction.shape==(1,3,192,256) and bool(torch.isfinite(prediction).all()) and not torch.cuda.is_initialized(),'one CPU forward')
 reader.unchanged();payload={'schemaVersion':'support-weight1-causal-probe-package-v1','policy':binding(policy),'resources':p['resources'],'sampleId':SAMPLE,'targetIndex':p.get('targetIndex',0),'sampleIdentity':identity,'inputs':[{'path':k,'sha256':v} for k,v in sorted(reader.observed.items())],'programs':project_sources(),'specification':binding('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),'formalQualificationGranted':False}
 run=('parameter44-causal-probe-v1-' if p.get('targetIndex')==44 else 'support-weight1-causal-probe-v1-')+hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()[:20];payload.update(experimentIdentity=run,outputRoot=common.OUTPUT+run)
 target=payload['outputRoot']+'/package.json'
 if (ROOT/target).exists():need(read(binding(target))==payload,'package changed');return binding(target)
 return save(target,payload)

def execute(bound):
 pkg=read(bound);p=read(pkg['policy']);validate_policy(p);out=pkg['outputRoot']
 need(out==common.OUTPUT+pkg['experimentIdentity'] and pkg['sampleId']==SAMPLE,'execution identity')
 for b in pkg['inputs']+pkg['programs']+[pkg['specification']]:need(binding(b['path'])==b,'frozen bytes changed')
 api=fit.imports(p);torch,np,psutil,auth,profile,worker,cpu,*_=api
 from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target0Observation
 from painter_learning_capacity_experiment import verify_controller_process
 lease=read(binding(out+'/controller-lease.json'));raw=(ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes();need(hashlib.sha256(raw).hexdigest()==lease['registrySha256'],'registry lease');verify_controller_process(lease,json.loads(raw),os.getppid())
 started=time.monotonic();artifacts=[];gpu=False;phase='loading';last_poll=0;device_id=None
 def put(name,value):
  b=save(out+'/'+name,value);artifacts.append(b);return b
 def guard():
  nonlocal last_poll,device_id
  need(time.monotonic()-started<180,'diagnostic wall budget');need(psutil.disk_usage(str(ROOT/out)).free>=2048*1024**2,'disk boundary');need(psutil.pid_exists(lease['workerParentPid']),'controller missing')
  live=json.loads((ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes());need(live['runId']==pkg['experimentIdentity'] and live['activeExecution'] is not None,'active registry differs')
  from datetime import datetime
  hb=json.loads((ROOT/out/'heartbeat.json').read_bytes());need(time.time()-datetime.fromisoformat(hb['heartbeatAtUtc'].replace('Z','+00:00')).timestamp()<120,'heartbeat stale')
  need(sum(f.stat().st_size for f in (ROOT/out).rglob('*') if f.is_file())<126*1024**2,'output reserve')
  if time.monotonic()-last_poll>3:
   fields=subprocess.run(['nvidia-smi','--query-gpu=uuid,temperature.gpu,memory.free','--format=csv,noheader,nounits','-i','0'],capture_output=True,text=True,check=True,timeout=10).stdout.strip().split(',')
   need(len(fields)==3 and float(fields[1])<85 and float(fields[2])>=2048,'GPU resource boundary')
   if device_id is None:device_id=fields[0].strip()
   need(device_id==fields[0].strip(),'GPU changed');last_poll=time.monotonic()
 def state(network):
  h=hashlib.sha256()
  for k,v in network.state_dict().items():h.update(k.encode());h.update(v.detach().cpu().contiguous().numpy().tobytes())
  return h.hexdigest()
 def deny_optimizer(*a,**k):raise RuntimeError('optimizer prohibited in diagnostic')
 try:
  reader=cpu.BoundReader(ROOT);sample,identity,order,model,critic=source(reader,p,api);guard();before=[state(x) for x in (model,critic)]
  torch.manual_seed(20260929);np.random.seed(20260929);__import__('random').seed(20260929)
  need(torch.cuda.is_available(),'CUDA unavailable');torch.cuda.set_per_process_memory_fraction(.7);torch.cuda.set_device(0);model.to('cuda:0');critic.to('cuda:0');gpu=True;phase='one_zero_update_call'
  from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target40Observation
  class Target44Observation(Target40Observation):
   index=44;name='core.core.terrain.decode_2.layers.3.weight';shape=(96,96,3,3)
  observer=(Target44Observation if p.get('targetIndex')==44 else Target0Observation)(model,guard);failure={};original_error=None;proof=None
  with patch.object(torch.optim.Optimizer,'__init__',deny_optimizer):
   with observer:
    try:proof=profile.zero_update_probe(model,critic,sample,order,guard,event=observer.event,failure_evidence=failure,support_structure_weight=1.0)
    except ValueError as error:
     need(str(error).startswith('actual four-term total gradient identity differs at parameter '),'unexpected probe error: '+str(error));original_error={'type':type(error).__name__,'message':str(error)}
  observer._compact_ready();after=[state(x) for x in (model,critic)];need(before==after,'diagnostic changed weights');need(all(q.grad is None for m in (model,critic) for q in m.parameters()),'diagnostic installed gradients')
  expected_counts={'forwardAttempted':1,'forwardCompleted':1,'generatorAttempted':5,'generatorCompleted':5,'discriminatorAttempted':1,'discriminatorCompleted':1};need(observer.counts==expected_counts,'one-call coverage')
  phase='saved_local_reference';buf=io.BytesIO();torch.save({'input':observer.input,'adjoints':observer.adjoints,'rawWeightGradients':observer.raw,'targetIndex':p.get('targetIndex',0),'counts':observer.counts},buf);capture=put(f"same-call-target{p.get('targetIndex',0)}.pt",buf.getvalue())
  local=local_reference(observer.input,observer.adjoints,observer.raw,p['coordinate'],p.get('targetIndex',0));put('local-reference.json',local)
  reader.unchanged();guard();need(all(binding(b['path'])==b for b in pkg['programs']),'program changed')
  put('result.json',{'status':'zero_update_causal_observation_completed_not_qualified','experimentIdentity':pkg['experimentIdentity'],'sampleId':SAMPLE,'targetIndex':p.get('targetIndex',0),'gpuStarted':True,'trainingStarted':False,'optimizerSteps':{'generator':0,'discriminator':0},'modelStateUnchanged':True,'stateBefore':before,'stateAfter':after,'counts':observer.counts,'originalGateError':original_error,'originalGatePassed':proof is not None,'probeFailure':failure,'capture':capture,'localReference':local,'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'recordedAtUtc':now(),'historicalReplayClaimed':False,'formalQualificationGranted':False})
 except BaseException as error:
  put('result.json',{'status':'zero_update_causal_observation_failed_closed','experimentIdentity':pkg['experimentIdentity'],'phase':phase,'error':str(error),'errorType':type(error).__name__,'gpuStarted':gpu,'trainingStarted':False,'optimizerSteps':{'generator':0,'discriminator':0},'artifacts':list(artifacts),'elapsedSeconds':time.monotonic()-started,'formalQualificationGranted':False});raise

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','run']);parser.add_argument('--policy',default=POLICY);parser.add_argument('--package');parser.add_argument('--sha256');args=parser.parse_args()
 if args.mode=='prepare':print(json.dumps(prepare(args.policy)))
 else:execute({'path':args.package,'sha256':args.sha256})
