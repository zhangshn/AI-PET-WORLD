import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { runOwnedWorker } from '../lib/ai-painter-owned-worker-v1.mjs';
import { createNativeOwnerCommand, nativeOwnerSourceIdentity } from '../lib/ai-painter-owned-worker-native-v1.mjs';
const base=path.resolve('.runtime/m-c4-01');fs.mkdirSync(base,{recursive:true});
assert.equal(fs.realpathSync(base),path.join(fs.realpathSync(path.resolve('.runtime')),'m-c4-01'),'owned fixture must remain below resolved runtime without extra redirection');
const root=fs.mkdtempSync(path.join(base,'owned-')),results=[],identities=[];
const fixture=path.resolve('scripts/fixtures/ai-painter-owned-worker.mjs');
const source=fs.readFileSync(path.resolve('scripts/lib/ai-painter-owned-worker-v1.mjs'),'utf8');
const started=Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
async function check(name,fn){if(process.argv.includes('--evidence-only')&&!name.endsWith('started'))return;const t=Date.now();try{const evidence=await fn();assert.ok(Date.now()-t<30000);results.push({name,status:'passed',elapsedMs:Date.now()-t,evidence});}catch(e){results.push({name,status:'failed',elapsedMs:Date.now()-t,error:String(e.stack),receipt:e.ownedReceipt});}}
function folder(name){const f=path.join(root,name);fs.mkdirSync(f);return f;}
async function run(mode,options={}){try{const v=await runOwnedWorker(process.execPath,[fixture,mode,root],{cwd:root,env:{...process.env,UV_THREADPOOL_SIZE:'2'},timeout:6000,...options});identities.push(v.ownedReceipt);return v;}catch(e){if(e.ownedReceipt)identities.push(e.ownedReceipt);throw e;}}
for(const failure of ['false','throw','started'])await check('synthetic bounded unknown cleanup '+failure,async()=>{
  let now=0,kills=0,abortCount=0;const timers=[],intervals=[];
  class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
  const stream=()=>Object.assign(new EventEmitter(),{destroyed:false,destroy(){this.destroyed=true;},write(){}});
  const child=Object.assign(new EventEmitter(),{pid:123,stdin:stream(),stdout:stream(),stderr:stream(),unref(){},kill(){kills++;if(failure==='throw')throw Object.assign(new Error('synthetic refusal'),{code:'EPERM'});return false;}});
  const fn=source.slice(source.indexOf('export function runOwnedWorker')).replace('export function','function');
  const faultFs={...fs,writeFileSync(file,...args){if(failure==='started'&&String(file).endsWith('-started.json'))throw Object.assign(new Error('synthetic started evidence ENOSPC'),{code:'ENOSPC'});return fs.writeFileSync(file,...args);}};
  const isolated=runInNewContext(fn+';runOwnedWorker',{assert,Buffer,crypto,fs:faultFs,path,SELF:path.resolve('scripts/lib/ai-painter-owned-worker-v1.mjs'),Date:Clock,process:{platform:'win32',pid:123},spawn:()=>child,
    nativeOwnerSourceIdentity:()=>({path:'synthetic',sha256:'a'.repeat(64)}),createNativeOwnerCommand:()=>({executable:'synthetic-owner',args:[]}),setInterval:fn=>{intervals.push(fn);return 1;},clearInterval(){},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){}});
  const vmRoot=folder('vm-'+failure);
  const pending=isolated(process.execPath,[],{cwd:vmRoot,env:{},timeout:3000,abortReason:()=>++abortCount===1?'first external reason':'later reason'}).catch(e=>e);
  now=500;intervals[0]();now=1000;intervals[0]();for(const timer of timers.sort((a,b)=>a.ms-b.ms)){now=timer.ms;timer.fn();}
  const error=await pending;assert.equal(kills,1);assert.equal(error.ownedReceipt.firstStop.reason,failure==='started'?'started_evidence: synthetic started evidence ENOSPC':'first external reason');
  assert.equal(error.ownedReceipt.cleanupConfirmed,false);assert.equal(error.ownedReceipt.ownerClosed,false);assert.equal(error.code,failure==='started'?'OWNED_START_EVIDENCE_ERROR':'ABORT_ERR');
  assert.equal(error.ownedReceipt.termination.sent,false);if(failure==='throw')assert.equal(error.ownedReceipt.termination.error.code,'EPERM');
  assert(fs.existsSync(error.ownedReceipt.guard.path));
  if(failure==='started'){assert.equal(timers.length,2);assert.equal(intervals.length,1);assert(fs.existsSync(error.ownedReceipt.guard.terminalEvidence));assert(error.ownedReceipt.protocolError.includes('ENOSPC'));}
  assert.throws(()=>isolated(process.execPath,[],{cwd:vmRoot,env:{},timeout:3000}),e=>e.code==='OWNED_GUARD_BUSY');
  return {synthetic:true,noRealCloseEmitted:true,receipt:error.ownedReceipt};
});
await check('native JSON stdout and separate stderr',async()=>{const v=await run('json');assert.equal(JSON.parse(v.stdout).text,'原始JSON');assert.equal(v.stderr,'diagnostic stderr\n');assert(v.ownedReceipt.cleanupConfirmed);assert.equal(fs.existsSync(v.ownedReceipt.guard.path),false);const second=await run('json');assert(second.ownedReceipt.cleanupConfirmed);return v.ownedReceipt;});
await check('existing guard refuses before spawn',async()=>{const out=folder('existing-guard'),g=path.join(out,'.runtime/ai-painter/owned-worker-guards');fs.mkdirSync(g,{recursive:true});const file=path.join(g,'active.json');fs.writeFileSync(file,'preserved prior guard');assert.throws(()=>runOwnedWorker(process.execPath,[],{cwd:out,env:process.env,timeout:3000}),e=>e.code==='OWNED_GUARD_BUSY');assert.equal(fs.readFileSync(file,'utf8'),'preserved prior guard');assert.deepEqual(fs.readdirSync(g),['active.json']);return {guard:file};});
await check('native nonzero retains stderr',async()=>{const e=await run('nonzero').catch(e=>e);assert.equal(e.code,7);assert.equal(e.stderr,'failure detail');assert(e.ownedReceipt.cleanupConfirmed);return e.ownedReceipt;});
for(const stream of ['stdout','stderr'])await check('native exact 8MiB '+stream,async()=>{const v=await run('bytes-'+stream);assert.equal(Buffer.byteLength(v[stream]),8*1024*1024);assert(v.ownedReceipt.cleanupConfirmed);return v.ownedReceipt;});
for(const mode of ['bytes-stdout-over','bytes-stderr-over-live'])await check('native maxBuffer '+mode,async()=>{const e=await run(mode).catch(e=>e);assert.equal(e.code,'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');assert(e.ownedReceipt.cleanupConfirmed);return e.ownedReceipt;});
await check('native external abort preserves first reason',async()=>{let n=0;const e=await run('wait',{abortReason:()=>++n===1?'resource first':'later resource'}).catch(e=>e);assert.equal(e.code,'ABORT_ERR');assert.equal(e.message,'resource first');assert(e.ownedReceipt.cleanupConfirmed);return e.ownedReceipt;});
await check('native independent wall timeout',async()=>{const e=await run('wait',{timeout:2500}).catch(e=>e);assert.equal(e.code,'ETIMEDOUT');assert(e.ownedReceipt.cleanupConfirmed);return e.ownedReceipt;});
await check('native PATH executable resolution',async()=>{const r=await runOwnedWorker('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::Out.Write("{}")'],{cwd:root,env:process.env,timeout:5000});assert.deepEqual(JSON.parse(r.stdout),{});identities.push(r.ownedReceipt);return r.ownedReceipt;});
for(const mode of ['normal','timeout'])await check('native stdlib venv '+mode,async()=>{
  const code='import os,sys,subprocess,json,time; c=subprocess.Popen([sys.executable,"-B","-c","import time;time.sleep(20)"]);print(json.dumps({"pid":os.getpid(),"ppid":os.getppid(),"childPid":c.pid,"executable":sys.executable,"baseExecutable":sys._base_executable}),flush=True);time.sleep('+ (mode==='normal'?'0':'20') +')';
  let result;try{result=await runOwnedWorker('F:/ai-pet-world/ml/ai-painter/.venv/Scripts/python.exe',['-B','-c',code],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2'},timeout:4000});assert.equal(mode,'normal');}
  catch(e){assert.equal(mode,'timeout');assert.equal(e.code,'ETIMEDOUT');result={stdout:e.stdout,ownedReceipt:e.ownedReceipt};}
  const python=JSON.parse(result.stdout);assert(result.ownedReceipt.cleanupConfirmed);assert(result.ownedReceipt.proof.totalProcesses>=3);identities.push(result.ownedReceipt);
  const audit=absent([python.pid,python.childPid,result.ownedReceipt.proof.rootPid]);assert([audit].flat().every(v=>!v.exists));return {python,receipt:result.ownedReceipt,processAudit:audit,torchImported:false};
});
async function until(file){const limit=Date.now()+5000;while(!fs.existsSync(file)){assert(Date.now()<limit,'fixture identity timeout');await wait(25);}}
function closed(child){return new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));}
function absent(pids){return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`@(${pids.join(',')}) | ForEach-Object { [pscustomobject]@{pid=$_; exists=($null -ne (Get-Process -Id $_ -ErrorAction SilentlyContinue))} } | ConvertTo-Json -Compress`],{windowsHide:true,encoding:'utf8',timeout:5000}));}
for(const mode of ['tree-zero','tree-nonzero','runner-loss','owner-loss'])await check('native lifetime '+mode,async()=>{
  const out=folder(mode),outsider=spawn(process.execPath,[fixture,'outsider',out],{windowsHide:true,stdio:'ignore'}),outsideDone=closed(outsider);
  let receipt,wrapper,wrapperDone;
  if(mode.startsWith('tree')){
    try{receipt=(await runOwnedWorker(process.execPath,[fixture,mode,out],{cwd:out,env:process.env,timeout:6000})).ownedReceipt;}
    catch(e){assert.equal(mode,'tree-nonzero');assert.equal(e.code,7);receipt=e.ownedReceipt;}
    assert(receipt.cleanupConfirmed);assert(receipt.proof.totalProcesses>=2);identities.push(receipt);
  }else{
    if(mode==='runner-loss')wrapper=spawn(process.execPath,[fixture,'runner',out],{cwd:out,windowsHide:true,stdio:'ignore'});
    else {
      const guard={identity:crypto.randomUUID(),startedEvidence:path.join(out,'started.json'),nativeOwnerSource:nativeOwnerSourceIdentity()};
      const command=createNativeOwnerCommand(process.execPath,[fixture,'tree-wait',out],process.cwd(),Date.now()+8000,1000,guard,JSON.stringify(guard));
      wrapper=spawn(command.executable,command.args,{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      wrapper.stdout.resume();wrapper.stderr.resume();
    }
    wrapperDone=closed(wrapper);await until(path.join(out,'leaf-pid.json'));assert.equal(wrapper.kill('SIGKILL'),true);await wrapperDone;
  }
  await until(path.join(out,'leaf-pid.json'));const r=read(path.join(out,'root-pid.json')),leaf=read(path.join(out,'leaf-pid.json'));
  await wait(3900);assert.equal(fs.existsSync(path.join(out,'leaf-completed')),false);assert.equal((await outsideDone).code,0);assert(fs.existsSync(path.join(out,'outsider-completed')));
  const audit=absent([...new Set([r.pid,leaf.pid,r.ppid,...(wrapper?[wrapper.pid]:[])])]);assert([audit].flat().every(v=>!v.exists));
  if(mode==='runner-loss')assert(fs.existsSync(path.join(out,'.runtime/ai-painter/owned-worker-guards/active.json')));
  return {receipt,root:r,leaf,wrapperPid:wrapper?.pid,outsiderPid:outsider.pid,processAudit:audit};
});
const report={recordedAtUtc:new Date().toISOString(),root,elapsedMs:Date.now()-started,results,identities,syntheticOnly:process.argv.includes('--evidence-only'),productionWritten:false};
assert(report.elapsedMs<180000);fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({root,elapsedMs:report.elapsedMs,results:results.map(({name,status,error})=>({name,status,error}))},null,2));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
