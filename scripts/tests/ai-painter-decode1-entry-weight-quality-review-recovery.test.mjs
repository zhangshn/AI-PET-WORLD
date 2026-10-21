import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {remainingRecoveryBudget,validateRecoveryPrograms,RECOVERY_LIMITS,assertFreshRecoveryDirectory,successorOutputRoot,SUCCESSOR_CASE,loadSuccessorLedger,PRELAUNCH_BINDINGS,independentBudgetFromFacts,measureIndependentPrior,createIndependentHeartbeat,independentOutputRoot,INDEPENDENT_CASE,reviewCli}
 from '../lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs'
import {json} from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs'
import {verifiedPrelaunchFailure} from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'

const prior=()=>({phase:'review',cleanupConfirmed:true,ownerClosed:true,proof:{activeProcessesAfterCleanup:0,exitCode:1},
 budget:{timeoutMs:120000,outputBytes:16777216},elapsedMs:57148,streamBytes:{stdout:0,stderr:2112}})
const binding=(path,sha256='a'.repeat(64))=>({path,sha256})
test('remaining allowance debits original wall and streams',()=>{
 assert.deepEqual(remainingRecoveryBudget(prior()),{timeoutMs:62852,streamBytes:8386496,outputBytes:16775104,priorStreamBytes:2112})
 assert.equal(RECOVERY_LIMITS.modelForwardCalls,16);assert.equal(RECOVERY_LIMITS.optimizerSteps,0);assert.equal(RECOVERY_LIMITS.automaticRetries,0)
})
for(const [name,change]of [
 ['unknown cleanup',p=>p.cleanupConfirmed=false],['open native owner',p=>p.ownerClosed=false],
 ['nonempty job',p=>p.proof.activeProcessesAfterCleanup=1],['wall exhaustion',p=>p.elapsedMs=120000],
 ['new time allowance',p=>p.budget.timeoutMs=240000],['new output allowance',p=>p.budget.outputBytes*=2],
 ['stream exhaustion',p=>p.streamBytes.stderr=8388608],['negative stream debit',p=>p.streamBytes.stdout=-1]])
 test('reject '+name,()=>{const p=prior();change(p);assert.throws(()=>remainingRecoveryBudget(p))})
test('only four registered recovery sources may change at the same paths',()=>{
 const old={reviewWorker:binding('worker.py'),reviewDriver:binding('driver.mjs'),nativeRunner:binding('native.mjs'),executionAuth:binding('auth.py'),math:binding('math.py')}
 const next=structuredClone(old);for(const key of ['reviewWorker','reviewDriver','nativeRunner','executionAuth'])next[key].sha256='b'.repeat(64)
 validateRecoveryPrograms(old,next)
 const wrong=structuredClone(next);wrong.math.sha256='c'.repeat(64);assert.throws(()=>validateRecoveryPrograms(old,wrong))
 const retarget=structuredClone(next);retarget.reviewWorker.path='foreign.py';assert.throws(()=>validateRecoveryPrograms(old,retarget))
 const omitted=structuredClone(next);delete omitted.math;assert.throws(()=>validateRecoveryPrograms(old,omitted))
})
test('alternate recovery namespace is rejected before filesystem access',()=>assert.throws(()=>assertFreshRecoveryDirectory(process.cwd(),'foreign')))
test('native recovery has no arbitrary executable or argument route',()=>{
 const source=fs.readFileSync(new URL('../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs',import.meta.url),'utf8')
 assert.match(source,/recovery=entry\.recoveryNativeContext\(root,reviewRecoveryPlan,onHeartbeat\)/u)
 assert.match(source,/assert\.deepEqual\(args,\[inside\(root,ROLES\.reviewDriver\),'--independent-review-child'/u)
 assert.match(source,/recovery\.original\.runtimeIdentity\.node\.absolutePath/u)
})
test('original JS numerical and visual auditors are byte equivalent',()=>{
 const current=fs.readFileSync(new URL('../lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n')
 const original=fs.readFileSync('.runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022/source-baselines/c9189d670cf8e0456a51c2cca0779f067e3dfa4f482a9695b48b326ce807d604.txt','utf8').replaceAll('\r\n','\n')
 const body=s=>s.slice(s.indexOf(' const report=json(root,reportBinding)'),s.indexOf('export async function runReview'))
 assert.equal(body(current),body(original))
})
test('new output identity cannot point at consumed predecessor',()=>{
 const id='12345678-1234-1234-1234-123456789abc'
 assert.equal(successorOutputRoot(id),SUCCESSOR_CASE+'/review-v2-'+id)
 for(const bad of ['recovery-v1','../escape','1234',id+'/extra'])assert.throws(()=>successorOutputRoot(bad))
})
test('real predecessor and closeout costs remain in the successor allowance',()=>{
 const p=json(process.cwd(),PRELAUNCH_BINDINGS.plan),receipt=json(process.cwd(),p.priorReviewReceipt)
 const ledger=loadSuccessorLedger(process.cwd(),receipt)
 assert.equal(ledger.wallDebitMs,65572);assert.equal(ledger.budget.timeoutMs,54428)
 assert.equal(ledger.budget.priorStreamBytes,41654)
 assert.equal(ledger.budget.outputBytes,16735562)
 assert.equal(ledger.closedRegistry.activeExecution,null)
 assert.ok(ledger.roots.includes(p.outputRoot));assert.ok(ledger.roots.some(p=>p.endsWith('old-prelaunch-closeout')))
})
test('disk-shaped prelaunch booleans never obtain same-call authority',()=>{
 const error=new Error('disk shaped');error.prelaunchProof={nativeNotLaunched:true,nativeCleanupCertified:false}
 assert.equal(verifiedPrelaunchFailure(error,process.cwd(),{path:'foreign',sha256:'0'.repeat(64)}),null)
})


test('independent allowance recomputes all real prior evidence without resetting old budget',()=>{
 const ledger=measureIndependentPrior(process.cwd()),b=ledger.budget
 assert.equal(ledger.wallDebitMs,119634);assert.equal(b.timeoutMs,180366);assert.equal(b.terminalReserveMs,15000)
 assert.equal(b.priorByteDebit,556372);assert.equal(b.priorStreamBytes,43375)
 assert.equal(b.outputBytes+b.priorByteDebit+b.controlReserveBytes,16777216)
 for(const wall of [[57148,6142,2282,0],[57148,6142,2282,54063]])assert.throws(()=>independentBudgetFromFacts(wall,556372,43375))
 assert.throws(()=>independentBudgetFromFacts([57148,6142,2282,54062],16777216,43375))
})
test('independent heartbeat preserves strict five second monotonic refresh bound',()=>{
 let time=0;const h=createIndependentHeartbeat({now:()=>time});assert.equal(h.due(),true);h.committed()
 time=999;assert.equal(h.due(),false);time=1000;assert.equal(h.due(),true);h.committed()
 time=6000;assert.equal(h.due(),true);time=6001;assert.throws(()=>h.due())
 assert.throws(()=>h.committed(),'publication cannot hide an overlong refresh interval')
})
test('consumed predecessor CLI flags reject before preparation or model invocation',async()=>{
 for(const flag of ['--recover-once','--recover-child'])await assert.rejects(reviewCli([flag,'old','a'.repeat(64)]),/consumed predecessor/)
 const id='12345678-1234-1234-1234-123456789abc';assert.equal(independentOutputRoot(id),INDEPENDENT_CASE+'/review-'+id)
})
