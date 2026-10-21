// Synthetic source/ledger/ABI fixtures only; never calls a real owned worker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {POLICY,bindPolicy,CAPABILITY,MODEL,validatePolicy,makePackage,validatePackage,validateRequest,
  validateWorkerResult,validateCpuAcceptance,sequenceQualification,createAccounting,createHostPaths,
  collectSourceClosure,requireDeadline,validateGpuResources,verifyVersionBindings,qualificationRunDirectory} from '../qualify-ai-painter-decode1-entry-gpu-v3.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),copy=v=>structuredClone(v);
const policyRaw=fs.readFileSync(path.join(ROOT,POLICY.path)),p=JSON.parse(policyRaw),bound=bindPolicy({path:POLICY.path,sha256:hash(policyRaw)});
const runId='decode1-entry-qualification-v3-00000000-0000-4000-8000-000000000001';
const packageBinding={path:p.outputRoot+'/'+runId+'/package.json',sha256:'a'.repeat(64)};
function privateRoot(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'decode1-qualification-host-fixture-'));
  t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('decode1-qualification-host-fixture-'));
    fs.rmSync(root,{recursive:true});});return root;}
function packageFixture(){
  const names=[...Object.values(p.implementations),...p.frozenCpuModelBindings.map(b=>b.path),p.metadataCanonicalProgram.path,
    'scripts/tests/ai-painter-qualification-owned-worker-boundary-v3.test.mjs','scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs'];
  const rows=[...new Set(names)].map(name=>({path:name,sha256:'b'.repeat(64)}));
  for(const b of [...p.frozenCpuModelBindings,p.frozenDeviceBridge,p.metadataCanonicalProgram])Object.assign(rows.find(row=>row.path===b.path),b);
  return makePackage(p,runId,rows,{path:process.execPath,sha256:'c'.repeat(64)},p.nodeInterpreter);
}
function requestFixture(mode){return {schemaVersion:p.wireProtocols.request,runId,mode,outputRoot:p.outputRoot+'/'+runId,policy:copy(bound),
  package:packageBinding,deadlineUnixMs:Date.now()+60000,...(mode==='gpu_qualify'?{cpuAcceptance:{path:p.outputRoot+'/'+runId+'/cpu-acceptance.json',sha256:'d'.repeat(64)}}:{})};}
function workerFixture(mode){const gpu=mode==='gpu_qualify';const counts={forwardAttempted:gpu?48:0,forwardCompleted:gpu?48:0,
  generatorAttempted:gpu?240:0,generatorCompleted:gpu?240:0,discriminatorAttempted:gpu?48:0,discriminatorCompleted:gpu?48:0,
  optimizerConstruction:0,optimizerUpdates:0,cudaCalls:gpu?20:0,cudaInitializationAttempted:gpu?1:0,cudaInitializationCompleted:gpu?1:0};
  const sampleIds=Array.from({length:gpu?48:8},(_,i)=>(gpu?'train-':'validation-')+i),graph=Array.from({length:108},(_,i)=>({name:'parameter'+i,shape:[1]}));
  graph[48]={name:p.target.parameterName,shape:p.target.weightShape};const digest={generator:'e'.repeat(64),discriminator:'f'.repeat(64)};
  return {schemaVersion:p.wireProtocols.worker,runId,mode,policy:bound,package:packageBinding,...p.qualification,
    status:gpu?'gpu_qualification_passed':'cpu_preparation_passed',executionState:'completed',counts,
    stateDigestBefore:digest,stateDigestAfter:copy(digest),modelIdentity:{capabilityVersion:MODEL,parameterCount:108,parameterElements:2242687,graph,initialState:copy(digest)},
    cpuAffinity:[0,1],sampleIds,completedSampleIds:gpu?copy(sampleIds):[],cudaInitialized:gpu,
    ...(!gpu?{componentTests:{status:'passed',testsRun:3,failures:0,errors:0,skipped:0,realModelAutograd:false}}:{})};}

