//092 source-only/CPU fixtures. Never execute a real recovery, model or prepare.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {RECOVERY_POLICY,RECOVERY_CLI,validateRecoveryPolicy,validateInitialRegistry,validateRecoveryEvidence} from '../lib/ai-painter-replay-retention-review-recovery-v1.mjs'
import {REPLAY_REVIEW_POLICY,REPLAY_REVIEW_POLICY_SHA} from '../lib/ai-painter-replay-retention-review-v1.mjs'
import {validateRecoveryEntry} from '../run-ai-painter-replay-retention-review-recovery-v1.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex'),clone=v=>JSON.parse(JSON.stringify(v))
const policy=JSON.parse(fs.readFileSync(RECOVERY_POLICY)),base=JSON.parse(fs.readFileSync(REPLAY_REVIEW_POLICY))
const read=b=>{const bytes=fs.readFileSync(b.path);assert.equal(sha(bytes),b.sha256,b.path);return JSON.parse(bytes)}
const failure=read(policy.priorFailure),prior=read(policy.priorPackage),inference=read(policy.inferenceFailure),streams=read(policy.workerStreams)
const pkg={policy:policy.baseReviewPolicy,sourceTerminal:policy.trainingSource.terminal,sourcePackage:policy.trainingSource.package,sourceCheckpoint:policy.trainingSource.checkpoint,resources:base.resources}

