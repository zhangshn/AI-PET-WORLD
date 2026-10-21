// Private synthetic evidence only. Never run a successful repair, native Job or GPU.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PROGRAM, OUTPUT, CASE, validateRepairCase, verifyRepairEvidence, repairRegistration,
} from '../reconcile-ai-painter-qualification-registration-v1.mjs';

const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const CPU_GUARD='87686856-d356-40d3-aac0-2e416998f237';
const GPU_GUARD='c92e55fe-3b6a-4ddf-8d57-443a707c5fcc';
const GUARDS='.runtime/ai-painter/owned-worker-guards';
const REGISTRY='.runtime/ai-painter/current-execution-registry/current.json';
const CAPABILITY='stage4_mvp256_dry_decode1_entry_gpu_qualification_v2';
const RUN='decode1-entry-qualification-v2-00000000-0000-4000-8000-000000000000';
const NOW=Date.now();
const PREFIX='ai-painter-qualification-registration-repair-';

function fixturePath(root,logical){
  const target=path.resolve(root,logical),relative=path.relative(root,target);
  assert(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'private fixture target');
  return target;
}
function put(root,logical,value){
  const target=fixturePath(root,logical),raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);
  return {path:logical,sha256:hash(raw),bytes:raw.length};
}
function read(root,b){return JSON.parse(fs.readFileSync(fixturePath(root,b.path),'utf8'));}
function snapshot(root){
  const result={};
  function visit(directory){for(const row of fs.readdirSync(directory,{withFileTypes:true})){
    const absolute=path.join(directory,row.name);assert(!row.isSymbolicLink());
    if(row.isDirectory())visit(absolute);else result[path.relative(root,absolute)]=hash(fs.readFileSync(absolute));
  }}
  visit(root);return result;
}
function withFixture(run){
  const temporaryParent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temporaryParent,PREFIX));
  return Promise.resolve().then(()=>run(buildFixture(root))).finally(()=>{
    const resolved=fs.realpathSync(root);
    assert.equal(path.dirname(resolved),temporaryParent);assert(path.basename(resolved).startsWith(PREFIX));
    fs.rmSync(resolved,{recursive:true,force:true});
  });
}

