import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as reg from '../lib/ai-painter-object-support-structure-quality-registration-v1.mjs';
import * as chain from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs';
import {validateCpuRegistryFixtureLeaseRequest,hasLiveOwnedProof} from '../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs';
import {verifyStoredGpuAcceptance} from '../run-ai-painter-object-support-structure-quality-v1.mjs';
import {LOCAL_FINAL_RGB_PREPARE_REGISTRATION as V2,localPreparationRoute,
 runFinalRgbPreparationForIsolatedTests} from '../lib/ai-painter-local-prepare-v1.mjs';
import {LOCAL_FINAL_RGB_CONTROL_REGISTRATION as V1,validateLocalStartPackage} from '../run-ai-painter-local-control-v1.mjs';
import {PHASES,CURRENT_ENTRYPOINT_REGISTRY_PATH,CLOSED_LOOP_CONTRACT_PATH} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {directoryBytes,withOutputBudget,write as writeBudgeted} from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';

const root=process.cwd(),route=localPreparationRoute('final-rgb-base-weight-quality-v1');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const put=(base,name,value)=>{const raw=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 const file=path.join(base,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw);
 return {path:name,sha256:hash(raw)};};

function timingAccountingFixture(t,logical,mapped=true){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'final-rgb-timing-accounting-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 logical??='.runtime/ai-painter/final-rgb-base-weight-quality-executions/final-rgb-base-quality-v1-'+randomUUID();
 const registered=mapped&&logical.startsWith('.runtime/'),dir=registered?chain.inside(root,logical):path.join(base,logical);
 const final=path.join(dir,'gpu-qualification-timing.json'),staged=final+'.staged';
 assert.equal(fs.existsSync(dir),false,'fresh private accounting fixture required');
 fs.mkdirSync(dir,{recursive:true});
 if(registered)t.after(()=>{for(const target of [dir,dir+'.moved']){
  assert.equal(path.dirname(target),path.dirname(dir));fs.rmSync(target,{recursive:true,force:true});
 }});
 return {base,projectRoot:registered?root:base,logical,dir,final,staged};
}
function accountingFs(overrides,action){
 const original=Object.fromEntries(Object.keys(overrides).map(key=>[key,fs[key]]));
 try{for(const [key,hook] of Object.entries(overrides))fs[key]=(...args)=>hook(original[key],...args);return action();}
 finally{for(const [key,value] of Object.entries(original))fs[key]=value;}
}

test('timing atomic rename rescans the whole Run and returns exact keeper accounting bytes',t=>{
 const f=timingAccountingFixture(t);assert.equal(chain.directoryBytes,directoryBytes);
 assert.equal(f.dir,chain.inside(root,f.logical));assert.notEqual(f.dir,path.join(root,f.logical),'actual physical runtime mapping is exercised');
 fs.writeFileSync(f.final,Buffer.alloc(5));fs.writeFileSync(f.staged,Buffer.alloc(37));
 put(f.dir,'sentinel.json',Buffer.alloc(11));put(f.dir,'nested/immutable.bin',Buffer.alloc(17));
 let renamed=0,scans=0;
 accountingFs({readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);},
  lstatSync:(original,target,...args)=>{if(target===f.staged){fs.renameSync(f.staged,f.final);renamed++;}return original.call(fs,target,...args);}},()=>{
  // Native keeper's diskBytes calls this same shared directoryBytes function.
  assert.equal(chain.directoryBytes(f.dir),65);
 });
 assert.equal(renamed,1);assert.equal(scans,2);assert.equal(fs.existsSync(f.staged),false);
});

test('stable timing final and staged bytes both count, with the32768 boundary enforced',t=>{
 const f=timingAccountingFixture(t);
 fs.writeFileSync(f.final,Buffer.alloc(32768));fs.writeFileSync(f.staged,Buffer.alloc(32768));
 put(f.dir,'sentinel.json',Buffer.alloc(11));assert.equal(directoryBytes(f.dir),65547);
 for(const file of [f.final,f.staged]){
  fs.writeFileSync(file,Buffer.alloc(32769));assert.throws(()=>directoryBytes(f.dir),/32768/u);
  fs.writeFileSync(file,Buffer.alloc(32768));
 }
});

test('three actual timing renames exhaust the existing three-scan ceiling',t=>{
 const f=timingAccountingFixture(t);fs.writeFileSync(f.final,Buffer.alloc(5));let scans=0,renamed=0;
 accountingFs({readdirSync:(original,target,...args)=>{
  if(target===f.dir){scans++;fs.writeFileSync(f.staged,Buffer.alloc(37));}return original.call(fs,target,...args);},
 lstatSync:(original,target,...args)=>{if(target===f.staged){fs.renameSync(f.staged,f.final);renamed++;}return original.call(fs,target,...args);}},()=>{
  assert.throws(()=>directoryBytes(f.dir),/did not settle within three scans/u);
 });
 assert.equal(scans,3);assert.equal(renamed,3);
});

test('unknown names, nested staging and other output roots get no timing ENOENT exemption',t=>{
 const valid='.runtime/ai-painter/final-rgb-base-weight-quality-executions/final-rgb-base-quality-v1-'+randomUUID();
 for(const [logical,relative,mapped] of [[valid,'unknown.json'],[valid,'nested/gpu-qualification-timing.json.staged'],
  [valid,'gpu-qualification-timing.json.staged-unknown'],
  [valid,'gpu-qualification-timing.json.staged',false],
  ['unregistered/final-rgb-base-weight-quality-executions/final-rgb-base-quality-v1-'+randomUUID(),'gpu-qualification-timing.json.staged',false],
  ['.runtime/ai-painter/other-executions/final-rgb-base-quality-v1-'+randomUUID(),'gpu-qualification-timing.json.staged',false],
  ['.runtime/ai-painter/final-rgb-base-weight-quality-executions/not-a-final-rgb-run-'+randomUUID(),'gpu-qualification-timing.json.staged']]){
  const caseLogical=logical===valid?valid.slice(0,-36)+randomUUID():logical;
  const f=timingAccountingFixture(t,caseLogical,mapped),file=path.join(f.dir,relative),final=file.replace(/\.staged.*$/u,'');
  put(f.dir,relative,Buffer.alloc(37));if(final!==file)fs.writeFileSync(final,Buffer.alloc(5));let vanished=0,scans=0;
  accountingFs({readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);},
   lstatSync:(original,target,...args)=>{if(target===file&&vanished++===0){if(final===file)fs.unlinkSync(file);else fs.renameSync(file,final);}return original.call(fs,target,...args);}},()=>{
   assert.throws(()=>directoryBytes(f.dir),error=>error.code==='ENOENT'&&error.path===file);
  });
  assert.equal(scans,1);assert.equal(vanished,1);
 }
});

