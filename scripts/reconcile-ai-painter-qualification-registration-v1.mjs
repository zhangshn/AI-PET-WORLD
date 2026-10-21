// CPU-only settlement of one expired qualification registration; no Job/guard operation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {resolveOwnedStopProjectDirectory} from './lib/ai-painter-owned-stop-request-v1.mjs';
import {readCurrentExecutionRegistry,recoverExpiredActiveExecutionToFailedClosed} from '../src/server/ai-painter-current-execution-registry.mjs';

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');
export const PROGRAM='scripts/reconcile-ai-painter-qualification-registration-v1.mjs';
export const OUTPUT='.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/parameter48-review-20261018/qualification-registration-repair-v1';
export const CASE=OUTPUT+'/case.json';
const REGISTRY='.runtime/ai-painter/current-execution-registry/current.json';
const GUARDS='.runtime/ai-painter/owned-worker-guards';
const LIMIT=8*1024*1024;
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function logical(value){assert(typeof value==='string'&&value.length>0&&!/[\\:\x00-\x1f\x7f]/u.test(value)
  &&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'),'explicit logical path required');return value;}
function binding(value){logical(value?.path);assert(/^[a-f0-9]{64}$/u.test(value.sha256??''),'exact input SHA required');return {path:value.path,sha256:value.sha256};}
function sameBinding(a,b){assert.deepEqual(binding(a),binding(b),'binding differs');}
function file(root,name){logical(name);const parent=resolveOwnedStopProjectDirectory(root,path.posix.dirname(name));
  const target=path.join(parent,path.posix.basename(name));if(fs.existsSync(target)){const st=fs.lstatSync(target);assert(st.isFile()&&!st.isSymbolicLink(),'ordinary file required');}return target;}
function read(root,b,maximum=1024*1024){const target=file(root,binding(b).path),st=fs.statSync(target);assert(st.size<=maximum,'input size bound');
  const raw=fs.readFileSync(target);assert.equal(hash(raw),b.sha256,'input SHA mismatch: '+b.path);if(b.bytes!==undefined)assert.equal(raw.length,b.bytes);return raw;}
function json(root,b,maximum){return JSON.parse(read(root,b,maximum));}
function bytesUnder(root){let sum=0;for(const row of fs.readdirSync(root,{withFileTypes:true})){assert(!row.isSymbolicLink(),'output redirect refused');
  const target=path.join(root,row.name);sum+=row.isDirectory()?bytesUnder(target):fs.statSync(target).size;}return sum;}

export function validateRepairCase(c){
  assert.equal(c.schemaVersion,'qualification-registration-handoff-repair-case-v1');assert.equal(c.caseId,'decode1-entry-v2-registration-handoff');
  assert.equal(c.outputRoot,OUTPUT);assert.equal(c.registry.path,REGISTRY);assert.equal(c.sourceProgram.path,PROGRAM);
  assert.equal(c.capabilityVersion,'stage4_mvp256_dry_decode1_entry_gpu_qualification_v2');
  assert(/^decode1-entry-qualification-v2-[a-f0-9-]{36}$/u.test(c.runId));assert.equal(c.packageId,c.runId+'-package');
  assert.deepEqual(c.scope,{registryOnly:true,guardMutation:false,processTermination:false,qualificationReplay:false,training:false});
  assert.deepEqual(c.resources,{maxWallSeconds:120,maxOutputBytes:LIMIT,maxStreamBytes:LIMIT,automaticRetries:0});
  for(const key of ['registry','sourceProgram','originalPolicy','sourcePackage','cpuTerminal','gpuTerminal','trainingTerminal','activeLock','heartbeat'])binding(c[key]);
  assert(Number.isInteger(c.registry.revision)&&c.registry.revision>0);return true;
}

export function verifyRepairEvidence(root,caseBinding,{now=Date.now()}={}){
  assert(path.isAbsolute(root));assert.equal(caseBinding.path,CASE);const c=json(root,caseBinding,32768);validateRepairCase(c);
  read(root,c.sourceProgram);const raw=read(root,c.registry,65536),registry=JSON.parse(raw);
  assert.equal(registry.registryRevision,c.registry.revision);assert.equal(registry.capabilityVersion,c.capabilityVersion);
  assert.equal(registry.runId,c.runId);assert.equal(registry.packageId,c.packageId);assert(registry.activeExecution,'exact stale active entry required');
  assert(!fs.existsSync(file(root,GUARDS+'/active.json')),'a current guard prohibits registration settlement');
  const pkg=json(root,c.sourcePackage,65536),policy=json(root,c.originalPolicy,32768);
  assert.equal(pkg.runId,c.runId);assert.equal(pkg.capabilityVersion,c.capabilityVersion);sameBinding(pkg.policy,c.originalPolicy);
  assert.equal(policy.capabilityVersion,c.capabilityVersion);assert.equal(policy.executionBoundary.training,false);
  assert(Array.isArray(pkg.programBindings)&&pkg.programBindings.length>0&&pkg.programBindings.length<=256);
  const programs=new Map();let sourceBytes=0;
  for(const b of pkg.programBindings){assert(!programs.has(b.path),'duplicate program path');programs.set(b.path,b);sourceBytes+=read(root,b).length;}
  assert(sourceBytes<=16*1024*1024,'source aggregate ceiling');
  for(const b of Object.values(registry.activeExecution.programLineage)){sameBinding(programs.get(b.path),b);}
  sameBinding(registry.activeExecution.lock,c.activeLock);const lock=json(root,c.activeLock,8192),beat=json(root,c.heartbeat,8192);
  assert.equal(registry.activeExecution.heartbeat.path,c.heartbeat.path);
  for(const v of [lock,beat])for(const key of ['capabilityVersion','packageId','runId','processId','processStartIdentity'])assert.equal(v[key],registry.activeExecution[key]);
  assert.equal(beat.ttlSeconds,registry.activeExecution.heartbeat.ttlSeconds);
  assert(Number.isFinite(Date.parse(beat.heartbeatAtUtc))&&now-Date.parse(beat.heartbeatAtUtc)>beat.ttlSeconds*1000,'heartbeat must be expired');
  const cpu=json(root,c.cpuTerminal,262144),gpu=json(root,c.gpuTerminal,65536);
  for(const t of [cpu,gpu]){assert.equal(t.runId,c.runId);sameBinding(t.policy,c.originalPolicy);sameBinding(t.package,c.sourcePackage);}
  assert.equal(cpu.status,'cpu_preparation_passed');assert.equal(cpu.mode,'cpu_prepare');assert.equal(cpu.executionState,'completed');
  assert.equal(gpu.executionState,'failed_closed');assert.equal(gpu.status,'failed_closed');
  assert.equal(gpu.mode,'gpu_qualify');assert.equal(gpu.trainingAllowed,false);assert.equal(gpu.actualCounts,null,'missing counts cannot be invented');
  assert.equal(gpu.worker,null);assert.equal(gpu.workerFailure,null);assert.equal(gpu.firstError.type,'AssertionError');
  assert.equal(cpu.cleanup.guard.identity,'87686856-d356-40d3-aac0-2e416998f237');
  assert.equal(gpu.cleanup.guard.identity,'c92e55fe-3b6a-4ddf-8d57-443a707c5fcc');
  assert(gpu.firstError.message.includes(cpu.cleanup.guard.identity)&&gpu.firstError.message.includes(gpu.cleanup.guard.identity),'exact handoff failure required');
  for(const t of [cpu,gpu]){
    const q=t.cleanup,id=q.guard.identity,prefix=GUARDS+'/'+id;
    assert.equal(q.cleanupConfirmed,true);assert.equal(q.guardReleaseConfirmed,true);assert.equal(q.liveOwnerCleanupConfirmed,true);
    assert.equal(q.ownerClosed,true);assert.equal(q.ownerExitCode,0);assert.equal(q.ownerSignal,null);
    assert.equal(q.protocolError,null);assert.equal(q.ownerError,'');assert.equal(q.persistenceError,null);
    assert.deepEqual(q.validation,{valid:true,emptyJob:true,errors:[]});assert.equal(q.proof.activeProcessesAfterCleanup,0);
    assert.equal(q.proof.ownerPid,q.ownerIdentity.pid);assert.equal(q.proof.assignedBeforeResume,true);assert.equal(q.proof.killOnJobClose,true);
    assert.equal(q.proof.stdoutClosed,true);assert.equal(q.proof.stderrClosed,true);assert.equal(q.proof.transportCompleted,true);
    assert.equal(q.proof.streamClosureVersion,'bounded-stream-capture-v2');
    for(const key of ['cleanupError','observationError','streamCaptureError','streamTransportError'])assert.equal(q.proof[key],null);
    for(const name of ['stdout','stderr']){assert(Number.isSafeInteger(q.streamBytes[name])&&q.streamBytes[name]>=0);
      assert.equal(q.proof[name+'Bytes'],q.streamBytes[name]);}
    assert(q.streamBytes.stdout+q.streamBytes.stderr<LIMIT,'original stream ceiling');
    const command=JSON.parse(Buffer.from(q.proof.bindingBase64,'base64').toString('utf8'));
    assert.equal(command.guard.identity,id);assert.equal(command.guard.runnerPid,registry.activeExecution.processId);
    assert.equal(path.resolve(command.scope),path.resolve(root));
    assert.equal(path.resolve(q.guard.terminalPath),path.join(root,prefix+'-guard-terminal.json'));
    const archived=read(root,{path:prefix+'-guard-terminal.json',sha256:command.guardSha256},8192);
    assert.deepEqual(JSON.parse(archived),command.guard);
    const startPath=prefix+'-started.json',startRaw=fs.readFileSync(file(root,startPath)),started=JSON.parse(startRaw);
    assert.equal(started.bindingBase64,q.proof.bindingBase64);assert.deepEqual(started.ownerIdentity,q.ownerIdentity);
    const live=JSON.parse(fs.readFileSync(file(root,prefix+'-terminal.json')));
    assert.deepEqual(live.proof,q.proof);assert.equal(live.liveOwnerCleanupConfirmed,true);
    assert.equal(path.resolve(command.nativeBuild.binary),path.join(root,prefix+'-native/owner.exe'));
    read(root,{path:prefix+'-native/owner.exe',sha256:command.nativeBuild.binarySha256});
    read(root,{path:prefix+'-native/owner.cs',sha256:command.nativeBuild.source.sha256});
    const helper=programs.get(policy.implementations.sharedNativeWorker);assert(helper);assert.equal(command.guard.helperSha256,helper.sha256);
    const requestBinding=binding(t.request),request=json(root,requestBinding,8192);
    assert.equal(request.runId,c.runId);assert.equal(request.mode,t.mode);sameBinding(request.package,c.sourcePackage);sameBinding(request.policy,c.originalPolicy);
    const args=['-B',path.join(root,policy.implementations.worker),'--request',requestBinding.path,'--request-sha256',requestBinding.sha256];
    assert.equal(command.guard.commandSha256,hash(JSON.stringify(args)));
  }
  assert.equal(registry.latestTrainingTerminal.sha256,c.trainingTerminal.sha256);sameBinding(registry.latestTrainingTerminal,c.trainingTerminal);read(root,c.trainingTerminal,65536);
  return {case:c,registry,registryRaw:raw,cpu,gpu,programCount:programs.size,sourceBytes};
}

export async function repairRegistration(root=ROOT,caseBinding){
  const began=performance.now(),deadline=Date.now()+120000,verified=verifyRepairEvidence(root,caseBinding),c=verified.case;
  const target=resolveOwnedStopProjectDirectory(root,c.outputRoot),claim=file(root,c.outputRoot+'/attempt-v1.json');
  assert(!fs.existsSync(claim),'maintenance attempt already consumed; no automatic retry');
  const shared=path.join(root,'.runtime/ai-painter/current-execution-registry');
  const sharedFiles=['registry.sqlite','registry.sqlite-journal','registry.sqlite-wal','events.jsonl'];
  const size=f=>fs.existsSync(f)?fs.statSync(f).size:0,baseline=new Map(sharedFiles.map(f=>[f,size(path.join(shared,f))]));
  const guard=()=>{assert(Date.now()<deadline&&performance.now()-began<120000,'maintenance deadline');
    assert(!fs.existsSync(file(root,GUARDS+'/active.json')),'new guard prohibits registry settlement');assert(bytesUnder(target)<LIMIT-1048576,'maintenance finalization reserve');};
  const put=(name,value,raw=false)=>{guard();const bytes=raw?value:Buffer.from(JSON.stringify(value,null,2)+'\n');assert(bytes.length<=262144);
    const logicalPath=c.outputRoot+'/'+name,fd=fs.openSync(file(root,logicalPath),'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    return {path:logicalPath,sha256:hash(bytes),bytes:bytes.length};};
  put('attempt-v1.json',{schemaVersion:'qualification-registration-maintenance-attempt-v1',case:caseBinding,runId:c.runId,recordedAtUtc:new Date().toISOString(),automaticRetries:0});
  const original=put('previous-registry.json',verified.registryRaw,true);
  const terminal=put('terminal.json',{schemaVersion:'qualification-registration-settlement-terminal-v1',capabilityVersion:c.capabilityVersion,packageId:c.packageId,runId:c.runId,
    executionState:'failed_closed',status:'qualification_controller_handoff_failed_closed',originalRegistry:original,sourceFailure:c.gpuTerminal,cpuPreparation:c.cpuTerminal,
    actualGpuCounts:null,historicalCleanupCertified:false,guardTouched:false,oldExecutionMayReplay:false,trainingQualificationGranted:false,trainingStarted:false});
  const capsule=put('capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:c.runId+'-expired-active-recovery',runId:c.runId,integrity:{status:'verified'},
    evidence:[{...caseBinding,sha256Verified:true},{...original,sha256Verified:true},{...c.gpuTerminal,sha256Verified:true},{...terminal,sha256Verified:true}]});
  guard();verifyRepairEvidence(root,caseBinding);guard();
  const recovered=await recoverExpiredActiveExecutionToFailedClosed({projectRoot:root,capabilityVersion:c.capabilityVersion,packageId:c.packageId,runId:c.runId,
    taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,expectedPreviousRegistryRevision:c.registry.revision,expectedPreviousRegistrySha256:c.registry.sha256});
  guard();assert(recovered.ok);const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok);assert.equal(after.registry.activeExecution,null);
  assert.deepEqual(after.registry.latestTrainingTerminal,verified.registry.latestTrainingTerminal);
  const tx=path.join(shared,'transactions',after.registry.transactionId),growth=sharedFiles.reduce((n,f)=>n+Math.max(0,size(path.join(shared,f))-baseline.get(f)),0);
  const measured=bytesUnder(target)+bytesUnder(tx)+growth;assert(measured<LIMIT-65536,'maintenance output limit');
  const result={schemaVersion:'qualification-registration-repair-result-v1',status:'registration_failed_closed_no_active_execution',runId:c.runId,case:caseBinding,
    sourceFailure:c.gpuTerminal,terminal,registryRevision:after.registry.registryRevision,registrySha256:after.registrySha256,latestTrainingTerminalUnchanged:true,
    guardTouched:false,historicalCleanupCertified:false,gpuReplayed:false,trainingStarted:false,measuredBytesBeforeResult:measured,elapsedMs:performance.now()-began};
  put('result.json',result);return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  try{const args=process.argv.slice(2);assert(args.length===4&&args[0]==='--case'&&args[1]===CASE&&args[2]==='--case-sha256','fixed CPU-only repair case required');
    const result=await repairRegistration(ROOT,{path:args[1],sha256:args[3]});process.stdout.write(JSON.stringify(result)+'\n');}
  catch(error){process.exitCode=1;process.stderr.write(JSON.stringify({status:'repair_failed_closed',error:String(error.message).slice(0,4096),gpuReplayed:false,trainingStarted:false})+'\n');}
}
