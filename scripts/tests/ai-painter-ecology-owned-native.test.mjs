// CPU only: fake compiler/owner/clock, real existing IO/accounting in isolated
// evidence fixtures. Run with --experimental-vm-modules; no native build/Job.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import vm from 'node:vm'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {fileURLToPath} from 'node:url'
import {test,after} from 'node:test'
import * as io from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs'

const sourceUrl=new URL('../lib/ai-painter-ecology-owned-native-v1.mjs',import.meta.url)
const source=fs.readFileSync(sourceUrl,'utf8')
const base=path.resolve(process.env.ECOLOGY_TEST_EVIDENCE_ROOT??'.runtime/ai-painter/ecology-managed-entry-t-q4-73/native')
fs.mkdirSync(base,{recursive:true})
const evidence=fs.mkdtempSync(path.join(base,'mock-'))
const results=[]
const MiB=1024**2
const ownPlan=()=>({schema:'ecology-regime-managed-plan-v1',capabilityVersion:'stage4_mvp256_dry_factorized_ecology_v1',
 executionProfile:'factorized_ecology_execution_v1',executionMode:'managed-training',runId:'mock-ecology-run',packageId:'mock-ecology-package',
 outputRoot:'.runtime/ai-painter/ecology-regime-managed-executions/mock-ecology-run',historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,
 configuration:{capabilityVersion:'stage4_mvp256_dry_factorized_ecology_v1',gpuAdmissionSeconds:600,
  executionCeiling:{maxWallSeconds:2700,maxOutputMiB:128,cpuThreads:2,trainingAttempts:1,automaticRetries:0}}})
const normalize=value=>JSON.parse(JSON.stringify(value))

