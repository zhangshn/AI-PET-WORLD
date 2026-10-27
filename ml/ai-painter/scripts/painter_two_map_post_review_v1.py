"""Bounded local post-training review inference; no optimizer, GPU or promotion."""
import os
os.environ['CUDA_VISIBLE_DEVICES']='-1'
os.environ['OMP_NUM_THREADS']='2'
os.environ['MKL_NUM_THREADS']='2'
import sys,io,json,hashlib,time
from pathlib import Path
from datetime import datetime,timezone
from contextlib import ExitStack
from unittest.mock import patch
ROOT=Path(__file__).absolute().parents[3]
for p in ('ml/ai-painter/src','ml/ai-painter/scripts'):sys.path.insert(0,str(ROOT/p))

def validate_controller_lease(lease,registry,review_id,parent_pid):
 assert lease['reviewId']==review_id and registry['runId']==review_id,'review identity changed'
 assert parent_pid in (lease['controllerPid'],lease['launcherPid']),'unregistered direct parent or venv launcher'
 active=registry['activeExecution']
 assert active['processId']==lease['controllerPid'] and active['processStartIdentity']==lease['controllerStartIdentity'],'controller process identity changed'
 assert registry['registryRevision']==lease['registryRevision'],'registry revision changed'

def validate_checkpoint_source(value,pkg,source,result):
 kind=pkg.get('trainingSourceKind','two-map')
 assert kind in ('two-map','mixed-train','single149-fit'),'unknown training source kind'
 mixed=kind=='mixed-train';single149=kind=='single149-fit';pairs=448 if mixed else 200
 assert source['schemaVersion']==('single-map-checkpoint-fit-package-v1' if single149 else 'mixed-train-rehearsal-package-v1' if mixed else 'two-map-checkpoint-fit-package-v1')
 assert source['training']['pairs']==pairs
 assert value['schema']==('single-map-checkpoint-fit-state-v1' if single149 else 'mixed-train-rehearsal-state-v1' if mixed else 'two-map-checkpoint-fit-state-v1')
 assert value['packageSha256']==pkg['sourcePackage']['sha256'] and value['counts']=={'generator':pairs,'discriminator':pairs} and value['checkpointPromotable'] is False
 if single149:
  assert source['selectedSampleId']=='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
  assert source['modelCapability']=='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
  assert source['policy']['path']=='data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v2.json'
 if mixed:
  ids=source['selectedSampleIds'];anchor='mvp64-slot164-objects-v5-20261020'
  assert len(ids)==len(set(ids))==48 and anchor in ids
  expected={sid:72 if sid==anchor else 8 for sid in ids}
  assert value['sampleVisits']==result['sampleVisits']==expected