test('timing permissions and missing, directory or linked replacements fail closed',t=>{
 for(const kind of ['permission','targetPermission','missing','directory','junction','oversize']){
  const f=timingAccountingFixture(t);fs.writeFileSync(f.staged,Buffer.alloc(37));
  if(kind==='directory')fs.mkdirSync(f.final);
  else if(kind==='junction'){const directory=path.join(f.base,'junction-target');fs.mkdirSync(directory);fs.symlinkSync(directory,f.final,'junction');}
  else if(kind!=='missing')fs.writeFileSync(f.final,Buffer.alloc(kind==='oversize'?32769:5));
  const denied=Object.assign(new Error('fixture access denied'),{code:'EACCES'});let scans=0;
  accountingFs({readdirSync:(original,target,...args)=>{
    if(target===f.dir){scans++;const entries=original.call(fs,target,...args);return entries.sort((a,b)=>(a.name.endsWith('.staged')?-1:0)-(b.name.endsWith('.staged')?-1:0));}
    return original.call(fs,target,...args);},
   lstatSync:(original,target,...args)=>{
    if(target===f.staged){if(kind==='permission')throw denied;fs.unlinkSync(f.staged);}
    if(target===f.final&&kind==='targetPermission')throw denied;
    return original.call(fs,target,...args);}},()=>{
   assert.throws(()=>directoryBytes(f.dir),error=>kind==='permission'||kind==='targetPermission'?error===denied:
    kind==='missing'?error.code==='ENOENT':kind==='oversize'?/32768/u.test(error.message):/must be regular/u.test(error.message));
  });
  assert.equal(scans,1);
 }
});

test('stable timing links and non-files cannot be counted as trusted timing outputs',t=>{
 for(const name of ['gpu-qualification-timing.json','gpu-qualification-timing.json.staged']){
  const f=timingAccountingFixture(t),file=path.join(f.dir,name);fs.mkdirSync(file);
  assert.throws(()=>directoryBytes(f.dir),/must be regular/u);fs.rmdirSync(file);
  const target=path.join(f.base,'linked-directory');fs.mkdirSync(target);fs.symlinkSync(target,file,'junction');
  assert.throws(()=>directoryBytes(f.dir),/junction prohibited/u);
 }
});

test('a disappeared Run root and root permission errors remain failures during recount',t=>{
 for(const kind of ['missingInitially','permission','missingOnRescan']){
  const f=timingAccountingFixture(t);fs.writeFileSync(f.final,Buffer.alloc(5));fs.writeFileSync(f.staged,Buffer.alloc(37));
  const denied=Object.assign(new Error('fixture root denied'),{code:'EACCES'});let scans=0;
  if(kind==='missingInitially')fs.renameSync(f.dir,f.dir+'.moved');
  accountingFs({lstatSync:(original,target,...args)=>{
    if(target===f.dir&&kind==='permission')throw denied;
    if(target===f.staged)fs.renameSync(f.staged,f.final);
    return original.call(fs,target,...args);},readdirSync:(original,target,...args)=>{
    if(target===f.dir&&++scans===2)fs.renameSync(f.dir,f.dir+'.moved');return original.call(fs,target,...args);}},()=>{
   assert.throws(()=>directoryBytes(f.dir),error=>kind==='permission'?error===denied:error.code==='ENOENT');
  });
  if(kind==='missingOnRescan')assert.equal(scans,2);
 }
});

test('timing recount retains all bytes and the existing output reserve rejects overflow',t=>{
 const f=timingAccountingFixture(t);fs.writeFileSync(f.final,Buffer.alloc(5));fs.writeFileSync(f.staged,Buffer.alloc(50));
 put(f.dir,'sentinel.json',Buffer.alloc(5));
 const attempt=()=>withOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:64,reserveBytes:1},()=>writeBudgeted(f.projectRoot,f.logical+'/blocked.json',Buffer.alloc(10)));
 assert.throws(attempt,/total output reserve/u);assert.equal(directoryBytes(f.dir),60);
 accountingFs({lstatSync:(original,target,...args)=>{
  if(target===f.staged||target===path.join(root,f.logical,'gpu-qualification-timing.json.staged'))fs.renameSync(f.staged,f.final);
  return original.call(fs,target,...args);}},()=>{
  assert.throws(attempt,/total output reserve/u);
 });
 assert.equal(directoryBytes(f.dir),55);assert.equal(fs.existsSync(path.join(f.dir,'blocked.json')),false);
});

test('existing progress and heartbeat atomic recount behavior is preserved',t=>{
 for(const [name,suffix] of [['progress.json','0123456789abcdef'],['heartbeat.json','01234567-89ab-cdef-0123-456789abcdef']]){
  const f=timingAccountingFixture(t),final=path.join(f.dir,name),staged=final+'.staged-'+suffix;
  fs.writeFileSync(final,Buffer.alloc(5));fs.writeFileSync(staged,Buffer.alloc(37));put(f.dir,'sentinel.json',Buffer.alloc(11));let scans=0;
  accountingFs({lstatSync:(original,target,...args)=>{if(target===staged)fs.renameSync(staged,final);return original.call(fs,target,...args);},
   readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);}},()=>assert.equal(directoryBytes(f.dir),48));
  assert.equal(scans,2);
 }
});

test('new route registrations remain exact and use the existing bounded adapters',()=>{
 const index=JSON.parse(fs.readFileSync(CURRENT_ENTRYPOINT_REGISTRY_PATH));
 for(const expected of [V1,V2])assert.deepEqual(index.localControlEntrypoints.filter(v=>v.entryId===expected.entryId),[expected]);
 assert.equal(route.capability,reg.FINAL_RGB_CAPABILITY);assert.equal(route.outputRoot,reg.FINAL_RGB_PROFILE.OUTPUT_ROOT);
 assert.equal(route.adapter,chain.ADAPTER);assert.equal(route.chain,'./ai-painter-object-support-structure-quality-package-chain-v1.mjs');
 assert.throws(()=>reg.executionRoute('forged-profile'));
});