test('exact registered route and immutable package stay qualification-only',()=>{
  validatePolicy(p);assert.equal(p.capabilityVersion,CAPABILITY);validatePackage(packageFixture(),p);assert.deepEqual(bindPolicy(bound),bound);
  assert.throws(()=>bindPolicy({path:bound.path,sha256:'0'.repeat(64)}));
});
test('v3 frozen bridge and predecessor inputs are hash-read without reopening old source closure',()=>{
  const q=copy(p),records=new Map(),calls=[];
  for(const [index,b] of [q.frozenDeviceBridge,...['policy','claim','package','terminal','workerFailure','controllerReview','normativeBytes'].map(key=>q.predecessorFailure[key]),
    ...['componentReview','predecessorPolicy','predecessorClaim','predecessorPackage','predecessorCpuTerminal','predecessorGpuTerminal','registrationSettlement','normativeBytes'].map(key=>q.phaseHandoff[key])].entries()){
    const raw=Buffer.from('synthetic evidence '+index);b.sha256=hash(raw);if(b.bytes!==undefined)b.bytes=raw.length;records.set(b.path,raw);}
  const reader={bytes(name,sha){calls.push(name);assert(records.has(name),'undeclared historical source traversal');const raw=records.get(name);assert.equal(hash(raw),sha);return raw;}};
  verifyVersionBindings(reader,q);assert.equal(calls.length,16);assert.equal(new Set(calls).size,16);
  const bad=copy(q);bad.frozenDeviceBridge.sha256='0'.repeat(64);assert.throws(()=>verifyVersionBindings(reader,bad));
  const wrong=copy(q);wrong.predecessorFailure.claim.bytes++;assert.throws(()=>verifyVersionBindings(reader,wrong));
  const old=copy(p);old.predecessorFailure.oldQualificationReusable=true;assert.throws(()=>validatePolicy(old));
  const changed=copy(p);changed.frozenDeviceBridge.sha256='0'.repeat(64);assert.throws(()=>validatePolicy(changed));
});
for(const [name,mutate] of [
  ['training',q=>q.executionBoundary.training=true],['phase cost reset',q=>q.phaseHandoff.closedPhaseCostsRetained=false],
  ['frozen run directory',q=>q.phaseHandoff.runDirectoryDynamic=false],['disk cleanup authority',q=>q.phaseHandoff.receiptAuthority='disk_json'],
  ['old attempt replay',q=>q.phaseHandoff.oldAttemptReplayAllowed=true],['retry',q=>q.resources.automaticRetries=1],['CPU time',q=>q.resources.cpuPreparationSeconds=241],
  ['GPU time',q=>q.resources.gpuQualificationSeconds=721],['threads',q=>q.resources.threads=3],['old260',q=>q.sourceClosure.old260ExceptionInherited=true],
  ['source count',q=>q.sourceClosure.maximumEntries=260],['source bytes',q=>q.sourceClosure.maximumTotalBytes++],
  ['model scope',q=>q.target.parameterIndex=88],['train split',q=>q.gpuQualification.sampleSplit='validation'],
  ['old qualification',q=>q.gpuQualification.oldQualificationReusable=true],['CPU train image',q=>q.cpuPreparation.trainImageContentRead=true],
  ['formal',q=>q.formalSpecification.version='AI-PAINTER-SPEC-1.91'],['frozen operator',q=>q.frozenCpuModelBindings[0].sha256='0'.repeat(64)],
])test('policy rejects '+name,()=>{const q=copy(p);mutate(q);assert.throws(()=>validatePolicy(q));});
test('package and request exact fields prevent scope, phase, identity and legacy acceptance substitution',()=>{
  const pkg=packageFixture();for(const mutate of [v=>v.resources.threads=3,v=>v.scope.trainSamples=1,v=>v.policy.sha256='0'.repeat(64),
    v=>v.extra='training',v=>v.programBindings.push(v.programBindings[0]),v=>v.programBindings.pop(),
    v=>v.programBindings=v.programBindings.filter(row=>row.path!==p.implementations.sharedNativeWorker)]){
    const broken=copy(pkg);mutate(broken);assert.throws(()=>validatePackage(broken,p));}
  for(const mode of p.allowedModes)validateRequest(requestFixture(mode),p,pkg);
  for(const mutate of [v=>v.mode='train',v=>v.outputRoot+='/other',v=>v.policy.sha256='0'.repeat(64),v=>v.deadlineUnixMs=1,
    v=>v.cpuAcceptance={path:'private/old.json',sha256:'0'.repeat(64)}]){
    const broken=requestFixture('cpu_prepare');mutate(broken);assert.throws(()=>validateRequest(broken,p,pkg));}
});
test('CPU and GPU real-count ABIs, finite state identity and original splits cannot substitute',()=>{
  for(const mode of p.allowedModes){const result=workerFixture(mode);assert(validateWorkerResult(result,p,mode,packageBinding,runId,result.sampleIds));}
  for(const mutate of [v=>v.counts.generatorCompleted=239,v=>v.counts.optimizerUpdates=1,v=>v.counts.cudaInitializationCompleted=0,
    v=>v.stateDigestAfter.generator='0'.repeat(64),v=>v.trainingAllowed=true,v=>v.completedSampleIds.pop(),v=>v.modelIdentity.parameterCount=107]){
    const result=workerFixture('gpu_qualify');mutate(result);assert.throws(()=>validateWorkerResult(result,p,'gpu_qualify',packageBinding,runId));}
  const cpu=workerFixture('cpu_prepare');cpu.counts.forwardAttempted=1;assert.throws(()=>validateWorkerResult(cpu,p,'cpu_prepare',packageBinding,runId));
  const failed=workerFixture('gpu_qualify');failed.status='failed_closed';failed.executionState='failed_closed';failed.firstError={message:'first scalar gate'};
  assert.equal(validateWorkerResult(failed,p,'gpu_qualify',packageBinding,runId),false);
});
test('CPU acceptance binds own immutable package and returned receipt, not historical status',()=>{
  const value={schemaVersion:'decode1-entry-gpu-qualification-cpu-acceptance-v3',status:'cpu_preparation_passed',runId,
    policy:bound,package:packageBinding,worker:workerFixture('cpu_prepare'),ownedReceipt:{path:p.outputRoot+'/'+runId+'/cpu-owned-receipt.json',sha256:'d'.repeat(64)}};
  validateCpuAcceptance(value,p,packageBinding,runId);
  for(const mutate of [v=>v.package.sha256='0'.repeat(64),v=>v.runId='old-run',v=>v.worker.componentTests.skipped=1,v=>v.ownedReceipt={cleanupConfirmed:true}]){
    const broken=copy(value);mutate(broken);assert.throws(()=>validateCpuAcceptance(broken,p,packageBinding,runId));}
});
test('CPU failure stops GPU, both phases run once and GPU success does not start training',async()=>{
  const events=[];await assert.rejects(sequenceQualification(async()=>{events.push('cpu');throw Error('CPU failed');},async()=>events.push('gpu')),/CPU failed/);
  assert.deepEqual(events,['cpu']);await assert.rejects(sequenceQualification(async()=>({status:'failed_closed'}),async()=>events.push('gpu')),/CPU did not pass/);
  events.length=0;const value=await sequenceQualification(async()=>{events.push('cpu');return {status:'cpu_preparation_passed'};},async()=>{events.push('gpu');return {status:'qualification_completed_training_not_started'};});
  assert.deepEqual(events,['cpu','gpu']);assert.equal(value.status,'qualification_completed_training_not_started');
});
test('phase ledger preserves costs and refuses a new phase without a live closure',t=>{
  const root=privateRoot(t),absolute=path.join(root,p.outputRoot,runId);fs.mkdirSync(absolute,{recursive:true});
  fs.writeFileSync(path.join(root,p.attemptClaimPath),'claim');const a=createAccounting(root,absolute,p);a.begin('cpu_prepare');
  const before=a.requireBudget();assert.equal(before.claimBytes,5);assert.equal(before.totalBytes,5+65536+16384);
  fs.writeFileSync(path.join(absolute,'cpu-terminal.json'),'cpu');assert.equal(a.requireBudget().totalBytes-before.totalBytes,3);
  assert.throws(()=>a.begin('gpu_qualify'),/previous phase/);assert.throws(()=>a.closePhase({cleanupConfirmed:true}),/same-call/);
});
test('public accounting observations do not make JSON a current-call cleanup authority',t=>{
  const root=privateRoot(t),absolute=path.join(root,p.outputRoot,runId);fs.mkdirSync(absolute,{recursive:true});
  const a=createAccounting(root,absolute,p);a.begin('cpu_prepare');assert.throws(()=>a.requireLive({cleanupConfirmed:true}),/same-call/);
});
test('approved physical runtime mapping retains logical accounting identity without granting redirects',t=>{
  const root=privateRoot(t),physical=path.join(root,'private-storage'),out=p.outputRoot+'/'+runId;
  fs.mkdirSync(physical);fs.symlinkSync(physical,path.join(root,'.runtime'),'junction');
  const target=path.join(physical,out.slice('.runtime/'.length));fs.mkdirSync(target,{recursive:true});
  const logical=qualificationRunDirectory(root,out,target);assert.equal(logical,path.join(root,out));
  assert.equal(fs.realpathSync(logical),fs.realpathSync(target));
  const ledger=createAccounting(root,logical,p);ledger.begin('cpu_prepare');assert(ledger.measure().totalBytes>0);
  fs.mkdirSync(path.join(root,'other'));assert.throws(()=>qualificationRunDirectory(root,out,path.join(root,'other')),/alias identity/);
  assert.throws(()=>createHostPaths(root).directory(out),/redirect/);
});
test('deadline, GPU identity/thermal/free-memory and nested redirects fail closed',t=>{
  assert.throws(()=>requireDeadline(1,1));requireDeadline(2,1);
  const gpu={index:0,uuid:'GPU-fixture',freeMiB:4096,temperatureC:40};validateGpuResources(gpu,p,'GPU-fixture');
  for(const q of [{...gpu,temperatureC:85},{...gpu,freeMiB:2047},{...gpu,uuid:'other'}])assert.throws(()=>validateGpuResources(q,p,'GPU-fixture'));
  const root=privateRoot(t);fs.mkdirSync(path.join(root,'.runtime'));fs.mkdirSync(path.join(root,'elsewhere'));
  fs.symlinkSync(path.join(root,'elsewhere'),path.join(root,'.runtime','redirect'),'junction');
  assert.throws(()=>createHostPaths(root).directory('.runtime/redirect'),/redirect/);
});