def execute(package_path,package_sha):
 import torch,numpy as np,psutil
 from PIL import Image
 import check_stage4_mvp_structured_object_v18_cpu_acceptance as cpu
 import decode1_entry_weight_quality_auth_v1 as auth
 import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
 from painter_stage4_appearance_regime_probe import derive_regime_record
 from current_checkpoint_fit_metrics_v1 import sample_metrics
 torch.set_num_threads(2);torch.set_num_interop_threads(2)
 psutil.Process().cpu_affinity(psutil.Process().cpu_affinity()[:2])
 reader=cpu.BoundReader(ROOT);pkg=reader.json({'path':package_path,'sha256':package_sha});out=ROOT/pkg['outputRoot']
 assert pkg['schemaVersion']=='ai-painter-two-map-post-review-package-v1'
 started=time.monotonic();started_at=datetime.now(timezone.utc).isoformat();calls={'generatorForwards':0,'criticForwards':0,'optimizerAttempts':0,'autogradAttempts':0,'cudaAttempts':0}
 def put(name,value):
  raw=value if isinstance(value,bytes) else json.dumps(value,allow_nan=False,indent=2).encode()
  assert sum(p.stat().st_size for p in out.rglob('*') if p.is_file())+len(raw)<24*1024**2
  with (out/name).open('xb') as f:f.write(raw)
  return {'path':(out/name).relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(raw).hexdigest()}
 def deny(key):
  def call(*a,**kw):calls[key]+=1;raise RuntimeError('forbidden '+key)
  return call
 def guard():
  assert time.monotonic()-started<270 and not torch.cuda.is_initialized()
  assert psutil.disk_usage(str(out)).free>2048*1024**2
  lease=json.loads((out/'worker-lease.json').read_bytes())
  assert psutil.pid_exists(lease['controllerPid']),'controller exited'
  registry=json.loads((ROOT/'.runtime/ai-painter/current-execution-registry/current.json').read_bytes())
  validate_controller_lease(lease,registry,pkg['reviewId'],os.getppid())
  hb=json.loads((out/'heartbeat.json').read_bytes())
  assert hb['runId']==pkg['reviewId'] and time.time()-datetime.fromisoformat(hb['heartbeatAtUtc'].replace('Z','+00:00')).timestamp()<120
 def state(m):
  h=hashlib.sha256()
  for k,v in m.state_dict().items():h.update(k.encode());h.update(v.detach().cpu().contiguous().numpy().tobytes())
  return h.hexdigest()
 try:
  for b in pkg['programs']:reader.read(b)
  with ExitStack() as stack:
   for owner,name,key in ((torch.autograd,'grad','autogradAttempts'),(torch.autograd,'backward','autogradAttempts'),(torch.Tensor,'backward','autogradAttempts'),(torch.optim.Optimizer,'__init__','optimizerAttempts'),(torch.cuda,'_lazy_init','cudaAttempts')):stack.enter_context(patch.object(owner,name,deny(key)))
   source=reader.json(pkg['sourcePackage']);terminal=reader.json(pkg['sourceTerminal']);result=reader.json(terminal['result'])
   assert terminal['executionState']=='completed' and result['checkpointReloadExact'] is True and pkg['sourceCheckpoint'] in result['artifacts']
   plan=reader.json(source['sourcePlan']);manifest=reader.json(plan['datasetManifest']);index=reader.json(manifest['sourceIndex'])
   order=manifest['identityPayload']['channelOrder'];continuous=manifest['identityPayload']['continuousChannelIds']
   valid=reader.json(plan['validationSplit'])['sampleIds'];train=reader.json(plan['trainSplit'])['sampleIds']
   assert valid==pkg['validationSampleIds'] and len(valid)==8
   rows=[next(r for r in index['samples'] if r['sampleId']==sid) for sid in pkg['trainSampleIds']+valid]
   samples=[];identities=[]
   for n,row in enumerate(rows):
    guard();assert row['split']==('train' if n<2 else 'validation');assert row['sampleId'] in (train if n<2 else valid)
    if 'sourceCorrection' in row:
     correction=reader.json(row['sourceCorrection']);parent=reader.json(correction['parentDataset']);old=next(r for r in reader.json(parent['sourceIndex'])['samples'] if r['sampleId']==row['parentSampleId'])
     assert old['split']==row['split']=='train'
     _,identity=cpu.load_sample(reader,old,order,continuous);identity.update(sampleId=row['sampleId'],image=row['image'])
     sample,identity=auth.load_corrected_sample(reader,row,order,continuous,identity,cpu)
    else:sample,identity=cpu.load_sample(reader,row,order,continuous)
    regime,_,_=derive_regime_record(reader,identity);samples.append(profile.bind_sample_ecology(reader,sample,identity,regime));identities.append(identity)
   capability=pkg.get('sourceModelCapability',profile.MODEL_CAPABILITY)
   assert capability==source.get('modelCapability',profile.MODEL_CAPABILITY),'review model identity differs from training'
   model,critic=profile.fresh_networks(order,model_capability=capability);value=torch.load(io.BytesIO(reader.read(pkg['sourceCheckpoint'])),map_location='cpu',weights_only=True)
   validate_checkpoint_source(value,pkg,source,result)
   model.load_state_dict(value['model'],strict=True);critic.load_state_dict(value['critic'],strict=True);model.eval();critic.eval()
   frozen={b['path']:b['sha256'] for b in source['programs']};actual_sources=[]
   for module in tuple(sys.modules.values()):
    f=getattr(module,'__file__',None)
    if f:
     p=Path(f).absolute()
     if p.is_relative_to(ROOT/'ml/ai-painter') and not p.is_relative_to(ROOT/'ml/ai-painter/.venv') and p!=Path(__file__).absolute():
      logical=p.relative_to(ROOT).as_posix();b={'path':logical,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()};assert frozen.get(logical)==b['sha256'],logical;reader.read(b);actual_sources.append(b)
   before=[state(m) for m in (model,critic)]
   def seen(*a):calls['generatorForwards']+=1;assert calls['generatorForwards']<=10
   model.register_forward_pre_hook(seen);critic.register_forward_pre_hook(deny('criticForwards'));observations=[]
   for n,(sample,identity,row) in enumerate(zip(samples,identities,rows)):
    guard()
    with torch.inference_mode():pred=profile.sample_forward(model,sample).detach().cpu()
    assert pred.shape==(1,3,192,256) and bool(torch.isfinite(pred).all())
    buf=io.BytesIO();Image.fromarray((pred[0].permute(1,2,0).clamp(0,1).numpy()*255).round().astype('uint8')).save(buf,format='PNG')
    prediction=put(f'prediction-{n:02}.png',buf.getvalue())
    observations.append({'sampleId':sample['sampleId'],'split':sample['split'],'identity':identity,'monsoonSeason':row['monsoonSeason'],'prediction':prediction,'metrics':sample_metrics(pred,sample,order)})
   after=[state(m) for m in (model,critic)];assert before==after and calls['generatorForwards']==10
   assert all(p.grad is None for m in (model,critic) for p in m.parameters());reader.unchanged();guard()
   b=put('inference.json',{'schemaVersion':'ai-painter-two-map-post-review-inference-v1','reviewId':pkg['reviewId'],'executionPackage':{'path':package_path,'sha256':package_sha},'sourceCheckpoint':pkg['sourceCheckpoint'],'observations':observations,'actualCalls':calls,'stateBefore':before,'stateAfter':after,'actualProjectSources':actual_sources,'inputs':[{'path':p,'sha256':s} for p,s in reader.observed.items()],'startedAtUtc':started_at,'endedAtUtc':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-started,'gpuInitialized':False,'optimizerUpdates':0,'formalQualificationGranted':False})
   print(json.dumps(b))
 except BaseException as e:
  put('inference-failure.json',{'status':'failed_closed','reviewId':pkg['reviewId'],'error':repr(e),'actualCalls':calls,'elapsedSeconds':time.monotonic()-started});raise

if __name__=='__main__':
 assert len(sys.argv)==3
 execute(sys.argv[1],sys.argv[2])