test('current authority and preview bytes bind the frozen sources; JS and Python derive exactly the same configuration',()=>{
 const {previewBinding}=chain.verifyFinalRgbAuthority(root);
 assert.equal(previewBinding.sha256,'f72ec23d5720ad5733f6260b3f5d1d0d66fc565bb29195f7d36c3518f5850659');
 const actual=reg.deriveConfiguration(chain.json(root,reg.CANDIDATE),{capabilityVersion:reg.FINAL_RGB_CAPABILITY,trainingPreviewPolicy:previewBinding});
 const code="import json,sys;from pathlib import Path;r=Path(sys.argv[1]);sys.path[:0]=[str(r/'ml/ai-painter/scripts'),str(r/'ml/ai-painter/src')];from ai_painter.complete_world.final_rgb_base_weight_quality_checkpoint_v1 import expected_configuration;print(json.dumps(expected_configuration(json.loads(sys.argv[2])),sort_keys=True))";
 const result=spawnSync(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-I','-B','-X','utf8','-c',code,root,JSON.stringify(previewBinding)],
  {encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1048576,env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(actual,JSON.parse(result.stdout));
 assert.deepEqual(actual.executionPolicy,reg.FINAL_RGB_PROFILE.EXECUTION_POLICY);
 assert.equal(actual.gpuAdmissionSeconds,720);
 assert.equal(reg.deriveConfiguration(chain.json(root,reg.CANDIDATE)).gpuAdmissionSeconds,600);
 assert.throws(()=>reg.deriveConfiguration(chain.json(root,reg.CANDIDATE),{capabilityVersion:reg.FINAL_RGB_CAPABILITY,
  trainingPreviewPolicy:{...previewBinding,path:'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v2.json'}}));
});

test('public required role getter is shared, unique, and keeps old codec template separate from final RGB codec',()=>{
 const roles=chain.requiredProgramRoles(root,reg.FINAL_RGB_CAPABILITY);
 assert.equal(new Set(Object.values(roles)).size,Object.keys(roles).length);
 assert.equal(roles.finalRgbCheckpoint,'ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_quality_checkpoint_v1.py');
 assert.equal(roles.managedCheckpoint,chain.ROLES.managedCheckpoint);assert.notEqual(roles.finalRgbCheckpoint,roles.managedCheckpoint);
 for(const key of ['finalRgbModel','finalRgbOperator','finalRgbCpuBridge','finalRgbDeviceBridge','finalRgbTrainingProfile','finalRgbCheckpoint','finalRgbTests'])assert.ok(roles[key]);
 const duplicate={a:{path:'scripts/example.mjs',sha256:'0'.repeat(64)},b:{path:'scripts/example.mjs',sha256:'0'.repeat(64)}};
 assert.throws(()=>chain.verifyProgramBindingAliases(duplicate,{capabilityVersion:reg.FINAL_RGB_CAPABILITY}),/one binding per path/);
});

function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'final-rgb-prepare-isolated-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const runId=route.prefix+randomUUID(),packageId=route.packagePrefix+randomUUID(),outputRoot=route.outputRoot+'/'+runId;
 const files=[V2.entryFile,V2.adapterFile,'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
 'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',
 'scripts/lib/'+route.chain.slice(2),route.adapter,'src/server/ai-console-control/operator-session.ts',V1.entryFile,
 'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs','scripts/lib/ai-painter-owned-stop-request-v1.mjs',
 'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs','scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs'];
 const programs=Object.fromEntries(files.map((p,i)=>['source'+i,put(base,p,'// inert isolated source\n')]));
 put(base,reg.CANDIDATE.path,fs.readFileSync(reg.CANDIDATE.path));put(base,CLOSED_LOOP_CONTRACT_PATH,fs.readFileSync(CLOSED_LOOP_CONTRACT_PATH));
 put(base,CURRENT_ENTRYPOINT_REGISTRY_PATH,{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:[V1,V2]});
 fs.mkdirSync(path.join(base,'.runtime/ai-painter/owned-worker-guards'),{recursive:true});
 const runtimeIdentity={python:{absolutePath:'inert-python-never-executed',sha256:'0'.repeat(64)}};
 const request={schema:'ai-painter-local-prepare-request-v1',protocol:V2.protocol,requestId:runId,runId,packageId,outputRoot,
 candidateSelection:route.registration.candidateSelection,candidateBinding:reg.CANDIDATE,capabilityVersion:route.capability,
 executionPackage:null,automaticRetries:0,programBindings:programs,runtimeIdentity};
 const rb=put(base,outputRoot+'/local-prepare/request.json',request),events=[],liveResult={ownedReceipt:{privateSyntheticReceipt:true}};
 const plan={schema:reg.PLAN_SCHEMA,capabilityVersion:route.capability,runId,packageId,outputRoot,programBindings:programs};
 const stubs={root:base,relativePath:rb.path,sha256:rb.sha256,
 readRegistry:async()=>({ok:true,status:'verified',registry:{activeExecution:null}}),
 chain:{ROLES:chain.ROLES,inside:(_r,p)=>path.join(base,p),bind:(_r,p)=>({path:p,sha256:hash(fs.readFileSync(path.join(base,p)))}),
  finalProgramBindings:(_r,o)=>{assert.equal(o.capabilityVersion,route.capability);return programs;},runtimeIdentity:()=>runtimeIdentity,
  prepareCpuRequest:options=>{events.push('request');assert.equal(options.capabilityVersion,route.capability);assert.deepEqual(options.preparationRequestBinding,rb);return put(base,outputRoot+'/cpu-request.json',{synthetic:true});},
  finalizeCpuAcceptance:async options=>{events.push('accept');assert.equal(options.result,liveResult);return put(base,outputRoot+'/cpu-acceptance.json',{synthetic:true});},
  preparePlan:()=>{events.push('plan');return put(base,outputRoot+'/quality-plan.json',plan);},
  makeInternalCandidate:(_r,b)=>{events.push('candidate');assert.equal(b.path,outputRoot+'/quality-plan.json');return {synthetic:true};}},
 native:{runNative:async options=>{events.push('cpu');assert.equal(options.phase,'cpu');assert.equal(options.outputRoot,outputRoot);return liveResult;},
  withNativeOrdinaryBudget:async(_r,receipt,action)=>{assert.equal(receipt,liveResult.ownedReceipt);return action();},
  nativeAccountingRoots:()=>[outputRoot]},
 materialize:(_candidate,options)=>{events.push('package');assert.equal(options.recoverExistingExact,false);
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:packageId,capabilityVersion:route.capability,
   outputRoot,ownerAuthorizationRequired:false,ownerInStateMachine:false,maxInfrastructureRecoveryAttempts:0,
   inputEvidence:[{path:outputRoot+'/quality-plan.json',sha256:hash(fs.readFileSync(path.join(base,outputRoot+'/quality-plan.json')))}],
   programLineage:Object.fromEntries(Object.entries(programs).map(([k,b])=>[k,b.sha256])),
   phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',path:route.adapter,
    sha256:Object.values(programs).find(b=>b.path===route.adapter).sha256,exportName:phase}]))};
  const b=put(base,'.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',spec);
  validateLocalStartPackage(base,{command:'start',packagePath:b.path,packageSha256:b.sha256});
  return {packagePath:b.path,packageSha256:b.sha256};},
 loop:async({spec})=>{assert.equal(spec.capabilityVersion,route.capability);for(const phase of PHASES){events.push(phase);assert.equal(spec.phaseAdapters[phase].path,route.adapter);}return {state:'completed'};}};
 return {base,request,events,stubs};
}

