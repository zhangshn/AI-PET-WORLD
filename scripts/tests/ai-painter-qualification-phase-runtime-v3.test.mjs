import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createOwnedAccounting,directoryBytes} from '../diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';
import {validateParameter60NativeProof} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs';

// Private files and a VM replacement of the fixed import only. Never spawn a
// process, compile native code, consume a real claim or touch official registry.
const source=fs.readFileSync(new URL('../lib/ai-painter-qualification-phase-runtime-v3.mjs',import.meta.url),'utf8');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const policy={outputRoot:'.runtime/ai-painter/private-qualification',
  attemptClaimPath:'.runtime/ai-painter/private-qualification/attempt-v1.json',allowedModes:['cpu_prepare','gpu_qualify'],
  resources:{cpuOutputBytes:8388608,gpuOutputBytes:16777216,totalOutputBytes:134217728,maxStreamBytes:8388608,
    failureReserveBytes:65536,cpuPreparationSeconds:240,gpuQualificationSeconds:720,threads:2}};
function write(file,raw){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw);}
function fixture(t){
  const temporary=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'qualification-phase-private-'));
  t.after(()=>{const resolved=fs.realpathSync(root);
    assert.equal(resolved,path.resolve(root));assert.equal(path.dirname(resolved),temporary);
    assert(path.basename(resolved).startsWith('qualification-phase-private-'));
    fs.rmSync(resolved,{recursive:true,force:true});});
  const absolute=path.join(root,policy.outputRoot,'private-run'),executable=path.join(root,'private-python.exe');
  fs.mkdirSync(absolute,{recursive:true});write(executable,'not executable');write(path.join(root,policy.attemptClaimPath),'private single claim');
  const faults=[],calls=[];
  const native=async(exe,args,options)=>{
    const fault=faults.shift()??{};calls.push({exe,args,options});
    if(fault.returnReceipt)return {ownedReceipt:fault.returnReceipt};
    if(fault.preGuard){const reason=options.abortReason();throw reason??fault.primary;}
    const guardRoot=path.join(root,'.runtime/ai-painter/owned-worker-guards'),id=crypto.randomUUID(),nativeRoot=path.join(guardRoot,id+'-native');
    const guard={identity:id,runnerPid:process.pid,executable:exe,commandSha256:hash(JSON.stringify(args)),
      startedEvidence:path.join(guardRoot,id+'-started.json'),nativeEvidenceRoot:nativeRoot};
    const guardView={path:path.join(guardRoot,'active.json'),identity:id,state:'retained',startedEvidence:guard.startedEvidence,
      nativeEvidenceRoot:nativeRoot,terminalEvidence:path.join(guardRoot,id+'-terminal.json'),terminalPath:path.join(guardRoot,id+'-guard-terminal.json')};
    const binary=path.join(nativeRoot,'owner.exe');write(binary,'private inert native bytes');write(path.join(nativeRoot,'owner.cs'),'private source');
    const nativeBuild={binary,binarySha256:hash(fs.readFileSync(binary))};
    const bindingBase64=Buffer.from(JSON.stringify({guard,guardSha256:hash(JSON.stringify(guard)),scope:root,nativeBuild})).toString('base64');
    const counts={stdout:fault.stdout??3,stderr:fault.stderr??2};
    const ownerIdentity={pid:4321,executable:binary,executableSha256:nativeBuild.binarySha256,identitySource:'retained_child_handle'};
    write(guardView.path,JSON.stringify(guard));write(guardView.startedEvidence,JSON.stringify({guard,ownerIdentity}));
    const scope={ownerPid:4321,ownerIdentity,bindingBase64,guard:guardView,guardRecord:guard,nativeBuildDirectory:nativeRoot,getStreamBytes:()=>({...counts})};
    let primary=fault.primary??null;
    if(fault.beforeOnSpawn){const reason=options.abortReason();primary??=reason instanceof Error?reason:new Error(String(reason));}
    else try{options.onSpawn(scope);}catch(error){primary??=error;}
    const proof={ownerPid:4321,rootPid:6789,rootCreationDateUtc:'2026-10-18T00:00:00.000Z',bindingBase64,
      assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,totalProcesses:1,
      exitCode:primary?1:0,stopReason:primary?'private_failure':null,streamClosureVersion:'bounded-stream-capture-v2',
      stdoutClosed:true,stderrClosed:true,transportCompleted:true,cleanupError:null,observationError:null,
      streamCaptureError:null,streamTransportError:null,stdoutBytes:counts.stdout,stderrBytes:counts.stderr};
    const receipt={schema:'parameter60-live-native-owner-receipt-v1',ownerIdentity,ownerClosed:true,ownerExitCode:0,ownerSignal:null,
      liveOwnerCleanupConfirmed:true,emptyJob:true,ownerPipeEOF:{stdout:true,stderr:true},cleanupConfirmed:true,
      cleanupState:'confirmed_empty_job',guardReleaseConfirmed:true,termination:null,proof,protocolError:null,ownerError:'',
      streamBytes:counts,nativeBuild,guard:{...guardView,state:'released_after_confirmed_cleanup'}};
    if(fault.unknown){receipt.cleanupConfirmed=false;receipt.guardReleaseConfirmed=false;receipt.guard.state='retained';proof.activeProcessesAfterCleanup=1;}
    fault.mutate?.(receipt);
    write(guardView.terminalEvidence,JSON.stringify({...receipt,cleanupConfirmed:false}));
    if(!fault.unknown)fs.renameSync(guardView.path,guardView.terminalPath);
    if(fault.during)fault.during(receipt);
    if(primary){primary.ownedReceipt=receipt;throw primary;}
    return {stdout:'abc',stderr:'de',ownedReceipt:receipt};
  };
  const js=source.replace(/^import .+;\r?$/gmu,'').replace(/export (async )?function /gu,'$1function ')+';({createAccounting,runOwnedPhase})';
  // Node strict assertions compare prototypes too; clone both sides into the
  // same realm without changing production checks or the fixed transport.
  const vmAssert=Object.assign((...args)=>assert(...args),assert,
    {deepEqual:(actual,expected,...rest)=>assert.deepEqual(structuredClone(actual),structuredClone(expected),...rest)});
  const api=runInNewContext(js,{assert:vmAssert,crypto,fs,path,Buffer,structuredClone,process,Error,
    createOwnedAccounting,directoryBytes,validateParameter60NativeProof,runDecode1EntryQualificationOwnedWorkerV4:native});
  const accounting=api.createAccounting(root,absolute,policy);
  const run=(phase='cpu',extra={})=>api.runOwnedPhase(accounting,executable,['private-worker','--request','private'],
    {cwd:root,phase,timeout:phase==='cpu'?240000:720000,maxBuffer:8388608,
      qualificationPolicy:{path:'private-policy.json',sha256:'a'.repeat(64)},...extra});
  return {...api,root,absolute,executable,accounting,run,faults,calls};
}