function buildFixture(root){
  const executionRoot='.runtime/ai-painter/decode1-entry-gpu-qualifications-v2/'+RUN;
  fs.mkdirSync(fixturePath(root,GUARDS),{recursive:true});
  fs.mkdirSync(fixturePath(root,OUTPUT),{recursive:true});
  const sourceProgram=put(root,PROGRAM,Buffer.from('// synthetic repair source identity, never executed\n'));
  const worker=put(root,'ml/ai-painter/scripts/qualify_decode1_entry_gpu_v2.py',Buffer.from('# synthetic worker source, never executed\n'));
  const helper=put(root,'scripts/lib/ai-painter-decode1-entry-qualification-owned-worker-v2.mjs',Buffer.from('// synthetic helper, never executed\n'));
  const originalPolicy=put(root,'data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v2.json',{
    capabilityVersion:CAPABILITY,executionBoundary:{training:false},
    implementations:{worker:worker.path,sharedNativeWorker:helper.path},
  });
  const sourcePackage=put(root,executionRoot+'/package.json',{
    runId:RUN,capabilityVersion:CAPABILITY,policy:originalPolicy,programBindings:[worker,helper],
  });
  const identity={capabilityVersion:CAPABILITY,packageId:RUN+'-package',runId:RUN,processId:987654,
    processStartIdentity:'synthetic-dead-supervisor-identity'};
  const activeLock=put(root,executionRoot+'/execution-lock.json',identity);
  const heartbeat=put(root,executionRoot+'/heartbeat.json',{
    ...identity,ttlSeconds:120,heartbeatAtUtc:new Date(NOW-121000).toISOString(),
  });
  const trainingTerminal=put(root,'.runtime/fixture/original-training-terminal.json',{
    runId:'original-training-run-not-this-qualification',executionState:'failed_closed',actualCounts:{generator:607,discriminator:608},
  });
  const latestTrainingTerminal={...trainingTerminal,runId:'original-training-run-not-this-qualification',status:'failed_closed'};
  const registry=put(root,REGISTRY,{
    registryRevision:7,capabilityVersion:CAPABILITY,runId:RUN,packageId:identity.packageId,latestTrainingTerminal,
    activeExecution:{...identity,lock:activeLock,heartbeat:{path:heartbeat.path,ttlSeconds:120},programLineage:{worker,helper}},
  });
  const requests={},terminals={};
  for(const [mode,tag,id] of [['cpu_prepare','cpu',CPU_GUARD],['gpu_qualify','gpu',GPU_GUARD]]){
    const request=put(root,executionRoot+'/'+tag+'-request.json',{
      schemaVersion:'decode1-entry-gpu-qualification-request-v2',mode,runId:RUN,package:sourcePackage,policy:originalPolicy,
    });
    requests[tag]=request;
    const prefix=GUARDS+'/'+id;
    const binary=put(root,prefix+'-native/owner.exe',Buffer.from('synthetic native binary, never launched'));
    const source=put(root,prefix+'-native/owner.cs',Buffer.from('synthetic native source, never compiled'));
    const args=['-B',path.join(root,worker.path),'--request',request.path,'--request-sha256',request.sha256];
    const guard={identity:id,runnerPid:identity.processId,helperSha256:helper.sha256,commandSha256:hash(JSON.stringify(args))};
    const archived=put(root,prefix+'-guard-terminal.json',guard);
    const command={guard,guardSha256:archived.sha256,scope:root,
      nativeBuild:{binary:fixturePath(root,binary.path),binarySha256:binary.sha256,source:{sha256:source.sha256}}};
    const bindingBase64=Buffer.from(JSON.stringify(command)).toString('base64');
    const ownerIdentity={pid:1000+(tag==='cpu'?1:2),creationTimeUtc:'2026-10-18T09:00:00.000Z'};
    const streamBytes={stdout:32,stderr:0};
    const proof={bindingBase64,activeProcessesAfterCleanup:0,ownerPid:ownerIdentity.pid,assignedBeforeResume:true,
      killOnJobClose:true,stdoutClosed:true,stderrClosed:true,transportCompleted:true,streamClosureVersion:'bounded-stream-capture-v2',
      cleanupError:null,observationError:null,streamCaptureError:null,streamTransportError:null,
      stdoutBytes:streamBytes.stdout,stderrBytes:streamBytes.stderr,rootPid:ownerIdentity.pid+100,
      rootCreationDateUtc:'2026-10-18T09:00:00.000Z',totalProcesses:1,exitCode:0,stopReason:null,emptyJob:true};
    const cleanup={guard:{identity:id,path:fixturePath(root,GUARDS+'/active.json'),state:'released_after_live_empty_job',
      terminalPath:fixturePath(root,archived.path)},cleanupConfirmed:true,guardReleaseConfirmed:true,
      liveOwnerCleanupConfirmed:true,ownerClosed:true,ownerExitCode:0,ownerSignal:null,
      protocolError:null,ownerError:'',persistenceError:null,forced:false,streamBytes,
      validation:{valid:true,emptyJob:true,errors:[]},proof,ownerIdentity};
    put(root,prefix+'-started.json',{bindingBase64,ownerIdentity});
    put(root,prefix+'-terminal.json',{proof,liveOwnerCleanupConfirmed:true});
    const value={runId:RUN,mode,policy:originalPolicy,package:sourcePackage,request,cleanup,
      status:tag==='cpu'?'cpu_preparation_passed':'failed_closed',executionState:tag==='cpu'?'completed':'failed_closed',trainingAllowed:false};
    if(tag==='gpu')Object.assign(value,{actualCounts:null,worker:null,workerFailure:null,
      firstError:{type:'AssertionError',message:'cross-stage accounting compared CPU '+CPU_GUARD+' with GPU '+GPU_GUARD}});
    terminals[tag]=put(root,executionRoot+'/'+tag+'-terminal.json',value);
  }
  const c={schemaVersion:'qualification-registration-handoff-repair-case-v1',caseId:'decode1-entry-v2-registration-handoff',
    outputRoot:OUTPUT,registry:{...registry,revision:7},sourceProgram,capabilityVersion:CAPABILITY,runId:RUN,packageId:identity.packageId,
    scope:{registryOnly:true,guardMutation:false,processTermination:false,qualificationReplay:false,training:false},
    resources:{maxWallSeconds:120,maxOutputBytes:8388608,maxStreamBytes:8388608,automaticRetries:0},
    originalPolicy,sourcePackage,cpuTerminal:terminals.cpu,gpuTerminal:terminals.gpu,trainingTerminal,activeLock,heartbeat};
  function saveCase(){return put(root,CASE,c);}
  function change(key,mutate){const value=read(root,c[key]);mutate(value);Object.assign(c[key],put(root,c[key].path,value));}
  function changeRequestMode(tag,mode){
    const key=tag==='cpu'?'cpuTerminal':'gpuTerminal',terminal=read(root,c[key]),request=read(root,terminal.request);
    request.mode=mode;terminal.request=put(root,terminal.request.path,request);
    const q=terminal.cleanup,command=JSON.parse(Buffer.from(q.proof.bindingBase64,'base64').toString('utf8'));
    const args=['-B',path.join(root,worker.path),'--request',terminal.request.path,'--request-sha256',terminal.request.sha256];
    command.guard.commandSha256=hash(JSON.stringify(args));
    const prefix=GUARDS+'/'+q.guard.identity,archived=put(root,prefix+'-guard-terminal.json',command.guard);
    command.guardSha256=archived.sha256;q.proof.bindingBase64=Buffer.from(JSON.stringify(command)).toString('base64');
    put(root,prefix+'-started.json',{bindingBase64:q.proof.bindingBase64,ownerIdentity:q.ownerIdentity});
    put(root,prefix+'-terminal.json',{proof:q.proof,liveOwnerCleanupConfirmed:true});
    Object.assign(c[key],put(root,c[key].path,terminal));
  }
  return {root,c,requests,saveCase,change,changeRequestMode,caseBinding:saveCase()};
}