test('private final RGB preparation carries one retained result through package validation and all six synthetic phases',async t=>{
 const f=fixture(t),terminal=await runFinalRgbPreparationForIsolatedTests(f.stubs);
 assert.deepEqual(f.events,['request','cpu','accept','plan','candidate','package',...PHASES]);
 assert.equal(terminal.status,'completed');assert.equal(terminal.automaticRetries,0);assert.equal(terminal.trainingQualified,false);
 assert.equal(terminal.runtimePublication,false);
});

test('private preparation rejects active registry and source drift before native; native failure never packages or retries',async t=>{
 for(const mode of ['active','drift','native']){
  const f=fixture(t);if(mode==='active')f.stubs.readRegistry=async()=>({ok:true,status:'verified',registry:{activeExecution:{}}});
  if(mode==='drift')put(f.base,V2.entryFile,'// drift');
  const error=Error('synthetic bounded CPU failure');
  if(mode==='native')f.stubs.native.runNative=async()=>{f.events.push('cpu');throw error;};
  await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),mode==='native'?e=>e===error:/active_or_unknown|source_drift/);
  assert.equal(f.events.includes('package'),false);assert.equal(f.events.filter(v=>v==='cpu').length,mode==='native'?1:0);
 }
});

test('final RGB keeper lease accepts each same-call fixture and rejects old namespace, different call and forged identity',()=>{
 const context={callIdentity:randomUUID(),entryRoot:route.outputRoot+'/synthetic-final-rgb-0001/cpu-entry',
  request:{path:'synthetic/request.json',sha256:'0'.repeat(64)},declaration:{path:'synthetic/declaration.json',sha256:'1'.repeat(64)}};
 for(const name of ['dispatch','finalization','failure']){
  const value={schema:'cpu-registry-fixture-keeper-request-v1',callIdentity:context.callIdentity,request:context.request,
   declaration:context.declaration,name,root:context.entryRoot+'/r/'+name,rootIdentity:'1:2'};
  assert.equal(validateCpuRegistryFixtureLeaseRequest(context,value),value);
  for(const patch of [{root:value.root.replace(route.outputRoot,reg.OUTPUT_ROOT)},{callIdentity:randomUUID()},
   {rootIdentity:'verified'},{request:{...context.request,sha256:'2'.repeat(64)}}])
   assert.throws(()=>validateCpuRegistryFixtureLeaseRequest(context,{...value,...patch}));
 }
});

test('final RGB model identity requires the unchanged 108 parameters and exact index88 weight',()=>{
 const graph=Array.from({length:108},(_,i)=>({name:'synthetic.parameter.'+i,shape:[1],elements:1,dtype:'torch.float32'}));
 for(const [i,name]of [[52,'core.core.terrain.decode_1.layers.3.weight'],[60,'core.core.terrain.full_resolution_detail.layers.3.weight'],[88,'core.core.final_rgb_decoder.base.layers.2.weight']])
  graph[i]={name,shape:[48,48,3,3],elements:20736,dtype:'torch.float32'};
 graph[0].elements=2242687-graph.slice(1).reduce((n,r)=>n+r.elements,0);graph[0].shape=[graph[0].elements];
 const model={capabilityVersion:reg.FINAL_RGB_CAPABILITY,modelCapabilityVersion:reg.FINAL_RGB_PROFILE.MODEL_CAPABILITY,
  architecture:reg.FINAL_RGB_PROFILE.ARCHITECTURE,numericRule:reg.FINAL_RGB_PROFILE.NUMERIC_RULE,graph,
  initialState:{generator:'0'.repeat(64),discriminator:'1'.repeat(64)}};
 assert.equal(reg.validateModelIdentity(model),model);
 for(const mutate of [m=>{m.graph[88].name='other.weight';},m=>{m.numericRule=reg.NUMERIC_RULE;},
  m=>{m.modelCapabilityVersion=reg.MODEL_CAPABILITY;},m=>{m.graph.pop();}]){
  const invalid=structuredClone(model);mutate(invalid);assert.throws(()=>reg.validateModelIdentity(invalid));
 }
});