async function harness(options={}) {
 const root=fs.mkdtempSync(path.join(evidence,'case-'))
 let now=1000000,child,command,record,validatorCalls=0,buildCalls=0,spawnCalls=0,virtualOutputBytes=0
 const intervals=[],timeouts=[],stops=[],events=[]
 const guard=path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')
 const timer=(kind,fn,ms)=>{const value={fn,ms,cleared:false};kind.push(value);return value}
 const context=vm.createContext({Buffer,Error,Date:class extends Date {static now(){return now}},process:{...process,platform:'win32'},
  setInterval:(fn,ms)=>timer(intervals,fn,ms),clearInterval:t=>{if(t)t.cleared=true},
  setTimeout:(fn,ms)=>timer(timeouts,fn,ms),clearTimeout:t=>{if(t)t.cleared=true}})
 const native={
  nativeOwnerSourceIdentity:()=>({path:'mock-owner.cs',sha256:io.sha('mock-owner-source')}),
  nativeBuildFailureObservation:error=>error===options.buildError&&options.compilerExited?{
   runnerPid:process.pid,guardIdentity:record.identity,guardSha256:io.sha(JSON.stringify(record))}:null,
  createNativeOwnerCommand:(exe,args,cwd,deadline,cleanupMs,r,guardBytes)=>{
   buildCalls++;record=r;events.push('build');assert.equal(cwd,root);assert.equal(cleanupMs,1000)
   assert.equal(r.helperSha256,io.sha(fs.readFileSync(sourceUrl)))
   assert.equal(fs.existsSync(guard),false);assert.equal(guardBytes,JSON.stringify(r))
   const directory=path.join(path.dirname(r.startedEvidence),r.identity+'-native')
   fs.mkdirSync(directory);fs.writeFileSync(path.join(directory,'mock-build.json'),JSON.stringify({mocked:true,deadline}))
   if(options.buildError)throw options.buildError
   command={executable:exe,args,deadline,bindingBase64:Buffer.from(JSON.stringify(r)).toString('base64'),nativeBuild:{mocked:true,directory}}
   return command
  }}
 const spawn=(_exe,_args,settings)=>{
  spawnCalls++;events.push('spawn');assert.ok(fs.existsSync(guard));assert.equal(settings.shell,false);assert.equal(settings.windowsHide,true)
  for(const key of ['OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS'])assert.equal(settings.env[key],'2')
  assert.equal(settings.env.PYTHONDONTWRITEBYTECODE,'1')
  if(options.spawnError)throw options.spawnError
  child=new EventEmitter();child.pid=12345;child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough()
  child.settings=settings;child.kill=()=>{events.push('kill');return true}
  child.stdin.on('data',chunk=>stops.push(Buffer.from(chunk.toString().trim(),'base64').toString()))
  return child
 }
 const modules=new Map([
  ['node:assert/strict',{default:assert}],['node:fs',{default:fs}],['node:path',{default:path}],['node:crypto',{default:crypto}],
  ['node:child_process',{spawn}],['node:url',{fileURLToPath}],['./ai-painter-owned-worker-native-v1.mjs',native],
  ['./ai-painter-ecology-managed-package-chain-v1.mjs',{validatePlan:(r,p)=>{validatorCalls++;assert.equal(r,root);if(options.validationError)throw options.validationError;return p}}],
  ['./ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs',{...io,
   directoryBytes:target=>io.directoryBytes(target)+(target===path.join(root,ownPlan().outputRoot)?virtualOutputBytes:0),write:(r,logical,value)=>{
   if(options.failWrite?.(logical))throw new Error('mock evidence IO refusal')
   events.push('write:'+path.basename(logical));return io.write(r,logical,value)
  }}]
 ])
 const nativeModule=new vm.SourceTextModule(source,{context,identifier:sourceUrl.href,initializeImportMeta:meta=>{meta.url=sourceUrl.href}})
 await nativeModule.link(specifier=>{
  const values=modules.get(specifier);assert.ok(values,'unexpected native dependency: '+specifier)
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value)},{context})
 })
 await nativeModule.evaluate()
 const api=nativeModule.namespace
 const call=(extra={})=>api.runNative({root,outputRoot:ownPlan().outputRoot,phase:'cpu',executable:process.execPath,args:['mock-worker'],...extra})
 const finish=({output='{}',stderr='',proofOverrides={},frames=null,close=true}={})=>{
  const out=Buffer.from(output),err=Buffer.from(stderr)
  const proof={ownerPid:child.pid,rootPid:12346,rootCreationDateUtc:'2026-10-09T00:00:00Z',bindingBase64:command.bindingBase64,
   assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,stdoutBytes:out.length,stderrBytes:err.length,exitCode:0,...proofOverrides}
  const lines=frames??[...(out.length?['O:'+out.toString('base64')]:[]),...(err.length?['E:'+err.toString('base64')]:[]),'R:'+Buffer.from(JSON.stringify(proof)).toString('base64')]
  for(const line of lines)child.stdout.write(line+'\n')
  if(close)child.emit('close',0)
 }
 return {root,guard,api,call,finish,events,stops,intervals,timeouts,virtualDisk:bytes=>{virtualOutputBytes=bytes},
  advance:ms=>{now+=ms},tick:()=>intervals.filter(t=>!t.cleared).forEach(t=>t.fn()),
  get child(){return child},get record(){return record},get command(){return command},
  get validatorCalls(){return validatorCalls},get buildCalls(){return buildCalls},get spawnCalls(){return spawnCalls}}
}
function checkPartition(receipt,maximum) {
 assert.equal(receipt.budget.outputBytes,maximum)
 assert.ok(receipt.budget.terminalReserveBytes>=65536)
 assert.equal(receipt.budget.ordinaryOutputLimitBytes+receipt.budget.terminalReserveBytes,maximum)
 assert.equal(receipt.budget.streamBytes,8*MiB)
 assert.equal(receipt.outputAccountingRoots.length,receipt.phase==='review'?3:2)
}
function save(name,value={}){results.push({name,status:'passed',...value})}

test('own budgets are fixed; new plan integrity is checked without qualification',{timeout:3000},async()=>{
 const h=await harness(),plan=ownPlan()
 for(const [phase,ms,bytes] of [['cpu',120000,8*MiB],['qualification',600000,16*MiB],['training',2700000,128*MiB],['review',120000,16*MiB]]){
  assert.deepEqual(normalize(h.api.nativeBudget(phase,{root:h.root,plan})),{timeoutMs:ms,streamBytes:8*MiB,outputBytes:bytes})
 }
 assert.equal(h.validatorCalls,4);assert.equal(h.buildCalls,0);assert.equal(h.spawnCalls,0)
 assert.throws(()=>h.api.nativeBudget('training'),/own immutable ecology plan/)
 assert.throws(()=>h.api.nativeBudget('retry'),/unknown native phase/)
 const error=new Error('source byte mismatch'),broken=await harness({validationError:error})
 assert.throws(()=>broken.api.nativeBudget('training',{root:broken.root,plan}),e=>e===error)
 save('fixed_own_budgets_and_validator')
})

