// Accounting and same-live-call handoff only. No registry/guard mutation or CLI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createOwnedAccounting,directoryBytes} from '../diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';
import {runDecode1EntryQualificationOwnedWorkerV2,validateParameter60NativeProof} from './ai-painter-decode1-entry-qualification-owned-worker-v2.mjs';

const ledgers=new WeakMap(),liveReceipts=new WeakMap(),seenGuardIds=new Set();
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const receiptHash=receipt=>hash(Buffer.from(JSON.stringify(receipt)));
const validBytes=n=>Number.isSafeInteger(n)&&n>=0;
function fileBytes(file){if(!fs.existsSync(file))return 0;const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());return st.size;}
function inside(file,root){const name=path.relative(root,file);assert(name&&!path.isAbsolute(name)&&name!=='..'&&!name.startsWith('..'+path.sep),'private accounting path required');}

// Seal only immutable native/committed transaction evidence, never the run
// directory: heartbeat and terminal finalization remain dynamically accounted.
function pinTree(root,{exact=false}={}){
  const dirs=new Map(),files=new Map();
  function visit(directory){const stat=fs.lstatSync(directory);assert(stat.isDirectory()&&!stat.isSymbolicLink());
    dirs.set(directory,[stat.dev,stat.ino,fs.realpathSync(directory)].join('|'));
    for(const name of fs.readdirSync(directory)){const file=path.join(directory,name),st=fs.lstatSync(file);assert(!st.isSymbolicLink());
      if(st.isDirectory())visit(file);else{assert(st.isFile()&&st.nlink===1);files.set(file,[st.dev,st.ino,st.size,hash(fs.readFileSync(file))].join('|'));}}}
  visit(root);
  return ()=>{for(const [dir,pin] of dirs){const st=fs.lstatSync(dir);assert(st.isDirectory()&&!st.isSymbolicLink());
      assert.equal([st.dev,st.ino,fs.realpathSync(dir)].join('|'),pin,'closed directory identity changed');}
    for(const [file,pin] of files){const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1);
      assert.equal([st.dev,st.ino,st.size,hash(fs.readFileSync(file))].join('|'),pin,'closed evidence changed');}
    if(exact){const names=[];function collect(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),st=fs.lstatSync(file);assert(!st.isSymbolicLink());
        if(st.isDirectory())collect(file);else{assert(st.isFile());names.push(file);}}}collect(root);
      assert.deepEqual(names.sort(),[...files.keys()].sort(),'closed namespace membership changed');}};
}
function scopeIdentity(scope){return [scope.ownerPid,scope.bindingBase64,scope.guardRecord.identity,scope.nativeBuildDirectory,
  scope.guard.path,scope.guard.startedEvidence,scope.guard.terminalEvidence,scope.guard.terminalPath].join('|');}
function copyScope(scope){return Object.freeze({...scope,guard:Object.freeze(structuredClone(scope.guard)),
  guardRecord:Object.freeze(structuredClone(scope.guardRecord)),ownerIdentity:scope.ownerIdentity?Object.freeze(structuredClone(scope.ownerIdentity)):null});}