// The child loads the on-disk production functions unchanged. Its module hook
// appends only private evidence IO and a clearly marked live-CPU-proof stub;
// preparePlan and the complete Node plan validator remain the actual functions.
async function isolatedPlanBindingMaterialization(){
 const assert=(await import('node:assert/strict')).default,fs=(await import('node:fs')).default,
  path=(await import('node:path')).default,os=(await import('node:os')).default;
 const {createHash,randomUUID}=await import('node:crypto'),{pathToFileURL}=await import('node:url'),
  {registerHooks}=await import('node:module'),{spawnSync}=await import('node:child_process');
 const project=process.cwd(),temporary=fs.realpathSync.native(os.tmpdir());
 const privateRoot=fs.mkdtempSync(path.join(temporary,'finalrgb-plan-binding-'));
 const sha=raw=>createHash('sha256').update(raw).digest('hex'),virtual=new Map(),writes=[];
 const originalFs={writeFileSync:fs.writeFileSync,mkdirSync:fs.mkdirSync,openSync:fs.openSync};
 const privatePath=file=>{
  const absolute=path.resolve(file),relative=path.relative(privateRoot,absolute);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'write outside private plan fixture');
  return absolute;
 };
 fs.writeFileSync=(file,...args)=>{privatePath(file);return originalFs.writeFileSync(file,...args);};
 fs.mkdirSync=(file,...args)=>{privatePath(file);return originalFs.mkdirSync(file,...args);};
 fs.openSync=(file,flags,...args)=>{if(typeof flags==='string'&&/[wa+]/u.test(flags))privatePath(file);return originalFs.openSync(file,flags,...args);};
 let serial=0,acceptanceChecks=0,complete=false,hook,policyPath,policyMutation=null;
 const put=(logical,value)=>{
  const raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');
  const file=path.join(privateRoot,'input-'+serial+++'.json');fs.writeFileSync(file,raw,{flag:'wx'});
  virtual.set(logical,file);return {path:logical,sha256:sha(raw)};
 };
 try{
  globalThis[Symbol.for('FINALRGB_PLAN_BINDING_PRIVATE_IO')]={
   read(base,b,fallback){
    assert.equal(base,project);const file=virtual.get(b.path);if(!file)return fallback(base,b);
    const raw=fs.readFileSync(file);assert.equal(sha(raw),b.sha256,'private bound input SHA differs');return raw;
   },
   json(base,b,fallback){const value=fallback(base,b);if(b.path===policyPath&&policyMutation)policyMutation(value);return value;},
   write(base,logical,value){
    assert.equal(base,project);assert.ok(logical.endsWith('/quality-plan.json'));
    const binding=put(logical,value);writes.push({binding,file:virtual.get(logical)});return binding;
   },
   verifyFinalAcceptance(base,plan){
    assert.equal(base,project);const raw=fs.readFileSync(virtual.get(plan.finalCpuAcceptance.path)),fixture=JSON.parse(raw);
    assert.equal(sha(raw),plan.finalCpuAcceptance.sha256);assert.equal(fixture.syntheticFixtureOnly,true);
    assert.equal(fixture.nativeAuthorityClaimed,false);acceptanceChecks++;
   }
  };
  const moduleUrl=pathToFileURL(path.join(project,'scripts/lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs')).href;
  hook=registerHooks({load(url,context,next){
   const loaded=next(url,context);if(url!==moduleUrl)return loaded;
   const adapter=`\nconst __privatePlanIo=globalThis[Symbol.for('FINALRGB_PLAN_BINDING_PRIVATE_IO')];
const __originalPlanRead=read;
const __originalPlanJson=json;
read=(base,b)=>__privatePlanIo.read(base,b,__originalPlanRead);
json=(base,b)=>__privatePlanIo.json(base,b,__originalPlanJson);
write=(base,logical,value)=>__privatePlanIo.write(base,logical,value);
verifyFinalAcceptance=(base,plan)=>__privatePlanIo.verifyFinalAcceptance(base,plan);\n`;
   return {...loaded,source:Buffer.from(loaded.source).toString('utf8')+adapter};
  }});
  const chain=await import(moduleUrl),profile=chain.FINAL_RGB_PROFILE;policyPath=profile.EXECUTION_POLICY.path;
  const {policy,previewBinding}=chain.verifyFinalRgbAuthority(project),candidate=chain.json(project,chain.CANDIDATE);
  const runId='final-rgb-plan-binding-'+randomUUID(),packageId='final-rgb-plan-package-'+randomUUID(),outputRoot=profile.OUTPUT_ROOT+'/'+runId;
  const graph=Array.from({length:108},(_,i)=>({name:'synthetic.parameter.'+i,shape:[1],elements:1,dtype:'torch.float32'}));
  for(const [index,name]of [[52,'core.core.terrain.decode_1.layers.3.weight'],[60,'core.core.terrain.full_resolution_detail.layers.3.weight'],[88,'core.core.final_rgb_decoder.base.layers.2.weight']])
   graph[index]={name,shape:[48,48,3,3],elements:20736,dtype:'torch.float32'};
  graph[0].elements=2242687-graph.slice(1).reduce((sum,row)=>sum+row.elements,0);graph[0].shape=[graph[0].elements];
  const modelBinding=put(outputRoot+'/model-identity.json',{capabilityVersion:profile.CAPABILITY,modelCapabilityVersion:profile.MODEL_CAPABILITY,
   architecture:profile.ARCHITECTURE,numericRule:profile.NUMERIC_RULE,graph,initialState:{generator:'0'.repeat(64),discriminator:'1'.repeat(64)}});
  const request={schema:'object-support-structure-quality-cpu-request-v1',runId,packageId,outputRoot:outputRoot+'/cpu-entry',
   configuration:chain.deriveConfiguration(candidate,{capabilityVersion:profile.CAPABILITY,trainingPreviewPolicy:previewBinding}),
   programBindings:chain.finalProgramBindings(project,{capabilityVersion:profile.CAPABILITY}),modelIdentityOutput:modelBinding.path,
   modelCapabilityVersion:profile.MODEL_CAPABILITY,datasetManifest:candidate.frozenBindings.datasetManifest,
   trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
   formalSpecification:profile.SPECIFICATION,sourceCandidate:chain.CANDIDATE,runtimeIdentity:chain.runtimeIdentity(project),
   historicalProvenance:{schemaVersion:'ai-painter-execution-provenance-refs-v1',frozenProgramPlan:{...chain.FROZEN_PLAN},
    priorCpuAcceptance:structuredClone(policy.priorCpuEvidence.acceptance),role:'immutable_historical_source_references_not_execution_permission'}};
  const requestBinding=put(outputRoot+'/cpu-request.json',request),dataClosure=put(outputRoot+'/data-closure.json',{syntheticFixtureOnly:true});
  const report=put(outputRoot+'/cpu-entry/cpu-report.json',{modelBinding,dataClosure});
  const finalCpuAcceptance=put(outputRoot+'/cpu-acceptance.json',{syntheticFixtureOnly:true,nativeAuthorityClaimed:false,report});
  const options={root:project,requestBinding,finalCpuAcceptance};
  assert.equal(fs.existsSync(path.join(project,outputRoot,'gpu-qualification-timing.json')),false,'timing observation is absent before preparation');
  const prepared=chain.preparePlan(options);assert.equal(writes.length,1);assert.equal(acceptanceChecks,1);
  assert.deepEqual(prepared,writes[0].binding);
  const plan=JSON.parse(fs.readFileSync(writes[0].file,'utf8'));
  assert.deepEqual(plan.executionPolicy,profile.EXECUTION_POLICY,'real preparePlan must serialize the top-level execution policy');
  assert.deepEqual(plan.executionPolicy,plan.configuration.executionPolicy);
  assert.deepEqual(plan.trainingPreviewPolicy,previewBinding);assert.deepEqual(plan.trainingPreviewPolicy,plan.configuration.trainingPreviewPolicy);
  assert.equal(chain.validatePlan(project,plan),plan);
  const native=await import(pathToFileURL(path.join(project,'scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs')).href);
  assert.deepEqual(native.nativeBudget('cpu'),{timeoutMs:240000,streamBytes:8388608,outputBytes:8388608});
  for(const [phase,timeoutMs]of [['qualification',720000],['training',8400000],['review',120000]]){
   const budget=native.nativeBudget(phase,{root:project,plan});assert.equal(budget.timeoutMs,timeoutMs);
   assert.equal(budget.streamBytes,8388608);assert.equal(budget.outputBytes,phase==='training'?134217728:16777216);
  }
  for(const seconds of [600,721]){const bad=structuredClone(plan);bad.configuration.gpuAdmissionSeconds=seconds;
   assert.throws(()=>native.nativeBudget('qualification',{root:project,plan:bad}));}
  const support={...structuredClone(plan),capabilityVersion:chain.CAPABILITY,executionProfile:chain.EXECUTION_PROFILE,
   outputRoot:chain.OUTPUT_ROOT+'/'+runId,configuration:chain.deriveConfiguration(candidate)};
  support.configuration.gpuAdmissionSeconds=720;
  assert.throws(()=>native.nativeBudget('qualification',{root:project,plan:support}));
  const candidatePackage=chain.makeInternalCandidate(project,prepared);
  const historicalInputs=[policy.supersededExecutionRevision.path,policy.supersededExecutionRevision.formalSpecificationSnapshot.path];
  for(const logical of historicalInputs)assert.ok(candidatePackage.inputEvidencePaths.includes(logical),'actual candidate builder must retain the frozen historical input');
  assert.equal(candidatePackage.inputEvidencePaths.includes(outputRoot+'/gpu-qualification-timing.json'),false,'timing output is never required package input');
  assert.equal(acceptanceChecks,2);

  const legacyFinalRgbPolicy={path:'data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-quality-execution-policy-v2.json',
   sha256:'6bdb8b2dac7db6f7a6d95592c5c970fa2aef82fd8e49ec90546ec64bdee6feab'};
  assert.equal(sha(fs.readFileSync(path.join(project,legacyFinalRgbPolicy.path))),legacyFinalRgbPolicy.sha256,'old policy bytes preserved');
  // An observation-looking private fixture cannot replace any policy binding.
  put(outputRoot+'/gpu-qualification-timing.json',{schemaVersion:'ai-painter-gpu-qualification-timing-v1',status:'passed',completedSamples:48,canGrantQualification:true});
  const mutations=[
   ['missing execution policy',p=>{delete p.executionPolicy;}],
   ['old execution policy',p=>{p.executionPolicy=structuredClone(legacyFinalRgbPolicy);} ],
   ['configuration execution conflict',p=>{p.configuration.executionPolicy=structuredClone(legacyFinalRgbPolicy);} ],
   ['execution digest drift',p=>{p.executionPolicy.sha256='0'.repeat(64);} ],
   ['missing preview policy',p=>{delete p.trainingPreviewPolicy;}],
   ['old preview policy',p=>{p.trainingPreviewPolicy.path=p.trainingPreviewPolicy.path.replace('-v3.json','-v2.json');}],
   ['configuration preview conflict',p=>{p.configuration.trainingPreviewPolicy.sha256='0'.repeat(64);} ],
   ['preview digest drift',p=>{p.trainingPreviewPolicy.sha256='0'.repeat(64);} ],
   ['old600 admission budget',p=>{p.configuration.gpuAdmissionSeconds=600;}],
   ['unregistered721 admission budget',p=>{p.configuration.gpuAdmissionSeconds=721;}]
  ];
  const cases=[{name:'correct real materialization',plan:structuredClone(plan),expected:true}];
  for(const [name,mutate]of mutations){
   const changed=structuredClone(plan);mutate(changed);
   assert.throws(()=>chain.validatePlan(project,changed),error=>error.code==='ERR_ASSERTION',name);
   cases.push({name,plan:changed,expected:false});
  }
  let materializerRejected=0;
  for(const key of ['executionPolicy','trainingPreviewPolicy']){
   const changed=structuredClone(request);changed.configuration[key].sha256='0'.repeat(64);
   const badRequest=put(requestBinding.path,changed),before=writes.length;
   assert.throws(()=>chain.preparePlan({...options,requestBinding:badRequest}),error=>error.code==='ERR_ASSERTION');
   assert.equal(writes.length,before,'invalid request must not materialize a plan');materializerRejected++;
  }
  put(requestBinding.path,request);
  let actualByteDriftRejected=0;
  for(const b of [profile.EXECUTION_POLICY,previewBinding]){
   const original=fs.readFileSync(path.join(project,b.path)),before=writes.length;
   put(b.path,Buffer.concat([original,Buffer.from('\n')]));
   assert.throws(()=>chain.preparePlan(options),/SHA differs/);assert.equal(writes.length,before);
   assert.equal(sha(fs.readFileSync(path.join(project,b.path))),b.sha256,'real authority bytes must remain unchanged');
   virtual.delete(b.path);actualByteDriftRejected++;
  }
  const observationMutations=[
   ['missing observation contract',p=>{delete p.qualificationObservation;}],
   ['wrong observation schema',p=>{p.qualificationObservation.schemaVersion='unregistered';}],
   ['unsafe observation filename',p=>{p.qualificationObservation.fileName='../timing.json';}],
   ['record allowance enlarged',p=>{p.qualificationObservation.maxFileBytes++;}],
   ['staged allowance enlarged',p=>{p.qualificationObservation.maxStagedFileBytes++;}],
   ['phase budget enlarged',p=>{p.qualificationObservation.accountedWithinQualificationOutputBytes++;}],
   ['qualification claim',p=>{p.qualificationObservation.canGrantQualification=true;}],
   ['new autograd call',p=>{p.qualificationObservation.additionalAutogradCalls=1;}],
   ['new CUDA synchronization',p=>{p.qualificationObservation.additionalCudaSynchronization=1;}],
   ['unauthenticated output authority',p=>{p.qualificationObservation.beforeAuthentication='write_any_output';}]
  ];
  for(const [name,mutate]of observationMutations){
   policyMutation=mutate;const before=writes.length;
   assert.throws(()=>chain.verifyFinalRgbAuthority(project),error=>error.code==='ERR_ASSERTION',name);
   assert.throws(()=>chain.preparePlan(options),error=>error.code==='ERR_ASSERTION',name);
   assert.equal(writes.length,before,'invalid observation policy must fail before plan output');policyMutation=null;
  }
  // Execute the actual Python validator prefix through its policy checks.
  // Model/data recomputation and native acceptance are outside this IO fixture.
  const pythonCode=`import ast,inspect,json,sys
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/src')]
import torch
calls={};guards=ExitStack()
def blocked(name):
 def stop(*a,**k):calls[name]=calls.get(name,0)+1;raise AssertionError(name)
 return stop
for obj,name in ((torch.nn.Module,'_call_impl'),(torch.autograd,'grad'),(torch.autograd,'backward'),(torch.optim.Optimizer,'__init__'),(torch.cuda,'_lazy_init')):guards.enter_context(patch.object(obj,name,side_effect=blocked(name)))
import object_support_structure_quality_auth_v1 as auth
tree=ast.parse(inspect.getsource(auth.validate_plan));function=tree.body[0]
cut=next(i for i,node in enumerate(function.body) if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='candidate' for target in node.targets))
assert any(isinstance(node,ast.If) and 'FINAL_RGB_CAPABILITY' in ast.unparse(node.test) for node in function.body[:cut])
function.body=function.body[:cut]+[ast.Return(ast.Name(id='plan',ctx=ast.Load()))];ast.fix_missing_locations(tree)
namespace=dict(vars(auth));exec(compile(tree,inspect.getsourcefile(auth),'exec'),namespace)
results=[]
for case in json.load(sys.stdin):
 try:namespace['validate_plan'](auth.Reader(root),case['plan']);accepted=True
 except ValueError:accepted=False
 assert accepted is case['expected'],case['name'];results.append({'name':case['name'],'accepted':accepted})
assert not calls;print(json.dumps({'cases':results,'forbiddenCalls':calls,'policyPrefixOnly':True}));guards.close()
`;
  const python=spawnSync(path.join(project,'ml/ai-painter/.venv/Scripts/python.exe'),['-I','-B','-X','utf8','-c',pythonCode,project],
   {input:JSON.stringify(cases),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1048576,
    env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
  assert.equal(python.status,0,python.stderr);const pythonResult=JSON.parse(python.stdout);
  assert.equal(pythonResult.cases.length,cases.length);assert.deepEqual(pythonResult.forbiddenCalls,{});
  assert.equal(acceptanceChecks,2);assert.equal(writes.length,1);
  complete=true;
  console.log(JSON.stringify({actualPreparePlanUsed:true,actualNodeValidatorUsed:true,actualCandidateBuilderUsed:true,historicalInputsVerified:historicalInputs.length,timingRequiredAsInput:false,privatePlanWrites:writes.length,
   liveCpuAcceptanceStubbed:true,nodePolicyCases:cases.length,invalidRequestsRejected:materializerRejected,
   actualByteDriftRejected,observationBoundaryCases:observationMutations.length,observationWasNotPreparationPrerequisite:true,pythonPolicyCases:pythonResult.cases.length,pythonPolicyPrefixOnly:true,
   forbiddenCalls:pythonResult.forbiddenCalls,productionRunCreated:false,productionRetryExecuted:false}));
 }catch(error){console.error('retained private plan fixture: '+privateRoot);throw error;}
 finally{
  hook?.deregister();delete globalThis[Symbol.for('FINALRGB_PLAN_BINDING_PRIVATE_IO')];
  Object.assign(fs,originalFs);
  if(complete){
   assert.equal(path.dirname(fs.realpathSync.native(privateRoot)),temporary);
   assert.match(path.basename(privateRoot),/^finalrgb-plan-binding-[A-Za-z0-9]+$/u);
   fs.rmSync(privateRoot,{recursive:true,force:false});
  }
 }
}

test('real plan materialization and Node/Python policy guards agree; conflicting bindings and changed bytes fail before writing',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e','('+isolatedPlanBindingMaterialization.toString()+')().catch(error=>{console.error(error);process.exitCode=1;});'],
  {cwd:root,encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1048576,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
 assert.equal(result.status,0,result.stderr);const observed=JSON.parse(result.stdout);
 assert.equal(observed.actualPreparePlanUsed,true);assert.equal(observed.actualNodeValidatorUsed,true);
 assert.equal(observed.actualCandidateBuilderUsed,true);assert.equal(observed.historicalInputsVerified,2);assert.equal(observed.timingRequiredAsInput,false);
 assert.equal(observed.nodePolicyCases,11);assert.equal(observed.pythonPolicyCases,11);
 assert.equal(observed.observationBoundaryCases,10);assert.equal(observed.observationWasNotPreparationPrerequisite,true);
 assert.equal(observed.invalidRequestsRejected,2);assert.equal(observed.actualByteDriftRejected,2);
 assert.equal(observed.privatePlanWrites,1);assert.equal(observed.liveCpuAcceptanceStubbed,true);
 assert.equal(observed.productionRetryExecuted,false);assert.deepEqual(observed.forbiddenCalls,{});
});


function savedAdmissionBudgetFixture(capability=reg.FINAL_RGB_CAPABILITY){
 const route=reg.executionRoute(capability),zero='0'.repeat(64),store=new Map();
 const put=(p,v)=>{const raw=Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v));store.set(p,raw);return {path:p,sha256:hash(raw)};};
 const inside=(r,p)=>path.resolve(r,p),bind=(r,p)=>{assert.ok(store.has(p));return {path:p,sha256:hash(store.get(p))};};
 const read=(r,b)=>{const raw=store.get(b.path);assert.ok(raw);assert.equal(hash(raw),b.sha256);return raw;},json=(r,b)=>JSON.parse(read(r,b));
 const runId='synthetic-budget-run',packageId='synthetic-budget-package',outputRoot=route.OUTPUT_ROOT+'/'+runId;
 const packageBinding={path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',sha256:zero};
 const configuration=reg.deriveConfiguration(chain.json(root,reg.CANDIDATE),capability===reg.FINAL_RGB_CAPABILITY?
  {capabilityVersion:capability,trainingPreviewPolicy:{path:route.previewPath,sha256:zero}}:{});
 const plan={runId,packageId,capabilityVersion:capability,outputRoot,configuration,runtimeIdentity:{python:{absolutePath:path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),sha256:zero}},
  programBindings:{nativeRunner:{path:'scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs',sha256:zero},gpuQualifier:{path:chain.ROLES.gpuQualifier,sha256:zero}}};
 const ready={root,plan,packageBinding},guardId='00000001-0002-0003-0004-000000000005',key=hash(Buffer.from(outputRoot)).slice(0,32);
 const nativeRoot='.runtime/ai-painter/owned-worker-guards/'+[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join('-');
 const source=Buffer.from('// explicit synthetic CPU source; never compiled\n'),binary=Buffer.from('synthetic-not-executable');
 put(nativeRoot+'/'+guardId+'-native/owner.cs',source);put(nativeRoot+'/'+guardId+'-native/owner.exe',binary);
 const ownerSource={path:inside(root,'scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs'),sha256:hash(source)};
 const guard={identity:guardId,runnerPid:999,recordedAtUtc:'2026-10-17T00:00:00Z',executable:plan.runtimeIdentity.python.absolutePath,
  executableSha256:zero,helperSha256:zero,nativeOwnerSource:ownerSource,
  commandSha256:hash(Buffer.from(JSON.stringify(['-B',inside(root,chain.ROLES.gpuQualifier),'--package',packageBinding.path,'--sha256',packageBinding.sha256]))),
  startedEvidence:inside(root,nativeRoot+'/'+guardId+'-started.json')};
 const build={snapshot:inside(root,nativeRoot+'/'+guardId+'-native/owner.cs'),binary:inside(root,nativeRoot+'/'+guardId+'-native/owner.exe'),binarySha256:hash(binary)};
 const encoded=Buffer.from(JSON.stringify({guard,guardSha256:hash(Buffer.from(JSON.stringify(guard))),scope:path.resolve(root),nativeBuild:build})).toString('base64');
 put(nativeRoot+'/'+guardId+'-started.json',{...guard,ownerPid:1001,commandBinding:encoded});
 const receipt={schema:'detail-weight-live-native-owner-receipt-v1',stopReason:null,phase:'qualification',cleanupConfirmed:true,processCleanupConfirmed:true,ownerClosed:true,ownerIdentity:{pid:1001},protocolError:null,
  proof:{exitCode:0,ownerPid:1001,rootPid:1002,rootCreationDateUtc:'2026-10-17T00:00:00Z',bindingBase64:encoded,assignedBeforeResume:true,killOnJobClose:true,
   activeProcessesAfterCleanup:0,stdoutBytes:20,stderrBytes:0,streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,transportCompleted:true,streamCaptureError:null,streamTransportError:null},
  streamBytes:{stdout:20,stderr:0},budget:{timeoutMs:configuration.gpuAdmissionSeconds*1000,outputBytes:16777216},nativeBuild:build,
  guard:{identity:guardId,state:'released_after_live_empty_job',nativeEvidenceRoot:nativeRoot},outputAccountingRoots:[outputRoot]};
 const receiptPath=outputRoot+'/synthetic-owned-gpu.json',admission={schema:'object-support-structure-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageBinding,
  programBindings:structuredClone(plan.programBindings),ownedReceipt:null,report:{path:outputRoot+'/gpu-gate.json',sha256:zero}};
 const registryResult={ok:true,registry:{activeExecution:null,capabilityVersion:capability,runId,packageId},currentTaskTerminal:{schema:'object-support-structure-quality-pretraining-terminal-v1',
  status:'qualification_completed_training_not_started',executionState:'completed',trainingStarted:false,optimizerStepsGenerator:0,optimizerStepsDiscriminator:0,executionPackage:packageBinding,gpuAcceptance:null}};
 const io={inside,bind,read,json,nativeOwnerSourceIdentity:()=>ownerSource,verifyGpuOutcome:()=>({fixtureOnly:true,numericalGateNotExecuted:true})};
 const fixture={ready,receipt,admission,registryResult,io,binding:null,refresh(){admission.ownedReceipt=put(receiptPath,receipt);this.binding=put(outputRoot+'/gpu-acceptance.json',admission);registryResult.currentTaskTerminal.gpuAcceptance=this.binding;}};
 fixture.refresh();return fixture;
}

