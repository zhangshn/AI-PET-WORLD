// Independent bounded read-only verification; never mutates an old contract or
// registers training. No automatic retries and no unsafe deserialization fallback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runBoundCpuCheckpointWorker} from './lib/ai-painter-cpu-checkpoint-worker.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bind=p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))});
const policyBinding={path:'data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json',
  sha256:'e01ada89734708bd3bca15b52b2fec9954a7d87e913da9b30f93a63f9c8ab46c'};
const programs=[
  'ml/ai-painter/scripts/probe_foundation_cpu_load.py',
  'ml/ai-painter/tests/test_foundation_cpu_load_probe.py',
  'ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py',
  'ml/ai-painter/src/ai_painter/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/model.py',
  'ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py',
  'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
  'ml/ai-painter/src/ai_painter/training/__init__.py',
  'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
  'data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json',
  'data/ai-painter/system-governance/stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json',
  'scripts/check-ai-painter-foundation-cpu-load.mjs',
  'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
  'scripts/lib/ai-painter-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
  'scripts/windows/ai-painter-owned-worker-owner.cs',
];
const boundJson=b=>{const bytes=fs.readFileSync(path.join(root,b.path));assert.equal(hash(bytes),b.sha256);return JSON.parse(bytes);};
assert.deepEqual(bind(policyBinding.path),policyBinding,'probe policy changed');
const policy=boundJson(policyBinding), foundation=boundJson(policy.foundationContract);
assert.equal(foundation.activation.checkpointDeserializationAllowedDuringCpuValidation,false);
const registryPath='.runtime/ai-painter/current-execution-registry/current.json';
const registryBefore=bind(registryPath);assert.equal(boundJson(registryBefore).activeExecution,null,'active execution prevents diagnostic');
const runId='foundation-cpu-probe-'+crypto.randomUUID(), outputRoot=policy.outputRoot+'/'+runId;
const absolute=path.join(root,outputRoot);
fs.mkdirSync(absolute,{recursive:true});
assert.equal(fs.realpathSync(absolute),path.join(fs.realpathSync(path.join(root,'.runtime')),
  'ai-painter','foundation-cpu-load-probes',runId),'probe output redirected outside declared storage');
const put=(name,value)=>{const logical=outputRoot+'/'+name;fs.writeFileSync(path.join(root,logical),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return bind(logical);};
const request={schemaVersion:'foundation-cpu-load-probe-request-v1',runId,policy:policyBinding,programBindings:programs.map(bind)};
const requestBinding=put('request.json',request);
const python=path.join(root,'ml/ai-painter/.venv/Scripts/python.exe');
const executable={path:python,sha256:hash(fs.readFileSync(python))};
const inputs=[...request.programBindings,policyBinding,policy.foundationContract,
  {path:foundation.sourceManifest.path,sha256:foundation.sourceManifest.sha256},
  {path:foundation.checkpoint.path,sha256:foundation.checkpoint.sha256},requestBinding];
const invoke=(script,args)=>runBoundCpuCheckpointWorker({root,executable,script:bind(script),args,
  programBindings:inputs,timeoutMs:policy.resources.maxWallSeconds*1000});
let tests=null,probe=null;
try{
  tests=await invoke('ml/ai-painter/tests/test_foundation_cpu_load_probe.py',[]);
  put('cpu-tests.json',tests);assert.equal(tests.value.status,'passed');assert.equal(tests.value.testsRun,7);
  probe=await invoke(policy.workerPath,['--request',requestBinding.path,'--request-sha256',requestBinding.sha256]);
  put('worker-result.json',probe);
  const v=probe.value;
  assert.equal(v.runId,runId);assert.equal(v.status,'cpu_load_and_probe_freeze_verified_not_training_qualified');
  assert.equal(v.loadedStateSha256,v.afterModeSwitchStateSha256);assert.equal(v.loadedStateSha256,v.afterProbeStateSha256);
  assert.equal(v.checkpoint.sha256,foundation.checkpoint.sha256);
  for(const key of ['gpuStarted','realDatasetRead','checkpointWritten','optimizerCreated','parameterGradientsCreated',
    'trainingFreezeProven','historicalIsolationQualified','trainingAllowed','capabilityReleased'])assert.equal(v[key],false,key);
  assert.equal(v.optimizerSteps,0);assert.equal(v.checkpointDeserialized,true);assert.equal(v.restrictedWeightsOnly,true);
  assert.deepEqual(bind(registryPath),registryBefore,'production registry changed');
  const report=put('report.json',{status:v.status,runId,recordedAtUtc:new Date().toISOString(),request:requestBinding,
    tests:bind(outputRoot+'/cpu-tests.json'),probe:bind(outputRoot+'/worker-result.json'),result:v,
    registryBefore,registryAfter:bind(registryPath),oldContractUnchanged:true,
    trainingAllowed:false,stage4ProgressRaised:false});
  console.log(JSON.stringify({status:v.status,evidence:report,runId,gpuStarted:false,trainingAllowed:false},null,2));
}catch(error){
  const report=put('failure.json',{status:'foundation_cpu_probe_failed_closed',runId,recordedAtUtc:new Date().toISOString(),
    request:requestBinding,error:String(error.stack??error),ownedReceipt:error.ownedReceipt??null,
    stdout:error.stdout??null,stderr:error.stderr??null,testsCompleted:tests?.value?.status==='passed',
    probeResultReceived:probe!==null,registryBefore,registryAfter:bind(registryPath),trainingAllowed:false});
  console.error(JSON.stringify({status:'failed_closed',evidence:report,error:String(error.message)}));process.exitCode=1;
}