test('effective recovery policy is exact zero-training604 scope and unchanged091 policy/resources',()=>{
 validateRecoveryPolicy(policy);assert.equal(sha(fs.readFileSync(REPLAY_REVIEW_POLICY)),REPLAY_REVIEW_POLICY_SHA)
 assert.deepEqual(policy.resources,base.resources);assert.equal(policy.dynamicReadRetry.maximumAttempts,5);assert.equal(policy.dynamicReadRetry.maximumElapsedMs,500)
 for(const patch of [{mode:'automatic_retry'},{trainingAllowed:true},{gpuAllowed:true},{optimizerUpdates:1},{formalQualificationGranted:true},{initialRegistry:{revision:605,sha256:policy.initialRegistry.sha256}},{dynamicReadRetry:{...policy.dynamicReadRetry,maximumAttempts:6}}])assert.throws(()=>validateRecoveryPolicy({...policy,...patch}))
})
test('registered dedicated entry requires exact package script and CPU-only role',()=>{
 const registry=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json')),packageJson=JSON.parse(fs.readFileSync('package.json'))
 validateRecoveryEntry(registry,packageJson)
 assert.throws(()=>validateRecoveryEntry({...registry,currentEntrypoints:registry.currentEntrypoints.filter(e=>e.entryFile!==RECOVERY_CLI)},packageJson))
 assert.throws(()=>validateRecoveryEntry(registry,{...packageJson,scripts:{...packageJson.scripts,'run:ai-painter-replay-retention-review-recovery':'node arbitrary-training.mjs'}}))
})
test('actual dedicated CLI rejects arbitrary flags before tests, recovery or model calls',()=>{
 const before=sha(fs.readFileSync('.runtime/ai-painter/current-execution-registry/current.json'))
 const child=spawnSync(process.execPath,[RECOVERY_CLI,'--train'],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:131072})
 assert.equal(child.status,1);assert.match(child.stderr,/no arbitrary source, policy, retry, or training arguments/)
 assert.equal(sha(fs.readFileSync('.runtime/ai-painter/current-execution-registry/current.json')),before)
})
test('actual old failure/package/zero-calls/heartbeat-error bindings are verified, never reclassified passed',()=>{
 validateRecoveryEvidence(policy,pkg,failure,prior,inference,streams)
 assert.equal(failure.executionState,'failed_closed');assert.deepEqual(inference.actualCalls,{generatorForwards:0,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0})
 assert.match(streams.stderr,/heartbeat\.json/)
 for(const patch of [{actualCalls:{...inference.actualCalls,generatorForwards:1}},{status:'completed'},{reviewId:'other'}])assert.throws(()=>validateRecoveryEvidence(policy,pkg,failure,prior,{...inference,...patch},streams))
 for(const patch of [{exitCode:0},{stdout:'fabricated result'},{stderr:'JSONDecodeError on another file'}])assert.throws(()=>validateRecoveryEvidence(policy,pkg,failure,prior,inference,{...streams,...patch}))
 assert.throws(()=>validateRecoveryEvidence(policy,{...pkg,sourceCheckpoint:{path:'other.pt',sha256:'0'.repeat(64)}},failure,prior,inference,streams))
 assert.throws(()=>validateRecoveryEvidence(policy,pkg,{...failure,executionState:'completed'},prior,inference,streams))
 assert.throws(()=>validateRecoveryEvidence(policy,pkg,{...failure,cleanupError:'unresolved'},prior,inference,streams))
})
test('initial current604 failure and latest C bindings reject active stale or substituted registry',()=>{
 const registry={registryRevision:604,executionState:'failed_closed',activeExecution:null,runId:failure.runId,terminalEvidence:policy.priorFailure,latestTrainingTerminal:policy.trainingSource.terminal}
 const current={ok:true,registry,registrySha256:policy.initialRegistry.sha256};validateInitialRegistry(current,policy)
 for(const patch of [{registryRevision:605},{executionState:'completed'},{activeExecution:{runId:'other'}},{runId:'other'},{terminalEvidence:{...policy.priorFailure,sha256:'f'.repeat(64)}},{latestTrainingTerminal:{...policy.trainingSource.terminal,sha256:'e'.repeat(64)}}])assert.throws(()=>validateInitialRegistry({...current,registry:{...registry,...patch}},policy))
 assert.throws(()=>validateInitialRegistry({...current,ok:false},policy));assert.throws(()=>validateInitialRegistry({...current,registrySha256:'d'.repeat(64)},policy))
})
test('resources cannot be increased by a self-consistent caller package',()=>{
 for(const field of ['maxWallSeconds','workerMaxWallSeconds','cpuThreads','generatorForwards','maxOutputMiB','automaticRetries']){
  const wrong={...pkg,resources:{...pkg.resources,[field]:pkg.resources[field]+1}}
  assert.throws(()=>validateRecoveryEvidence(policy,wrong,failure,prior,inference,streams))
 }
})
test('all181 old program identities verify exact archived bytes; immutable C/failure metadata stay exact',()=>{
 const freeze=read(policy.originalSourceFreeze);assert.equal(freeze.programs.length,181)
 const baseline=read({path:'.runtime/ai-painter/controller-repair-reviews/balanced-map-followup-093-20261027/historical-source-baseline.json',sha256:'0f3e6109f5f1490c52d318604c6a7141f754f16579414e18740b25401e01547e'})
 assert.equal(baseline.taskId,'BALANCED-MAP-093');assert.equal(baseline.entries.length,186)
 const mapped=new Map(baseline.entries.map(e=>[e.original.path+'@'+e.original.sha256,e]));assert.equal(mapped.size,186)
 for(const b of freeze.programs){const e=mapped.get(b.path+'@'+b.sha256);assert(e,b.path);assert.equal(e.archive.path,'.runtime/ai-painter/controller-repair-reviews/balanced-map-followup-093-20261027/source-baseline/'+b.path);assert.equal(e.archive.sha256,b.sha256);assert.equal(sha(fs.readFileSync(e.archive.path)),b.sha256,e.archive.path)}
 for(const b of [policy.priorFailure,policy.priorPackage,policy.inferenceFailure,policy.workerStreams,policy.trainingSource.terminal,policy.trainingSource.package,policy.trainingSource.result])read(b)
 // Checkpoint identity is hash-checked by the baseline/final artifact verifier;
 // this test neither deserializes it nor constructs a model.
 const terminal=read(policy.trainingSource.terminal),result=read(policy.trainingSource.result)
 assert.equal(terminal.executionState,'completed');assert.equal(result.checkpointReloadExact,true)
 assert(result.artifacts.some(b=>b.path===policy.trainingSource.checkpoint.path&&b.sha256===policy.trainingSource.checkpoint.sha256))
 assert.equal(failure.sourceTerminal.sha256,policy.trainingSource.terminal.sha256)
})
test('recovery controller imports frozen pure logic and binds CLI+four sources, not a policy as code',()=>{
 const source=fs.readFileSync('scripts/lib/ai-painter-replay-retention-review-recovery-v1.mjs','utf8')
 assert.match(source,/from '\.\/ai-painter-replay-retention-review-v1\.mjs'/)
 assert.match(source,/const recoverySources=\[SELF,REPLAY_REVIEW_WORKER,RECOVERY_PY_TEST,RECOVERY_JS_TEST,RECOVERY_CLI\]/)
 assert.equal(RECOVERY_CLI,'scripts/run-ai-painter-replay-retention-review-recovery-v1.mjs')
 assert.doesNotMatch(source,/recoverySources=\[[^\]]*RECOVERY_POLICY/)
 assert.match(source,/recovery:recoveryBinding,recoverySources/)
 assert.match(source,/assert\(!fs\.existsSync\(absolute\(outputRoot\)\),'consumed review output; no retry'\)/)
})
test('actual isolated wrong recovery policy preflight writes only an explicit refusal; no worker or registry',()=>{
 const baseDir=path.resolve(process.env.AI_PAINTER_REPLAY_RECOVERY_TEST_OUTPUT??'.runtime/ai-painter/controller-repair-reviews/replay-retention-review-recovery-092-20261027/review/fixtures'),root=path.join(baseDir,'refusal-'+randomUUID())
 fs.mkdirSync(path.join(root,path.dirname(RECOVERY_POLICY)),{recursive:true});fs.writeFileSync(path.join(root,REPLAY_REVIEW_POLICY),fs.readFileSync(REPLAY_REVIEW_POLICY),{flag:'wx'});fs.writeFileSync(path.join(root,RECOVERY_POLICY),'{}\n',{flag:'wx'})
 const url=pathToFileURL(path.resolve('scripts/lib/ai-painter-replay-retention-review-recovery-v1.mjs')).href
 const script=`const m=await import(${JSON.stringify(url)});try{await m.runReplayRetentionReviewRecovery({projectRoot:process.cwd()});process.exitCode=2}catch(e){if(!e.reviewFailureEvidence)throw e;console.log(JSON.stringify(e.reviewFailureEvidence))}`
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:131072,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}})
 assert.equal(child.status,0,child.stderr);const b=JSON.parse(child.stdout),raw=fs.readFileSync(path.join(root,b.path)),value=JSON.parse(raw)
 assert.equal(sha(raw),b.sha256);assert.equal(value.registered,false);assert.equal(value.executionState,'failed_closed');assert.equal(value.visualOutcome,'unknown');assert.equal(value.formalQualificationGranted,false)
 assert.equal(fs.existsSync(path.join(root,'.runtime/ai-painter/current-execution-registry')),false)
 assert.equal(fs.existsSync(path.join(root,path.dirname(b.path),'worker-lease.json')),false)
})
