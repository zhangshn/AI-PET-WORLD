// M004 independent acceptance only; no model inference, native owner or GPU.
// This file is test evidence, never execution source role 257.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import {DatabaseSync} from 'node:sqlite'
import * as review from '../lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs'
import {readCurrentExecutionRegistry,initializeCurrentExecutionRegistry,advanceCurrentExecutionRegistry,recoverExpiredActiveExecutionToFailedClosed} from '../../src/server/ai-painter-current-execution-registry.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex'),parts=[57148,6142,2282,54062],priorBytes=556372,priorStreams=43375
const roots=new Set(),reg='.runtime/ai-painter/current-execution-registry'
function scope(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-painter-review-adoption-004-'));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));roots.add(root);return root}
function put(root,logical,value){assert(roots.has(root));assert(!logical.includes('..'));const file=path.join(root,logical);fs.mkdirSync(path.dirname(file),{recursive:true});const b=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value)+'\n');fs.writeFileSync(file,b,{flag:'wx'});return {path:logical,sha256:sha(b)}}
const json=(root,logical)=>JSON.parse(fs.readFileSync(path.join(root,logical)))

test('M004 exact cumulative budget preserves old debit, internal tail and all byte envelopes',()=>{
 const b=review.independentBudgetFromFacts(parts,priorBytes,priorStreams)
 assert.equal(b.wallDebitMs,119634);assert.equal(b.timeoutMs,180366);assert.equal(b.terminalReserveMs,15000);assert.equal(b.timeoutMs-b.terminalReserveMs,165366)
 assert.equal(b.outputBytes+priorBytes+b.controlReserveBytes,16777216);assert.equal(b.streamBytes+priorStreams+review.OUTER_STREAM_ENVELOPE_BYTES,8388608)
 assert.equal(b.priorByteDebit,556372);assert.equal(b.priorStreamBytes,43375);assert.equal(b.controlReserveBytes,3145728)
 assert.equal(review.INDEPENDENT_LIMITS.maxWallMs,300000);assert.equal(review.INDEPENDENT_LIMITS.cpuThreads,2);assert.equal(review.INDEPENDENT_LIMITS.modelForwardCalls,16);assert.equal(review.INDEPENDENT_LIMITS.optimizerSteps,0);assert.equal(review.INDEPENDENT_LIMITS.automaticRetries,0)
 assert.equal(review.INDEPENDENT_LIMITS.heartbeatTtlSeconds,120);assert.equal(review.INDEPENDENT_LIMITS.heartbeatMaximumIntervalMs,5000)
})
test('M004 incomplete/changed wall and exhausted or unsafe byte facts cannot obtain a budget',async t=>{
 for(const [name,w,d,s]of [
  ['missing previous execution',parts.slice(0,3),priorBytes,priorStreams],['changed cumulative wall',[57148,6142,2282,54061],priorBytes,priorStreams],['negative prior execution',[-1,6142,2282,54062],priorBytes,priorStreams],['fractional debit',[57148.1,6142,2282,54062],priorBytes,priorStreams],['nonfinite debit',[NaN,6142,2282,54062],priorBytes,priorStreams],
  ['prior disk understated',parts,556371,priorStreams],['control envelope exhausted',parts,16777216-review.CONTROL_RESERVE_BYTES,priorStreams],['negative streams',parts,priorBytes,-1],['outer stream envelope exhausted',parts,priorBytes,8388608-review.OUTER_STREAM_ENVELOPE_BYTES],['unsafe bytes',parts,Number.MAX_SAFE_INTEGER+1,priorStreams]
 ])await t.test(name,()=>assert.throws(()=>review.independentBudgetFromFacts(w,d,s)))
})
test('M004 heartbeat refreshes over180s without extending TTL and refuses late or reversed monotonic time',()=>{
 let at=0;const hb=review.createIndependentHeartbeat({now:()=>at});assert.equal(hb.due(),true);hb.committed();assert.equal(hb.last(),0)
 at=999;assert.equal(hb.due(),false)
 for(at=1000;at<=180000;at+=1000){assert.equal(hb.due(),true);hb.committed();assert.equal(hb.last(),at)}
 at=185000;assert.equal(hb.due(),true);at=185001;assert.throws(()=>hb.due(),/refresh late/)
 let otherAt=0;const other=review.createIndependentHeartbeat({now:()=>otherAt});other.committed();otherAt=-1;assert.throws(()=>other.due())
 otherAt=NaN;assert.throws(()=>other.due());assert.equal(review.INDEPENDENT_LIMITS.heartbeatTtlSeconds,120)
 let committedAt=0;const commit=review.createIndependentHeartbeat({now:()=>committedAt});commit.committed();committedAt=5001;assert.throws(()=>commit.committed(),/refresh late/);committedAt=-1;assert.throws(()=>commit.committed(),/refresh late/)
})
test('M004 independent namespace is fixed and cannot select old recovery or arbitrary output',()=>{
 const id='11111111-2222-4333-8444-555555555555';assert.equal(review.independentOutputRoot(id),review.INDEPENDENT_CASE+'/review-'+id)
 for(const bad of ['../foreign','/tmp/foreign','C:/foreign','review-v2-'+id,'11111111-2222-4333-8444-55555555555X'])assert.throws(()=>review.independentOutputRoot(bad))
})
test('M004 actual bound previous files, native receipts, events and SQLite are remeasured read-only',()=>{
 const before=sha(fs.readFileSync(reg+'/current.json')),ledger=review.measureIndependentPrior(process.cwd())
 assert.equal(ledger.wallDebitMs,119634);assert.equal(ledger.budget.timeoutMs,180366);assert.equal(ledger.budget.priorByteDebit,556372);assert.equal(ledger.accounting.actualModelForwardCalls,null)
 assert.equal(sha(fs.readFileSync(reg+'/current.json')),before)
})
function priorShadow(){
 const root=scope(),audit=JSON.parse(fs.readFileSync('.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022/m-043759/prior-ledger-independent-audit.json','utf8'))
 const paths=new Set([...audit.evidence.map(row=>row.path),...Object.values(review.PRELAUNCH_BINDINGS).map(row=>row.path),...['single-recovery-command-result.json','single-recovery-command.stdout.log','single-recovery-command.stderr.log'].map(name=>review.HISTORY_ROOT+'/'+name),review.INDEPENDENT_POLICY.path,reg+'/registry.sqlite'])
 for(const logical of paths)put(root,logical,fs.readFileSync(logical))
 return {root,audit}
}
test('M004 prior measurement rejects added/missing/tampered files, event rows, SQLite identity and policy changes',async t=>{
 for(const [name,mutate,error]of [
  ['changed bound phase file',f=>{const p=f.audit.evidence.find(r=>r.path.endsWith('/heartbeat.json')).path;fs.appendFileSync(path.join(f.root,p),'changed')},/fixture SHA conflict/],
  ['missing prior file',f=>{const p=f.audit.evidence.find(r=>r.path.endsWith('/heartbeat.json')).path;fs.unlinkSync(path.join(f.root,p))},/prior output set changed|heartbeat\.json/],
  ['unregistered old output',f=>{const p=path.posix.dirname(f.audit.evidence.find(r=>r.path.endsWith('/heartbeat.json')).path);put(f.root,p+'/unexpected.json',{})},/prior output set changed/],
  ['changed bound policy',f=>fs.appendFileSync(path.join(f.root,review.INDEPENDENT_POLICY.path),'changed'),/fixture SHA conflict/],
  ['changed registry event binding',f=>{const p=path.join(f.root,reg,'events.jsonl'),data=fs.readFileSync(p,'utf8').split('\n').map(line=>{if(!line.trim())return line;const v=JSON.parse(line);return v.registryRevision===504?JSON.stringify({...v,currentSha256:'a'.repeat(64)}):line}).join('\n');fs.writeFileSync(p,data)},/Expected values|a{64}/],
  ['changed SQLite identity',f=>{const db=new DatabaseSync(path.join(f.root,reg,'registry.sqlite'));try{db.exec("UPDATE registry_revisions SET current_sha256='"+'b'.repeat(64)+"' WHERE registry_revision=504")}finally{db.close()}},/current_sha256/]
 ])await t.test(name,()=>{const f=priorShadow();mutate(f);const isolated=moduleFixture(f.root);const result=isolated.run(['--input-type=module','-e',`const m=await import(${JSON.stringify(isolated.driverUrl)});try{m.measureIndependentPrior(process.cwd());process.exitCode=9}catch(error){process.stdout.write(error.message)}`]);assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stdout,/configured project root required/);assert.match(result.stdout,error)})
 const valid=priorShadow(),isolated=moduleFixture(valid.root),result=isolated.run(['--input-type=module','-e',`const m=await import(${JSON.stringify(isolated.driverUrl)});process.stdout.write(String(m.measureIndependentPrior(process.cwd()).budget.priorByteDebit))`]);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'556372')
})

