import assert from 'node:assert/strict'
import fs from 'node:fs'
import {test} from 'node:test'
import {currentNaturalCandidate,naturalCandidateKey,verifyNativeCandidateRasters} from '../prepare-natural-world-live-map-candidate.mjs'
import {json,safe} from '../lib/world-initialized-evolution.mjs'
const base='.runtime/ai-painter/controller-repair-reviews/',before=json(base+'natural-world-current-map-render-227-20261103/preflight.json')
test('candidate key binds current snapshot, condition, trained model and executed numeric code',()=>{
  const p=before.plan.identityPayload;assert.equal(naturalCandidateKey(p),before.key)
  for(const mutate of [v=>v.store.sha256='a'.repeat(64),v=>v.descriptor.sha256='b'.repeat(64),v=>v.model.checkpoint.sha256='c'.repeat(64),v=>v.programs[0].sha256='d'.repeat(64)]){
    const v=structuredClone(p);mutate(v);assert.notEqual(naturalCandidateKey(v),before.key)
  }
  assert.throws(()=>naturalCandidateKey({...p,stage:0}));assert.throws(()=>naturalCandidateKey({...p,world:{worldId:'foreign'}}))
})
test('the existing historical native bytes validate the complete float-to-PNG mapping; a changed float or pixel digest fails',async()=>{
  const old=base+'world-first-current-rgb-192-20261103/run/',out=json(old+'inference-result.json')
  const npy=fs.readFileSync(safe(old+'natural-world-native1024.npy')),png=fs.readFileSync(safe(old+'natural-world-native1024.png'))
  await verifyNativeCandidateRasters(npy,png,out.outputPixelSha256,out.output.sha256)
  await assert.rejects(verifyNativeCandidateRasters(npy,png,'0'.repeat(64),out.output.sha256))
  const wrong=Buffer.from(npy);wrong.writeFloatLE(Number.NaN,wrong.length-4)
  await assert.rejects(verifyNativeCandidateRasters(wrong,png,out.outputPixelSha256,out.output.sha256))
})
test('unknown action never opens the worker or a supplied image',async()=>{
  await assert.rejects(currentNaturalCandidate('force'))
})