test('normal fixed call supplies a single-use private live receipt; JSON cannot close',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');const value=await f.run(),r=value.ownedReceipt;
  assert.throws(()=>a.requireLive(JSON.parse(JSON.stringify(r))),/same-call/);
  assert.throws(()=>a.closePhase(JSON.parse(JSON.stringify(r))),/same-call/);
  a.requireLive(r);a.closePhase(r);assert.throws(()=>a.closePhase(r),/closed/);
  assert.equal(f.calls.length,1);
});

test('CPU closes before a distinct GPU guard; heartbeat and terminal stay mutable and costs persist',async t=>{
  const f=fixture(t),a=f.accounting,heartbeat=path.join(f.absolute,'qualification-heartbeat.json');
  const txn='.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-private';
  write(heartbeat,'CPU heartbeat');a.begin('cpu_prepare');write(path.join(f.root,txn,'commit.json'),'immutable transaction');
  a.observeRegistryTransaction(txn);a.preparation(17);a.retired(23);a.external(29);a.beforeAtomicWrite('private-terminal',31);
  const cpu=await f.run(),before=a.measure();a.closePhase(cpu.ownedReceipt);const closed=a.measure();
  assert.equal(closed.totalBytes,before.totalBytes);
  write(heartbeat,'CPU closed; legitimate heartbeat updated');write(path.join(f.absolute,'cpu-terminal.json'),'final CPU terminal');
  const afterFinalization=a.measure();assert.equal(afterFinalization.totalBytes-closed.totalBytes,afterFinalization.diagnosticBytes-closed.diagnosticBytes);
  a.begin('gpu_qualify');const initial=a.measure();
  f.faults.push({during(receipt){assert.notEqual(receipt.guard.identity,cpu.ownedReceipt.guard.identity);a.measure();}});
  const gpu=await f.run('qualification',{onSpawn(){a.measure();}}),now=a.measure();
  const carried=closed.totalBytes-closed.diagnosticBytes-closed.claimBytes;
  assert.equal(now.totalBytes-now.diagnosticBytes-now.claimBytes,
    carried+now.nativeBytes+now.registryBytes+now.streamBytes+now.atomicCopyBytes+now.conservativeTransportAndRetiredBytes);
  assert(now.totalBytes>initial.totalBytes);assert.throws(()=>a.requireLive(cpu.ownedReceipt),/same-call/);
  a.closePhase(gpu.ownedReceipt);a.requireBudget();
});