// Reuse only our existing private registry fixture declaration. Importing the
// old test file would register unrelated M002/M003 tests, so select that helper
// through its parsed declaration, never any production function or test body.
let fixtureModule
async function baseRegistry(){
 if(!fixtureModule){
  const file=new URL('./ai-painter-review-prelaunch-closeout-cpu.test.mjs',import.meta.url),source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='registryFixture');assert(fn)
  const official=pathToFileURL(path.resolve('src/server/ai-painter-current-execution-registry.mjs')).href,identity=pathToFileURL(path.resolve('scripts/run-ai-painter-mvp256-dry-v24-training.mjs')).href
  const code=`import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{initializeCurrentExecutionRegistry,advanceCurrentExecutionRegistry}from${JSON.stringify(official)};import{processIdentity}from${JSON.stringify(identity)};const sha=b=>createHash('sha256').update(b).digest('hex'),selfIdentity=processIdentity(process.pid),fixtureRoots=[];function scope(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-painter-review-adoption-004-base-'));fixtureRoots.push(root);return root}const read=(r,p)=>fs.readFileSync(path.join(r,p)),json=(r,p)=>JSON.parse(read(r,p));function write(root,p,v){assert(fixtureRoots.includes(root));const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));return{path:p,sha256:sha(read(root,p))}}export ${fn.getText(ast)}`
  fixtureModule=import('data:text/javascript,'+encodeURIComponent(code))
 }
 const fixture=await(await fixtureModule).registryFixture();roots.add(fixture.root);const closed=await recoverExpiredActiveExecutionToFailedClosed(fixture.options);return {...fixture,closed}
}

