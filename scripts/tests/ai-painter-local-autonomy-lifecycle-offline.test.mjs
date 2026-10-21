import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {materializeAutonomousClosedLoopPackage} from '../lib/ai-painter-autonomous-package-materializer-v1.mjs';
import {launchAutonomousClosedLoopBackground} from '../lib/ai-painter-autonomous-background-launcher-v1.mjs';
import {prepareExactlyOnceBackgroundSpawn} from '../lib/ai-painter-exactly-once-background-spawn-v1.mjs';
import {runLocalControlV2} from '../run-ai-painter-local-control-v2.mjs';
import {LOCAL_CONTROL_REGISTRATION, LOCAL_CONTROL_PROTOCOL, localPreparationRoute,
  runLocalPreparationRequest, runFinalRgbPreparationForIsolatedTests,
  preservePreparationFailure} from '../lib/ai-painter-local-prepare-v1.mjs';
import {initializeOwnedStopControlEvidence, submitOwnedStopIntent,
  createOwnedStopNativeControlForIsolatedTests} from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import {issueLocalOperatorSession} from '../../src/server/ai-console-control/operator-session.ts';
import {CURRENT_EXECUTION_REGISTRY_PATH} from '../../src/server/ai-painter-current-execution-registry.mjs';

// Existing production launcher/state machine and explicit isolation hooks only.
// CPU adapters and retained-call descriptors below are synthetic; no model,
// physical network isolation, production authentication or native Job proof.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const allowed=fs.realpathSync(path.join(project,'.runtime/ai-painter/controller-repair-reviews/local-autonomy-offline-acceptance-20261021'));
const selected=process.env.AI_PAINTER_LOCAL_AUTONOMY_ACCEPTANCE_ROOT;
assert.ok(selected&&path.isAbsolute(selected),'explicit private evidence root required');
assert.equal(fs.realpathSync(path.dirname(path.resolve(selected))),allowed,'only the authorized evidence directory may be written');
assert.equal(fs.existsSync(selected),false,'each command requires a fresh attempt');
fs.mkdirSync(selected);
const root=fs.realpathSync(selected),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const env={...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',UV_THREADPOOL_SIZE:'2'};
for(const key of Object.keys(env))if(/CODEX|OPENAI|ANTHROPIC/u.test(key))delete env[key];
const phases=['preflight','execute','validate','review','adjudicate','finalize'];
const put=(base,logical,value)=>{const f=path.join(base,logical);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return {path:logical,sha256:sha(fs.readFileSync(f))};};
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check,ms=18000){const end=Date.now()+ms;while(Date.now()<end){if(check())return;await sleep(50);}assert.fail('private fixture deadline; evidence retained');}
function snapshot(base){const rows={};for(const e of fs.readdirSync(base,{withFileTypes:true})){const f=path.join(base,e.name);assert.equal(fs.lstatSync(f).isSymbolicLink(),false);if(e.isDirectory()){for(const [p,h]of Object.entries(snapshot(f)))rows[e.name+'/'+p]=h;}else rows[e.name]=sha(fs.readFileSync(f));}return rows;}
function fixture(name){const base=path.join(root,name);fs.mkdirSync(base);return base;}