test('training rejects old identities, namespaces, resource successors and caller overrides independently',{timeout:3000},async()=>{
 const h=await harness()
 const changes=[p=>p.capabilityVersion='stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1',p=>p.executionProfile='detail_weight_failure_capture_execution_v1',
  p=>p.schema='detail-weight-capture-managed-plan-v1',p=>p.outputRoot=p.outputRoot.replace('ecology-regime','detail-weight-capture'),
  p=>p.outputRoot+='/another-run',p=>p.configuration.capabilityVersion='old-capability',p=>p.executionMode='synthetic-cpu-bootstrap',
  p=>p.resourcePolicy={path:'old-4200-policy'},p=>p.resourcePolicy=null,p=>p.effectiveExecutionCeiling={maxWallSeconds:4200},
  p=>p.configuration.executionCeiling.maxWallSeconds=4200,p=>p.configuration.executionCeiling.maxOutputMiB=129,
  p=>p.configuration.executionCeiling.cpuThreads=3,p=>p.configuration.executionCeiling.automaticRetries=1,
  p=>p.configuration.executionCeiling.trainingAttempts=2,p=>p.configuration.gpuAdmissionSeconds=601,
  p=>p.trainingRestartAllowed=true,p=>p.historicalCheckpointMayInitialize=true,p=>p.packageId=p.runId]
 for(const change of changes){const plan=ownPlan();change(plan);assert.throws(()=>h.api.nativeBudget('training',{root:h.root,plan}))}
 assert.equal(h.validatorCalls,0);assert.equal(h.buildCalls,0);assert.equal(h.spawnCalls,0)
 save('independent_identity_budget_rejection',{cases:changes.length})
})

test('unsupported retry/recovery/cpu override options fail before any build or guard',{timeout:3000},async()=>{
 const h=await harness()
 for(const key of ['retry','priorReviewReceipt','priorReviewFailure','cpuAccountingRoot','cpuMaximumBytes','timeoutMs'])
  await assert.rejects(h.call({[key]:null}),/unsupported native option/)
 await assert.rejects(h.call({phase:'training'}),/own immutable ecology plan/)
 const plan=ownPlan();await assert.rejects(h.call({phase:'training',executionPlan:plan,outputRoot:plan.outputRoot+'-other'}))
 assert.equal(h.buildCalls,0);assert.equal(fs.existsSync(h.guard),false)
 save('unsupported_options_pre_side_effect')
})

test('same Job schema binds SELF, counts native build/streams, and releases only after persisted live proof',{timeout:3000},async()=>{
 const h=await harness(),promise=h.call();h.finish({output:'mock stdout',stderr:'mock stderr'});const result=await promise,r=result.ownedReceipt
 checkPartition(r,8*MiB);assert.equal(r.schema,'detail-weight-live-native-owner-receipt-v1');assert.equal(r.cleanupConfirmed,true)
 assert.equal(fs.existsSync(h.guard),false);assert.equal(r.guard.state,'released_after_live_empty_job')
 assert.equal(h.record.helperSha256,io.sha(fs.readFileSync(sourceUrl)));assert.equal(h.buildCalls,1);assert.equal(h.spawnCalls,1)
 assert.equal(r.streamBytes.stdout,11);assert.equal(r.streamBytes.stderr,11);assert.equal(result.stdout,'mock stdout')
 assert.ok(r.outputAccountingRoots.includes(r.guard.nativeEvidenceRoot));assert.equal(r.budget.timeoutMs,120000)
 const original=JSON.parse(fs.readFileSync(path.join(h.root,result.receiptBinding.path.replace('release-receipt','original-receipt'))))
 assert.equal(original.cleanupConfirmed,false);assert.equal(JSON.parse(io.read(h.root,result.receiptBinding)).cleanupConfirmed,true)
 assert.ok(h.events.indexOf('write:original-receipt.json')<h.events.indexOf('write:release-receipt.json'))
 assert.ok(r.outputAccountingRoots.reduce((n,p)=>n+io.directoryBytes(io.inside(h.root,p)),0)+r.streamBytes.stdout+r.streamBytes.stderr<=r.budget.outputBytes)
 const second=h.call();h.finish();const next=await second
 assert.equal(next.ownedReceipt.guard.nativeEvidenceRoot,r.guard.nativeEvidenceRoot);assert.notEqual(next.ownedReceipt.guard.identity,r.guard.identity)
 save('mock_live_owner_release',{receipt:result.receiptBinding,fixtureRoot:h.root})
})

test('Node review driver and descendant streams stay inside one 120s private Job budget',{timeout:3000},async()=>{
 const h=await harness(),plan=ownPlan(),outputRoot=plan.outputRoot+'/dry-review-owned'
 const promise=h.call({phase:'review',outputRoot,executable:process.execPath,args:['mock-node-review-driver'],executionPlan:plan})
 assert.equal(h.record.executable,process.execPath);assert.equal(h.command.deadline,1119000)
 h.finish({output:'node+python-child-output'});const r=(await promise).ownedReceipt
 checkPartition(r,16*MiB);assert.equal(r.budget.timeoutMs,120000)
 assert.deepEqual(normalize(r.outputAccountingRoots.slice(0,2)),[outputRoot,plan.outputRoot+'/dry-review'])
 assert.equal(h.spawnCalls,1);assert.equal(h.validatorCalls,1)
 save('node_review_same_job_deadline')
})