function closureFixture(){const profile='ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py';
  const source='from ai_painter.complete_world import parameter48_causal_observation_v1\n';
  const code=new Map([[profile,source],[p.implementations.host,"import '@babel/parser';\n"],[p.metadataCanonicalProgram.path,fs.readFileSync(path.join(ROOT,p.metadataCanonicalProgram.path))]]);
  const q=copy(p);q.sourceAlgorithmBindings=[];const original={profile:{path:profile,sha256:hash(source)}},reads=[];
  const reader={bound:()=>({context:{programBindings:original}}),bytes(name,sha){reads.push(name);const raw=Buffer.from(code.get(name)??'');if(sha!==undefined)assert.equal(hash(raw),sha);return raw;},verifyStable(){}};
  return {q,reader,code,reads};}
test('synthetic closure walks actual Node imports/provider manifest and includes boundary test without tensors',()=>{
  const f=closureFixture(),rows=collectSourceClosure(ROOT,f.reader,f.q,Date.now()+30000),names=rows.map(row=>row.path);
  assert(names.includes('node_modules/@babel/parser/package.json'));assert(names.some(name=>name.startsWith('node_modules/@babel/parser/')&&name.endsWith('.js')));
  assert(names.includes('scripts/tests/ai-painter-qualification-owned-worker-boundary-v3.test.mjs'));assert(rows.length<=256);
  assert(!f.reads.some(name=>name.endsWith('.pt')||name.endsWith('.png')));assert(rows.preparationStreamBytes>0);
});
test('new arbitrary dynamic loader is rejected, only the exact fixed TEST loader is closed',()=>{
  const f=closureFixture();f.code.set(p.implementations.worker,'import importlib\nimportlib.import_module(untrusted)\n');
  assert.throws(()=>collectSourceClosure(ROOT,f.reader,f.q,Date.now()+30000),/dynamic/);
  const fixture=closureFixture();fixture.code.set(p.implementations.worker,"import importlib.util\nTEST = 'ml/ai-painter/tests/test_decode1_entry_gpu_qualification_cpu_v3.py'\ndef preparation_abi_tests(reader):\n return importlib.util.spec_from_file_location('_decode1_entry_qualification_abi_tests',reader.path(TEST))\n");
  collectSourceClosure(ROOT,fixture.reader,fixture.q,Date.now()+30000);
  fixture.code.set(p.implementations.worker,fixture.code.get(p.implementations.worker).replace('reader.path(TEST)','reader.path(other)'));
  assert.throws(()=>collectSourceClosure(ROOT,fixture.reader,fixture.q,Date.now()+30000));
});
test('CLI has no training, phase-only or scope override and consumes no actual claim',()=>{
  const claim=path.join(ROOT,p.attemptClaimPath),before=fs.existsSync(claim);
  const result=spawnSync(process.execPath,[path.join(ROOT,p.implementations.host),'--train'],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.notEqual(result.status,0);assert.match(result.stderr,/qualification-only/);assert.equal(fs.existsSync(claim),before);
});

// Execute the actual host and phase-runtime bodies, not source-string gates.
// Only external inputs/native transport/OS/registry storage are memory fixtures.
import {runInNewContext} from 'node:vm';
import {validateParameter60NativeProof} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v3.mjs';
function hostControlFixture(fault={}){
  const root=path.resolve('F:/private-memory-only-qualification-host'),files=new Map(),directories=new Map(),events=[];
  let inode=0,elapsed=0,mode=null,serial=0,active=null,currentRun=null,supervisorSpawns=0;
  const closed=new Set(),phaseStarted=new Map(),closedMeasures=new Map(),pending=new Map();
  const primary=new Error('current-call before-onSpawn first error');let lastReceipt=null,inner=null;
  function mkdir(directory){if(!directories.has(directory)){const parent=path.dirname(directory);if(parent!==directory)mkdir(parent);directories.set(directory,++inode);}return directory;}
  function write(file,bytes,options={}){mkdir(path.dirname(file));if(options.flag==='wx')assert(!files.has(file),'private exclusive file');
    const old=files.get(file);files.set(file,{bytes:Buffer.from(bytes),ino:old?.ino??++inode});}
  const stat=file=>{assert(files.has(file)||directories.has(file),'memory path absent: '+file);return {dev:1,ino:files.get(file)?.ino??directories.get(file),
    nlink:1,size:files.get(file)?.bytes.length??0,isFile:()=>files.has(file),isDirectory:()=>directories.has(file),isSymbolicLink:()=>false};};
  const memoryFs={existsSync:file=>files.has(file)||directories.has(file),statSync:stat,lstatSync:stat,realpathSync:file=>{stat(file);return file;},
    readFileSync(file,encoding){assert(files.has(file),'memory file absent: '+file);const raw=Buffer.from(files.get(file).bytes);return encoding?raw.toString(encoding):raw;},
    writeFileSync:write,renameSync(from,to){assert(files.has(from));files.set(to,files.get(from));files.delete(from);},
    statfsSync:()=>({bavail:8192,bsize:1048576}),
    readdirSync(directory,options){stat(directory);const names=[...directories.keys(),...files.keys()].filter(name=>name!==directory&&path.dirname(name)===directory).map(name=>path.basename(name));
      return options?.withFileTypes?names.map(name=>({name})):names;}};
  const paths={mkdir:name=>mkdir(path.join(root,name)),directory:name=>path.join(root,name),file:name=>path.join(root,name)};
  write(path.join(root,POLICY.path),policyRaw);
  const rows=packageFixture().programBindings,python=path.join(root,'private-python.exe');write(python,'inert fixture');
  const reader={paths,bytes(name,sha){const raw=memoryFs.readFileSync(path.join(root,name));if(sha!==undefined)assert.equal(hash(raw),sha);return raw;},
    bound(binding){if(binding.path===p.dataBindings.validationSplit.path)return {sampleIds:workerFixture('cpu_prepare').sampleIds};
      if(binding.path===p.dataBindings.trainSplit.path)return {sampleIds:workerFixture('gpu_qualify').sampleIds};
      return JSON.parse(this.bytes(binding.path,binding.sha256));},verifyStable(){}};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[1800000000000+elapsed]));}static now(){return 1800000000000+elapsed;}}
  const vmAssert=Object.assign((...args)=>assert(...args),assert,{deepEqual:(a,b,...rest)=>assert.deepEqual(copy(a),copy(b),...rest)});
  const globals={assert:vmAssert,fs:memoryFs,path,crypto,Buffer,structuredClone,Error,process:{pid:process.pid,env:{}},Date:Clock};
  const oldSource=fs.readFileSync(path.join(ROOT,'scripts/diagnose-ai-painter-parameter48-causal-gpu-v2.mjs'),'utf8');
  const baseSource=oldSource.slice(oldSource.indexOf('export function directoryBytes('),oldSource.indexOf('async function publishRegistry('));
  assert(baseSource.startsWith('export function directoryBytes('));
  const base=runInNewContext('const RESERVE=65536;'+baseSource.replace(/export function /gu,'function ')+';({createOwnedAccounting,directoryBytes})',globals);
  async function native(executable,args,options){
    const request=JSON.parse(memoryFs.readFileSync(path.join(root,args[3]))),id=crypto.randomUUID(),guardRoot=path.join(root,'.runtime/ai-painter/owned-worker-guards');
    events.push({kind:'native',phase:options.phase,elapsed});
    const guardRecord={identity:id,runnerPid:process.pid,executable,commandSha256:hash(JSON.stringify(args)),
      startedEvidence:path.join(guardRoot,id+'-started.json'),nativeEvidenceRoot:path.join(guardRoot,id+'-native')};
    const guard={path:path.join(guardRoot,'active.json'),identity:id,state:'retained',startedEvidence:guardRecord.startedEvidence,
      nativeEvidenceRoot:guardRecord.nativeEvidenceRoot,terminalEvidence:path.join(guardRoot,id+'-terminal.json'),terminalPath:path.join(guardRoot,id+'-guard-terminal.json')};
    const binary=path.join(guard.nativeEvidenceRoot,'private-owner.exe');write(binary,'inert native fixture');
    const nativeBuild={binary,binarySha256:hash(memoryFs.readFileSync(binary))};
    const bindingBase64=Buffer.from(JSON.stringify({guard:guardRecord,guardSha256:hash(JSON.stringify(guardRecord)),scope:root,nativeBuild})).toString('base64');
    const ownerIdentity={pid:4321,executable:binary,executableSha256:nativeBuild.binarySha256,identitySource:'retained_child_handle'};
    const worker=workerFixture(request.mode);worker.runId=request.runId;worker.package=request.package;
    const stdout=JSON.stringify(worker),counts={stdout:Buffer.byteLength(stdout),stderr:0};
    write(guard.path,JSON.stringify(guardRecord));write(guard.startedEvidence,JSON.stringify({ownerIdentity,bindingBase64}));
    const fail=fault.beforeOnSpawn===request.mode;
    if(!fail){supervisorSpawns++;options.onSpawn({guard,guardRecord,nativeBuildDirectory:guard.nativeEvidenceRoot,
      ownerPid:ownerIdentity.pid,ownerIdentity,bindingBase64,getStreamBytes:()=>({...counts})});}
    const proof={ownerPid:4321,rootPid:6789,rootCreationDateUtc:'2026-10-18T00:00:00.000Z',bindingBase64,
      assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,totalProcesses:1,exitCode:fail?1:0,stopReason:fail?'fixture_abort':null,
      streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,transportCompleted:true,
      cleanupError:null,observationError:null,streamCaptureError:null,streamTransportError:null,stdoutBytes:counts.stdout,stderrBytes:counts.stderr};
    const receipt={schema:'parameter60-live-native-owner-receipt-v1',ownerIdentity,ownerClosed:true,ownerExitCode:0,ownerSignal:null,
      liveOwnerCleanupConfirmed:true,emptyJob:true,ownerPipeEOF:{stdout:true,stderr:true},cleanupConfirmed:true,cleanupState:'confirmed_empty_job',
      guardReleaseConfirmed:true,termination:null,proof,protocolError:null,ownerError:'',streamBytes:counts,nativeBuild,
      guard:{...guard,state:'released_after_confirmed_cleanup'}};
    write(guard.terminalEvidence,JSON.stringify({...receipt,cleanupConfirmed:false}));memoryFs.renameSync(guard.path,guard.terminalPath);lastReceipt=receipt;
    if(fail){primary.ownedReceipt=receipt;throw primary;}return {stdout,stderr:'',ownedReceipt:receipt};
  }
  const runtimeSource=fs.readFileSync(path.join(ROOT,p.implementations.phaseRuntime),'utf8');
  const runtime=runInNewContext(runtimeSource.replace(/^import .+;\r?$/gmu,'').replace(/export (async )?function /gu,'$1function ')+
    ';({createAccounting,runOwnedPhase})',{...globals,...base,validateParameter60NativeProof,runDecode1EntryQualificationOwnedWorkerV3:native});
  function expire(point){if(fault.mode===mode&&fault.point===point)elapsed=phaseStarted.get(mode)+(mode==='cpu_prepare'?240000:720000)+1;}
  const createLedger=(...args)=>{inner=runtime.createAccounting(...args);return {...inner,
    begin(next){mode=next;phaseStarted.set(mode,elapsed);events.push({kind:'begin',mode,elapsed});const value=inner.begin(next);expire('begin');return value;},
    closePhase(receipt){const value=inner.closePhase(receipt);closed.add(mode);events.push({kind:'close',mode,elapsed});expire('close');return value;},
    requireBudget(...args){const value=inner.requireBudget(...args);if(closed.has(mode)){
      events.push({kind:'closed-budget',mode,elapsed});expire((closedMeasures.get(mode)??0)>=2?'outer-check-budget':'check-budget');}return value;},
    measure(){const value=inner.measure();if(closed.has(mode)){const n=(closedMeasures.get(mode)??0)+1;closedMeasures.set(mode,n);
      events.push({kind:'closed-measure',mode,n,elapsed});expire(n===1?'measure':'outer-measure');}return value;}};};
  const hostSource=fs.readFileSync(path.join(ROOT,p.implementations.host),'utf8');
  const js=hostSource.slice(0,hostSource.indexOf('\nif(process.argv[1]')).replace(/^import .+;\r?$/gmu,'')
    .replace(/^export \{createAccounting\}.+;\r?$/gmu,'').replace(/export (async )?function /gu,'$1function ').replace(/export (const|let) /gu,'$1 ')
    .replace("const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');","const SELF='private-host.mjs',ROOT='private-memory-root';")+
    `\ncreateReader=()=>fixtureReader;
    dryResolve=()=>({reader:fixtureReader,programBindings:Object.defineProperty(fixtureRows,'preparationStreamBytes',{value:0}),python:fixturePython,
      interpreter:{path:fixturePython,sha256:'c'.repeat(64)},nodeInterpreter:fixturePolicy.nodeInterpreter});
    processIdentity=()=>({processId:1,processStartIdentity:'private-supervisor'});
    gpuObservation=()=>({index:0,uuid:'private-GPU',freeMiB:4096,temperatureC:40});runQualification;`;
  const run=runInNewContext(js,{...globals,performance:{now:()=>elapsed},builtinModules:[],fixtureReader:reader,fixtureRows:rows,fixturePython:python,fixturePolicy:p,
    createAccounting:createLedger,runOwnedPhase:(_ledger,...args)=>runtime.runOwnedPhase(inner,...args),setInterval:()=>1,clearInterval(){},
    readCurrentExecutionRegistry:async()=>({ok:true,registrySha256:String(serial),registry:{activeExecution:active,latestTrainingTerminal:{original:'preserved'},runId:currentRun}}),
    prepareCurrentExecutionRegistryAdvance:async options=>{const transactionId='private-'+pending.size,
      transactionRoot='.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-'+transactionId;
      write(path.join(root,transactionRoot,'prepared.json'),'private prepared transaction');pending.set(transactionId,{options,transactionRoot});
      return {transactionId,transactionRoot};},
    finalizePreparedCurrentExecutionRegistryAdvance:async options=>{const item=pending.get(options.transactionId);
      options.beforeAtomicWrite('private-registry.json',17);write(path.join(root,item.transactionRoot,'committed.json'),'private committed transaction');
      active=item.options.activeExecution;currentRun=item.options.runId;serial++;events.push({kind:'registry',state:item.options.executionState,
        active:active!==null,mode:item.options.lifecycleStage,elapsed});return {ok:true};}});
  return {run:()=>run(root,bound),events,primary,files,get active(){return active;},get receipt(){return lastReceipt;},get supervisorSpawns(){return supervisorSpawns;}};
}