const driverPath='scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs',nativePath='scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'
function replaceBodies(source,replacements){
 const ast=ts.createSourceFile('review.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),edits=[]
 for(const n of ast.statements)if(ts.isFunctionDeclaration(n)&&Object.hasOwn(replacements,n.name?.text)){assert(n.body);edits.push([n.body.getStart(ast),n.body.end,'{'+replacements[n.name.text](n.body.getText(ast).slice(1,-1))+'}'])}
 assert.equal(edits.length,Object.keys(replacements).length)
 for(const [from,to,value]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,from)+value+source.slice(to)
 return source
}
function moduleFixture(root,{metadata=false,guardAppears=false,nativePreparation=false,compilePulse=false,setupGap=false,lateGap=false,asyncRegistrationGap=false,controlFault=null,extraLoaders=[]}={}){
 const rawDriver=fs.readFileSync(driverPath,'utf8'),rawNative=fs.readFileSync(nativePath,'utf8');let adapted=rawDriver
 if(metadata)adapted=replaceBodies(rawDriver,{
  measureIndependentPrior:()=>"return globalThis.__m004MeasurePrior()",
  loadReviewRecovery:body=>{
   const start=body.indexOf(' const pkg=json(root,plan.sourceExecutionPackage)'),end=body.indexOf(' assert.deepEqual(plan.priorBindings,PRELAUNCH_BINDINGS)');assert(start>0&&end>start)
   const gap=`if(++globalThis.__m004LoadCount>1){${setupGap?'for(let i=0;i<6;i++){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);pulse()}':''}${lateGap?'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5100);pulse()':''}}`
   return body.slice(0,start)+`const terminal=json(root,plan.sourceWorkerTerminal),failure=json(root,plan.sourceReviewFailure),prior=json(root,plan.priorReviewReceipt),ledger=measureIndependentPrior(root),budget=ledger.budget;${gap}pulse();`+body.slice(end)
  },
  recoveryNativeContext:body=>`const actual=(()=>{${body}})();fs.writeFileSync(path.join(root,'m004-native-boundary.json'),JSON.stringify({planBinding,deadline:actual.deadline,workDeadline:actual.workDeadline,budget:actual.budget,plan:actual.plan,now:Date.now()}));${guardAppears?"fs.mkdirSync(path.join(root,'.runtime/ai-painter/owned-worker-guards'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json'),'unknown-owner-kept');":''}${controlFault==='missing-heartbeat'?"fs.unlinkSync(inside(root,independentHeartbeatPath(actual.plan)));":controlFault==='overflow-registry'?"fs.appendFileSync(inside(root,REGISTRY_ROOT+'/events.jsonl'),' '.repeat(CONTROL_RESERVE_BYTES));":''}${nativePreparation||compilePulse?'return actual;':"throw Error('m004_fixed_preowner_refusal')"}`
 })
 if(compilePulse){const before='onHeartbeat:observation=>{try{beat(observation)}';assert(adapted.includes(before));adapted=adapted.replace(before,"onHeartbeat:observation=>{fs.appendFileSync(path.join(root,'m004-compile-pulses.jsonl'),JSON.stringify({stage:globalThis.__m004CompileStage??'before',at:Date.now()})+'\\n');try{beat(observation)}")}
 put(root,driverPath,adapted);put(root,nativePath,rawNative)
 const accountUrl=pathToFileURL(path.resolve('scripts/lib/ai-painter-decode1-entry-weight-output-accounting-v1.mjs')).href
 const chain=`import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{write as actualWrite,directoryBytes,withOutputBudget}from${JSON.stringify(accountUrl)};export{directoryBytes,withOutputBudget};export const sha=b=>createHash('sha256').update(b).digest('hex'),inside=(r,p)=>{assert(typeof p==='string'&&!path.isAbsolute(p)&&!p.includes('..')&&!p.includes('\\\\'));const f=path.resolve(r,p);assert(f.startsWith(path.resolve(r)+path.sep));return f},read=(r,b)=>{const f=inside(r,b.path),s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);const raw=fs.readFileSync(f);assert.equal(sha(raw),b.sha256,'fixture SHA conflict');return raw},json=(r,b)=>JSON.parse(read(r,b)),bind=(r,p)=>({path:p,sha256:sha(fs.readFileSync(inside(r,p)))}),write=(r,p,v)=>{const result=actualWrite(r,p,v);if(p.includes('/control-heartbeat/'))fs.appendFileSync(path.join(r,'m004-heartbeat-observations.jsonl'),JSON.stringify({path:p,value:v,at:Date.now(),bytes:fs.statSync(inside(r,p)).size})+'\\n');return result},ROLES={reviewDriver:${JSON.stringify(driverPath)}};export const loadContext=()=>{throw Error('unexpected model context')},runtimeIdentity=()=>({}),validateCompleted=()=>{},validatePlan=()=>{},executionRoute=()=>null,requiredProgramRoles=()=>[],sourceFileCountMaximum=256,gpuAdmissionSeconds=()=>0,finalProgramBindings=()=>({}),deriveConfiguration=()=>({});`
 put(root,'m004-chain.mjs',compilePulse?chain.replace('executionRoute=()=>null',"executionRoute=()=>({CAPABILITY:'stage4_mvp256_dry_decode1_registered_source_v1'})"):chain)
 const modules={}
 for(const source of [rawDriver,rawNative]){
  const ast=ts.createSourceFile('source.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
  for(const n of ast.statements){if(!ts.isImportDeclaration(n))continue;const name=n.moduleSpecifier.text;if(name.startsWith('node:')||modules[name])continue
   if(name.endsWith('package-chain-v1.mjs')){modules[name]='chain';continue}
   if(name.endsWith('ai-painter-current-execution-registry.mjs')){const url=JSON.stringify(pathToFileURL(path.resolve('src/server/ai-painter-current-execution-registry.mjs')).href);modules[name]=`export*from${url};`+(asyncRegistrationGap?`import*as actual from${url};let n=0;export const prepareCurrentExecutionRegistryAdvance=async(...args)=>{if(n++===0)await new Promise(resolve=>setTimeout(resolve,6000));return actual.prepareCurrentExecutionRegistryAdvance(...args)};`:'');continue}
   if(name.endsWith('run-ai-painter-learning-capacity-experiment.mjs')){modules[name]=`export{replaceHeartbeatFile}from${JSON.stringify(pathToFileURL(path.resolve('scripts/run-ai-painter-learning-capacity-experiment.mjs')).href)};`;continue}
   const names=n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)?n.importClause.namedBindings.elements.map(e=>e.propertyName?.text??e.name.text):[]
   let code=n.importClause?.name?'export default{concurrency(){}};':''
   for(const item of names){let value=item==='processIdentity'?'pid=>pid+":"+globalThis.__m004CreatedAt':'()=>{throw Error("m004_unknown_native_preparation_'+item+'")}';if(compilePulse&&item==='nativeOwnerSourceIdentity')value="()=>({schema:'private_compiler_metadata'})";if(compilePulse&&item==='nativeBuildFailureObservation')value='()=>null';if(compilePulse&&item==='createNativeOwnerCommand')value=`(...args)=>{globalThis.__m004CompileStage='during';Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1200);globalThis.__m004CompileStage='after';return{get nativeBuild(){throw Error('m004_post_compile_metadata_refusal')}}}`;code+='export const '+item+'='+value+';'}
   modules[name]=code
  }
 }
 const driverUrl=pathToFileURL(path.join(root,driverPath)).href,nativeUrl=pathToFileURL(path.join(root,nativePath)).href
 put(root,'m004-loader.mjs',`import path from'node:path';import{pathToFileURL}from'node:url';const root=${JSON.stringify(root)},driver=${JSON.stringify(driverUrl)},native=${JSON.stringify(nativeUrl)},modules=${JSON.stringify(modules)};export async function resolve(s,c,next){if(c.parentURL===driver||c.parentURL===native){if(s.endsWith('weight-quality-review-v1.mjs'))return{url:driver,shortCircuit:true};if(s.endsWith('weight-quality-owned-native-v1.mjs'))return{url:native,shortCircuit:true};if(modules[s])return{url:modules[s]==='chain'?pathToFileURL(path.join(root,'m004-chain.mjs')).href:'data:text/javascript,'+encodeURIComponent(modules[s]),shortCircuit:true};if(s==='node:child_process')return{url:'data:text/javascript,'+encodeURIComponent('export const spawn=()=>{throw Error("FORBIDDEN_NATIVE_OWNER")},spawnSync=()=>{throw Error("FORBIDDEN_MODEL")};'),shortCircuit:true}}return next(s,c)}`)
 let count=0
 const loaderUrl=pathToFileURL(path.join(root,'m004-loader.mjs')).href
 const run=args=>{const all=[...extraLoaders.flatMap(url=>['--experimental-loader',url]),'--experimental-loader',loaderUrl,...(metadata?['--import',pathToFileURL(path.join(root,'m004-preload.mjs')).href]:[]),...args],result=spawnSync(process.execPath,all,{cwd:root,encoding:'utf8',timeout:25000,maxBuffer:128*1024,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}});put(root,'m004-process-'+(++count)+'.json',{args,exitCode:result.status,errorCode:result.error?.code??null,stdout:result.stdout,stderr:result.stderr,actualSource:{driver:sha(Buffer.from(rawDriver)),native:sha(Buffer.from(rawNative))}});return result}
 return {root,driverUrl,nativeUrl,loaderUrl,run,actualSource:{driver:sha(Buffer.from(rawDriver)),native:sha(Buffer.from(rawNative))}}
}