test('exact synthetic case verifies read-only, retaining unknown GPU counts and original training terminal',()=>withFixture(f=>{
  const before=snapshot(f.root),training=fs.readFileSync(fixturePath(f.root,f.c.trainingTerminal.path));
  assert.equal(validateRepairCase(f.c),true);
  const verified=verifyRepairEvidence(f.root,f.caseBinding,{now:NOW});
  assert.equal(verified.programCount,2);assert.equal(verified.gpu.actualCounts,null);assert.equal(verified.gpu.worker,null);
  assert.deepEqual(verified.registry.latestTrainingTerminal,read(f.root,f.c.registry).latestTrainingTerminal);
  assert(fs.readFileSync(fixturePath(f.root,f.c.trainingTerminal.path)).equals(training));
  assert.deepEqual(snapshot(f.root),before); // In particular, no cleanup certificate or transaction is written.
}));

test('wrong case/Run/package/policy/sourceSHA/terminal/heartbeat bindings refuse without writing',async t=>{
  const cases=[
    ['case identity',f=>{f.c.caseId='another-case';}],
    ['case schema',f=>{f.c.schemaVersion='unknown';}],
    ['case binding SHA',()=>{},f=>({...f.caseBinding,sha256:'0'.repeat(64)})],
    ['case Run',f=>{f.c.runId='decode1-entry-qualification-v2-11111111-1111-4111-8111-111111111111';f.c.packageId=f.c.runId+'-package';}],
    ['registry package',f=>f.change('registry',r=>{r.packageId='wrong';})],
    ['package Run',f=>f.change('sourcePackage',p=>{p.runId='wrong';})],
    ['package policy SHA',f=>f.change('sourcePackage',p=>{p.policy.sha256='0'.repeat(64);})],
    ['policy capability',f=>f.change('originalPolicy',p=>{p.capabilityVersion='wrong';})],
    ['policy enables training',f=>f.change('originalPolicy',p=>{p.executionBoundary.training=true;})],
    ['repair source bytes',f=>{fs.appendFileSync(fixturePath(f.root,f.c.sourceProgram.path),'changed');}],
    ['worker source bytes',f=>{const p=read(f.root,f.c.sourcePackage);fs.appendFileSync(fixturePath(f.root,p.programBindings[0].path),'changed');}],
    ['duplicate source path',f=>f.change('sourcePackage',p=>{p.programBindings.push(p.programBindings[0]);})],
    ['active lineage SHA',f=>f.change('registry',r=>{r.activeExecution.programLineage.worker.sha256='0'.repeat(64);})],
    ['active lock SHA',f=>{f.c.activeLock.sha256='0'.repeat(64);}],
    ['lock identity',f=>f.change('activeLock',r=>{r.processStartIdentity='wrong';})],
    ['heartbeat identity',f=>f.change('heartbeat',r=>{r.runId='wrong';})],
    ['heartbeat unexpired',f=>f.change('heartbeat',r=>{r.heartbeatAtUtc=new Date(NOW).toISOString();})],
    ['heartbeat future',f=>f.change('heartbeat',r=>{r.heartbeatAtUtc=new Date(NOW+1000).toISOString();})],
    ['heartbeat invalid time',f=>f.change('heartbeat',r=>{r.heartbeatAtUtc='not-a-time';})],
    ['heartbeat TTL mismatch',f=>f.change('heartbeat',r=>{r.ttlSeconds=121;})],
    ['CPU terminal Run',f=>f.change('cpuTerminal',r=>{r.runId='wrong';})],
    ['CPU terminal wrong phase',f=>f.change('cpuTerminal',r=>{r.mode='gpu_qualify';})],
    ['CPU terminal not completed',f=>f.change('cpuTerminal',r=>{r.executionState='failed_closed';})],
    ['CPU request wrong phase with all hashes rebound',f=>f.changeRequestMode('cpu','gpu_qualify')],
    ['GPU request wrong phase with all hashes rebound',f=>f.changeRequestMode('gpu','cpu_prepare')],
    ['GPU terminal package',f=>f.change('gpuTerminal',r=>{r.package.sha256='0'.repeat(64);})],
    ['GPU terminal state',f=>f.change('gpuTerminal',r=>{r.executionState='completed';})],
    ['GPU terminal status',f=>f.change('gpuTerminal',r=>{r.status='gpu_qualification_passed';})],
    ['GPU terminal mode',f=>f.change('gpuTerminal',r=>{r.mode='cpu_prepare';})],
    ['GPU invented zero counts',f=>f.change('gpuTerminal',r=>{r.actualCounts={forwardAttempted:0,generatorAttempted:0};})],
    ['GPU missing counts field',f=>f.change('gpuTerminal',r=>{delete r.actualCounts;})],
    ['GPU invented worker',f=>f.change('gpuTerminal',r=>{r.worker={counts:{forwardAttempted:0}};})],
    ['GPU failure not handoff',f=>f.change('gpuTerminal',r=>{r.firstError.message='another failure';})],
    ['latest training identity',f=>f.change('registry',r=>{r.latestTrainingTerminal.sha256='0'.repeat(64);})],
    ['original training bytes',f=>{fs.appendFileSync(fixturePath(f.root,f.c.trainingTerminal.path),'changed');}],
  ];
  for(const [name,mutate,bound] of cases)await t.test(name,()=>withFixture(f=>{
    mutate(f);f.caseBinding=f.saveCase();const before=snapshot(f.root);
    assert.throws(()=>verifyRepairEvidence(f.root,bound?bound(f):f.caseBinding,{now:NOW}));
    assert.deepEqual(snapshot(f.root),before);
  }));
});