test('actual host memory flow closes CPU before GPU and retains same-call runtime proof',async()=>{
  const f=hostControlFixture(),value=await f.run();assert.equal(value.status,'qualification_completed_training_not_started');
  assert.deepEqual(f.events.filter(e=>e.kind==='native').map(e=>e.phase),['cpu','qualification']);
  assert(f.events.findIndex(e=>e.kind==='close'&&e.mode==='cpu_prepare')<f.events.findIndex(e=>e.kind==='begin'&&e.mode==='gpu_qualify'));
  assert.equal(f.active,null);assert.equal(f.supervisorSpawns,2);assert.equal(value.trainingAllowed,false);
});
for(const point of ['close','measure','check-budget'])test('actual host CPU '+point+' exceeding240s never starts GPU',async()=>{
  const f=hostControlFixture({mode:'cpu_prepare',point});await assert.rejects(f.run(),/deadline/);
  assert.deepEqual(f.events.filter(e=>e.kind==='native').map(e=>e.phase),['cpu']);
  assert(!f.events.some(e=>e.kind==='begin'&&e.mode==='gpu_qualify'));
});
for(const point of ['begin','close','measure','outer-measure','check-budget','outer-check-budget'])test('actual host GPU '+point+' exceeding720s cannot return success',async()=>{
  const f=hostControlFixture({mode:'gpu_qualify',point});await assert.rejects(f.run(),/deadline/);
  assert.equal(f.events.filter(e=>e.kind==='native'&&e.phase==='qualification').length,point==='begin'?0:1);
});
for(const phase of ['cpu_prepare','gpu_qualify'])test('actual host '+phase+' before-onSpawn current native receipt preserves first error and finalizes failure',async()=>{
  const f=hostControlFixture({beforeOnSpawn:phase});await assert.rejects(f.run(),error=>error===f.primary);
  assert.equal(f.primary.ownedReceipt,f.receipt);assert.equal(f.active,null);assert.equal(f.supervisorSpawns,phase==='cpu_prepare'?0:1);
  const committed=f.events.filter(e=>e.kind==='registry').at(-1);assert.equal(committed.state,'failed_closed');assert.equal(committed.active,false);
  assert(f.events.some(e=>e.kind==='close'&&e.mode===phase));
  const terminal=[...f.files.entries()].find(([name])=>name.endsWith((phase==='cpu_prepare'?'cpu':'qualification')+'-terminal.json'));
  const saved=JSON.parse(terminal[1].bytes);assert.equal(saved.status,'failed_closed');assert.equal(saved.firstError.message,f.primary.message);
  assert.equal(saved.cleanup.cleanupConfirmed,true);
});