test('actual stored admission verifier accepts only own720s final RGB or own600s support transcripts; no live cleanup authority',()=>{
 for(const capability of [reg.FINAL_RGB_CAPABILITY,reg.CAPABILITY]){const s=savedAdmissionBudgetFixture(capability);
  verifyStoredGpuAcceptance(s.ready,s.binding,s.registryResult,s.io);assert.equal(hasLiveOwnedProof(s.receipt),false);}
});
for(const [name,capability,mutate]of [
 ['old600 receipt',reg.FINAL_RGB_CAPABILITY,s=>{s.receipt.budget.timeoutMs=600000;}],
 ['expanded721 receipt',reg.FINAL_RGB_CAPABILITY,s=>{s.receipt.budget.timeoutMs=721000;}],
 ['caller721 override',reg.FINAL_RGB_CAPABILITY,s=>{s.ready.plan.configuration.gpuAdmissionSeconds=721;s.receipt.budget.timeoutMs=721000;}],
 ['caller600 fallback',reg.FINAL_RGB_CAPABILITY,s=>{s.ready.plan.configuration.gpuAdmissionSeconds=600;s.receipt.budget.timeoutMs=600000;}],
 ['support720 receipt',reg.CAPABILITY,s=>{s.receipt.budget.timeoutMs=720000;}],
 ['support720 override',reg.CAPABILITY,s=>{s.ready.plan.configuration.gpuAdmissionSeconds=720;s.receipt.budget.timeoutMs=720000;}],
 ['other package acceptance',reg.FINAL_RGB_CAPABILITY,s=>{s.admission.executionPackage={path:'.runtime/ai-painter/autonomous-closed-loop-packages/old-package/package.json',sha256:'1'.repeat(64)};}],
 ['changed source transcript',reg.FINAL_RGB_CAPABILITY,s=>{s.admission.programBindings.nativeRunner.sha256='1'.repeat(64);}],
 ['nonempty Job transcript',reg.FINAL_RGB_CAPABILITY,s=>{s.receipt.proof.activeProcessesAfterCleanup=1;}]
])test('actual stored admission verifier rejects '+name,()=>{const s=savedAdmissionBudgetFixture(capability);mutate(s);s.refresh();
 assert.throws(()=>verifyStoredGpuAcceptance(s.ready,s.binding,s.registryResult,s.io));});