test('CPU/GPU guard, command, native source and live-evidence misbindings cannot certify settlement',async t=>{
  for(const [name,mutate] of [
    ['wrong CPU guard',q=>{q.guard.identity=GPU_GUARD;}],
    ['wrong GPU guard',q=>{q.guard.identity=CPU_GUARD;}],
    ['guard not released',q=>{q.guardReleaseConfirmed=false;}],
    ['cleanup not confirmed',q=>{q.cleanupConfirmed=false;}],
    ['disk-only cleanup',q=>{q.liveOwnerCleanupConfirmed=false;}],
    ['owner not closed',q=>{q.ownerClosed=false;}],
    ['owner wrong exit',q=>{q.ownerExitCode=1;}],
    ['protocol error',q=>{q.protocolError='synthetic protocol failure';}],
    ['owner transport error',q=>{q.ownerError='synthetic owner failure';}],
    ['persistence error',q=>{q.persistenceError='synthetic persistence failure';}],
    ['owner PID conflict',q=>{q.proof.ownerPid++;}],
    ['job not empty',q=>{q.proof.activeProcessesAfterCleanup=1;}],
    ['not assigned before resume',q=>{q.proof.assignedBeforeResume=false;}],
    ['open stdout',q=>{q.proof.stdoutClosed=false;}],
    ['open stderr',q=>{q.proof.stderrClosed=false;}],
    ['incomplete transport',q=>{q.proof.transportCompleted=false;}],
    ['old stream closure',q=>{q.proof.streamClosureVersion='unbound-v1';}],
    ['native cleanup error',q=>{q.proof.cleanupError='synthetic cleanup failure';}],
    ['native observation error',q=>{q.proof.observationError='synthetic observation failure';}],
    ['stream capture error',q=>{q.proof.streamCaptureError='synthetic capture failure';}],
    ['stream transport error',q=>{q.proof.streamTransportError='synthetic transport failure';}],
    ['stdout bytes inconsistent',q=>{q.proof.stdoutBytes++;}],
    ['stderr bytes inconsistent',q=>{q.proof.stderrBytes++;}],
    ['negative observed stream bytes',q=>{q.streamBytes.stdout=-1;}],
    ['foreign guard terminal path',q=>{q.guard.terminalPath+='-foreign';}],
  ])await t.test(name,()=>withFixture(f=>{
    const terminal=name==='wrong CPU guard'?'cpuTerminal':'gpuTerminal';f.change(terminal,v=>mutate(v.cleanup));
    f.caseBinding=f.saveCase();const before=snapshot(f.root);
    assert.throws(()=>verifyRepairEvidence(f.root,f.caseBinding,{now:NOW}));assert.deepEqual(snapshot(f.root),before);
  }));
  for(const [name,file] of [['archived guard',GUARDS+'/'+GPU_GUARD+'-guard-terminal.json'],
    ['started evidence',GUARDS+'/'+GPU_GUARD+'-started.json'],['native binary',GUARDS+'/'+GPU_GUARD+'-native/owner.exe'],
    ['native source',GUARDS+'/'+GPU_GUARD+'-native/owner.cs'],['live proof',GUARDS+'/'+GPU_GUARD+'-terminal.json']])
    await t.test(name,()=>withFixture(f=>{fs.appendFileSync(fixturePath(f.root,file),'changed');const before=snapshot(f.root);
      assert.throws(()=>verifyRepairEvidence(f.root,f.caseBinding,{now:NOW}));assert.deepEqual(snapshot(f.root),before);
    }));
});

test('an existing new guard refuses evidence validation without touching that guard',()=>withFixture(f=>{
  const guard=put(f.root,GUARDS+'/active.json',{identity:'new-owner-must-not-touch',pid:1234}),before=snapshot(f.root);
  assert.throws(()=>verifyRepairEvidence(f.root,f.caseBinding,{now:NOW}),/current guard/);
  assert.equal(hash(fs.readFileSync(fixturePath(f.root,guard.path))),guard.sha256);assert.deepEqual(snapshot(f.root),before);
}));

test('already consumed private maintenance refuses before writing or reaching the registry writer',()=>withFixture(async f=>{
  put(f.root,OUTPUT+'/attempt-v1.json',{schemaVersion:'synthetic-prior-consumption',case:f.caseBinding});
  const before=snapshot(f.root);
  // This invokes only the actual rejection precondition on a private Temp root;
  // never a successful repair, process probe, guard removal or registry transaction.
  await assert.rejects(repairRegistration(f.root,f.caseBinding),/already consumed/);
  assert.deepEqual(snapshot(f.root),before);
}));