test('unknown existing guard and cross-Run namespace are preserved and refuse owner build',{timeout:3000},async()=>{
 const h=await harness();fs.mkdirSync(path.dirname(h.guard),{recursive:true});const bytes=Buffer.from('mock retained unknown guard')
 fs.writeFileSync(h.guard,bytes)
 await assert.rejects(h.call(),e=>e.code==='OWNED_GUARD_BUSY'&&!e.ownedReceipt.cleanupConfirmed)
 assert.deepEqual(fs.readFileSync(h.guard),bytes);assert.equal(h.buildCalls,0)
 const other=await harness(),outputRoot=ownPlan().outputRoot,pointer={schema:'detail-weight-native-evidence-root-v1',outputRoot,nativeEvidenceRoot:'.runtime/ai-painter/owned-worker-guards/'+crypto.randomUUID()}
 io.write(other.root,outputRoot+'/native-evidence-root.json',pointer);io.write(other.root,pointer.nativeEvidenceRoot+'/binding.json',pointer)
 await assert.rejects(other.call(),/namespace identity must derive/);assert.equal(other.buildCalls,0);assert.equal(fs.existsSync(other.guard),false)
 assert.equal(h.api.cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:false}},{cleanupConfirmed:true}),false)
 save('unknown_guard_and_cross_run_refused')
})

test('unknown cleanup, forged identity and incomplete/malformed frames cannot remove guard',{timeout:3000},async()=>{
 for(const spec of [{proofOverrides:{activeProcessesAfterCleanup:1}},{proofOverrides:{bindingBase64:'forged'}},
  {proofOverrides:{ownerPid:9876}},{proofOverrides:{assignedBeforeResume:false}},{proofOverrides:{cleanupError:'unknown'}},
  {proofOverrides:{stdoutBytes:500}},{frames:['O:not canonical base64']},{frames:['X:unknown-frame']}]){
  const h=await harness(),promise=h.call();h.finish(spec);const error=await promise.catch(e=>e)
  assert.ok(error instanceof Error);assert.equal(error.ownedReceipt.cleanupConfirmed,false);assert.ok(fs.existsSync(h.guard))
 }
 const h=await harness(),promise=h.call();h.child.stdout.write('R:unfinished');h.child.emit('close')
 await assert.rejects(promise,e=>e.ownedReceipt.protocolError==='incomplete_frame'&&!e.ownedReceipt.cleanupConfirmed)
 assert.ok(fs.existsSync(h.guard));save('unknown_cleanup_protocol_rejection',{cases:9})
})

test('compiler failure and secondary receipt IO keep original exception; no owner started',{timeout:3000},async()=>{
 for(const compilerExited of [false,true]){
  const original=new Error('mock original compiler failure'),h=await harness({buildError:original,compilerExited})
  await assert.rejects(h.call(),e=>e===original&&e.ownedReceipt.cleanupConfirmed===compilerExited)
  assert.equal(h.spawnCalls,0);assert.equal(fs.existsSync(h.guard),false)
 }
 const original=new Error('mock original compiler failure'),h=await harness({buildError:original,compilerExited:true,failWrite:p=>p.endsWith('original-receipt.json')})
 await assert.rejects(h.call(),e=>e===original&&/mock evidence IO refusal/.test(e.secondaryEvidenceError)&&!e.ownedReceipt.cleanupConfirmed)
 assert.equal(h.spawnCalls,0);assert.equal(fs.existsSync(h.guard),false)
 save('compiler_original_and_secondary_io_preserved')
})

test('spawn and live callback failures preserve original exception and secondary IO, retain guard',{timeout:3000},async()=>{
 const original=new Error('mock spawn failure'),h=await harness({spawnError:original,failWrite:p=>p.endsWith('original-receipt.json')})
 await assert.rejects(h.call(),e=>e===original&&/mock evidence IO refusal/.test(e.secondaryEvidenceError)&&!e.ownedReceipt.cleanupConfirmed)
 assert.ok(fs.existsSync(h.guard))
 const callback=new Error('mock heartbeat original'),live=await harness({failWrite:p=>p.endsWith('original-receipt.json')})
 const promise=live.call({onHeartbeat:()=>{throw callback}});live.tick();live.finish()
 await assert.rejects(promise,e=>e===callback&&/mock evidence IO refusal/.test(e.secondaryEvidenceError)&&!e.ownedReceipt.cleanupConfirmed)
 assert.ok(fs.existsSync(live.guard));save('spawn_live_original_secondary_preserved')
})