test('current v3 authority uses frozen1.78 bytes while v2 remains a600s historical contract',()=>{
 const {policy}=chain.verifyFinalRgbAuthority(root),current=chain.read(root,reg.FINAL_RGB_PROFILE.SPECIFICATION);
 const history=policy.supersededExecutionRevision;
 const old=chain.json(root,{path:history.path,sha256:history.sha256}),snapshot=chain.read(root,history.formalSpecificationSnapshot);
 assert.ok(current.includes(Buffer.from('AI-PAINTER-SPEC-1.79')));
 assert.ok(snapshot.includes(Buffer.from('AI-PAINTER-SPEC-1.78')));
 assert.equal(old.formalSpecification.path,reg.FINAL_RGB_PROFILE.SPECIFICATION.path);
 assert.notEqual(hash(current),old.formalSpecification.sha256);
 assert.equal(hash(snapshot),old.formalSpecification.sha256);
 assert.equal(policy.qualificationObservation.canGrantQualification,false);
 assert.equal(policy.qualificationObservation.existingEventCountsOnly,true);
 assert.equal(policy.phaseResources.gpuAdmissionSeconds,720);assert.equal(policy.gpuAdmission.sampleCount,48);
 assert.equal(old.phaseResources.gpuAdmissionSeconds,600);
 assert.equal(old.schemaVersion,'ai-painter-final-rgb-base-weight-quality-execution-policy-v2');
 assert.equal(history.oldAttemptReplayAllowed,false);assert.equal(history.oldQualificationReusable,false);
 assert.equal(policy.executionCeiling.epochs,24);assert.equal(policy.executionCeiling.maxWallSeconds,8400);
});