export function createAccounting(root,absolute,policy){
  root=path.resolve(root);absolute=path.resolve(absolute);inside(absolute,path.join(root,policy.outputRoot));
  const p=structuredClone(policy),r=p.resources;
  for(const [key,want] of Object.entries({cpuOutputBytes:8388608,gpuOutputBytes:16777216,totalOutputBytes:134217728,maxStreamBytes:8388608,
    failureReserveBytes:65536,cpuPreparationSeconds:240,gpuQualificationSeconds:720,threads:2}))assert.equal(r[key],want,'unchanged resource '+key);
  assert.deepEqual(p.allowedModes,['cpu_prepare','gpu_qualify']);
  const entries=[];let active=null;
  const needActive=()=>{assert(active,'phase accounting required');return active;};
  const needOpen=()=>{const e=needActive();assert(!e.closed,'phase already closed');return e;};
  function current(entry){
    if(entry.closed){for(const verify of entry.pins)verify();return entry.snapshot;}
    const value=entry.base.measure(),live=entry.finalStreams??entry.scope?.getStreamBytes?.()??{stdout:0,stderr:0};
    assert(validBytes(live.stdout)&&validBytes(live.stderr)&&live.stdout+live.stderr<r.maxStreamBytes,'actual stream ceiling');
    assert.equal(value.streamBytes,live.stdout+live.stderr,'stream observation changed');let guardBytes=0;
    if(entry.scope&&!entry.released&&fs.existsSync(entry.scope.guard.path)){
      const raw=fs.readFileSync(entry.scope.guard.path);assert.equal(JSON.parse(raw).identity,entry.scope.guardRecord.identity);guardBytes=raw.length;}
    return {...value,extraBytes:entry.preparationBytes+entry.retiredBytes+entry.externalBytes+8*(live.stdout+live.stderr)+65536+16384+guardBytes};
  }
  function measure(){const entry=needActive(),v=current(entry),diagnosticBytes=directoryBytes(absolute),claimBytes=fileBytes(path.join(root,p.attemptClaimPath));
    const totalBytes=diagnosticBytes+claimBytes+entries.reduce((sum,e)=>{const value=current(e);return sum+value.nativeBytes+value.registryBytes+
      value.streamBytes+value.atomicCopyBytes+value.extraBytes;},0);
    const phaseBytes=diagnosticBytes-entry.initialDirectoryBytes+v.nativeBytes+v.registryBytes+v.streamBytes+v.atomicCopyBytes+v.extraBytes+(entry.mode==='cpu_prepare'?claimBytes:0);
    return {phase:entry.mode,phaseBytes,totalBytes,diagnosticBytes,claimBytes,nativeBytes:v.nativeBytes,registryBytes:v.registryBytes,
      streamBytes:v.streamBytes,atomicCopyBytes:v.atomicCopyBytes,preparationStreamBytes:entry.preparationBytes,
      conservativeTransportAndRetiredBytes:v.extraBytes-entry.preparationBytes-entry.externalBytes};}
  function requireBudget(extra=0){assert(validBytes(extra));const e=needActive(),value=measure(),reserve=e.failure?0:r.failureReserveBytes;
    assert(value.phaseBytes+extra<=e.maximum-reserve,'qualification phase cumulative output ceiling');
    assert(value.totalBytes+extra<=r.totalOutputBytes-reserve,'qualification total output ceiling');return value;}
  function observe(scope,{trusted=false}={}){const e=needOpen();
    assert.equal(path.resolve(scope.guard.path),path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json'));
    if(e.scope){assert.equal(scopeIdentity(e.scope),scopeIdentity(scope),'one owner per phase');
      assert.equal(e.scope.getStreamBytes,scope.getStreamBytes,'stream observation identity changed');}
    else{e.scope=copyScope(scope);e.base.observe(e.scope);}
    if(trusted)e.trustedScope=e.scope;
  }
  function requireLive(receipt){const e=needOpen(),record=liveReceipts.get(receipt);
    assert(record&&record.accounting===api&&record.entry===e&&record.call===e.call&&!record.consumed&&!e.inflight,'this phase same-call live receipt required');
    assert.equal(receiptHash(receipt),record.sha256,'live receipt changed after native return');return record;}
  const api={measure,requireBudget,
    begin(mode){assert(p.allowedModes.includes(mode));if(active){assert(active.closed,'previous phase must close with current live cleanup');requireBudget();}
      assert(!entries.some(e=>e.mode===mode),'phase already consumed');
      const base=createOwnedAccounting(root,absolute,{outputRoot:p.outputRoot,resources:{...r,maxOutputBytes:r.totalOutputBytes}});
      active={base,mode,maximum:mode==='cpu_prepare'?r.cpuOutputBytes:r.gpuOutputBytes,initialDirectoryBytes:mode==='cpu_prepare'?0:directoryBytes(absolute),
        scope:null,trustedScope:null,failure:false,preparationBytes:0,retiredBytes:0,externalBytes:0,transactions:new Set(),
        closed:false,attempted:false,inflight:false,call:null,released:false,finalStreams:null};entries.push(active);
      return Object.freeze({mode,maximum:active.maximum,initialDirectoryBytes:active.initialDirectoryBytes});},
    preparation(bytes){assert(validBytes(bytes));needOpen().preparationBytes+=bytes;requireBudget();},
    external(bytes){assert(validBytes(bytes));needOpen().externalBytes+=bytes;requireBudget();},
    retired(bytes){assert(validBytes(bytes));needOpen().retiredBytes+=bytes;requireBudget();},
    failure(){const e=needOpen();e.failure=true;e.base.beginFailureClosure();},
    observe(scope){observe(scope);requireBudget();},
    observeFailure(error){const e=needOpen();if(e.scope||error.ownedReceipt?.guard?.state==='existing_guard_refused')return;
      const guard=error.ownedReceipt?.guard;if(!guard)return;assert(/^[a-f0-9-]{36}$/.test(guard.identity));
      const native=path.join(root,'.runtime/ai-painter/owned-worker-guards',guard.identity+'-native');
      if(fs.existsSync(native))observe({guard,guardRecord:{identity:guard.identity},nativeBuildDirectory:native});},
    requireLive(receipt){requireLive(receipt);},
    closePhase(receipt){const e=needOpen(),record=requireLive(receipt);assert(!e.inflight);const snapshot=current(e);
      const pins=[];
      if(e.scope){pins.push(pinTree(e.scope.nativeBuildDirectory,{exact:true}));
        for(const file of [e.scope.guard.startedEvidence,e.scope.guard.terminalEvidence,e.scope.guard.terminalPath]){
          const raw=fs.readFileSync(file),sha=hash(raw);pins.push(()=>{const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());assert.equal(hash(fs.readFileSync(file)),sha,'closed native evidence changed');});}}
      for(const name of e.transactions)pins.push(pinTree(path.join(root,name),{exact:true}));
      const claim=path.join(root,p.attemptClaimPath);if(fs.existsSync(claim)){const sha=hash(fs.readFileSync(claim));pins.push(()=>assert.equal(hash(fs.readFileSync(claim)),sha,'shared claim changed'));}
      e.snapshot=Object.freeze({...snapshot});e.pins=pins;e.closed=true;record.consumed=true;return Object.freeze(measure());},
    observeRegistryTransaction(name){const e=needOpen();e.base.observeRegistryTransaction(name);e.transactions.add(name);requireBudget();},
    beforeAtomicWrite(name,bytes){const e=needOpen();requireBudget(bytes);e.base.beforeAtomicWrite(name,bytes);requireBudget();}};
  ledgers.set(api,{root,absolute,p,get active(){return active;},observe,requireBudget});return Object.freeze(api);
}