async function cliFixture(mode={}){
 const seeded=await baseRegistry(),root=seeded.root,old=priorShadow(),oldModule=moduleFixture(old.root)
 const fixture=moduleFixture(root,{metadata:true,...mode,extraLoaders:[oldModule.loaderUrl]})
 const runId='d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8',capabilityVersion='stage4_mvp256_dry_decode1_registered_source_v1'
 const original={runId,packageId:'d1-src-v1-package-850c25f8-8181-446e-99da-3dae2dbb21a8',capabilityVersion,outputRoot:'.runtime/fixture/original',programBindings:{reviewDriver:{path:driverPath},nativeRunner:{path:nativePath}},runtimeIdentity:{node:{absolutePath:process.execPath}}}
 const plan=put(root,original.outputRoot+'/quality-plan.json',original),pkg=put(root,'.runtime/fixture/package.json',{inputEvidence:[plan]})
 const worker=put(root,original.outputRoot+'/worker-terminal.json',{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',status:'post_decode_object_rgb_stage0_real_visual_failure',runId,executionPackage:pkg,selectedCheckpointRecord:{checkpoint:{path:'.runtime/fixture/selected.pt',sha256:'a'.repeat(64)}}})
 const prev=json(process.cwd(),review.PRELAUNCH_BINDINGS.plan.path),failure=json(process.cwd(),prev.sourceReviewFailure.path),account=json(process.cwd(),review.PRIOR_ACCOUNTING.path)
 for(const logical of new Set([review.PRELAUNCH_BINDINGS.plan.path,prev.sourceReviewFailure.path,failure.nativeOwnedReceipt.path,review.PRIOR_ACCOUNTING.path,account.newFailure.path,review.HISTORY_ROOT+'/all-original-source-preservation.json','docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md','docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md']))put(root,logical,fs.readFileSync(logical))
 const capsule=put(root,'.runtime/fixture/m004-seed-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},evidence:[{...account.newFailure,kind:'fixture_closed_source',sha256Verified:true}]})
 const head=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion,packageId:original.packageId,runId,taskId:'m004-private-fixture-seed',taskKind:'private_fixture_review',lifecycleStage:'review',executionState:'failed_closed',activity:'review_execution_failed_closed',taskCapsulePath:capsule.path,terminalEvidencePath:account.newFailure.path,latestTrainingTerminal:{runId,...worker,status:'post_decode_object_rgb_stage0_real_visual_failure',evidence:{}},activeExecution:null,expectedPreviousRegistryRevision:seeded.closed.registry.registryRevision,expectedPreviousRegistrySha256:seeded.closed.registrySha256,_testHooks:{currentProcessIdentity:'private-cli-setup'}})
 const acceptance=put(root,'.runtime/fixture/cpu.json',{status:'passed',modelForwards:0})
 put(root,'m004-preload.mjs',`import{spawnSync}from'node:child_process';const r=spawnSync('powershell.exe',['-NoProfile','-Command',"$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+process.pid+"';$p.CreationDate.ToUniversalTime().ToString('o')"],{encoding:'utf8',windowsHide:true,timeout:5000});if(r.status!==0)throw Error('m004_process_identity_unavailable');globalThis.__m004CreatedAt=r.stdout.trim();globalThis.__m004LoadCount=0;const old=await import(${JSON.stringify(oldModule.driverUrl)});globalThis.__m004MeasurePrior=()=>old.measureIndependentPrior(${JSON.stringify(old.root)});`)
 return {...fixture,acceptance,head,oldRoot:old.root,runCli:()=>fixture.run([driverPath,'--independent-review-once',acceptance.path,acceptance.sha256])}
}
function boundary(f){const record=json(f.root,'m004-native-boundary.json'),p=record.plan;assert.equal(record.workDeadline,p.startedAtUnixMs+180366-15000);assert.equal(record.deadline-1000,record.workDeadline);assert.equal(p.startedAtUnixMs,Date.parse(p.processStartIdentity.slice(p.processStartIdentity.indexOf(':')+1)));assert.equal(record.budget.outputBytes,13075116);assert.equal(record.budget.streamBytes,8279697);assert.equal(record.budget.terminalReserveMs,15000);assert(record.deadline-record.now<=166366);return record}
function heartbeats(f,record){const file=path.join(f.root,'m004-heartbeat-observations.jsonl'),rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);assert(rows.length>=1);for(const row of rows){assert.equal(row.value.ttlSeconds,120);assert.equal(row.value.executionState,'reviewing');for(const key of ['runId','packageId','capabilityVersion','processId','processStartIdentity'])assert.equal(row.value[key],record.plan[key]);assert(row.path.startsWith(review.INDEPENDENT_CASE+'/control-heartbeat/'));assert(!row.path.startsWith(record.plan.outputRoot+'/'));assert(row.bytes<4096)}const unique=rows.filter(r=>!r.path.includes('.staged-'));assert.equal(unique.length,0);for(let i=1;i<rows.length;i++)assert(rows[i].at-rows[i-1].at<=5000);return rows}

