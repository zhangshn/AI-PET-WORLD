import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {runOwnedWorker} from '../lib/ai-painter-owned-worker-v1.mjs';
import {createNativeOwnerCommand,nativeOwnerSourceIdentity} from '../lib/ai-painter-owned-worker-native-v1.mjs';

const base=path.resolve('.runtime/m-c4-01');fs.mkdirSync(base,{recursive:true});
assert.equal(fs.realpathSync(base),path.join(fs.realpathSync(path.resolve('.runtime')),'m-c4-01'),'native fixture must remain below the resolved runtime root without extra redirection');
const root=fs.mkdtempSync(path.join(base,'native-')),began=Date.now(),results=[],pids=[];
const fixture=path.resolve('scripts/fixtures/ai-painter-owned-worker.mjs'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const guardPath=d=>path.join(d,'.runtime/ai-painter/owned-worker-guards/active.json');
const observation=d=>path.join(path.dirname(guardPath(d)),read(guardPath(d)).identity+'-native','cleanup-observation.json');
function scope(name){const d=path.join(root,name);fs.mkdirSync(d);return d;}
async function until(fn){const end=Date.now()+10000;while(!fn()){assert(Date.now()<end,'native fixture deadline');await wait(20);}}
function refuse(d){const before=fs.readFileSync(guardPath(d));assert.throws(()=>runOwnedWorker(process.execPath,[],{cwd:d,env:process.env,timeout:2000}),e=>e.code==='OWNED_GUARD_BUSY');assert.deepEqual(fs.readFileSync(guardPath(d)),before);}
function track(d){const r=read(path.join(d,'root-pid.json')),l=read(path.join(d,'leaf-pid.json'));pids.push(r.pid,r.ppid,l.pid);return r;}
async function check(name,fn){const t=Date.now();try{results.push({name,status:'passed',evidence:await fn(),elapsedMs:Date.now()-t});}catch(e){results.push({name,status:'failed',error:String(e.stack),receipt:e.ownedReceipt,elapsedMs:Date.now()-t});}}
await check('normal ABI builds from current source and never consumes tampered old binary',async()=>{
 const d=scope('normal');const first=await runOwnedWorker(process.execPath,[fixture,'json',d],{cwd:d,env:process.env,timeout:6000});
 assert(first.ownedReceipt.cleanupConfirmed);assert(first.ownedReceipt.guardReleaseConfirmed);assert(!fs.existsSync(guardPath(d)));
 const persisted=read(first.ownedReceipt.guard.terminalEvidence);assert.equal(persisted.cleanupConfirmed,false);assert.equal(persisted.guardReleaseConfirmed,false);assert.equal(persisted.liveOwnerCleanupConfirmed,true);
 const before=fs.readFileSync(first.ownedReceipt.nativeBuild.binary);fs.writeFileSync(path.join(d,'original-owner.exe.evidence'),before,{flag:'wx'});
 fs.appendFileSync(first.ownedReceipt.nativeBuild.binary,'untrusted old build');
 const second=await runOwnedWorker(process.execPath,[fixture,'json',d],{cwd:d,env:process.env,timeout:6000});assert(second.ownedReceipt.cleanupConfirmed);assert.notEqual(first.ownedReceipt.nativeBuild.binary,second.ownedReceipt.nativeBuild.binary);assert.equal(second.stdout,first.stdout);
 return {first:first.ownedReceipt,second:second.ownedReceipt};
});
await check('runner death persists observation; replay and tamper never release unknown guard',async()=>{
 const d=scope('runner-loss'),runner=spawn(process.execPath,[fixture,'runner',d],{cwd:d,windowsHide:true,stdio:'ignore'}),done=new Promise(r=>runner.once('close',(code,signal)=>r({code,signal})));pids.push(runner.pid);
 try{await until(()=>fs.existsSync(path.join(d,'leaf-pid.json')));const r=track(d);refuse(d);assert(runner.kill('SIGKILL'));const exit=await done;await until(()=>fs.existsSync(observation(d)));const file=observation(d),bytes=fs.readFileSync(file),value=JSON.parse(bytes),binding=JSON.parse(Buffer.from(value.bindingBase64,'base64'));
  assert.equal(value.authority,'observation_only_no_release_authority');assert.equal(value.activeProcessesAfterCleanup,0);assert.equal(value.ownerPid,r.ppid);assert.equal(value.rootPid,r.pid);assert(BigInt(value.ownerCreationFileTime)>0n);assert.equal(binding.guardSha256,sha(fs.readFileSync(guardPath(d))));assert.equal(Buffer.from(value.stopReasonBase64,'base64').toString(),'runner_lost');refuse(d);
  fs.writeFileSync(path.join(d,'original-observation.json'),bytes,{flag:'wx'});fs.writeFileSync(file,JSON.stringify({...value,cleanupConfirmed:true,ownerPid:value.ownerPid+1}));refuse(d);
  const replay=scope('replay'),g=guardPath(replay);fs.mkdirSync(path.dirname(g),{recursive:true});fs.writeFileSync(g,JSON.stringify({...binding.guard,identity:crypto.randomUUID()}),{flag:'wx'});fs.mkdirSync(path.dirname(observation(replay)));fs.writeFileSync(observation(replay),bytes,{flag:'wx'});refuse(replay);
  return {directory:d,exit,originalObservationSha256:sha(bytes),value,replayDirectory:replay};
 }finally{if(runner.exitCode===null&&runner.signalCode===null)runner.kill('SIGKILL');}
});
await check('real native publication IO failure retains guard and returns unknown ABI',async()=>{
 const d=scope('io-failure');let injected=false;const e=await runOwnedWorker(process.execPath,[fixture,'tree-wait',d],{cwd:d,env:process.env,timeout:6500,abortReason:()=>{
  if(!fs.existsSync(path.join(d,'leaf-pid.json')))return null;if(!injected){fs.mkdirSync(observation(d)+'.pending');injected=true;}return 'publication IO fixture';
 }}).catch(e=>e);
 assert(injected);assert.equal(e.ownedReceipt.cleanupConfirmed,false);assert.equal(e.ownedReceipt.liveOwnerCleanupConfirmed,true);assert.equal(e.ownedReceipt.proof.activeProcessesAfterCleanup,0);assert.match(e.ownedReceipt.proof.observationError,/Exception:/);assert(!fs.existsSync(observation(d)));track(d);refuse(d);return e.ownedReceipt;
});
await check('guard changed during live worker cannot be released by confirmed cleanup',async()=>{
 const d=scope('changed-guard');let changed=false;const e=await runOwnedWorker(process.execPath,[fixture,'tree-wait',d],{cwd:d,env:process.env,timeout:6500,abortReason:()=>{
  if(!fs.existsSync(path.join(d,'leaf-pid.json')))return null;if(!changed){fs.writeFileSync(path.join(d,'original-guard.json'),fs.readFileSync(guardPath(d)),{flag:'wx'});fs.writeFileSync(guardPath(d),'changed guard fixture');changed=true;}return 'guard changed fixture';
 }}).catch(e=>e);assert(changed);assert.equal(e.ownedReceipt.cleanupConfirmed,false);assert.match(e.ownedReceipt.guard.error,/guard identity changed/);assert.equal(fs.readFileSync(guardPath(d),'utf8'),'changed guard fixture');track(d);refuse(d);return e.ownedReceipt;
});
await check('retained native owner death and broken stdout are separate from starter exit',async()=>{
 const evidence=[];for(const kill of [true,false]){const d=scope(kill?'owner-loss':'stdout-loss'),guard={identity:crypto.randomUUID(),startedEvidence:path.join(d,'started.json'),nativeOwnerSource:nativeOwnerSourceIdentity()};
  const g=guardPath(d);fs.mkdirSync(path.dirname(g),{recursive:true});fs.writeFileSync(g,JSON.stringify(guard),{flag:'wx'});
  const command=createNativeOwnerCommand(process.execPath,[fixture,'tree-wait',d],d,Date.now()+7000,1000,guard,JSON.stringify(guard));
  const owner=spawn(command.executable,command.args,{cwd:d,windowsHide:true,detached:true,stdio:['pipe','pipe','pipe']}),done=new Promise(r=>owner.once('close',(code,signal)=>r({code,signal})));owner.stdout.resume();owner.stderr.resume();pids.push(owner.pid);
  try{await until(()=>fs.existsSync(path.join(d,'leaf-pid.json')));track(d);if(kill)assert(owner.kill('SIGKILL'));else{owner.stdout.destroy();await wait(250);owner.stdin.end();}const exit=await done;
   assert.equal(fs.existsSync(command.observationPath),!kill);if(!kill)assert.equal(read(command.observationPath).activeProcessesAfterCleanup,0);refuse(d);evidence.push({directory:d,exit,observationPath:command.observationPath,observationExpected:!kill});
  }finally{if(owner.exitCode===null&&owner.signalCode===null)owner.kill('SIGKILL');}
 }return evidence;
});
const audit=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`@(${[...new Set(pids)].join(',')}) | ForEach-Object { [pscustomobject]@{pid=$_;exists=($null -ne (Get-Process -Id $_ -ErrorAction SilentlyContinue))} } | ConvertTo-Json -Compress`],{windowsHide:true,timeout:5000,encoding:'utf8'}));
const report={recordedAtUtc:new Date().toISOString(),root,elapsedMs:Date.now()-began,results,audit,productionWritten:false,trainingPerformed:false,automaticRecoveryImplemented:false};
fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));assert(report.elapsedMs<180000);assert([audit].flat().every(p=>!p.exists));assert(results.every(r=>r.status==='passed'));