const adapter=`import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
process.env.CUDA_VISIBLE_DEVICES='';for(const k of ['OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS','UV_THREADPOOL_SIZE'])process.env[k]='2';
for(const k of Object.keys(process.env))if(/CODEX|OPENAI|ANTHROPIC/u.test(k))delete process.env[k];
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','$p=Get-Process -Id '+process.pid+';$p.ProcessorAffinity=[IntPtr]3;if($p.ProcessorAffinity -ne 3){throw "private affinity not applied"}'],{windowsHide:true,timeout:8000});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function log(c,phase){fs.appendFileSync(path.join(c.projectRoot,'phases.jsonl'),JSON.stringify({phase,pid:process.pid,at:Date.now()})+'\\n');}
export async function preflight(c){log(c,'preflight');const end=Date.now()+15000;while(!fs.existsSync(path.join(c.projectRoot,'client-exited.json'))){if(Date.now()>end)throw Error('private_client_exit_timeout');await pause(25);}return {status:'passed'};}
export async function execute(c){log(c,'execute');if(JSON.parse(fs.readFileSync(path.join(c.projectRoot,'input.json'))).failure)throw Object.assign(Error('first_private_pipeline_error'),{code:'private_original'});return {status:'passed'};}
export async function validate(c){log(c,'validate');return {status:'passed'};}
export async function review(c){log(c,'review');return {status:'passed'};}
export async function adjudicate(c){log(c,'adjudicate');return {status:'passed'};}
export async function finalize(c){log(c,'finalize');return {status:'passed'};}
`;
const starter=`import fs from 'node:fs';import {launchAutonomousClosedLoopBackground} from './scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs';
const binding=JSON.parse(fs.readFileSync('binding.json'));const receipt=await launchAutonomousClosedLoopBackground({...binding,root:process.cwd()});fs.writeFileSync('client-receipt.json',JSON.stringify({clientPid:process.pid,receipt}),{flag:'wx'});`;
const sources=['scripts/run-ai-painter-autonomous-closed-loop-package.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-local-autonomy-governance-v3.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs','scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs','data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json','data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json'];

