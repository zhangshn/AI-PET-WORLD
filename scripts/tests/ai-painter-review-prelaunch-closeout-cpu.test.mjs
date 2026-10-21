// Independent acceptance only. Never register this file as execution source 257.
// Real closeout/native/model execution is forbidden here; all writes are private.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import {initializeCurrentExecutionRegistry,advanceCurrentExecutionRegistry,readCurrentExecutionRegistry,recoverExpiredActiveExecutionToFailedClosed} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from '../run-ai-painter-mvp256-dry-v24-training.mjs'
import {verifyPrelaunchFailureFacts} from '../lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs'
import {verifiedPrelaunchFailure} from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex'),REG='.runtime/ai-painter/current-execution-registry',selfIdentity=processIdentity(process.pid)
const fixtureRoots=[]
function scope(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-painter-review-prelaunch-'));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fixtureRoots.push(root);return root}
const read=(root,p)=>fs.readFileSync(path.join(root,p)),json=(root,p)=>JSON.parse(read(root,p))
function write(root,p,value){assert(fixtureRoots.includes(root),'private fixture required');const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));return {path:p,sha256:sha(read(root,p))}}
async function registryFixture(){
 const root=scope(),candidate='.runtime/fixture/candidate.json',terminal='.runtime/fixture/initial-terminal.json',capsule='.runtime/fixture/initial-capsule.json',training='.runtime/fixture/training/phase-terminal.json'
 write(root,candidate,{schemaVersion:'stage4-post-decode-bounded-candidate-v1',status:'cpu_inactive_candidate_planned_not_implemented',selectedCandidate:{candidateKind:'fixture_candidate'}})
 const initial=write(root,terminal,{schemaVersion:'stage4-post-decode-failure-bounded-planning-terminal-v1',executionState:'completed',status:'bounded_candidate_planning_completed',planningRunId:'fixture-plan',nextAction:'fixture_review',candidate:{path:candidate,sha256:sha(read(root,candidate))},fixedTotalProgress:{completedStages:3,totalStages:5,percent:60}})
 write(root,capsule,{schemaVersion:'ai-painter-local-task-capsule-v2',latestTerminal:initial})
 write(root,training,{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',status:'post_decode_object_rgb_stage0_real_visual_failure',runId:'fixture-training'})
 write(root,'.runtime/fixture/training/execution-state.json',{status:'completed',phase:'machine_review_completed'})
 write(root,'.runtime/fixture/training/machine-review.json',{previewCount:1,previewPassCount:0,previewFailCount:1})
 write(root,'.runtime/fixture/training/training-output/progress.json',{phase:'training_completed',epoch:24,epochTarget:24})
 const seed=await initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule,currentTaskTerminalPath:terminal,currentCandidatePath:candidate,latestTrainingTerminalPath:training,archivedEvidenceNamespaces:[]});assert.equal(seed.ok,true)
 const identity={capabilityVersion:'fixture-review-capability',packageId:'fixture-package',runId:'fixture-run',processId:process.pid,processStartIdentity:selfIdentity}
 const source=write(root,'.runtime/fixture/review/source.mjs','export const fixtureOnly=true\n'),lock=write(root,'.runtime/fixture/review/lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity}),heartbeatPath='.runtime/fixture/review/heartbeat.json'
 write(root,heartbeatPath,{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',ttlSeconds:60,heartbeatAtUtc:new Date().toISOString()})
 const evidence=write(root,'.runtime/fixture/review/starting-evidence.json',{schemaVersion:'fixture-review-initial-terminal',executionState:'completed',status:'fixture_training_finished_review_pending'})
 const nextCapsule=write(root,'.runtime/fixture/review/capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},evidence:[{...evidence,kind:'fixture_evidence',sha256Verified:true}]})
 const activeExecution={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:{fixtureRunner:source},lock,heartbeat:{path:heartbeatPath,ttlSeconds:60}}
 const running=await advanceCurrentExecutionRegistry({projectRoot:root,...identity,taskId:'fixture-review-task',taskKind:'fixture_readonly_review',lifecycleStage:'review',executionState:'reviewing',activity:'cpu_review_recovery_running',queueStatus:'running',nextMachineAction:null,taskCapsulePath:nextCapsule.path,terminalEvidencePath:evidence.path,activeExecution,expectedPreviousRegistryRevision:seed.registry.registryRevision,expectedPreviousRegistrySha256:seed.registrySha256,_testHooks:{currentProcessIdentity:'private-prelaunch-writer'}})
 const heartbeat=json(root,heartbeatPath);heartbeat.heartbeatAtUtc=new Date(Date.now()-61000).toISOString();write(root,heartbeatPath,heartbeat)
 const proof=write(root,'.runtime/fixture/closeout/proof.json',{schemaVersion:'private-prelaunch-proof',...identity,nativeNotLaunched:true,nativeCleanupCertified:false})
 const failed=write(root,'.runtime/fixture/closeout/failure.json',{schemaVersion:'private-prelaunch-failure',...identity,executionState:'failed_closed',status:'review_prelaunch_failed_closed',proof,nativeCleanupCertified:false})
 const failedCapsule=write(root,'.runtime/fixture/closeout/capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},evidence:[{...proof,kind:'prelaunch_failure',sha256Verified:true}]})
 const options={projectRoot:root,capabilityVersion:identity.capabilityVersion,packageId:identity.packageId,runId:identity.runId,taskCapsulePath:failedCapsule.path,terminalEvidencePath:failed.path,expectedPreviousRegistryRevision:running.registry.registryRevision,expectedPreviousRegistrySha256:running.registrySha256,_testHooks:{currentProcessIdentity:'private-prelaunch-writer',probeActiveExecutionProcess:()=>({status:'dead'})}}
 return {root,options,running,training,source,lock,heartbeatPath,failed,proof}
}
test('existing writer fail-closes private expired review and preserves latest training, lock and heartbeat bytes',async()=>{
 const f=await registryFixture(),preserved=[f.training,f.lock.path,f.heartbeatPath].map(p=>[p,sha(read(f.root,p))])
 const oldLatest=f.running.registry.latestTrainingTerminal,result=await recoverExpiredActiveExecutionToFailedClosed(f.options)
 assert.equal(result.ok,true);assert.equal(result.registry.activeExecution,null);assert.equal(result.registry.executionState,'failed_closed');assert.deepEqual(result.registry.latestTrainingTerminal,oldLatest)
 assert.equal(result.currentTaskTerminal.nativeCleanupCertified,false)
 for(const [p,hash]of preserved)assert.equal(sha(read(f.root,p)),hash)
 assert.equal((await readCurrentExecutionRegistry(f.root)).ok,true)
})
test('repeat and concurrent closeouts cannot publish a second failed transaction',async()=>{
 const f=await registryFixture(),outcomes=await Promise.allSettled([recoverExpiredActiveExecutionToFailedClosed(f.options),recoverExpiredActiveExecutionToFailedClosed(f.options)])
 assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);assert.equal(outcomes.filter(v=>v.status==='rejected').length,1)
 const current=await readCurrentExecutionRegistry(f.root);assert.equal(current.registry.registryRevision,f.running.registry.registryRevision+1)
 await assert.rejects(recoverExpiredActiveExecutionToFailedClosed(f.options))
 assert.equal((await readCurrentExecutionRegistry(f.root)).registrySha256,current.registrySha256)
})
test('cross-run, source hash, missing lock, missing heartbeat and wrong published SHA refuse without clearing',async t=>{
 for(const [name,change]of [
  ['cross Run',f=>{f.options.runId='foreign-run'}],
  ['changed source bytes',f=>write(f.root,f.source.path,'changed source')],
  ['missing lock',f=>fs.unlinkSync(path.join(f.root,f.lock.path))],
  ['missing heartbeat',f=>fs.unlinkSync(path.join(f.root,f.heartbeatPath))],
  ['wrong registry SHA',f=>{f.options.expectedPreviousRegistrySha256='a'.repeat(64)}],
  ['process still active',f=>{f.options._testHooks.probeActiveExecutionProcess=()=>({status:'active',identity:selfIdentity})}],
  ['process status unknown',f=>{f.options._testHooks.probeActiveExecutionProcess=()=>({status:'indeterminate'})}]
 ])await t.test(name,async()=>{const f=await registryFixture(),before=read(f.root,REG+'/current.json');change(f);await assert.rejects(recoverExpiredActiveExecutionToFailedClosed(f.options));assert.deepEqual(read(f.root,REG+'/current.json'),before)})
})

// Exercise the actual CLI body and actual runNative -> dynamic self-import.
// Only metadata/OS adapters are private stubs. Never replace runNative or CLI.
async function cliCycleFixture(driverSource,nativeSource,{guardAppears=false,nativePreparation=false}={}){
 const seeded=await registryFixture(),root=seeded.root,closed=await recoverExpiredActiveExecutionToFailedClosed(seeded.options)
 const driverPath='scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs',nativePath='scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'
 const legacy=/export const RECOVERY_ROOT='([^']+)'/u.exec(driverSource)?.[1],successor=/export const SUCCESSOR_CASE='([^']+)'/u.exec(driverSource)?.[1],history=/export const HISTORY_ROOT='([^']+)'/u.exec(driverSource)?.[1]
 const recoveryRoot=legacy??successor;assert(recoveryRoot,'exact recovery metadata root')
 const overrides={loadReviewRecovery:'return {...globalThis.__prelaunchCpuContext,plan:json(root,planBinding),planBinding}',loadSuccessorLedger:'return {budget:globalThis.__prelaunchCpuContext.budget,roots:[],wallDebitMs:65572}',recoveryNativeContext:'fs.writeFileSync(path.join(root,"dynamic-import-boundary-reached.json"),JSON.stringify({planBinding}));'+(guardAppears?'fs.mkdirSync(path.join(root,".runtime/ai-painter/owned-worker-guards"),{recursive:true});fs.writeFileSync(path.join(root,".runtime/ai-painter/owned-worker-guards/active.json"),"unrelated-unknown-owner");':'')+(nativePreparation?'return {...globalThis.__prelaunchCpuContext,plan:json(root,planBinding),planBinding};':'throw Error("independent_cpu_pre_owner_refusal")')}
 const parsed=ts.createSourceFile('driver.mjs',driverSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),replacements=[]
 for(const node of parsed.statements){if(ts.isFunctionDeclaration(node)&&overrides[node.name?.text]){assert(node.body);replacements.push([node.body.getStart(parsed),node.body.end,'{'+overrides[node.name.text]+'}'])}}
 assert.equal(replacements.length,legacy?2:3)
 let transformed=driverSource;for(const [start,end,body]of replacements.sort((a,b)=>b[0]-a[0]))transformed=transformed.slice(0,start)+body+transformed.slice(end)
 write(root,driverPath,transformed);write(root,nativePath,nativeSource)
 const original={runId:'d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8',packageId:'d1-src-v1-package-850c25f8-8181-446e-99da-3dae2dbb21a8',outputRoot:'.runtime/fixture/original',programBindings:{reviewDriver:{path:driverPath},nativeRunner:{path:nativePath}}}
 const planRef=write(root,original.outputRoot+'/quality-plan.json',original),packageRef=write(root,'.runtime/fixture/package.json',{inputEvidence:[planRef]})
 const workerRef=write(root,'.runtime/fixture/worker.json',{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',status:'post_decode_object_rgb_stage0_real_visual_failure',runId:original.runId,executionPackage:packageRef,selectedCheckpointRecord:{checkpoint:{path:'.runtime/fixture/selected.pt',sha256:'a'.repeat(64)}}})
 const prior=write(root,'.runtime/fixture/prior.json',{phase:'review',cleanupConfirmed:true,ownerClosed:true,proof:{activeProcessesAfterCleanup:0,exitCode:1},budget:{timeoutMs:120000,outputBytes:16777216},elapsedMs:57148,streamBytes:{stdout:0,stderr:2112},outputAccountingRoots:[]})
 const failure=write(root,'.runtime/fixture/failure.json',{executionState:'failed_closed',status:'review_execution_failed_closed',nativeOwnedReceipt:prior})
 write(root,(legacy?path.posix.dirname(legacy):history)+'/all-original-source-preservation.json',{})
 if(!legacy){write(root,history+'/recovery-v1/plan.json',{sourceReviewFailure:failure});const exactClosed=successor+'/old-prelaunch-closeout/failure-terminal.json';write(root,exactClosed,fs.readFileSync(exactClosed,'utf8'))}
 const chain=`import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';export const inside=(r,p)=>path.join(r,p),sha=b=>createHash('sha256').update(b).digest('hex'),read=(r,b)=>fs.readFileSync(inside(r,b.path)),json=(r,b)=>JSON.parse(read(r,b)),bind=(r,p)=>({path:p,sha256:sha(fs.readFileSync(inside(r,p)))}),write=(r,p,v)=>{fs.mkdirSync(path.dirname(inside(r,p)),{recursive:true});fs.writeFileSync(inside(r,p),JSON.stringify(v)+'\\n',{flag:'wx'});return bind(r,p)},withOutputBudget=(_options,action)=>action(),directoryBytes=()=>0,ROLES={reviewDriver:${JSON.stringify(driverPath)}};export const loadContext=()=>{throw Error('unexpected_context')},runtimeIdentity=()=>({}),validateCompleted=()=>{},validatePlan=()=>{},executionRoute=()=>null,requiredProgramRoles=()=>[],sourceFileCountMaximum=256,gpuAdmissionSeconds=()=>0,finalProgramBindings=()=>({}),deriveConfiguration=()=>({});`
 write(root,'private-chain.mjs',chain)
 const modules={}
 for(const [source,parent]of [[driverSource,driverPath],[nativeSource,nativePath]]){
  const ast=ts.createSourceFile(parent,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
  for(const node of ast.statements){if(!ts.isImportDeclaration(node))continue;const spec=node.moduleSpecifier.text;if(spec.startsWith('node:'))continue
   if(spec.endsWith('package-chain-v1.mjs')){modules[spec]='chain';continue}
   if(modules[spec])continue
   if(spec.endsWith('ai-painter-current-execution-registry.mjs')){modules[spec]=`export {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from ${JSON.stringify(pathToFileURL(path.resolve('src/server/ai-painter-current-execution-registry.mjs')).href)};`;continue}
   const names=node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)?node.importClause.namedBindings.elements.map(e=>e.propertyName?.text??e.name.text):[]
   let content=node.importClause?.name?'export default {concurrency(){}};':''
   for(const name of names){let body='(...args)=>{throw Error("unexpected_private_metadata_call_'+name+'")}';if(name==='processIdentity')body='pid=>pid+":"+globalThis.__prelaunchCpuCreatedAt';if(name==='replaceHeartbeatFile')body='(from,to)=>fs.renameSync(from,to)';content+='export const '+name+'='+body+';'}
   modules[spec]='import fs from "node:fs";'+content
  }
 }
 write(root,'private-loader.mjs',`import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';const root=${JSON.stringify(root)},modules=${JSON.stringify(modules)},driver=pathToFileURL(path.join(root,${JSON.stringify(driverPath)})).href,native=pathToFileURL(path.join(root,${JSON.stringify(nativePath)})).href;export async function resolve(specifier,context,next){if(context.parentURL===driver||context.parentURL===native){if(specifier.endsWith('weight-quality-review-v1.mjs'))return {url:driver,shortCircuit:true};if(specifier.endsWith('weight-quality-owned-native-v1.mjs'))return {url:native,shortCircuit:true};if(Object.hasOwn(modules,specifier))return {url:modules[specifier]==='chain'?pathToFileURL(path.join(root,'private-chain.mjs')).href:'data:text/javascript,'+encodeURIComponent(modules[specifier]),shortCircuit:true};if(specifier==='node:child_process')return {url:'data:text/javascript,'+encodeURIComponent('export const spawn=()=>{throw Error("UNEXPECTED_NATIVE_SPAWN")},spawnSync=()=>{throw Error("UNEXPECTED_NATIVE_SPAWN")};'),shortCircuit:true}}return next(specifier,context)};`)
 const currentTerminal=legacy?failure.path:successor+'/old-prelaunch-closeout/failure-terminal.json'
 const capsule=write(root,'.runtime/fixture/cli-seed-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},evidence:[{path:currentTerminal,sha256:sha(read(root,currentTerminal)),kind:'fixture_closed_source',sha256Verified:true}]})
 await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:'stage4_mvp256_dry_decode1_registered_source_v1',packageId:original.packageId,runId:original.runId,taskId:'private-cli-prelaunch',taskKind:'private_fixture_review',lifecycleStage:'review',executionState:'failed_closed',activity:'review_execution_failed_closed',taskCapsulePath:capsule.path,terminalEvidencePath:currentTerminal,latestTrainingTerminal:{runId:original.runId,...workerRef,status:'post_decode_object_rgb_stage0_real_visual_failure',evidence:{}},activeExecution:null,expectedPreviousRegistryRevision:closed.registry.registryRevision,expectedPreviousRegistrySha256:closed.registrySha256,_testHooks:{currentProcessIdentity:'private-cli-setup'}})
 write(root,'private-preload.mjs',`import {spawnSync} from 'node:child_process';const r=spawnSync('powershell.exe',['-NoProfile','-Command',"$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+process.pid+"';$p.CreationDate.ToUniversalTime().ToString('o')"],{encoding:'utf8',windowsHide:true,timeout:5000});if(r.status!==0)throw Error('private_process_identity_unavailable');globalThis.__prelaunchCpuCreatedAt=r.stdout.trim();globalThis.__prelaunchCpuContext={root:${JSON.stringify(root)},original:{...${JSON.stringify(original)},runtimeIdentity:{node:{absolutePath:process.execPath}}},prior:${JSON.stringify(json(root,prior.path))},budget:{timeoutMs:54428,outputBytes:16600000,streamBytes:8300000},deadline:Date.now()+50000};`)
 let attempts=0
 const run=args=>{const result=spawnSync(process.execPath,['--experimental-loader',pathToFileURL(path.join(root,'private-loader.mjs')).href,'--import',pathToFileURL(path.join(root,'private-preload.mjs')).href,...args],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:128*1024,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});write(root,'cli-attempt-'+(++attempts)+'.json',{args,status:result.status,errorCode:result.error?.code??null,stdout:result.stdout,stderr:result.stderr,actualDriverSha256:sha(Buffer.from(driverSource)),actualNativeSha256:sha(Buffer.from(nativeSource))});return result}
 return {root,driverPath,recoveryRoot,run}
}
test('real frozen CLI reproduces exit13; current CLI reaches native self-import, archives failure and atomically closes its private activity',async()=>{
 const baseline='.runtime/ai-painter/controller-repair-reviews/review-prelaunch-acceptance-20261022/m-033425/'
 const oldDriver=fs.readFileSync(baseline+'reviewDriver-old-source.txt','utf8'),oldNative=fs.readFileSync(baseline+'nativeRunner-old-source.txt','utf8')
 assert.equal(sha(Buffer.from(oldDriver)),'06162db44327ece70935640f5f6bb8c75a29233e6a4618eded8f73727734f4e0')
 const previous=await cliCycleFixture(oldDriver,oldNative),oldResult=previous.run([previous.driverPath,'--recover-once','fixture-acceptance.json','a'.repeat(64)])
 assert.equal(oldResult.status,13,oldResult.stderr);assert.match(oldResult.stderr,/unsettled top-level await/);assert.equal(fs.existsSync(path.join(previous.root,'dynamic-import-boundary-reached.json')),false)
 const currentDriver=fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs','utf8'),currentNative=fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs','utf8'),current=await cliCycleFixture(currentDriver,currentNative)
 const result=current.run([current.driverPath,'--recover-once','fixture-acceptance.json','a'.repeat(64)])
 assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/independent_cpu_pre_owner_refusal/);assert.doesNotMatch(result.stderr,/unsettled top-level await|UNEXPECTED_NATIVE_SPAWN/)
 assert.equal(fs.existsSync(path.join(current.root,'dynamic-import-boundary-reached.json')),true)
 assert.equal(fs.existsSync(path.join(current.root,'.runtime/ai-painter/owned-worker-guards')),false)
 const head=await readCurrentExecutionRegistry(current.root);assert.equal(head.ok,true,head.errorCode);assert.equal(head.registry.activeExecution,null);assert.equal(head.registry.executionState,'failed_closed');assert.equal(head.currentTaskTerminal.nativeCleanupCertified,false);assert.equal(head.currentTaskTerminal.modelForwardCalls,0);assert.equal(head.currentTaskTerminal.nativeReceipt,null);assert.match(head.currentTaskTerminal.error,/independent_cpu_pre_owner_refusal/)
})
test('real CLI retains unknown guard or native preparation failure and saves explicit unknown-cleanup evidence',async t=>{
 for(const [name,mode]of [['guard appeared',{guardAppears:true}],['native preparation entered',{nativePreparation:true}]])await t.test(name,async()=>{
  const fixture=await cliCycleFixture(fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs','utf8'),fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs','utf8'),mode)
  const result=fixture.run([fixture.driverPath,'--recover-once','fixture-acceptance.json','a'.repeat(64)]);assert.equal(result.status,1,result.stderr);assert.doesNotMatch(result.stderr,/unsettled top-level await|UNEXPECTED_NATIVE_SPAWN/)
  assert.equal(fs.existsSync(path.join(fixture.root,'dynamic-import-boundary-reached.json')),true)
  const boundary=json(fixture.root,'dynamic-import-boundary-reached.json'),output=path.posix.dirname(boundary.planBinding.path),failure=json(fixture.root,output+'/cleanup-unknown-failure.json'),head=json(fixture.root,REG+'/current.json')
  assert.equal(failure.activeExecutionRetained,true);assert.equal(failure.nativeCleanupCertified,false);assert.equal(failure.status,'review_failure_cleanup_unknown_active_retained');assert.notEqual(head.activeExecution,null);assert.equal(fs.existsSync(path.join(fixture.root,output+'/prelaunch-failure.json')),false)
  if(mode.guardAppears)assert.equal(read(fixture.root,'.runtime/ai-painter/owned-worker-guards/active.json').toString(),'unrelated-unknown-owner')
 })
})
test('caller booleans or a cloned JSON receipt cannot forge live prelaunch capability',()=>{
 const root=scope(),plan={path:'.runtime/fixture/plan.json',sha256:'a'.repeat(64)},fake=Object.assign(Error('fake'),{nativeNotLaunched:true,nativeCleanupCertified:false,ownedReceipt:{cleanupConfirmed:true,nativeOwnerSpawnAttempted:false}})
 assert.equal(verifiedPrelaunchFailure(fake,root,plan),null)
 assert.equal(verifiedPrelaunchFailure({nativeNotLaunched:true,guardAcquired:false,nativePreparationEntered:false},root,plan),null)
})
test('actual live-call capability binds original root/plan values and rejects cloned errors or later guard',async()=>{
 const fixture=await cliCycleFixture(fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs','utf8'),fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs','utf8'))
 const nativeUrl=pathToFileURL(path.join(fixture.root,'scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs')).href
 const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';const n=await import(${JSON.stringify(nativeUrl)}),root=process.cwd(),binding={path:'.runtime/fixture/live-plan.json',sha256:'a'.repeat(64)},original={...binding};let first;try{await n.runNative({root,outputRoot:'.runtime/fixture/live/dry-review-owned',phase:'review',executable:process.execPath,args:[],reviewRecoveryPlan:binding})}catch(error){first=error}assert(first);assert.match(first.message,/independent_cpu_pre_owner_refusal/);assert.equal(n.verifiedPrelaunchFailure(first,root,original).nativeCleanupCertified,false);assert.throws(()=>n.verifiedPrelaunchFailure(first,root+'-foreign',original));assert.throws(()=>n.verifiedPrelaunchFailure(first,root,{...original,path:'.runtime/fixture/foreign.json'}));assert.equal(n.verifiedPrelaunchFailure(Object.assign(Error(first.message),{nativeNotLaunched:true}),root,original),null);binding.sha256='b'.repeat(64);assert.throws(()=>n.verifiedPrelaunchFailure(first,root,binding));assert.equal(n.verifiedPrelaunchFailure(first,root,original).nativeNotLaunched,true);fs.mkdirSync(path.join(root,'.runtime/ai-painter/owned-worker-guards'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json'),'unknown-owner-retained');assert.equal(n.verifiedPrelaunchFailure(first,root,original),null);process.stdout.write('immutable-live-capability-ok');`
 const result=fixture.run(['--input-type=module','-e',script]);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'immutable-live-capability-ok');assert.equal(read(fixture.root,'.runtime/ai-painter/owned-worker-guards/active.json').toString(),'unknown-owner-retained')
})
function realBoundPrelaunchFacts(){
 const before='.runtime/ai-painter/controller-repair-reviews/review-prelaunch-acceptance-20261022/m-033425/',audit=JSON.parse(fs.readFileSync(before+'actual-old-identity-audit.json','utf8'))
 const recovery='.runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022/recovery-v1',base=path.posix.dirname(recovery)
 const registry=JSON.parse(fs.readFileSync(REG+'/transactions/'+audit.identityBindings.transaction.transactionId+'/current.staged.json','utf8'))
 assert.equal(sha(Buffer.from(JSON.stringify(registry,null,2)+'\n')),audit.identityBindings.currentSha256)
 return {plan:JSON.parse(fs.readFileSync(recovery+'/plan.json','utf8')),registry,consumed:JSON.parse(fs.readFileSync(recovery+'/consumed.json','utf8')),lock:JSON.parse(fs.readFileSync(recovery+'/execution-lock.json','utf8')),heartbeat:JSON.parse(fs.readFileSync(recovery+'/heartbeat.json','utf8')),command:JSON.parse(fs.readFileSync(base+'/single-recovery-command-result.json','utf8')),stderr:fs.readFileSync(base+'/single-recovery-command.stderr.log','utf8'),driver:fs.readFileSync(before+'reviewDriver-old-source.txt'),native:fs.readFileSync(before+'nativeRunner-old-source.txt'),processObservation:{status:'dead'},guardPresent:false,nativeNamespacePresent:false,entries:['consumed.json','execution-lock.json','heartbeat.json','plan.json','started-capsule.json']}
}
test('case-bound pre-owner verifier accepts complete actual old facts without granting native cleanup',()=>{
 assert.deepEqual(verifyPrelaunchFailureFacts(realBoundPrelaunchFacts()),{nativeNotLaunched:true,nativeCleanupCertified:false})
})
test('case-bound pre-owner verifier refuses owner/guard, PID reuse, identity/hash conflicts and incomplete facts',async t=>{
 for(const [name,change]of [
  ['guard exists',f=>{f.guardPresent=true}],['owner namespace exists',f=>{f.nativeNamespacePresent=true}],['native output appeared',f=>{f.entries.push('owned-review')}],
  ['PID reused',f=>{f.processObservation={status:'active',identity:'36592:different-creation'}}],['same process active',f=>{f.processObservation={status:'active',identity:f.plan.processStartIdentity}}],['OS status unknown',f=>{f.processObservation={status:'indeterminate'}}],
  ['wrong Run',f=>{f.plan.runId='foreign-run'}],['wrong package lock',f=>{f.lock.packageId='foreign-package'}],['wrong creation identity',f=>{f.heartbeat.processStartIdentity='36592:foreign-start'}],['wrong registry revision',f=>{f.registry.registryRevision++}],['source closure mismatch',f=>{delete f.registry.activeExecution.programLineage.reviewDriver}],
  ['driver SHA conflict',f=>{f.driver=Buffer.concat([f.driver,Buffer.from('changed')])}],['native SHA conflict',f=>{f.native=Buffer.concat([f.native,Buffer.from('changed')])}],
  ['missing consumed',f=>{f.consumed=null}],['missing lock',f=>{f.lock=null}],['missing heartbeat',f=>{f.heartbeat=null}],['missing command exit evidence',f=>{f.command=null}],['stderr mismatch',f=>{f.stderr+='changed'}],['non13 exit',f=>{f.command.exitCode=1}],['unexpired heartbeat',f=>{f.now=Date.parse(f.heartbeat.heartbeatAtUtc)}],['changed command binding',f=>{f.command.command[3]='foreign-acceptance.json'}]
 ])await t.test(name,()=>{const facts=realBoundPrelaunchFacts();change(facts);assert.throws(()=>verifyPrelaunchFailureFacts(facts))})
})
test('actual repaired review module import has no CLI side effect',async()=>{
 const fixture=await cliCycleFixture(fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs','utf8'),fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs','utf8'))
 const result=fixture.run(['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(path.join(fixture.root,fixture.driverPath)).href)});process.stdout.write('import-ok')`])
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'import-ok');assert.equal(fs.existsSync(path.join(fixture.root,'metadata-published.json')),false);assert.equal(fs.existsSync(path.join(fixture.root,'dynamic-import-boundary-reached.json')),false)
})
test('frozen v3 real CLI pre-owner failure archives and atomically closes only its private activity',async()=>{
 const driver=fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs'),native=fs.readFileSync('scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs')
 assert.equal(sha(driver),'a096c6f944be03881ca7c5210d6b63cecd4393a1e336dd13c64a14299e0b375f');assert.equal(sha(native),'5e19f60ac77db2ec45b14f88a86e5c2fe593ed525d6b367186d726d92d1269ec')
 const fixture=await cliCycleFixture(driver.toString(),native.toString()),before=await readCurrentExecutionRegistry(fixture.root)
 const result=fixture.run([fixture.driverPath,'--recover-once','fixture-acceptance.json','a'.repeat(64)]);assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/independent_cpu_pre_owner_refusal/);assert.doesNotMatch(result.stderr,/unsettled top-level await|UNEXPECTED_NATIVE_SPAWN/)
 const head=await readCurrentExecutionRegistry(fixture.root);assert.equal(head.ok,true,head.errorCode);assert.equal(head.registry.executionState,'failed_closed');assert.equal(head.registry.activeExecution,null);assert.deepEqual(head.registry.latestTrainingTerminal,before.registry.latestTrainingTerminal)
 assert.equal(head.currentTaskTerminal.nativeNotLaunched,true);assert.equal(head.currentTaskTerminal.nativeCleanupCertified,false);assert.equal(head.currentTaskTerminal.nativeReceipt,null);assert.equal(head.currentTaskTerminal.modelForwardCalls,0);assert.equal(head.currentTaskTerminal.automaticRetries,0)
 assert.equal(fs.existsSync(path.join(fixture.root,'.runtime/ai-painter/owned-worker-guards')),false)
 write(fixture.root,'frozen-v3-acceptance.json',{status:'passed',actualDriverSha256:sha(driver),actualNativeSha256:sha(native),latestTrainingPreserved:true,failedClosed:true,nativeOwnerStarted:false,nativeJobCleanupCertified:false})
 console.log('frozen-v3-private-evidence '+fixture.root)
})