// This validator is reached ONLY from the fixed awaited native import below.
// A receipt's shape/hash alone never installs its private provenance record.
function attest(state,accounting,entry,call,receipt,executable,args){
  assert(receipt&&typeof receipt==='object'&&!liveReceipts.has(receipt),'replayed native receipt');
  assert.equal(receipt.schema,'parameter60-live-native-owner-receipt-v1');
  assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.guardReleaseConfirmed,true);assert.equal(receipt.liveOwnerCleanupConfirmed,true);
  assert.equal(receipt.guard.state,'released_after_confirmed_cleanup');assert.equal(receipt.ownerIdentity.identitySource,'retained_child_handle');
  const encoded=receipt.proof?.bindingBase64,bytes=Buffer.from(encoded??'','base64');assert.equal(bytes.toString('base64'),encoded);
  const binding=JSON.parse(bytes),guard=binding.guard,id=guard.identity;
  assert(/^[a-f0-9-]{36}$/.test(id)&&!seenGuardIds.has(id),'replayed guard identity');
  assert.equal(binding.scope,state.root);assert.equal(guard.runnerPid,process.pid);assert.equal(guard.commandSha256,hash(JSON.stringify(args)));
  assert.equal(path.resolve(guard.executable),path.resolve(state.root,executable));
  assert.equal(binding.guardSha256,hash(JSON.stringify(guard)));assert.equal(receipt.guard.identity,id);
  const guardRoot=path.join(state.root,'.runtime/ai-painter/owned-worker-guards'),native=path.join(guardRoot,id+'-native');
  for(const [key,name] of [['path','active.json'],['startedEvidence',id+'-started.json'],['terminalEvidence',id+'-terminal.json'],['terminalPath',id+'-guard-terminal.json']])
    assert.equal(path.resolve(receipt.guard[key]),path.join(guardRoot,name),'native receipt path identity');
  assert.equal(receipt.nativeBuild.binary,binding.nativeBuild.binary);assert.equal(path.dirname(receipt.nativeBuild.binary),native);
  assert.equal(receipt.nativeBuild.binarySha256,binding.nativeBuild.binarySha256);
  assert.equal(receipt.ownerIdentity.executable,receipt.nativeBuild.binary);assert.equal(receipt.ownerIdentity.executableSha256,receipt.nativeBuild.binarySha256);
  const observed={ownerClosed:receipt.ownerClosed,ownerExitCode:receipt.ownerExitCode,ownerSignal:receipt.ownerSignal,
    stdoutClosed:receipt.ownerPipeEOF?.stdout,stderrClosed:receipt.ownerPipeEOF?.stderr,protocolError:receipt.protocolError,ownerError:receipt.ownerError,
    forced:receipt.termination!==null,ownerPid:receipt.ownerIdentity.pid,bindingBase64:encoded,
    stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr,maxBuffer:8388608};
  assert.equal(validateParameter60NativeProof(receipt.proof,observed).valid,true,'native R/pipe/emptyJob proof invalid');
  const counts=Object.freeze({...receipt.streamBytes});
  if(entry.trustedScope){assert.equal(entry.trustedScope.ownerPid,receipt.ownerIdentity.pid);assert.equal(entry.trustedScope.bindingBase64,encoded);
    assert.equal(entry.trustedScope.guardRecord.identity,id);assert.deepEqual(entry.trustedScope.getStreamBytes(),counts);}
  else state.observe({guard:receipt.guard,guardRecord:guard,nativeBuildDirectory:native,ownerPid:receipt.ownerIdentity.pid,
    ownerIdentity:receipt.ownerIdentity,bindingBase64:encoded,getStreamBytes:()=>({...counts})},{trusted:true});
  entry.finalStreams=counts;entry.released=true;
  liveReceipts.set(receipt,{accounting,entry,call,sha256:receiptHash(receipt),consumed:false});seenGuardIds.add(id);
}

