// Read-only candidate initialization. No training, promotion or GPU registration.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBoundCpuCheckpointWorker} from './lib/ai-painter-cpu-checkpoint-worker.mjs';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reader=createReader(root), sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bind=p=>({path:p,sha256:sha(reader.bytes(p))});
const policyBinding={path:'data/ai-painter/system-governance/ai-painter-candidate-cpu-initialization-policy-v1.json',
  sha256:'cf1caa18974ea128f7fc2660c51ca270ff9902aaedae86e09a1c1423cedbdf6f'};
const policy=reader.bound(policyBinding), loadPolicy=reader.bound(policy.foundationLoadPolicy);
const foundation=reader.bound(loadPolicy.foundationContract), component=reader.bound(policy.componentContract);
const parent=reader.bound(component.parentCapability);
assert.equal(parent.foundationAssetBinding.sha256,loadPolicy.foundationContract.sha256);
const programs=[
  'ml/ai-painter/scripts/initialize_authenticated_split_smoke_cpu.py',
  'ml/ai-painter/tests/test_authenticated_split_smoke_cpu_initialization.py',
  'ml/ai-painter/scripts/probe_foundation_cpu_load.py',
  'ml/ai-painter/scripts/stage4_split_smoke_cpu_execution.py',
  'ml/ai-painter/scripts/stage4_split_smoke_checkpoint.py',
  'ml/ai-painter/scripts/stage4_split_isolated_smoke.py',
  'ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py',
  'ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py',
  'ml/ai-painter/src/ai_painter/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/model.py',
  'ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py',
  'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
  'ml/ai-painter/src/ai_painter/complete_world/split_release.py',
  'ml/ai-painter/src/ai_painter/complete_world/split_training.py',
  'ml/ai-painter/src/ai_painter/training/__init__.py',
  'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
  'scripts/check-ai-painter-candidate-cpu-initialization.mjs',
  'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
  'scripts/lib/ai-painter-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
  'scripts/windows/ai-painter-owned-worker-owner.cs',
];
const sourceBindings=programs.map(bind), registryBefore=bind('.runtime/ai-painter/current-execution-registry/current.json');
assert.equal(reader.bound(registryBefore).activeExecution,null);
const runId='candidate-cpu-init-'+crypto.randomUUID(), logical=policy.outputRoot+'/'+runId;
const output=path.resolve(root,logical);fs.mkdirSync(output,{recursive:true});
assert.equal(fs.realpathSync(output),path.join(fs.realpathSync(path.join(root,'.runtime')),'ai-painter','candidate-cpu-initializations',runId));
const put=(name,value)=>{const p=logical+'/'+name;fs.writeFileSync(path.join(root,p),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return bind(p);};
const request={schemaVersion:'candidate-cpu-initialization-request-v1',runId,policy:policyBinding,programBindings:sourceBindings};
const requestBinding=put('request.json',request);
const inputs=[...sourceBindings,policyBinding,policy.foundationLoadPolicy,loadPolicy.foundationContract,
  policy.componentContract,component.parentCapability,requestBinding,registryBefore,
  {path:foundation.sourceManifest.path,sha256:foundation.sourceManifest.sha256},
  {path:foundation.checkpoint.path,sha256:foundation.checkpoint.sha256}];
const python=path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe');
const executable={path:python,sha256:sha(fs.readFileSync(python))};
const invoke=(script,args)=>runBoundCpuCheckpointWorker({root,executable,script:bind(script),args,
  programBindings:inputs,timeoutMs:policy.resources.maxWallSeconds*1000});
let tests=null,worker=null;
try{
  tests=await invoke(programs[1],[]);const testsBinding=put('tests.json',tests);
  assert.equal(tests.value.status,'passed');assert.equal(tests.value.testsRun,9);
  worker=await invoke(policy.workerPath,['--request',requestBinding.path,'--request-sha256',requestBinding.sha256]);
  const workerBinding=put('worker.json',worker), v=worker.value;
  assert.equal(v.runId,runId);assert.equal(v.status,'candidate_cpu_initialized_not_training_qualified');
  assert.deepEqual(v.component,policy.componentContract);
  assert.deepEqual(v.loadedCheckpoint,{path:foundation.checkpoint.path,sha256:foundation.checkpoint.sha256});
  assert.equal(v.loadedFoundationByteIdentityVerified,true);assert.equal(v.freshDenoiserReproduced,true);
  assert.equal(v.initialization.capabilityVersion,component.capabilityVersion);
  assert.equal(v.initialization.seed,component.schedule.seed);
  assert.equal(v.initialization.configSha256,component.derivedCpuConfigSha256);
  assert.equal(v.foundationStateSha256,v.initialization.foundationStateSha256);
  assert.equal(v.foundationRuntimeStateSha256,v.initialization.foundationBoundaryEvidence.stateSha256);
  for(const key of ['optimizerCreated','forwardOrBackwardExecuted','datasetTensorsDecoded','historicalDenoiserLoaded',
    'checkpointWritten','gpuStarted','trainingFreezeProven','dataQualified','trainingAllowed','capabilityReleased'])assert.equal(v[key],false,key);
  assert.equal(v.optimizerSteps,0);reader.verifyStable();
  const registryAfter=bind(registryBefore.path);assert.deepEqual(registryAfter,registryBefore);
  const evidence=put('report.json',{schemaVersion:'candidate-cpu-initialization-check-v1',status:v.status,
    checkedAtUtc:new Date().toISOString(),requestBinding,testsBinding,workerBinding,result:v,
    registryBefore,registryAfter,inputReceipts:reader.receipts(),trainingAllowed:false,stage4ProgressRaised:false});
  console.log(JSON.stringify({status:v.status,evidence,runId,trainingAllowed:false},null,2));
}catch(error){
  const evidence=put('failure.json',{status:'failed_closed',runId,requestBinding,error:String(error.stack??error),
    stdout:error.stdout??null,stderr:error.stderr??null,ownedReceipt:error.ownedReceipt??null,
    tests:tests?.value??null,worker:worker?.value??null,registryBefore,registryAfter:bind(registryBefore.path),trainingAllowed:false});
  console.error(JSON.stringify({status:'failed_closed',evidence,error:error.message}));process.exitCode=1;
}