test('wall deadline, abort, aggregate stream and disk limits stop once without extra allowance',{timeout:3000},async()=>{
 for(const reason of ['wall_timeout','abort','stream_limit','output_budget']){
  const h=await harness(),promise=h.call(reason==='abort'?{abortReason:()=>reason}:reason==='stream_limit'?{phase:'qualification'}:{})
  if(reason==='wall_timeout'){h.advance(119000);h.tick();h.tick()}
  else if(reason==='abort'){h.tick();h.tick()}
  else if(reason==='stream_limit'){
   const block=Buffer.alloc(4096,65);for(let i=0;i<2049;i++)h.child.stdout.write('O:'+block.toString('base64')+'\n')
  }else{
   h.virtualDisk(Number(h.child.settings.env.DETAIL_WEIGHT_OUTPUT_MAX))
   h.tick()
  }
  assert.deepEqual(h.stops,[reason]);h.finish({output:'',proofOverrides:reason==='stream_limit'?{stdoutBytes:2049*4096}:{}})
  await assert.rejects(promise,e=>e.ownedReceipt.stopReason===reason)
 }
 const deadline=await harness(),promise=deadline.call();deadline.advance(120000);deadline.timeouts.find(t=>t.ms===120000).fn()
 await assert.rejects(promise,e=>e.ownedReceipt.stopReason==='cleanup_deadline'&&!e.ownedReceipt.cleanupConfirmed)
 assert.ok(fs.existsSync(deadline.guard));save('bounded_clock_abort_stream_disk',{cases:5})
})

test('ordinary and terminal writers account namespace, stream bytes and retained guard',{timeout:3000},async()=>{
 const h=await harness(),promise=h.call();h.finish();const r=(await promise).ownedReceipt
 const disk=r.outputAccountingRoots.reduce((n,p)=>n+io.directoryBytes(io.inside(h.root,p)),0),logical=ownPlan().outputRoot+'/outer.json'
 await h.api.withNativeReceiptBudget(h.root,r,()=>io.write(h.root,logical,{mocked:true}))
 const tooSmall={...r,budget:{...r.budget,ordinaryOutputLimitBytes:disk+65000}}
 await assert.rejects(h.api.withNativeOrdinaryBudget(h.root,tooSmall,()=>io.write(h.root,ownPlan().outputRoot+'/denied.json',{value:'x'.repeat(2048)})),/total output reserve/)
 const huge={...r};await assert.rejects(h.api.withNativeReceiptBudget(h.root,huge,()=>io.write(h.root,ownPlan().outputRoot+'/huge.json',{value:'x'.repeat(65536)})),/total output reserve/)
 const retained=await harness(),unknown=retained.call();retained.finish({proofOverrides:{activeProcessesAfterCleanup:1}})
 const held=(await unknown.catch(e=>e)).ownedReceipt
 const heldDisk=held.outputAccountingRoots.reduce((n,p)=>n+io.directoryBytes(io.inside(retained.root,p)),0)
 const heldBytes=fs.statSync(retained.guard).size
 const narrowed={...held,budget:{...held.budget,outputBytes:heldDisk+heldBytes+held.streamBytes.stdout+held.streamBytes.stderr+1024}}
 await assert.rejects(retained.api.withNativeReceiptBudget(retained.root,narrowed,()=>io.write(retained.root,ownPlan().outputRoot+'/guard-budget-denied.json',{value:'x'.repeat(2048)})),/total output reserve/)
 assert.ok(fs.existsSync(retained.guard))
 save('ordinary_terminal_accounting')
})

after(()=>{
 io.write(path.resolve('.'),path.relative(path.resolve('.'),evidence).split(path.sep).join('/')+'/report.json',{
  schema:'ecology-native-mocked-cpu-behavior-v1',checkedAtUtc:new Date().toISOString(),status:results.length===11?'passed':'incomplete_or_failed',
  expectedTests:11,passedItems:results.length,nativeHelperSha256:io.sha(fs.readFileSync(sourceUrl)),
  testSourceSha256:io.sha(fs.readFileSync(fileURLToPath(import.meta.url))),mockedTransport:true,realNativeBuildInvocations:0,realWindowsJobInvocations:0,
  gpuStarted:false,trainingStarted:false,realPlanSourceVerification:'delegated_to_controller',items:results})
 console.log('NATIVE_MOCK_EVIDENCE='+path.join(evidence,'report.json'))
})
