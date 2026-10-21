import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {nativeOwnerSourceIdentity,createNativeOwnerCommand,resolveNativeTiming,createCompletionCleanupClock,createCompletionNativeFrameParser,validateCompletionNativeTimingProof,COMPLETION_POLICY,COMPLETION_CAPABILITY,QUALIFICATION_COMPLETION_POLICY,QUALIFICATION_COMPLETION_CAPABILITY} from '../lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs';
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const batchDeadline=Date.now()+120000,root=process.cwd(),base=process.env.AI_PAINTER_COMPLETION_NATIVE_CPU_ROOT;
assert(base&&path.isAbsolute(base)&&!fs.existsSync(base),'fresh explicit private CPU evidence root required');
const permittedRoots=['completion-training-20261019','gpu-admission-completion-20261019'].map(name=>path.resolve(root,'.runtime/ai-painter/controller-repair-reviews',name,'m-native'));
const permitted=permittedRoots.find(candidate=>path.dirname(path.resolve(base))===candidate);
assert(permitted,'private evidence must stay in an explicit owned review root');
const protectedFiles=['scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs','scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs','.runtime/ai-painter/owned-worker-guards/active.json','.runtime/ai-painter/current-execution-registry/current.json'];
const protectedBytes=protectedFiles.map(file=>fs.existsSync(file)?fs.readFileSync(file):null);
function unchanged(){protectedFiles.forEach((file,i)=>assert.deepEqual(fs.existsSync(file)?fs.readFileSync(file):null,protectedBytes[i],file));}
fs.mkdirSync(base);
const source=nativeOwnerSourceIdentity(),compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',framework=path.dirname(compiler),binary=path.join(base,'owner.exe');
const compileArgs=['/nologo','/noconfig','/target:exe','/optimize+',...['System.dll','System.Core.dll','System.Web.Extensions.dll'].map(f=>'/reference:'+path.join(framework,f)),'/out:'+binary,source.path];
execFileSync(compiler,compileArgs,{windowsHide:true,timeout:20000,maxBuffer:1048576});
let wireBytes=0,serial=0;
const cases=[];
const testOutcomes=[];
const test=(name,body)=>nodeTest(name,async context=>{
 try{await body(context);if(!name.startsWith('private native batch evidence'))testOutcomes.push({name,status:'passed'});}
 catch(error){testOutcomes.push({name,status:'failed',error:String(error)});throw error;}
});
const fixtureRoot=path.resolve(root,'.runtime/ai-painter/controller-repair-reviews/gpu-admission-completion-20261019/m-native');
function budget(){assert(Date.now()<batchDeadline,'CPU batch120sec');assert(wireBytes<8*1024*1024,'CPU wire cap');}
test('C# synthetic clock: completion passes8400, finite deadline and every cleanup slice remain bounded',()=>{
 const probe=path.join(fixtureRoot,'timing-cpu.cs'),exe=path.join(base,'timing-cpu.exe');
 execFileSync(compiler,['/nologo','/noconfig','/target:exe','/reference:'+binary,'/out:'+exe,probe],{windowsHide:true,timeout:20000,maxBuffer:1048576});
 const result=JSON.parse(execFileSync(exe,[],{windowsHide:true,timeout:5000,encoding:'utf8',maxBuffer:65536}));assert.equal(result.status,'passed');cases.push({kind:'clock',...result});budget();
});
test('JS completion timing rejects implicit/old modes, cross identity and boolean authority; finite calls unchanged',()=>{
 const now=Date.now();assert.deepEqual(resolveNativeTiming(now+1000),{mode:'finite_deadline',deadlineUnixMs:now+1000});
 for(const invalid of [null,undefined,Infinity,NaN,now+8400001,'999999999999999999',{}, {mode:'registered_training_completion'}, {mode:'registered_training_completion',phase:'cpu',runId:'private-run-0000',packageId:'private-package-0000',policy:COMPLETION_POLICY,startupDeadlineUnixMs:now+1000}])assert.throws(()=>resolveNativeTiming(invalid,{root,now}));
 const timing={mode:'registered_training_completion',phase:'training',runId:'private-run-0000',packageId:'private-package-0000',policy:COMPLETION_POLICY,startupDeadlineUnixMs:now+1000};
 assert.throws(()=>resolveNativeTiming({...timing,policy:{...COMPLETION_POLICY,sha256:'0'.repeat(64)}},{root,now}));
 assert.throws(()=>resolveNativeTiming({...timing,startupDeadlineUnixMs:null},{root,now}));
 assert.throws(()=>resolveNativeTiming({...timing,startupDeadlineUnixMs:now+8400001},{root,now}));
 assert.throws(()=>resolveNativeTiming(timing,{root,now,executable:process.execPath,args:[]}));
 const clock=createCompletionCleanupClock(),a=clock.start(now,'resource_stop');assert.equal(clock.start(now+8400001,'renewal'),a);assert.equal(clock.current().forceAt,now+750);assert.equal(clock.current().finalAt,now+1000);cases.push({kind:'JSnegative',status:'passed'});budget();
});
test('completion mode rereads exact policy and same package plan/admission, rejects identity mutations',()=>{
 const now=Date.now(),policy=JSON.parse(fs.readFileSync(path.join(root,COMPLETION_POLICY.path))),runId='private-new-run-0000',packageId='private-new-package-0000';
 const output=policy.outputRoot+'/'+runId,python=Buffer.from('private synthetic interpreter bytes'),worker=Buffer.from('private synthetic worker bytes');
 function fixture(change=()=>{}){
  const store=new Map(),put=(logical,value)=>{const raw=Buffer.from(JSON.stringify(value));store.set(path.resolve(root,logical),raw);return {path:logical,sha256:hash(raw)};};
  const workerPath='private-worker.py',exe=path.resolve(root,'private-python.exe');store.set(exe,python);store.set(path.resolve(root,workerPath),worker);
  const programs={worker:{path:workerPath,sha256:hash(worker)}};
  const plan={runId,packageId,capabilityVersion:COMPLETION_CAPABILITY,outputRoot:output,executionProfile:policy.executionProfile,executionPolicy:COMPLETION_POLICY,
   formalSpecification:{path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},configuration:{capabilityVersion:COMPLETION_CAPABILITY,executionCeiling:policy.executionCeiling,gpuAdmissionSeconds:720},
   historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,runtimeIdentity:{python:{absolutePath:exe,sha256:hash(python)}},programBindings:programs};
  change(plan);const planRef=put(output+'/quality-plan.json',plan),packageRef=put('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',{packageIdentity:packageId,capabilityVersion:COMPLETION_CAPABILITY,inputEvidence:[planRef]});
  const admission=put(output+'/gpu-acceptance.json',{schema:'object-support-structure-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageRef,programBindings:programs});
  const timing={mode:'registered_training_completion',phase:'training',runId,packageId,policy:COMPLETION_POLICY,startupDeadlineUnixMs:now+1000};
  const args=['-B',path.resolve(root,workerPath),'--package',packageRef.path,'--sha256',packageRef.sha256,'--gpu',admission.path,'--gpu-sha256',admission.sha256];
  return {timing,options:{root,executable:exe,args,now,reader:file=>store.get(path.resolve(file))??fs.readFileSync(file)}};
 }
 let f=fixture();const actual=resolveNativeTiming(f.timing,f.options);assert.equal(actual.mode,'registered_training_completion');assert.equal(Object.hasOwn(actual,'deadlineUnixMs'),false);
 for(const change of [p=>p.runId='wrong-run-0000',p=>p.capabilityVersion='old-candidate',p=>p.executionPolicy={...COMPLETION_POLICY,sha256:'0'.repeat(64)},p=>p.configuration={...p.configuration,executionCeiling:{...p.configuration.executionCeiling,maxWallSeconds:999999}},p=>p.trainingRestartAllowed=true]){
  f=fixture(change);assert.throws(()=>resolveNativeTiming(f.timing,f.options));
 }
 f=fixture();assert.throws(()=>resolveNativeTiming({...f.timing,phase:'qualification'},f.options));
 cases.push({kind:'immutablePolicyAndPackage',status:'passed',executionActuallySpawned:false});budget();
});
test('qualification completion exact v3 accepts both phases and rejects old or crossed authority',()=>{
 const now=Date.now(),policy=JSON.parse(fs.readFileSync(path.join(root,QUALIFICATION_COMPLETION_POLICY.path)));
 function fixture(phase='qualification',change=()=>{}){
  const runId='private-v2-run-0000',packageId='private-v2-package-0000',output=policy.outputRoot+'/'+runId,store=new Map();
  const put=(logical,value)=>{const raw=Buffer.from(JSON.stringify(value));store.set(path.resolve(root,logical),raw);return {path:logical,sha256:hash(raw)};};
  const exe=path.resolve(root,'private-v2-python.exe'),python=Buffer.from('synthetic interpreter');store.set(exe,python);
  const programs={};for(const role of ['worker','gpuQualifier']){const logical='private-v2-'+role+'.py',raw=Buffer.from('synthetic '+role);store.set(path.resolve(root,logical),raw);programs[role]={path:logical,sha256:hash(raw)};}
  const plan={runId,packageId,capabilityVersion:QUALIFICATION_COMPLETION_CAPABILITY,outputRoot:output,executionProfile:policy.executionProfile,
   executionPolicy:QUALIFICATION_COMPLETION_POLICY,formalSpecification:{path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},
   configuration:{capabilityVersion:QUALIFICATION_COMPLETION_CAPABILITY,executionCeiling:policy.executionCeiling,gpuAdmissionSeconds:null,gpuAdmissionWallMode:'completion'},
   historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,runtimeIdentity:{python:{absolutePath:exe,sha256:hash(python)}},programBindings:programs};
  change(plan);const planRef=put(output+'/quality-plan.json',plan),packageRef=put('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',
   {packageIdentity:packageId,capabilityVersion:QUALIFICATION_COMPLETION_CAPABILITY,inputEvidence:[planRef]});
  const role=phase==='qualification'?'gpuQualifier':'worker',args=['-B',path.resolve(root,programs[role].path),'--package',packageRef.path,'--sha256',packageRef.sha256];
  if(phase==='training'){const admission=put(output+'/gpu-acceptance.json',{schema:'object-support-structure-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageRef,programBindings:programs});args.push('--gpu',admission.path,'--gpu-sha256',admission.sha256);}
  return {timing:{mode:phase==='qualification'?'registered_qualification_completion':'registered_training_completion',phase,startupDeadlineUnixMs:now+1000,
   policy:QUALIFICATION_COMPLETION_POLICY,runId,packageId},options:{root,executable:exe,args,now,reader:file=>store.get(path.resolve(file))??fs.readFileSync(file)}};
 }
 for(const phase of ['qualification','training']){const f=fixture(phase),actual=resolveNativeTiming(f.timing,f.options);assert.equal(actual.phase,phase);assert(!Object.hasOwn(actual,'deadlineUnixMs'));}
 let f=fixture();assert.throws(()=>resolveNativeTiming({...f.timing,mode:'registered_training_completion'},f.options));
 assert.throws(()=>resolveNativeTiming({...f.timing,policy:COMPLETION_POLICY},f.options));
 assert.throws(()=>resolveNativeTiming({...f.timing,startupDeadlineUnixMs:now+720001},f.options));
 for(const change of [p=>p.capabilityVersion=COMPLETION_CAPABILITY,p=>p.configuration.gpuAdmissionSeconds=720,p=>p.configuration.gpuAdmissionWallMode='finite',p=>p.runId='different-v2-run']){
  f=fixture('qualification',change);assert.throws(()=>resolveNativeTiming(f.timing,f.options));
 }
 f=fixture('training');f.options.args=f.options.args.slice(0,6);assert.throws(()=>resolveNativeTiming(f.timing,f.options));
 cases.push({kind:'qualificationAuthority',status:'passed',actualQualification:false});budget();
});
test('qualification completion S/C/R binds the exact phase and rejects training proof substitution',()=>{
 const now=Date.now(),startupDeadlineUnixMs=now+10000,ownerPid=17;
 const bindingBase64=Buffer.from(JSON.stringify({executionTiming:{mode:'registered_qualification_completion',phase:'qualification',startupDeadlineUnixMs}})).toString('base64');
 const parser=createCompletionNativeFrameParser({bindingBase64,ownerPid,startupDeadlineUnixMs}),encode=(kind,v)=>kind+':'+Buffer.from(JSON.stringify(v)).toString('base64');
 const started={schemaVersion:'completion-native-started-v1',bindingBase64,ownerPid,rootPid:18,rootCreationDateUtc:new Date(now).toISOString(),startedAtUtc:new Date(now).toISOString(),startupDeadlineUnixMs};
 const cleanup={schemaVersion:'completion-native-cleanup-start-v1',bindingBase64,ownerPid,rootPid:18,rootCreationDateUtc:started.rootCreationDateUtc,cleanupStartedAtUnixMs:now,cleanupMs:1000,stopReason:null};
 assert.equal(parser(encode('S',started)).kind,'started');assert.equal(parser(encode('C',cleanup)).kind,'cleanup');
 const proof={...cleanup,timingMode:'registered_qualification_completion',startedAtUtc:started.startedAtUtc,endedAtUtc:new Date().toISOString(),elapsedMs:1},context={started,cleanup,ownerPid,bindingBase64};
 assert(validateCompletionNativeTimingProof(proof,context));assert.throws(()=>validateCompletionNativeTimingProof({...proof,timingMode:'registered_training_completion'},context));
 const crossed=Buffer.from(JSON.stringify({executionTiming:{mode:'registered_training_completion',phase:'qualification',startupDeadlineUnixMs}})).toString('base64');
 assert.throws(()=>createCompletionNativeFrameParser({bindingBase64:crossed,ownerPid,startupDeadlineUnixMs}));
 cases.push({kind:'qualificationFrames',status:'passed'});budget();
});
test('S/C parser binds root, rejects duplicate/cross invocation and cannot renew cleanup',()=>{
 let now=1700000000000;const ownerPid=12,startupDeadlineUnixMs=now+10000;
 const bindingBase64=Buffer.from(JSON.stringify({executionTiming:{mode:'registered_training_completion',phase:'training',startupDeadlineUnixMs}})).toString('base64');
 const frame=(kind,value)=>kind+':'+Buffer.from(JSON.stringify(value)).toString('base64');
 const started={schemaVersion:'completion-native-started-v1',bindingBase64,ownerPid,rootPid:13,rootCreationDateUtc:new Date(now).toISOString(),startedAtUtc:new Date(now).toISOString(),startupDeadlineUnixMs};
 const cleanup={schemaVersion:'completion-native-cleanup-start-v1',bindingBase64,ownerPid,rootPid:13,rootCreationDateUtc:started.rootCreationDateUtc,cleanupStartedAtUnixMs:now,cleanupMs:1000,stopReason:null};
 const make=()=>createCompletionNativeFrameParser({bindingBase64,ownerPid,startupDeadlineUnixMs,now:()=>now});
 let parser=make();assert.throws(()=>parser(frame('C',cleanup)));assert.equal(parser(frame('S',started)).kind,'started');assert.throws(()=>parser(frame('S',started)));
 assert.throws(()=>parser(frame('C',{...cleanup,rootPid:99})));assert.equal(parser(frame('C',cleanup)).kind,'cleanup');assert.throws(()=>parser(frame('C',cleanup)));
 parser=make();assert.throws(()=>parser(frame('S',{...started,bindingBase64:'other'})));now=startupDeadlineUnixMs;assert.throws(()=>parser(frame('S',started)));cases.push({kind:'frameNegative',status:'passed'});budget();
 const proof={...cleanup,timingMode:'registered_training_completion',startedAtUtc:started.startedAtUtc,endedAtUtc:new Date(now).toISOString(),elapsedMs:100};
 const observed={started,cleanup,ownerPid,bindingBase64};assert.equal(validateCompletionNativeTimingProof(proof,observed),true);
 for(const changed of [{...proof,rootPid:99},{...proof,cleanupStartedAtUnixMs:proof.cleanupStartedAtUnixMs+1},{...proof,elapsedMs:null},{...proof,timingMode:'finite_deadline'}])assert.throws(()=>validateCompletionNativeTimingProof(changed,observed));
});
test('new builder finite numeric ABI compiles exact native bytes without production guard',()=>{
 const record={identity:crypto.randomUUID(),startedEvidence:path.join(base,'private-started.json'),nativeOwnerSource:source};
 const command=createNativeOwnerCommand(process.execPath,['-e','process.exit(0)'],root,Date.now()+5000,1000,record,JSON.stringify(record));
 assert.equal(command.executionTiming.mode,'finite_deadline');assert.equal(Number(command.args[2]),command.executionTiming.deadlineUnixMs);
 assert.equal(hash(fs.readFileSync(command.nativeBuild.snapshot)),source.sha256);assert.equal(hash(fs.readFileSync(command.executable)),command.nativeBuild.binarySha256);
 assert.equal(JSON.parse(Buffer.from(command.bindingBase64,'base64')).executionTiming.mode,'finite_deadline');
 cases.push({kind:'builderFinite',status:'passed'});budget();
});
async function run(name,{completion=true,phase='training',reason=null,natural=false,runnerLost=false,blockCleanup=false,expiredStartup=false}={}){
 budget();const dir=path.join(base,String(++serial));fs.mkdirSync(dir);const began=Date.now(),startup=began+5000,deadline=began+400,receipt=path.join(dir,'observation.json');
 const executionTiming={mode:phase==='qualification'?'registered_qualification_completion':'registered_training_completion',phase,startupDeadlineUnixMs:expiredStartup?began-1:startup,policy:phase==='qualification'?QUALIFICATION_COMPLETION_POLICY:COMPLETION_POLICY,runId:'private-native-run-0000',packageId:'private-native-package-0000'};
 const bindingBase64=Buffer.from(JSON.stringify({fixtureOnly:true,executionTiming})).toString('base64');
 const token=completion?(phase==='qualification'?'completion_qualification:':'completion_train:')+executionTiming.startupDeadlineUnixMs:String(deadline);
 const sourceCode=natural?"process.stdout.write('cpu-out');process.stderr.write('cpu-err');":blockCleanup?"require('fs').writeSync(1,Buffer.alloc(262144,65));":"process.stdout.write('cpu-start');setInterval(()=>{},1000);";
 let executable=binary;
 if(blockCleanup){
  const blocker=path.join(fixtureRoot,'cleanup-blocker.cs'),exe=path.join(base,'blocker.exe');
  execFileSync(compiler,['/nologo','/noconfig','/target:exe','/main:CleanupBlocker','/reference:'+binary,'/out:'+exe,blocker],{windowsHide:true,timeout:20000,maxBuffer:1048576});executable=exe;
 }
 const child=spawn(executable,[process.execPath,root,token,'1000',receipt,bindingBase64,'-e',sourceCode],{windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'},stdio:['pipe','pipe','pipe']});
 let pending='',proof=null,started=null,cleanup=null,error='',stdout=0,stderr=0,forced=false,forceTimer=null,blockedAt=null;
 const parser=createCompletionNativeFrameParser({bindingBase64,ownerPid:child.pid,startupDeadlineUnixMs:executionTiming.startupDeadlineUnixMs});
 const fallback=setTimeout(()=>{forced=true;child.kill();},7000);
 child.stdin.on('error',()=>{});
 child.stdout.on('data',chunk=>{wireBytes+=chunk.length;pending+=chunk.toString('ascii');let at;
  while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at).trimEnd();pending=pending.slice(at+1);
   try{
    if(line.startsWith('S:')||line.startsWith('C:')){
     const got=parser(line);
     if(got.kind==='started'){started=got.frame;if(runnerLost)child.stdin.end();else if(reason)child.stdin.write(Buffer.from(reason).toString('base64')+'\n');}
     else {cleanup=got.frame;forceTimer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)forced=child.kill();},Math.max(1,cleanup.cleanupStartedAtUnixMs+750-Date.now()));}
    }else if(line.startsWith('R:'))proof=JSON.parse(Buffer.from(line.slice(2),'base64'));
    else if(line.startsWith('O:'))stdout+=Buffer.from(line.slice(2),'base64').length;
    else if(line.startsWith('E:'))stderr+=Buffer.from(line.slice(2),'base64').length;
    else throw Error('unexpected native frame');
   }catch(e){error+=String(e);child.kill();}
  }
 });
 child.stderr.on('data',chunk=>{wireBytes+=chunk.length;error+=chunk.toString();if(error.includes('private C writer blocked'))blockedAt??=Date.now();});
 const [exitCode,signal]=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(...args)=>resolve(args));});
 clearTimeout(fallback);clearTimeout(forceTimer);
 const result={name,status:'failed',exitCode,signal,forced,elapsedMs:Date.now()-began,started,cleanup,proof,error,stdout,stderr};cases.push(result);
 if(blockCleanup||expiredStartup){assert.equal(proof,null);assert.notEqual(exitCode,0);assert.equal(forced,false,error);assert(result.elapsedMs<6000);if(blockCleanup){assert(blockedAt);assert(Date.now()-blockedAt<1000,'blocked C must exit inside original cleanup budget');}result.status='passed';return;}
 assert.equal(error,'');assert.equal(forced,false);assert.equal(exitCode,0);assert(proof);
 assert.equal(proof.bindingBase64,bindingBase64);assert.equal(proof.ownerPid,child.pid);assert.equal(proof.activeProcessesAfterCleanup,0);
 for(const key of ['assignedBeforeResume','killOnJobClose','stdoutClosed','stderrClosed','transportCompleted'])assert.equal(proof[key],true,key);
 for(const key of ['cleanupError','observationError','streamCaptureError','streamTransportError'])assert.equal(proof[key],null,key);
 assert.equal(proof.stdoutBytes,stdout);assert.equal(proof.stderrBytes,stderr);
 if(completion){assert(started&&cleanup);assert.equal(validateCompletionNativeTimingProof(proof,{started,cleanup,ownerPid:child.pid,bindingBase64}),true);assert.equal(cleanup.rootPid,proof.rootPid);assert.equal(proof.cleanupStartedAtUnixMs,cleanup.cleanupStartedAtUnixMs);assert.equal(proof.stopReason,reason??(runnerLost?'runner_lost':null));assert(Date.now()<cleanup.cleanupStartedAtUnixMs+1000);}
 else assert.equal(proof.stopReason,'wall_timeout');
 assert.equal(JSON.parse(fs.readFileSync(receipt)).bindingBase64,bindingBase64);unchanged();budget();result.status='passed';
}
test('real private native Job: completion natural exit',()=>run('natural',{natural:true}));
test('real private native Job: resource stop retains reason and bounded cleanup',()=>run('resource',{reason:'GPU resource guard: private CPU synthetic resource failure'}));
test('real private native Job: operator stop retains reason and bounded cleanup',()=>run('operator',{reason:'operator_stop'}));
test('real private native Job: control EOF still stops',()=>run('runner_lost',{runnerLost:true}));
test('real private native Job: finite legacy mode still wall-times out',()=>run('finite',{completion:false}));
test('real private native Job: startup expiry fails closed',()=>run('startup',{expiredStartup:true}));
test('C frame blocked writer cannot exceed cleanup budget or invent proof',()=>run('blocked_C',{blockCleanup:true}));
test('qualification completion private Job natural exit',()=>run('qualification_natural',{phase:'qualification',natural:true}));
test('qualification completion private Job resource stop',()=>run('qualification_resource',{phase:'qualification',reason:'private_cpu_resource_stop'}));
test('qualification completion blocked C remains bounded and unqualified',()=>run('qualification_blocked_C',{phase:'qualification',blockCleanup:true}));
test('private native batch evidence and unchanged protected bytes',()=>{
 unchanged();budget();const size=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,d)=>n+(d.isDirectory()?size(path.join(dir,d.name)):fs.statSync(path.join(dir,d.name)).size),0);
 const diskBytes=size(base);assert(diskBytes+wireBytes<8*1024*1024);
 const result={status:cases.length>0&&cases.every(c=>c.status==='passed')&&testOutcomes.every(t=>t.status==='passed')?'passed':'failed',cases,testOutcomes,source,sourceSha256:source.sha256,oldV2AndRegistryGuardUnchanged:true,productionQualification:false,productionGuardUsed:false,elapsedMs:120000-(batchDeadline-Date.now()),wireBytes,diskBytes,limits:{totalSeconds:120,cpuCores:2,cpuThreads:2,outputBytes:8388608}};
 fs.writeFileSync(path.join(base,'batch.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({batch:path.join(base,'batch.json'),cases:cases.length,diskBytes,wireBytes}));
 assert.equal(result.status,'passed','CPU batch preserves any prior failed case');
});