test('M004 real CLI self-import/WeakMap archives pre-owner refusal and official prepare/finalize closes only private activity',async()=>{
 const f=await cliFixture(),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/m004_fixed_preowner_refusal/);assert.doesNotMatch(r.stderr,/FORBIDDEN_|unsettled top-level await|secondary evidence/)
 const rec=boundary(f),rows=heartbeats(f,rec),head=await readCurrentExecutionRegistry(f.root);assert.equal(head.ok,true,head.errorCode);assert.equal(head.registry.registryRevision,f.head.registry.registryRevision+2);assert.equal(head.registry.executionState,'failed_closed');assert.equal(head.registry.activeExecution,null);assert.deepEqual(head.registry.latestTrainingTerminal,f.head.registry.latestTrainingTerminal);assert.equal(head.currentTaskTerminal.nativeNotLaunched,true);assert.equal(head.currentTaskTerminal.nativeCleanupCertified,false);assert.equal(head.currentTaskTerminal.nativeReceipt,null);assert.equal(head.currentTaskTerminal.modelForwardCalls,0);assert.equal(head.currentTaskTerminal.prelaunchProof.nativeNotLaunched,true);assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards')),false)
 const db=new DatabaseSync(path.join(f.root,reg,'registry.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) AS n FROM registry_transactions WHERE status=?').get('committed').n,head.registry.registryRevision)}finally{db.close()}
 const once=review.INDEPENDENT_CASE+'/admission/independent-consumed.json',onceHash=sha(fs.readFileSync(path.join(f.root,once))),before=sha(fs.readFileSync(path.join(f.root,reg,'current.json'))),again=f.runCli();assert.equal(again.status,1,again.stderr);assert.equal(sha(fs.readFileSync(path.join(f.root,once))),onceHash);assert.equal(sha(fs.readFileSync(path.join(f.root,reg,'current.json'))),before)
 const replay=f.run(['--input-type=module','-e',`const m=await import(${JSON.stringify(f.driverUrl)});try{m.assertFreshRecoveryDirectory(process.cwd(),m.independentOutputRoot('11111111-2222-4333-8444-555555555555'));process.exitCode=9}catch(e){process.stdout.write(e.message)}`]);assert.equal(replay.status,0,replay.stderr);assert.match(replay.stdout,/already consumed/)
 put(f.root,'m004-acceptance.json',{status:'passed',actualSource:f.actualSource,privateRegistryRevision:head.registry.registryRevision,heartbeatObservations:rows.length,boundary:rec,modelForwards:0,nativeOwnerStarted:false});console.log('M004-private-CLI '+f.root)
})

