import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {nativeContinuationCommand,continuationCursor,continuationOutcome,driveContinuationSegment} from '../lib/native-stage0-continuation-host.mjs'
const root='.runtime/ai-painter/native-stage0-formal-training/stage0-native-256-formal-229'
const snap=p=>{const b=fs.readFileSync(p);return createHash('sha256').update(b).digest('hex')}
const context={runId:'stage0-native-256-formal-229',deadlineUtc:'2026-11-03T08:09:02.105Z',endPair:312,nextSegment:14,reservedSegment:null}
test('resume starts at first untouched segment; uncertain reservation, bad clock, wrong identity or nonpaired cursor cannot be retried',()=>{
 assert.equal(continuationCursor(context),14)
 for(const v of [{endPair:311},{nextSegment:13},{deadlineUtc:'2030-01-01T00:00:00Z'},{reservedSegment:14},{runId:'fresh'}])assert.throws(()=>continuationCursor({...context,...v}))
})
function simulated(fail){
 const sequence=[]
 const hooks=Object.fromEntries(['waitForCapacity','claim','perform','seal','independentReadback','review','reap'].map(k=>[k,(...args)=>{
   sequence.push(k);if(k===fail)throw Error(k);return k==='review'?{qualityPassed:false}:args[0]
 }]))
 return {sequence,hooks}
}
test('normal orchestration preserves pinned13, observes only at24, and never promotes a failed final review',async()=>{
 const cases=[[14,['waitForCapacity','claim','perform','seal']],[15,['waitForCapacity','claim','perform','seal','reap']],[24,['waitForCapacity','claim','perform','seal','review','reap']],
 [48,['waitForCapacity','claim','perform','seal','independentReadback','review','reap']]]
 for(const [n,expected] of cases){const t=simulated();const verdict=await driveContinuationSegment(n,t.hooks);assert.deepEqual(t.sequence,expected)
   if(n===48)assert.equal(continuationOutcome(n,verdict.qualityPassed),'training_completed_fixed_review_failed')}
 assert.throws(()=>continuationOutcome(24,true));assert.equal(continuationOutcome(48,true),'training_completed_fixed_review_passed')
})
test('real control flow halts at each failing operation; no automatic second worker, reaping, final reply or readback',async()=>{
 for(const phase of ['waitForCapacity','claim','perform','seal','independentReadback','review','reap']){
  const t=simulated(phase);await assert.rejects(()=>driveContinuationSegment(48,t.hooks));assert.equal(t.sequence.at(-1),phase)
  assert.equal(t.sequence.filter(x=>x==='claim').length,phase==='waitForCapacity'?0:1)
  assert(t.sequence.filter(x=>x==='perform').length<=1)
 }
})
test('fixed normal readonly status reads an immutable old failure and reports fresh observation time without creating an activation',async()=>{
 const old=snap(root+'/terminal.json'),pin=snap(root+'/segments/13/recovery.pt')
 const pre=fs.existsSync(root+'/continuations/resource-continuation-236');const started=Date.now()
 const r=await nativeContinuationCommand('--status');assert.equal(r.runId,context.runId);assert.equal(r.deadlineUtc,context.deadlineUtc)
 assert.equal(r.oldTerminal.sha256,old);assert(Date.parse(r.sourceTime)>=started)
 assert.equal(typeof r.activeProof==='object',true);assert.equal(fs.existsSync(root+'/continuations/resource-continuation-236'),pre)
 assert.equal(snap(root+'/terminal.json'),old);assert.equal(snap(root+'/segments/13/recovery.pt'),pin)
 await assert.rejects(()=>nativeContinuationCommand('--host','--root','other'),/fixed continuation command/)
})