test('an unclosed CPU blocks GPU and a phase may invoke the fixed transport only once',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');const r=(await f.run()).ownedReceipt;
  assert.throws(()=>a.begin('gpu_qualify'),/previous phase/);await assert.rejects(f.run(),/one fixed native invocation/);
  a.closePhase(r);assert.throws(()=>a.begin('cpu_prepare'),/consumed/);
});

test('cross-accounting, cross-phase and replayed receipts cannot hand off',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');const r=(await f.run()).ownedReceipt;
  const other=f.createAccounting(f.root,f.absolute,policy);other.begin('cpu_prepare');assert.throws(()=>other.requireLive(r),/same-call/);
  a.closePhase(r);a.begin('gpu_qualify');f.faults.push({returnReceipt:r});
  await assert.rejects(f.run('qualification'),/replayed native receipt/);assert.throws(()=>a.closePhase(r),/same-call/);
});

test('a copied old receipt returned by transport still fails invocation/guard replay',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');const r=(await f.run()).ownedReceipt;
  a.closePhase(r);a.begin('gpu_qualify');f.faults.push({returnReceipt:JSON.parse(JSON.stringify(r))});
  await assert.rejects(f.run('qualification'),/replayed guard identity/);
});

test('worker failure keeps its original first Error and current cleanup can close failure phase',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('original worker failure');a.begin('cpu_prepare');f.faults.push({primary});
  await assert.rejects(f.run(),error=>error===primary);a.requireLive(primary.ownedReceipt);a.closePhase(primary.ownedReceipt);
});

test('abort before onSpawn still uses this call native R/pipe/emptyJob for closure',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('abort before onSpawn');a.begin('cpu_prepare');f.faults.push({beforeOnSpawn:true});
  let spawned=false;await assert.rejects(f.run('cpu',{onSpawn(){spawned=true;},abortReason(){return primary;}}),error=>error===primary);
  assert.equal(spawned,false);a.requireLive(primary.ownedReceipt);assert(a.measure().nativeBytes>0);a.closePhase(primary.ownedReceipt);
});

test('onSpawn callback first error is retained and cleanup proof is not lost',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('caller onSpawn failure');a.begin('cpu_prepare');
  await assert.rejects(f.run('cpu',{onSpawn(scope){a.observe(scope);throw primary;}}),error=>error===primary);
  a.closePhase(primary.ownedReceipt);
});

test('unknown cleanup never closes; the worker first error is not replaced',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('first failure, not cleanup assertion');a.begin('cpu_prepare');f.faults.push({primary,unknown:true});
  await assert.rejects(f.run(),error=>error===primary&&!!error.secondaryLiveProofError);
  assert.throws(()=>a.requireLive(primary.ownedReceipt),/same-call/);assert.throws(()=>a.closePhase(primary.ownedReceipt),/same-call/);
  assert.throws(()=>a.begin('gpu_qualify'),/previous phase/);
});

test('failure accounting observes costs but never authorizes JSON or historical disk cleanup',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');f.faults.push({unknown:true});
  let receipt;await assert.rejects(f.run(),error=>{receipt=error.ownedReceipt;return true;});
  const other=f.createAccounting(f.root,f.absolute,policy);other.begin('cpu_prepare');other.observeFailure({ownedReceipt:receipt});
  assert(other.measure().nativeBytes>0);assert.throws(()=>other.closePhase(receipt),/same-call/);
  const disk=JSON.parse(fs.readFileSync(receipt.guard.terminalEvidence));assert.throws(()=>other.requireLive(disk),/same-call/);
});