test('M004 actual synchronous metadata pulses cover startup gap without resetting native deadline',async()=>{
 const f=await cliFixture({setupGap:true,asyncRegistrationGap:true}),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/m004_fixed_preowner_refusal/);assert.doesNotMatch(r.stderr,/refresh late|FORBIDDEN_|unsettled top-level await/);const rec=boundary(f),rows=heartbeats(f,rec);assert(rows.length>=13);assert(rec.now-rec.plan.startedAtUnixMs>=12000);const head=await readCurrentExecutionRegistry(f.root);assert.equal(head.registry.activeExecution,null);console.log('M004-private-startup-gap '+f.root)
})

test('M004 unknown guard and native preparation never certify cleanup or clear active',async t=>{
 for(const [name,mode,error]of [['unknown guard',{guardAppears:true},/m004_fixed_preowner_refusal/],['entered native preparation',{nativePreparation:true},/m004_unknown_native_preparation_/]])await t.test(name,async()=>{
  const f=await cliFixture(mode),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,error);assert.doesNotMatch(r.stderr,/FORBIDDEN_|unsettled top-level await/);const observed=await readCurrentExecutionRegistry(f.root);assert.equal(observed.ok,false);assert.equal(observed.errorCode,'registry_active_execution_process_not_active');const retained=json(f.root,reg+'/current.json');assert(retained.activeExecution);assert.equal(retained.registryRevision,f.head.registry.registryRevision+1);const claim=json(f.root,review.INDEPENDENT_CASE+'/admission/independent-consumed.json'),plan=json(f.root,claim.plan.path);const failed=json(f.root,plan.outputRoot+'/cleanup-unknown-failure.json');assert.equal(failed.activeExecutionRetained,true);assert.equal(failed.nativeCleanupCertified,false);assert.equal(fs.existsSync(path.join(f.root,plan.outputRoot+'/prelaunch-failure.json')),false);if(mode.guardAppears)assert.equal(fs.readFileSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json'),'utf8'),'unknown-owner-kept');console.log('M004-private-retained '+name+' '+f.root)
 })
})

test('M004 a synchronous pulse after5s fails closed through actual pre-owner proof and does not start owner',async()=>{
 const f=await cliFixture({lateGap:true}),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/refresh late/);assert.doesNotMatch(r.stderr,/FORBIDDEN_|unsettled top-level await/);const head=await readCurrentExecutionRegistry(f.root);assert.equal(head.ok,true);assert.equal(head.registry.activeExecution,null);assert.equal(head.registry.registryRevision,f.head.registry.registryRevision+2);assert.equal(head.currentTaskTerminal.nativeNotLaunched,true);assert.equal(head.currentTaskTerminal.nativeCleanupCertified,false);assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards')),false);console.log('M004-private-late-heartbeat '+f.root)
})

test('M004 actual native call pulses before/after isolated synchronous compiler and keeps unknown cleanup active',async()=>{
 const f=await cliFixture({compilePulse:true}),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/m004_post_compile_metadata_refusal/);assert.doesNotMatch(r.stderr,/FORBIDDEN_|refresh late|unsettled top-level await/);boundary(f);const rows=fs.readFileSync(path.join(f.root,'m004-compile-pulses.jsonl'),'utf8').trim().split('\n').map(JSON.parse),after=rows.findIndex(v=>v.stage==='after');assert(after>0);assert(rows[after].at-rows[after-1].at>=1200);heartbeats(f,json(f.root,'m004-native-boundary.json'));const retained=json(f.root,reg+'/current.json');assert(retained.activeExecution);assert.equal(retained.registryRevision,f.head.registry.registryRevision+1);const claim=json(f.root,review.INDEPENDENT_CASE+'/admission/independent-consumed.json'),plan=json(f.root,claim.plan.path);assert.equal(json(f.root,plan.outputRoot+'/cleanup-unknown-failure.json').nativeCleanupCertified,false);assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json')),false);console.log('M004-private-compile-pulses '+f.root)
})