for(const failure of [false,true])test(`private client exits, concurrent v2 status stays read-only, ${failure?'first failure is terminal':'six phases complete'}, replay never launches`,{timeout:45000},async()=>{
  const base=fixture(failure?'f':'n');
  const copies=sources.map(p=>put(base,p,fs.readFileSync(path.join(project,p))));
  put(base,'adapters.mjs',adapter);put(base,'starter.mjs',starter);put(base,'input.json',{failure,syntheticCpuOnly:true});
  // Short private identities also keep node:sqlite below Windows MAX_PATH.
  const id='cpu-'+crypto.randomBytes(4).toString('hex');
  const binding=materializeAutonomousClosedLoopPackage({schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:id,capabilityVersion:'private-local-offline-cpu-only',ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/fixture-outputs/'+id,programFiles:{adapters:'adapters.mjs'},inputEvidencePaths:['input.json'],phaseAdapters:Object.fromEntries(phases.map(p=>[p,{path:'adapters.mjs',exportName:p}]))},{root:base});
  put(base,'binding.json',binding);
  const child=spawn(process.execPath,['starter.mjs'],{cwd:base,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stdout.resume();child.stderr.on('data',c=>{stderr=(stderr+c).slice(-8192);});
  const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});assert.equal(exit,0,stderr);
  const launch=json(path.join(base,'client-receipt.json'));assert.equal(launch.clientPid,child.pid);assert.notEqual(launch.receipt.processId,child.pid);
  const er=path.join(base,'.runtime/ai-painter/autonomous-closed-loop-executions',id),terminalPath=path.join(er,'phase-terminal.json');
  await waitFor(()=>{const early=path.join(base,'.runtime/ai-painter/autonomous-background-launches',id,'background-process-terminal.json');if(fs.existsSync(early))assert.fail(JSON.stringify(json(early).error));return fs.existsSync(path.join(base,'phases.jsonl'));});
  assert.equal(fs.existsSync(terminalPath),false,'background waits until initiating client has exited');
  const registry=path.join(base,CURRENT_EXECUTION_REGISTRY_PATH);assert.equal(fs.existsSync(registry),false);
  const status=await runLocalControlV2({command:'status'},null,base);assert.equal(status.readOnly,true);assert.notEqual(status.current?.ok,true,'missing registry stays unknown');
  assert.equal(fs.existsSync(registry),false,'status cannot bootstrap a registry');
  put(base,'client-exited.json',{clientPid:child.pid,observedAt:Date.now()});
  await waitFor(()=>fs.existsSync(terminalPath));
  const terminalBytes=fs.readFileSync(terminalPath),terminal=JSON.parse(terminalBytes);
  assert.equal(terminal.status,failure?'failed_closed':'completed');
  const observations=fs.readFileSync(path.join(base,'phases.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(observations.map(r=>r.phase),failure?['preflight','execute']:phases);
  for(const r of observations.slice(1)){assert.equal(r.pid,launch.receipt.processId);assert.ok(r.at>=json(path.join(base,'client-exited.json')).observedAt);}
  const db=new DatabaseSync(path.join(er,'execution.sqlite'),{readOnly:true});
  try{const row=db.prepare('SELECT state, owner_response_required FROM executions WHERE package_identity=?').get(id);assert.equal(row.state,terminal.status);assert.equal(row.owner_response_required,0);}finally{db.close();}
  const state=json(path.join(er,'execution-state.json'));assert.equal(state.recoveryAttempt,0);
  if(failure){assert.match(JSON.stringify(terminal),/first_private_pipeline_error/);assert.equal(state.failureCode,'adapter_exception');}
  let spawns=0;const replay=await launchAutonomousClosedLoopBackground({root:base,...binding,processLauncher:()=>{spawns++;assert.fail('replay attempted another process');}});
  assert.deepEqual(replay,launch.receipt);assert.equal(spawns,0);assert.deepEqual(fs.readFileSync(terminalPath),terminalBytes);
  assert.equal(fs.readFileSync(path.join(base,'phases.jsonl'),'utf8').trim().split('\n').length,observations.length);
  await waitFor(()=>fs.existsSync(path.join(base,'.runtime/ai-painter/autonomous-background-launches',id,'background-process-terminal.json')));
  put(base,'acceptance.json',{status:'passed',componentOnly:true,clientPid:child.pid,backgroundPid:replay.processId,terminal:{path:terminalPath,sha256:sha(terminalBytes),status:terminal.status},copies,duplicateSpawnCount:spawns,automaticRetries:0,productionRegistryUsed:false,physicalNetworkDisconnected:false,nativeJobCleanupProved:false});
});

test('v2 receiver rejects a replayed consumed request before loading any CPU chain',{timeout:8000},()=>{
  const base=fixture('consumed-v2'),route=localPreparationRoute('ecology-quality-v1'),id=route.prefix+crypto.randomUUID(),outputRoot=route.outputRoot+'/'+id;
  const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,requestId:id,runId:id,packageId:route.packagePrefix+crypto.randomUUID(),outputRoot,candidateSelection:'ecology-quality-v1',candidateBinding:LOCAL_CONTROL_REGISTRATION.candidateBinding,executionPackage:null,automaticRetries:0};
  const rb=put(base,outputRoot+'/local-prepare/request.json',request);put(base,outputRoot+'/local-prepare/state.json',{stage:'failed_closed'});
  const runner=put(base,'scripts/run-ai-painter-local-control-v2.mjs','// private inert marker, never executed');
  const dir=outputRoot+'/local-prepare/background-launches/'+id;
  const attempt=prepareExactlyOnceBackgroundSpawn({projectRoot:base,attemptPath:path.join(base,dir,'spawn-attempt.json'),launchIdentity:id,runnerPath:runner.path,runnerSha256:runner.sha256,runnerArgs:['--internal-prepare-v2','--request',rb.path,'--request-sha256',rb.sha256],recordedAtUtc:new Date().toISOString()});
  const moduleUrl=new URL('../lib/ai-painter-local-prepare-v1.mjs',import.meta.url).href;
  const script=`import fs from 'node:fs';import {runLocalPreparationRequest} from ${JSON.stringify(moduleUrl)};fs.writeFileSync(${JSON.stringify(path.join(base,dir,'background-started.json'))},JSON.stringify({processId:process.pid,nonce:${JSON.stringify(attempt.nonce)},commandIdentitySha256:${JSON.stringify(attempt.commandIdentitySha256)}}),{flag:'wx'});try{await runLocalPreparationRequest(${JSON.stringify({root:base,relativePath:rb.path,sha256:rb.sha256})});process.exitCode=2;}catch(e){if(e.message!=='local_prepare_request_already_consumed')throw e;console.log(e.message);}`;
  const result=spawnSync(process.execPath,[attempt.processMarker,'--input-type=module','-e',script],{cwd:project,env,encoding:'utf8',windowsHide:true,timeout:7000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/local_prepare_request_already_consumed/);
  assert.equal(fs.existsSync(path.join(base,outputRoot,'local-prepare/consumed.json')),false,'replay cannot replace or create consumption');
  assert.equal(fs.existsSync(path.join(base,outputRoot,'cpu-request.json')),false);
});

test('v2 status needs no Codex session, network, authentication key or process creation',{timeout:8000},async()=>{
  const base=fixture('standalone-status'),before=snapshot(base);
  const url=new URL('../run-ai-painter-local-control-v2.mjs',import.meta.url).href;
  const childEnv={...env};delete childEnv.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  const code=`import assert from 'node:assert/strict';import cp from 'node:child_process';import net from 'node:net';import http from 'node:http';import https from 'node:https';import {syncBuiltinESMExports} from 'node:module';const denied=()=>{throw Error('forbidden_status_side_effect')};for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync'])cp[k]=denied;net.connect=denied;net.createConnection=denied;http.request=denied;https.request=denied;globalThis.fetch=denied;syncBuiltinESMExports();const {runLocalControlV2}=await import(${JSON.stringify(url)});const r=await runLocalControlV2({command:'status'},null,${JSON.stringify(base)});assert.equal(r.readOnly,true);assert.notEqual(r.current?.ok,true);console.log(JSON.stringify({readOnly:r.readOnly,authenticationRequired:false}));`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:project,env:childEnv,encoding:'utf8',windowsHide:true,timeout:7000});assert.equal(result.status,0,result.stderr);assert.deepEqual(snapshot(base),before);put(base,'acceptance.json',{status:'passed',result:JSON.parse(result.stdout)});
});

test('original preparation error survives terminal and stderr publication failures',()=>{
  const base=fixture('original-error'),original=Object.assign(Error('first_private_pipeline_error'),{code:'private_original'});
  const write=process.stderr.write;let diagnostics='';
  try{process.stderr.write=c=>{diagnostics+=c;return true;};assert.throws(()=>preservePreparationFailure(original,()=>{throw Error('secondary_terminal_write_failure');}),e=>e===original);process.stderr.write=()=>{throw Error('tertiary_stderr_failure');};assert.throws(()=>preservePreparationFailure(original,()=>{throw Error('secondary_terminal_write_failure');}),e=>e===original);}finally{process.stderr.write=write;}
  const record=JSON.parse(diagnostics);assert.equal(record.originalErrorPreserved,true);put(base,'acceptance.json',{status:'passed',originalCode:original.code,secondaryDiagnostic:record,componentOnly:true});
});

test('stop acceptance, consumption and reason delivery cannot become cleanup or checkpoint proof',{timeout:10000},async()=>{
  const base=fixture('stop-layering'),evidenceRoot=path.join(base,'operator-stop-control');initializeOwnedStopControlEvidence(evidenceRoot);
  const source=put(base,'source.mjs','// private immutable CPU fixture');const roles={fixture:source};
  const pkg=put(base,'package.json',{packageIdentity:'private-stop-package',programLineage:{fixture:source.sha256}});
  const context={runId:'private-stop-run',packageId:'private-stop-package',executionPackagePath:pkg.path,executionPackageSha256:pkg.sha256,supervisorProcessId:123,supervisorProcessStartIdentity:'134359011720230661',phase:'training'};
  const lock={runId:context.runId,packageId:context.packageId,processId:context.supervisorProcessId,processStartIdentity:context.supervisorProcessStartIdentity};const lb=put(base,'lock.json',lock);
  put(base,'heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',capabilityVersion:'private-stop-cpu',...lock,executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
  const registry={...lock,registryRevision:4,executionState:'executing',activeExecution:{...lock,executionState:'executing',capabilityVersion:'private-stop-cpu',programLineage:roles,lock:lb,heartbeat:{path:'heartbeat.json',ttlSeconds:120}}};
  put(base,CURRENT_EXECUTION_REGISTRY_PATH,registry);
  const prior=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=crypto.randomBytes(48).toString('hex');let control;
  try{
    const session=issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session',{headers:{host:'localhost:3000'}}));assert.equal(session.ok,true);
    const {phase,...target}=context;const intent=submitOwnedStopIntent({evidenceRoot,credentials:{cookie:session.setCookie.split(';')[0],csrf:session.session.csrfToken},input:{...target,expectedRegistryRevision:4,idempotencyKey:'private_offline_stop_0001',reasonText:'private component stop'}});
    for(const k of ['requestAccepted','executionStopped','cleanupConfirmed','checkpointSaved'])assert.equal(intent[k],false);
    const descriptor=Object.freeze({callId:'synthetic-private-call',...context});
    control=createOwnedStopNativeControlForIsolatedTests({projectRoot:base,evidenceRoot,expectedContext:context,readRetainedNativeCall:()=>descriptor},{reader:async()=>({ok:true,status:'verified',registry:structuredClone(registry),registrySha256:sha(fs.readFileSync(path.join(base,CURRENT_EXECUTION_REGISTRY_PATH)))}),wallNow:()=>Date.now(),monotonicNow:()=>0});
    assert.equal((await control.preparePending()).ok,true);assert.match(control.abortReason(),/^operator_stop:[a-f0-9]{64}:private component stop$/u);assert.equal(control.abortReason(),null);assert.equal((await control.preparePending()).status,'reason_delivered_not_stop_proof');
    const delivered=json(path.join(evidenceRoot,'inbox',intent.intentId+'.delivered.json'));assert.equal(delivered.reasonDelivered,true);for(const k of ['executionStopped','cleanupConfirmed','checkpointSaved'])assert.equal(delivered[k],false);
    put(base,'acceptance.json',{status:'passed',componentOnly:true,delivered,realNativeCall:false,realTrainingStopped:false});
  }finally{control?.dispose();if(prior===undefined)delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=prior;}
});

test('v2 full preparation isolation refuses the authorized non-temp root without weakening its boundary',async()=>{
  const base=fixture('v2-isolation-boundary'),before=snapshot(base);
  await assert.rejects(runFinalRgbPreparationForIsolatedTests({root:base}),/local_prepare_isolated_temp_root_required/);
  assert.deepEqual(snapshot(base),before);
});

// Explicitly authorized OS-temp fixtures reuse the existing v2 isolation hook.
// Only the CPU/native trust boundary is stubbed; preparation state/terminal IO,
// source checks, package materialization and six-phase lifecycle are real.
for(const failure of [false,true])test(`v2 isolated preparation survives client exit: ${failure?'CPU failure retains first error and never packages':'real materializer and lifecycle complete'}`,{timeout:30000},async()=>{
  const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'final-rgb-prepare-isolated-')));
  const evidence=fixture(failure?'v2-cpu-failure':'v2-normal');
  put(evidence,'fixture-root.json',{root:temp,scope:'explicitly authorized private OS-temp fixture'});
  const route=localPreparationRoute('final-rgb-base-weight-quality-v1'),id=route.prefix+crypto.randomUUID(),packageId=route.packagePrefix+crypto.randomUUID(),outputRoot=route.outputRoot+'/'+id;
  const required=['scripts/run-ai-painter-local-control-v2.mjs','scripts/lib/ai-painter-local-prepare-v1.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs','scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/'+route.chain.slice(2),route.adapter,'src/server/ai-console-control/operator-session.ts'];
  const privateAdapter=phases.map(p=>`export async function ${p}(c){return {status:'passed',syntheticCpuOnly:true};}`).join('\n');
  const programs=Object.fromEntries(required.map((p,i)=>['source'+i,put(temp,p,p===route.adapter?privateAdapter:fs.readFileSync(path.join(project,p)))]));
  put(temp,route.registration.candidateBinding.path,fs.readFileSync(path.join(project,route.registration.candidateBinding.path)));
  for(const p of ['ai-painter-autonomous-closed-loop-contract-v1.json','local-ai-operating-responsibility-contract-v3.json'])put(temp,'data/ai-painter/system-governance/'+p,fs.readFileSync(path.join(project,'data/ai-painter/system-governance',p)));
  put(temp,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:[route.registration]});
  fs.mkdirSync(path.join(temp,'.runtime/ai-painter/owned-worker-guards'),{recursive:true});
  const runtimeIdentity={python:{absolutePath:path.join(temp,'never-executed-python')}};
  const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,requestId:id,runId:id,packageId,outputRoot,candidateSelection:route.registration.candidateSelection,candidateBinding:route.registration.candidateBinding,capabilityVersion:route.capability,executionPackage:null,automaticRetries:0,programBindings:programs,runtimeIdentity};
  const rb=put(temp,outputRoot+'/local-prepare/request.json',request);put(temp,outputRoot+'/local-prepare/state.json',{stage:'prepared_request_not_cpu_qualified',requestId:id,runId:id,plannedPackageId:packageId,sequence:0,executionPackage:null});
  const urls=Object.fromEntries(['ai-painter-local-prepare-v1','ai-painter-autonomous-package-materializer-v1','ai-painter-autonomous-closed-loop-v1','ai-painter-autonomous-background-launcher-v1'].map(n=>[n,pathToFileURL(path.join(project,'scripts/lib',n+'.mjs')).href]));
  const driver=`import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
process.chdir(${JSON.stringify(project)});
const {runFinalRgbPreparationForIsolatedTests}=await import(${JSON.stringify(urls['ai-painter-local-prepare-v1'])});
const {materializeAutonomousClosedLoopPackage}=await import(${JSON.stringify(urls['ai-painter-autonomous-package-materializer-v1'])});
const {runAutonomousClosedLoop}=await import(${JSON.stringify(urls['ai-painter-autonomous-closed-loop-v1'])});
process.env.CUDA_VISIBLE_DEVICES='';for(const k of ['OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS'])process.env[k]='2';for(const k of Object.keys(process.env))if(/CODEX|OPENAI|ANTHROPIC/u.test(k))delete process.env[k];
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','$p=Get-Process -Id '+process.pid+';$p.ProcessorAffinity=[IntPtr]3'],{windowsHide:true,timeout:8000});
const root=${JSON.stringify(temp)},request=${JSON.stringify(request)},rb=${JSON.stringify(rb)},programs=request.programBindings,phases=${JSON.stringify(phases)},failure=${failure};
const events=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(logical,value)=>{const p=path.join(root,logical);fs.mkdirSync(path.dirname(p),{recursive:true});const b=Buffer.from(JSON.stringify(value,null,2)+'\\n');fs.writeFileSync(p,b,{flag:'wx'});return {path:logical,sha256:sha(b)};};
const held={ownedReceipt:{privateSyntheticCpuOnly:true}},original=Object.assign(Error('first_v2_private_cpu_failure'),{code:'private_v2_original',cleanupConfirmed:true});let packageCreated=false;
try{const terminal=await runFinalRgbPreparationForIsolatedTests({root,relativePath:rb.path,sha256:rb.sha256,readRegistry:async()=>({ok:true,status:'verified',registry:{activeExecution:null}}),
chain:{ROLES:{cpuHarness:'inert-cpu.py'},inside:(_r,p)=>path.join(root,p),bind:(_r,p)=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}),finalProgramBindings:()=>programs,runtimeIdentity:()=>request.runtimeIdentity,
prepareCpuRequest:o=>{assert.deepEqual(o.preparationRequestBinding,rb);events.push('cpu_request');return put(request.outputRoot+'/cpu-request.json',{synthetic:true});},
finalizeCpuAcceptance:async o=>{assert.equal(o.result,held);events.push('cpu_acceptance');return put(request.outputRoot+'/cpu-acceptance.json',{synthetic:true});},
preparePlan:()=>{events.push('plan');return put(request.outputRoot+'/quality-plan.json',{programs,synthetic:true});},
makeInternalCandidate:(_r,b)=>({schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:request.packageId,capabilityVersion:request.capabilityVersion,outputRoot:request.outputRoot,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,programFiles:Object.fromEntries(Object.entries(programs).map(([k,v])=>[k,v.path])),inputEvidencePaths:[b.path],phaseAdapters:Object.fromEntries(phases.map(p=>[p,{path:${JSON.stringify(route.adapter)},exportName:p}]))})},
native:{runNative:async()=>{events.push('cpu_running');put('cpu-waiting.json',{pid:process.pid});const end=Date.now()+15000;while(!fs.existsSync(path.join(root,'client-exited.json'))){if(Date.now()>end)throw Error('private_v2_gate_timeout');await new Promise(r=>setTimeout(r,25));}if(failure)throw original;return held;},withNativeOrdinaryBudget:async(_r,r,fn)=>{assert.equal(r,held.ownedReceipt);return fn();},nativeAccountingRoots:()=>[request.outputRoot],requireLiveOwnedReceipt:()=>{throw Error('no_real_native_receipt');}},
materialize:(c,o)=>{assert.equal(o.recoverExistingExact,false);packageCreated=true;events.push('materialize');return materializeAutonomousClosedLoopPackage(c,o);},loop:async o=>{events.push('lifecycle');return runAutonomousClosedLoop(o);}});
assert.equal(failure,false);assert.equal(terminal.status,'completed');put('driver-result.json',{status:'passed',events,packageCreated,terminal});}
catch(e){if(!failure||e!==original)throw e;const terminal=JSON.parse(fs.readFileSync(path.join(root,request.outputRoot,'local-prepare/terminal.json')));assert.equal(terminal.originalErrorCode,'private_v2_original');assert.equal(terminal.cleanupConfirmed,false);assert.equal(packageCreated,false);put('driver-result.json',{status:'passed',events,packageCreated,terminal,originalErrorIdentityPreserved:true});}
`;
  put(temp,'preparation-driver.mjs',driver);
  put(temp,'client.mjs',`import fs from 'node:fs';import {launchProjectCommandBackground} from ${JSON.stringify(urls['ai-painter-autonomous-background-launcher-v1'])};const receipt=launchProjectCommandBackground({root:process.cwd(),launchIdentity:'private-v2-'+${JSON.stringify(failure?'failure':'normal')},runnerPath:'preparation-driver.mjs',receiptRoot:'.runtime/private-launches'});fs.writeFileSync('client-receipt.json',JSON.stringify({clientPid:process.pid,receipt}),{flag:'wx'});`);
  const child=spawn(process.execPath,['client.mjs'],{cwd:temp,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let stderr='';child.stdout.resume();child.stderr.on('data',c=>{stderr=(stderr+c).slice(-8192);});const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});assert.equal(exit,0,stderr);
  const processTerminal=path.join(temp,'.runtime/private-launches','private-v2-'+(failure?'failure':'normal'),'background-process-terminal.json');
  await waitFor(()=>{if(fs.existsSync(processTerminal)){fs.cpSync(temp,path.join(evidence,'private-temp-tree'),{recursive:true,errorOnExist:true,force:false});assert.fail(JSON.stringify(json(processTerminal).error));}return fs.existsSync(path.join(temp,'cpu-waiting.json'));});
  assert.equal(fs.existsSync(path.join(temp,'driver-result.json')),false);assert.equal(json(path.join(temp,outputRoot,'local-prepare/state.json')).stage,'cpu_running');
  put(temp,'client-exited.json',{clientPid:child.pid});await waitFor(()=>fs.existsSync(path.join(temp,'driver-result.json')));
  const result=json(path.join(temp,'driver-result.json'));assert.equal(result.status,'passed');assert.equal(result.terminal.automaticRetries,0);
  if(failure){assert.deepEqual(result.events,['cpu_request','cpu_running']);assert.equal(result.terminal.gpuNotStartedIfPreparationFailed,true);assert.equal(result.terminal.executionPackage,null);}else{assert.deepEqual(result.events,['cpu_request','cpu_running','cpu_acceptance','plan','materialize','lifecycle']);assert.equal(result.terminal.trainingQualified,false);assert.equal(result.terminal.runtimePublication,false);}
  const launch=json(path.join(temp,'client-receipt.json'));await waitFor(()=>fs.existsSync(processTerminal));assert.equal(json(processTerminal).exitCode,0);
  // Keep the exact private tree for failed-evidence diagnosis; no temp cleanup
  // or deletion is needed for this bounded acceptance.
  fs.cpSync(temp,path.join(evidence,'private-temp-tree'),{recursive:true,errorOnExist:true,force:false});
  put(evidence,'acceptance.json',{status:'passed',componentOnly:true,osTempRoot:temp,requestId:id,clientPid:child.pid,launch,result,nativeCpuProofSynthetic:true,realNativeJobStarted:false,physicalNetworkDisconnected:false});
});