test('caller-thrown fake receipt cannot cross the before-guard abort boundary',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('caller supplied error');primary.ownedReceipt={cleanupConfirmed:true};
  a.begin('cpu_prepare');f.faults.push({preGuard:true});await assert.rejects(f.run('cpu',{abortReason(){throw primary;}}),error=>error===primary);
  assert.throws(()=>a.closePhase(primary.ownedReceipt),/same-call/);assert.equal(a.measure().nativeBytes,0);
});

test('same-call receipt mutation and wrong phase options fail closed',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');await assert.rejects(f.run('qualification'),/Expected values/);assert.equal(f.calls.length,0);
  const r=(await f.run()).ownedReceipt;r.proof.rootPid++;assert.throws(()=>a.requireLive(r),/receipt changed/);
});

test('R/pipe/stream/binding identities must all pass even on a current fixed call',async t=>{
  for(const mutate of [r=>{r.ownerPipeEOF.stderr=false;},r=>{r.proof.bindingBase64+='!';},r=>{r.proof.ownerPid++;},
    r=>{r.proof.activeProcessesAfterCleanup=1;},r=>{r.streamBytes.stdout++;},r=>{r.ownerIdentity.executable+='wrong';}]){
    const f=fixture(t);f.accounting.begin('cpu_prepare');f.faults.push({mutate});
    let receipt;await assert.rejects(f.run(),error=>{receipt=error.ownedReceipt;return true;});
    assert.throws(()=>f.accounting.closePhase(receipt),/same-call/);
  }
});

test('immutable native, committed transaction and shared claim remain protected after closure',async t=>{
  for(const kind of ['native','transaction','claim']){
    const f=fixture(t),a=f.accounting,txn='.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-sealed';
    write(path.join(f.root,txn,'commit.json'),'committed');a.begin('cpu_prepare');a.observeRegistryTransaction(txn);
    const r=(await f.run()).ownedReceipt;a.closePhase(r);
    const file=kind==='native'?r.nativeBuild.binary:kind==='transaction'?path.join(f.root,txn,'commit.json'):path.join(f.root,policy.attemptClaimPath);
    fs.appendFileSync(file,'changed');assert.throws(()=>a.measure(),/closed evidence changed|shared claim changed/);
  }
});

test('budgets retain 64KiB failure reserve and cannot be reset through a new phase',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');const r=(await f.run()).ownedReceipt;
  const normalLimit=policy.resources.cpuOutputBytes-policy.resources.failureReserveBytes;
  const bytes=normalLimit-a.measure().phaseBytes;a.external(bytes);assert.equal(a.requireBudget().phaseBytes,normalLimit);
  assert.throws(()=>a.requireBudget(1),/phase cumulative/);a.failure();a.external(65536);assert.equal(a.requireBudget().phaseBytes,8388608);
  assert.throws(()=>a.external(1),/phase cumulative/);a.closePhase(r);assert.throws(()=>a.begin('gpu_qualify'),/phase cumulative/);
});

test('output overrun following worker failure retains primary error and permits only cleanup handoff',async t=>{
  const f=fixture(t),a=f.accounting,primary=new Error('worker first, output second');a.begin('cpu_prepare');
  f.faults.push({primary,during(){write(path.join(f.absolute,'private-overrun'),Buffer.alloc(8388608));}});
  await assert.rejects(f.run(),error=>error===primary);a.requireLive(primary.ownedReceipt);a.closePhase(primary.ownedReceipt);
  assert.throws(()=>a.requireBudget(),/phase cumulative/);assert.throws(()=>a.begin('gpu_qualify'),/phase cumulative/);
});

test('no public nativeRunner injection and no output ceiling reset before native invocation',async t=>{
  const f=fixture(t),a=f.accounting;a.begin('cpu_prepare');await assert.rejects(f.run('cpu',{nativeRunner(){}}),/unregistered native option/);
  write(path.join(f.absolute,'private-overrun'),Buffer.alloc(8388608));await assert.rejects(f.run(),/phase cumulative/);assert.equal(f.calls.length,0);
});