test('M004 committed heartbeat disappearance and control-plane overflow cannot become zero-byte successful closeout',async t=>{
 for(const [mode,error]of [['missing-heartbeat',/committed heartbeat disappeared/],['overflow-registry',/control-plane output reserve exhausted/]])await t.test(mode,async()=>{
  const f=await cliFixture({controlFault:mode}),r=f.runCli();assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/m004_fixed_preowner_refusal/);assert.match(r.stderr,error);assert.doesNotMatch(r.stderr,/FORBIDDEN_|unsettled top-level await/);const retained=json(f.root,reg+'/current.json');assert(retained.activeExecution);assert.equal(retained.registryRevision,f.head.registry.registryRevision+1);assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards')),false);console.log('M004-private-control-refusal '+mode+' '+f.root)
 })
})

test('M004 caller booleans, serialized old receipts and foreign error objects cannot acquire live WeakMap cleanup authority',async()=>{
 const native=await import('../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'),oldPlan=json(process.cwd(),review.PRELAUNCH_BINDINGS.plan.path),old=json(process.cwd(),oldPlan.priorReviewReceipt.path),binding={path:review.INDEPENDENT_CASE+'/review-11111111-2222-4333-8444-555555555555/plan.json',sha256:'a'.repeat(64)}
 for(const error of [Object.assign(Error('caller flag'),{nativeNotLaunched:true,nativeCleanupCertified:true,prelaunchProof:{nativeNotLaunched:true}}),Object.assign(Error('old receipt'),{ownedReceipt:old,receiptBinding:oldPlan.priorReviewReceipt}),Object.assign(Error('copied old receipt'),{ownedReceipt:JSON.parse(JSON.stringify(old))})]){assert.equal(native.verifiedPrelaunchFailure(error,process.cwd(),binding),null);assert.equal(native.cleanupForCurrentCall(error,old),false)}
})

test('M004 old flags and partial/foreign directories are refused before any independent admission',async()=>{
 const root=scope(),f=moduleFixture(root),once=review.INDEPENDENT_CASE+'/admission/independent-consumed.json'
 for(const flag of ['--recover-once','--recover-child']){const r=f.run([driverPath,flag,'old.json','a'.repeat(64)]);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/consumed predecessor/);assert.equal(fs.existsSync(path.join(root,once)),false)}
 const id='11111111-2222-4333-8444-555555555555',output=review.independentOutputRoot(id);put(root,output+'/partial.json',{})
 const r=f.run(['--input-type=module','-e',`const m=await import(${JSON.stringify(f.driverUrl)});try{m.assertFreshRecoveryDirectory(process.cwd(),${JSON.stringify(output)});process.exitCode=9}catch(e){process.stdout.write(e.message)}`]);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/recovery already prepared or consumed/);assert.equal(fs.existsSync(path.join(root,once)),false)
})

test('M004 acceptance binds exact v4 four-source freeze and unchanged remaining252 execution roles',()=>{
 const frozen=json(process.cwd(),review.INDEPENDENT_CASE+'/source-freeze-v4.json');assert.equal(frozen.sourceCount,256);assert.equal(Object.keys(frozen.programBindings).length,256);assert.equal(sha(fs.readFileSync(review.INDEPENDENT_CASE+'/source-freeze-v4.json')),'b4606a7c79bd45bfa756b5f3a136a12995a777e6004b802981e0a2eefbdcb82d')
 const old=json(process.cwd(),review.PRELAUNCH_BINDINGS.plan.path),original=json(process.cwd(),old.sourceTrainingPlan.path),changed=[]
 for(const [role,b]of Object.entries(frozen.programBindings)){assert.equal(sha(fs.readFileSync(b.path)),b.sha256);assert.equal(b.path,original.programBindings[role].path);if(b.sha256!==original.programBindings[role].sha256)changed.push(role)}assert.deepEqual(changed.sort(),['executionAuth','nativeRunner','reviewDriver','reviewWorker']);assert(!Object.values(frozen.programBindings).some(b=>b.path.endsWith('ai-painter-independent-review-adoption-004-cpu.test.mjs')))
})