export async function runOwnedPhase(accounting,executable,args,options={}){
  const state=ledgers.get(accounting);assert(state,'local accounting instance required');const entry=state.active;
  assert(entry&&!entry.closed&&!entry.attempted&&!entry.scope,'one fixed native invocation per open phase');
  const opts={...options},argv=Array.from(args);assert(argv.every(arg=>typeof arg==='string'));assert.equal(typeof executable,'string');
  for(const name of Object.keys(opts))assert(['cwd','env','timeout','maxBuffer','onSpawn','abortReason','qualificationPolicy','phase'].includes(name),'unregistered native option');
  assert.equal(path.resolve(opts.cwd),state.root);assert.equal(opts.phase,entry.mode==='cpu_prepare'?'cpu':'qualification');
  const q={path:opts.qualificationPolicy?.path,sha256:opts.qualificationPolicy?.sha256};
  const environment=opts.env===undefined?undefined:{...opts.env},onSpawn=opts.onSpawn,abort=opts.abortReason;
  assert(onSpawn===undefined||onSpawn===null||typeof onSpawn==='function');assert(abort===undefined||typeof abort==='function');
  const callbackErrors=new WeakMap();
  function clean(error){const original=error instanceof Error?error:new Error(String(error)),sanitized=new Error(original.message);
    if(typeof original.code==='string'||typeof original.code==='number')sanitized.code=original.code;callbackErrors.set(sanitized,original);return sanitized;}
  state.requireBudget();entry.attempted=true;entry.inflight=true;const call={};entry.call=call;let result,nativeError=null;
  try{result=await runDecode1EntryQualificationOwnedWorkerV2(executable,argv,{...opts,env:environment,qualificationPolicy:q,
    onSpawn(scope){try{assert(state.active===entry);state.observe(scope,{trusted:true});state.requireBudget();if(onSpawn)onSpawn(scope);}catch(error){throw clean(error);}},
    abortReason(){try{const reason=abort?.();if(reason instanceof Error)return clean(reason);return reason?String(reason):null;}catch(error){return clean(error);}}});}
  catch(error){nativeError=error;}
  finally{entry.inflight=false;}
  const receipt=nativeError?(Object.hasOwn(nativeError,'ownedReceipt')?nativeError.ownedReceipt:null):result?.ownedReceipt;
  let proofError=null;
  try{attest(state,accounting,entry,call,receipt,executable,argv);}catch(error){proofError=error;}
  let primary=nativeError?(callbackErrors.get(nativeError)??nativeError):proofError;
  if(!primary){try{state.requireBudget();}catch(error){primary=error;}}
  if(primary){accounting.failure();
    if(nativeError&&primary!==nativeError)for(const key of ['stdout','stderr','ownedReceipt','nativeBuild','nativeEvidenceRoot','guardTerminalPath'])
      if(Object.hasOwn(nativeError,key))primary[key]=nativeError[key];
    if(!nativeError&&receipt)primary.ownedReceipt=receipt;
    if(proofError&&proofError!==primary)primary.secondaryLiveProofError=String(proofError.message);
    try{accounting.observeFailure({ownedReceipt:receipt});}catch(error){primary.secondaryAccountingError=String(error.message);}
    throw primary;
  }return result;
}
