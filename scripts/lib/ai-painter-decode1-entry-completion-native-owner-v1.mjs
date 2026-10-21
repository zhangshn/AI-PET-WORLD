import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {registeredTrainingInterfaces} from './ai-painter-decode1-entry-weight-quality-registration-v1.mjs';

const sourcePath=fileURLToPath(new URL('../windows/ai-painter-owned-worker-owner-stream-completion-v1.cs',import.meta.url));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

export const COMPLETION_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1';
export const COMPLETION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v2.json',sha256:'cee623bb0a34bfd49f68ec99f6078c93603a7af66f457e807f29fa50b6cd467b'});
export const COMPLETION_SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',version:'AI-PAINTER-SPEC-1.98',sha256:'d8590b62599da831130fdd791edee9ea23f683d0ce62cd3845f9466676d37162'});
export const QUALIFICATION_COMPLETION_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2';
// Controller-frozen v3 bytes; an absent or different binding never grants execution.
export const QUALIFICATION_COMPLETION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v3.json',sha256:'851b6ad6c13794f9351325a3b9f6323295dd48c4dbad9a141f74074a7e0b2307'});
export const QUALIFICATION_COMPLETION_SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',version:'AI-PAINTER-SPEC-1.99',sha256:'0bdd8f244f2e75777e75e27a8606c1f7132d464ea5d1efb1aec8d1b1abce294e'});
const scopedFrozenInputs=new Map([
 [COMPLETION_POLICY.path+'\\0'+COMPLETION_POLICY.sha256,'.runtime/ai-painter/controller-repair-reviews/gpu-admission-completion-20261019/source-baselines/'+COMPLETION_POLICY.sha256+'.txt'],
 [COMPLETION_SPECIFICATION.path+'\\0'+COMPLETION_SPECIFICATION.sha256,'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.98-d8590b62.txt']
 ,['docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'+'\\0'+'4492b0641a5a3b5e62e9b8f2c71f358f3dcd3d43734cc7f3de0b721730c92cfc','data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.105-4492b064.txt']
]);
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{7,127}$/u.test(value);
function binding(value){assert(value&&typeof value.path==='string'&&/^[a-f0-9]{64}$/u.test(value.sha256),'immutable binding required');return {path:value.path,sha256:value.sha256};}
function readBound(root,ref,reader,parse=true){
 const b=binding(ref),physical=scopedFrozenInputs.get(b.path+'\\0'+b.sha256)??b.path,file=path.resolve(root,physical),relative=path.relative(path.resolve(root),file);
 assert(!path.isAbsolute(b.path)&&relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'project-relative binding required');
 const raw=reader(file);assert.equal(digest(raw),b.sha256,'immutable bytes differ: '+b.path);return parse?JSON.parse(raw):raw;
}
// This validator performs no build or spawn. Injected reader/clock exist for
// isolated component tests. createNativeOwnerCommand always uses real bytes,
// fixed module policy bindings and the actual clock.
export function resolveNativeTiming(timing,{root,executable,args,now=Date.now(),reader=fs.readFileSync}={}){
 if(typeof timing==='number'){
  assert(Number.isSafeInteger(timing)&&timing>0&&timing-now<=8400000,'original finite work deadline required');
  return Object.freeze({mode:'finite_deadline',deadlineUnixMs:timing});
 }
 assert(timing&&typeof timing==='object'&&!Array.isArray(timing),'explicit timing mode required');
 assert.deepEqual(Object.keys(timing).sort(),['mode','packageId','phase','policy','runId','startupDeadlineUnixMs'].sort(),'exact completion timing fields required');
 const supplied=binding(timing.policy),sameCall=supplied.path==='data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json';
 const registered=[COMPLETION_POLICY.path,QUALIFICATION_COMPLETION_POLICY.path,'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json'].includes(supplied.path)?null:
  registeredTrainingInterfaces(root).find(profile=>profile.EXECUTION_POLICY.path===supplied.path&&profile.EXECUTION_POLICY.sha256===supplied.sha256);
 const dual=!!registered||sameCall||supplied.path===QUALIFICATION_COMPLETION_POLICY.path;
 if(dual)assert(/^[a-f0-9]{64}$/u.test(QUALIFICATION_COMPLETION_POLICY.sha256??''),'qualification completion policy not frozen');
 const expectedPolicy=registered?registered.EXECUTION_POLICY:sameCall?{path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json',sha256:'a9efa678657b7069b36f824487673e27d05a862b39a37a21bf3270d34624e2aa'}:dual?QUALIFICATION_COMPLETION_POLICY:COMPLETION_POLICY;
 const capability=registered?registered.CAPABILITY:sameCall?'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1':dual?QUALIFICATION_COMPLETION_CAPABILITY:COMPLETION_CAPABILITY;
 const specification=registered?registered.interfacePolicy.formalSpecification:sameCall?{path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',version:'AI-PAINTER-SPEC-1.105',sha256:'4492b0641a5a3b5e62e9b8f2c71f358f3dcd3d43734cc7f3de0b721730c92cfc'}:dual?QUALIFICATION_COMPLETION_SPECIFICATION:COMPLETION_SPECIFICATION;
 assert.deepEqual(supplied,expectedPolicy,'registered completion policy required');
 const qualification=timing.phase==='qualification';
 assert(timing.phase==='training'||dual&&qualification,'registered completion phase required');
 assert.equal(timing.mode,qualification?'registered_qualification_completion':'registered_training_completion');
 assert(id(timing.runId)&&id(timing.packageId)&&timing.runId!==timing.packageId,'new Run/package identity required');
 const startupMs=qualification?720000:8400000;
 assert(Number.isSafeInteger(timing.startupDeadlineUnixMs)&&timing.startupDeadlineUnixMs>now&&timing.startupDeadlineUnixMs-now<=startupMs,'original finite startup budget required');
 const policy=readBound(root,expectedPolicy,reader);
 assert.equal(policy.schemaVersion,registered?'ai-painter-registered-training-execution-policy-v1':sameCall?'ai-painter-decode1-entry-weight-quality-execution-policy-v4':dual?'ai-painter-decode1-entry-weight-quality-execution-policy-v3':'ai-painter-decode1-entry-weight-quality-execution-policy-v2');
 assert.equal(policy.candidate,capability);assert.deepEqual(policy.formalSpecification,specification);readBound(root,specification,reader,false);
 assert.equal(policy.executionCeiling.trainingWallMode,'completion');assert.equal(policy.executionCeiling.maxWallSeconds,null);
 assert.deepEqual([policy.trainingCompletion.epochs,policy.trainingCompletion.generatorOptimizerSteps,policy.trainingCompletion.discriminatorOptimizerSteps,policy.trainingCompletion.trainingTotalWallSeconds],[24,1152,1152,null]);
 const native=qualification?policy.nativeQualificationCompletion:policy.nativeCompletion;
 assert.equal(native.mode,timing.mode);assert.equal(native.phase,timing.phase);assert.equal(native.cleanupMilliseconds,1000);
 if(qualification){assert.equal(native.startupSeconds,720);assert.equal(policy.phaseResources.gpuAdmissionSeconds,null);
  assert.equal(policy.phaseResources.gpuAdmissionWallMode,'completion');assert.equal(policy.phaseResources.gpuAdmissionStartupSeconds,720);
  assert.equal(policy.gpuAdmission.wallMode,'completion');assert.equal(policy.gpuAdmission.totalWallSeconds,null);assert.equal(policy.gpuAdmission.sampleCount,48);}
 assert(Array.isArray(args)&&args.length===(qualification?6:10));
 assert.deepEqual([args[0],args[2],args[4]],['-B','--package','--sha256']);
 if(!qualification)assert.deepEqual([args[6],args[8]],['--gpu','--gpu-sha256']);
 const packageRef=binding({path:args[3],sha256:args[5]});
 assert.equal(packageRef.path,'.runtime/ai-painter/autonomous-closed-loop-packages/'+timing.packageId+'/package.json');
 const pkg=readBound(root,packageRef,reader);assert.equal(pkg.packageIdentity,timing.packageId);assert.equal(pkg.capabilityVersion,capability);
 const output=policy.outputRoot+'/'+timing.runId,plans=pkg.inputEvidence.filter(b=>b.path===output+'/quality-plan.json');assert.equal(plans.length,1,'exact same-package plan required');
 const plan=readBound(root,plans[0],reader);assert.equal(plan.runId,timing.runId);assert.equal(plan.packageId,timing.packageId);assert.equal(plan.capabilityVersion,capability);
 if(registered){assert.deepEqual(plan.interfacePolicy,registered.EXECUTION_POLICY);assert.deepEqual(plan.entrypointSnapshot,registered.entrypointSnapshot);}
 assert.equal(plan.outputRoot,output);assert.equal(plan.executionProfile,policy.executionProfile);assert.deepEqual(plan.executionPolicy,expectedPolicy);
 assert.deepEqual(binding(plan.formalSpecification),binding(specification));assert.equal(plan.configuration.capabilityVersion,capability);assert.deepEqual(plan.configuration.executionCeiling,policy.executionCeiling);
 if(dual){assert.equal(plan.configuration.gpuAdmissionWallMode,'completion');assert.equal(plan.configuration.gpuAdmissionSeconds,null);}
 else assert.equal(plan.configuration.gpuAdmissionSeconds,720);
 assert.equal(plan.historicalCheckpointMayInitialize,false);assert.equal(plan.trainingRestartAllowed,false);
 const python=plan.runtimeIdentity.python;assert.equal(path.resolve(executable),path.resolve(python.absolutePath));assert.equal(digest(reader(executable)),python.sha256);
 const role=qualification?'gpuQualifier':'worker';assert.equal(path.resolve(args[1]),path.resolve(root,plan.programBindings[role].path));
 const sourceBindings=Object.values(plan.programBindings);assert(sourceBindings.length<=256);
 for(const b of sourceBindings)readBound(root,b,reader,false);
 if(!qualification){
  assert.equal(args[7],output+'/gpu-acceptance.json');const admission=readBound(root,{path:args[7],sha256:args[9]},reader);
  assert.equal(admission.schema,'object-support-structure-quality-owned-gpu-acceptance-v1');assert.equal(admission.status,'passed');assert.deepEqual(admission.executionPackage,packageRef);assert.deepEqual(admission.programBindings,plan.programBindings);
 }
 // This is transport validation, not CPU/GPU qualification. The existing host
 // still verifies current registry, consumed package and full live admission.
 return Object.freeze({...timing,policy:Object.freeze({...expectedPolicy})});
}
function completionDescriptor(bindingBase64){
 const raw=Buffer.from(bindingBase64,'base64');assert.equal(raw.toString('base64'),bindingBase64,'canonical invocation binding required');
 const timing=JSON.parse(raw).executionTiming;
 assert(timing&&Number.isSafeInteger(timing.startupDeadlineUnixMs),'bound completion timing required');
 assert((timing.phase==='training'&&timing.mode==='registered_training_completion')
  ||(timing.phase==='qualification'&&timing.mode==='registered_qualification_completion'),'exact bound completion phase/mode required');
 return timing;
}
export function createCompletionCleanupClock(){
 let value=null;
 return Object.freeze({start(observedAtUnixMs,reason=null){
  assert(Number.isSafeInteger(observedAtUnixMs)&&observedAtUnixMs>0,'actual cleanup anchor required');
  if(value)return value;
  value=Object.freeze({cleanupStartedAtUnixMs:observedAtUnixMs,reason,captureAt:observedAtUnixMs+375,forwardAt:observedAtUnixMs+500,publishAt:observedAtUnixMs+600,terminalAt:observedAtUnixMs+675,forceAt:observedAtUnixMs+750,finalAt:observedAtUnixMs+1000});
  return value;
 },current:()=>value});
}
export function createCompletionNativeFrameParser({bindingBase64,ownerPid,startupDeadlineUnixMs,now=Date.now}){
 assert(typeof bindingBase64==='string'&&Number.isInteger(ownerPid)&&ownerPid>0&&Number.isSafeInteger(startupDeadlineUnixMs));
 const executionTiming=completionDescriptor(bindingBase64);assert.equal(executionTiming.startupDeadlineUnixMs,startupDeadlineUnixMs);
 let started=null,cleanup=null;
 return line=>{
  assert(typeof line==='string'&&line.length<=90000&&/^[SC]:/u.test(line),'completion timing frame required');
  const bytes=Buffer.from(line.slice(2),'base64');assert.equal(bytes.toString('base64'),line.slice(2));assert(bytes.length<=65536,'completion frame cap');
  const v=JSON.parse(bytes);assert.equal(v.bindingBase64,bindingBase64);assert.equal(v.ownerPid,ownerPid);
  assert(Number.isInteger(v.rootPid)&&v.rootPid>0&&typeof v.rootCreationDateUtc==='string'&&Number.isFinite(Date.parse(v.rootCreationDateUtc)));
  if(line[0]==='S'){
   assert.equal(started,null,'duplicate startup frame');assert.equal(cleanup,null);
   assert.deepEqual(Object.keys(v).sort(),['schemaVersion','bindingBase64','ownerPid','rootPid','rootCreationDateUtc','startedAtUtc','startupDeadlineUnixMs'].sort());
   assert.equal(v.schemaVersion,'completion-native-started-v1');assert.equal(v.startupDeadlineUnixMs,startupDeadlineUnixMs);
   assert(Number.isFinite(Date.parse(v.startedAtUtc))&&now()<startupDeadlineUnixMs,'startup acknowledgement deadline');
   started=Object.freeze(v);return Object.freeze({kind:'started',frame:started});
  }
  assert(started&&cleanup===null,'cleanup requires one retained startup frame');
  assert.deepEqual(Object.keys(v).sort(),['schemaVersion','bindingBase64','ownerPid','rootPid','rootCreationDateUtc','cleanupStartedAtUnixMs','cleanupMs','stopReason'].sort());
  assert.equal(v.schemaVersion,'completion-native-cleanup-start-v1');assert.equal(v.rootPid,started.rootPid);assert.equal(v.rootCreationDateUtc,started.rootCreationDateUtc);
  assert.equal(v.cleanupMs,1000);assert(Number.isSafeInteger(v.cleanupStartedAtUnixMs)&&v.cleanupStartedAtUnixMs>0&&v.cleanupStartedAtUnixMs<=now()+25,'actual cleanup timestamp required');
  assert(v.stopReason===null||(typeof v.stopReason==='string'&&Buffer.byteLength(v.stopReason)<=2048));
  cleanup=Object.freeze(v);return Object.freeze({kind:'cleanup',frame:cleanup});
 };
}
// Pure additional timing/identity consistency check. It never substitutes for
// the host's retained-handle/EOF/empty-Job validation or grants guard release.
export function validateCompletionNativeTimingProof(proof,{started,cleanup,ownerPid,bindingBase64}){
 assert(started&&cleanup&&proof,'one live S/C/R sequence required');
 for(const value of [started,cleanup,proof]){
  assert.equal(value.bindingBase64,bindingBase64);assert.equal(value.ownerPid,ownerPid);
  assert.equal(value.rootPid,started.rootPid);assert.equal(value.rootCreationDateUtc,started.rootCreationDateUtc);
 }
 assert.equal(proof.timingMode,completionDescriptor(bindingBase64).mode);assert.equal(proof.startedAtUtc,started.startedAtUtc);
 assert.equal(proof.cleanupStartedAtUnixMs,cleanup.cleanupStartedAtUnixMs);assert.equal(proof.stopReason,cleanup.stopReason);
 assert(Number.isFinite(Date.parse(proof.startedAtUtc))&&Number.isFinite(Date.parse(proof.endedAtUtc)));
 assert(Number.isSafeInteger(proof.elapsedMs)&&proof.elapsedMs>=0,'actual native monotonic duration required');
 return true;
}

// Only the current synchronous compiler call can produce this observation.
// Parsed files, copied Error fields and caller flags cannot recreate it.
const buildFailures=new WeakMap();
export function nativeBuildFailureObservation(error){return buildFailures.get(error)??null;}
export function nativeOwnerSourceIdentity(){return {path:sourcePath,sha256:digest(fs.readFileSync(sourcePath))};}
function put(file,bytes){const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}

// A fresh build per invocation avoids accepting an executable from a writable cache.
// These hashes record actual build inputs/outputs; they are not cleanup authorization.
export function createNativeOwnerCommand(executable,args,cwd,timing,cleanupMs,guardRecord,guardBytes){
  assert.equal(cleanupMs,1000,'original finite cleanup budget required');
  const executionTiming=resolveNativeTiming(timing,{root:cwd,executable,args});
  const deadline=executionTiming.mode==='finite_deadline'?executionTiming.deadlineUnixMs:executionTiming.startupDeadlineUnixMs;
  const directory=path.join(path.dirname(guardRecord.startedEvidence),guardRecord.identity+'-native');
  fs.mkdirSync(directory);
  const source=fs.readFileSync(sourcePath);
  assert.equal(digest(source),guardRecord.nativeOwnerSource.sha256,'native owner source changed before build');
  const framework=path.join(process.env.SystemRoot??'C:/Windows','Microsoft.NET','Framework64','v4.0.30319');
  const compiler=path.join(framework,'csc.exe'),compilerSha256=digest(fs.readFileSync(compiler));
  const snapshot=path.join(directory,'owner.cs'),binary=path.join(directory,'owner.exe');put(snapshot,source);
  const remaining=deadline-Date.now();assert(remaining>0,'native build deadline exhausted');
  const compileArgs=['/nologo','/noconfig','/utf8output','/target:exe','/optimize+',...['System.dll','System.Core.dll','System.Web.Extensions.dll'].map(name=>`/reference:${path.join(framework,name)}`),`/out:${binary}`,snapshot];
  let output;
  try{output=execFileSync(compiler,compileArgs,{cwd,windowsHide:true,shell:false,timeout:remaining,maxBuffer:1024*1024,encoding:'utf8'});}
  catch(error){
    const failurePath=path.join(directory,'build-failure.json'),failureBytes=JSON.stringify({code:error.code??null,status:error.status??null,message:error.message,stdout:String(error.stdout??'').slice(0,8192),stderr:String(error.stderr??'').slice(0,8192)});
    put(failurePath,failureBytes);
    if(Number.isInteger(error.status)&&error.status!==0&&!error.signal
      &&digest(fs.readFileSync(sourcePath))===guardRecord.nativeOwnerSource.sha256&&digest(fs.readFileSync(compiler))===compilerSha256){
      buildFailures.set(error,Object.freeze({schema:'live-native-compiler-failure-v1',runnerPid:process.pid,guardIdentity:guardRecord.identity,guardSha256:digest(Buffer.from(guardBytes)),
        compiler,compilerSha256,exitStatus:error.status,source:guardRecord.nativeOwnerSource,failurePath,failureSha256:digest(Buffer.from(failureBytes)),recordedAtUtc:new Date().toISOString()}));
    }
    throw error;
  }
  assert.equal(digest(fs.readFileSync(sourcePath)),guardRecord.nativeOwnerSource.sha256,'native owner source changed during build');
  assert.equal(digest(fs.readFileSync(compiler)),compilerSha256,'native compiler changed during build');
  assert(Date.now()<deadline,'native build deadline exhausted');
  const nativeBuild={source:guardRecord.nativeOwnerSource,snapshot,compiler,compilerSha256,binary,binarySha256:digest(fs.readFileSync(binary)),compileArgs,output,recordedAtUtc:new Date().toISOString()};
  put(path.join(directory,'build.json'),JSON.stringify(nativeBuild));
  const observationPath=path.join(directory,'cleanup-observation.json');
  const bindingBase64=Buffer.from(JSON.stringify({guard:guardRecord,guardSha256:digest(Buffer.from(guardBytes)),scope:path.resolve(cwd),nativeBuild,executionTiming})).toString('base64');
  return {executable:binary,args:[executable,cwd,executionTiming.mode==='finite_deadline'?String(deadline):(executionTiming.phase==='qualification'?'completion_qualification:':'completion_train:')+deadline,String(cleanupMs),observationPath,bindingBase64,...args],nativeBuild,observationPath,bindingBase64,executionTiming};
}