test('M004 Python verified-history reader accepts real atomic heartbeat replacement without freezing mutable bytes',()=>{
 const root=scope(),script=String.raw`
import sys,json,hashlib,os,shutil,subprocess,contextlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
source,private,node=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
sys.path[:0]=[str(source/'ml/ai-painter/scripts'),str(source/'ml/ai-painter/src')]
import decode1_entry_weight_quality_auth_v1 as auth
copied=set()
def copy(logical):
    if logical in copied:return
    target=private/logical;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((source/logical).read_bytes());copied.add(logical)
cpu=source/auth._REVIEW_CASE/'cpu-history-context-5c76f88e81089a6a0ec9bf3cb108ad002b0b813feb495e499efe702da098afd8.json'
plan=json.loads(cpu.read_bytes());identity='11111111-2222-4333-8444-555555555555'
output=auth._INDEPENDENT_CASE+'/review-'+identity
plan['outputRoot']=output
for key in ['sourceExecutionPackage','sourceTrainingPlan','sourcePreservation']:copy(plan[key]['path'])
preservation=json.loads((source/plan['sourcePreservation']['path']).read_bytes())
for row in preservation['entries']:
    if row['role'] in {'executionAuth','reviewWorker','nativeRunner','reviewDriver'}:copy(row['snapshotPath'])
for logical,digest,snapshot,current in auth._REVIEW_NORMALS:copy(logical);copy(snapshot)
for b in plan['programBindings'].values():copy(b['path'])
raw=json.dumps(plan).encode();logical=output+'/plan.json';target=private/logical;target.parent.mkdir(parents=True);target.write_bytes(raw)
binding={'path':logical,'sha256':hashlib.sha256(raw).hexdigest()}
class PrivateMap:
    physical_runtime=private/'.runtime'
    def check(self):
        assert self.physical_runtime.is_dir() and not self.physical_runtime.is_symlink()
    def path(self,logical):
        assert type(logical) is str and not Path(logical).is_absolute() and '..' not in logical.split('/')
        p=private/logical;assert p.is_relative_to(private);return p
    def binding(self,b,maximum):
        p=self.path(b['path']);s=p.lstat();assert p.is_file() and not p.is_symlink() and s.st_nlink==1 and s.st_size<=maximum
        raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==b['sha256'];return raw
mapping=PrivateMap()
with patch.object(auth.RuntimeMap,'current',side_effect=lambda root: mapping if Path(root)==private else (_ for _ in ()).throw(AssertionError('wrong fixture root'))):
    history=auth.verified_review_history(private,binding)
    reader=auth.Reader(private,review_history=history)
    heart=auth._INDEPENDENT_CASE+'/control-heartbeat/'+identity+'/heartbeat.json'
    path=private/heart;path.parent.mkdir(parents=True)
    scope={'runId':plan['runId'],'packageId':json.loads((source/plan['sourceTrainingPlan']['path']).read_bytes())['packageId'],'capabilityVersion':plan['capabilityVersion'],'outputRoot':output}
    expected={**{k:scope[k] for k in ['runId','packageId','capabilityVersion']},'processId':42,'processStartIdentity':'42:private-creation'}
    def value(**changes):return {'schemaVersion':'ai-painter-current-active-execution-heartbeat-v1',**expected,'executionState':'reviewing','ttlSeconds':120,'heartbeatAtUtc':datetime.now(timezone.utc).isoformat(),**changes}
    path.write_text(json.dumps(value()),encoding='utf8')
    first,first_binding=auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=history)
    staged=path.with_name('next.json');staged.write_text(json.dumps(value()),encoding='utf8')
    helper=(source/'scripts/run-ai-painter-learning-capacity-experiment.mjs').as_uri()
    command='const{replaceHeartbeatFile}=await import('+json.dumps(helper)+');replaceHeartbeatFile('+json.dumps(str(staged))+','+json.dumps(str(path))+');'
    replaced=subprocess.run([node,'--input-type=module','-e',command],capture_output=True,text=True,timeout=10)
    assert replaced.returncode==0,replaced.stderr
    second,second_binding=auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=history)
    assert first_binding!=second_binding and heart not in reader.observed
    # Deterministically schedule one ordinary replacement after a real Windows
    # shared-delete handle read. Actual bounded retry and identity checks run.
    original_open=auth._open_heartbeat_handle;replacements=[]
    staged.write_text(json.dumps(value()),encoding='utf8')
    @contextlib.contextmanager
    def replacing(p):
        with original_open(p) as handle:yield handle
        if not replacements:os.replace(staged,path);replacements.append(True)
    with patch.object(auth,'_open_heartbeat_handle',replacing):
        third,third_binding=auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=history)
    assert replacements==[True] and third_binding['sha256']==hashlib.sha256(third).hexdigest()
    assert heart not in reader.observed
    reader.unchanged()
    failures=[]
    for label,changes in [('stale',{'heartbeatAtUtc':(datetime.now(timezone.utc)-timedelta(seconds=6)).isoformat()}),('foreign-pid',{'processId':43}),('foreign-creation',{'processStartIdentity':'42:reused'}),('ttl-inflation',{'ttlSeconds':300})]:
        path.write_text(json.dumps(value(**changes)),encoding='utf8')
        try:auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=history)
        except ValueError:failures.append(label)
        else:raise AssertionError(label+' accepted')
    path.unlink()
    try:auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=history)
    except FileNotFoundError:failures.append('missing')
    else:raise AssertionError('missing heartbeat accepted')
    try:auth._snapshot_heartbeat(reader,heart,scope,expected,review_history=object())
    except ValueError:failures.append('unverified-context')
    else:raise AssertionError('unverified context accepted')
    assert len(failures)==6
    print(json.dumps({'status':'passed','actualAuthSha256':hashlib.sha256(Path(auth.__file__).read_bytes()).hexdigest(),'snapshotVersions':3,'observedMutableBytes':False,'realWindowsSharedHandle':True,'realJsAtomicReplace':True,'failuresRejected':failures,'copiedFiles':len(copied),'modelForwards':0}))
`
 const result=spawnSync(path.resolve('ml/ai-painter/.venv/Scripts/python.exe'),['-B','-c',script,process.cwd(),root,process.execPath],{cwd:process.cwd(),encoding:'utf8',timeout:30000,maxBuffer:128*1024,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}})
 put(root,'m004-python-heartbeat.json',{status:result.status,errorCode:result.error?.code??null,stdout:result.stdout,stderr:result.stderr});assert.equal(result.status,0,result.stderr);const resultLine=result.stdout.trim().split('\n').at(-1),record=JSON.parse(resultLine);assert.equal(record.status,'passed');assert.equal(record.actualAuthSha256,'9a0a4fc577f56bdabdea19225ac052d612bf5dc59b28a386c298e7833864fc29');assert.equal(record.modelForwards,0);console.log('M004-private-Python-heartbeat '+root)
})
