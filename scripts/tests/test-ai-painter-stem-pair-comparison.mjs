import test from 'node:test'
import assert from 'node:assert/strict'
import {sealStemPairSuccessor,sealStemDecoderSuccessor} from '../lib/ai-painter-stem-pair-comparison-v1.mjs'
function fixture(){
 const baseline={arm:'stem-pair-support1',parentExperiment:{checkpoint:{path:'parent.pt',sha256:'a'.repeat(64)}},selectedSampleIds:['train-a','train-b'],training:{pairs:448,supportStructureWeight:1,seed:20260929},resources:{maxWallSeconds:3600},modelCapability:'independent-pair'}
 const template={arm:'stem-pair-baseline',equalBudgetComparator:null,comparisonBindingStatus:'pending_completed_stem_pair_support1',parentExperiment:structuredClone(baseline.parentExperiment),sampleIds:baseline.selectedSampleIds,training:{...baseline.training,supportStructureWeight:.1},resources:baseline.resources,modelCapability:baseline.modelCapability}
 const bindings=Object.fromEntries(['package','terminal','result'].map(k=>[k,{path:k+'.json',sha256:'b'.repeat(64)}]))
 return {template,baseline,bindings}
}
test('local successor sealing changes only completed baseline linkage and preserves inputs',()=>{
 const {template,baseline,bindings}=fixture();const before=structuredClone(template);const result=sealStemPairSuccessor(template,baseline,bindings)
 assert.deepEqual(template,before);assert.equal(result.comparisonBindingStatus,'bound_completed_stem_pair_support1');assert.deepEqual(result.equalBudgetComparator,bindings)
 result.parentExperiment.checkpoint.path='changed';result.equalBudgetComparator.package.path='changed'
 assert.deepEqual(template,before);assert.equal(bindings.package.path,'package.json')
})
test('sealing rejects mismatched source, order, budget, identity, weight and prior sealing',()=>{
 for(const change of [f=>f.template.arm='old',f=>f.baseline.arm='old',f=>f.template.equalBudgetComparator={},f=>f.template.comparisonBindingStatus='bound',f=>f.template.parentExperiment={},f=>f.template.sampleIds=['train-b','train-a'],f=>f.template.training.pairs=449,f=>f.template.training.supportStructureWeight=1,f=>f.template.resources={maxWallSeconds:7200},f=>f.template.modelCapability='other',f=>delete f.bindings.result,f=>f.bindings.package.sha256='invalid']){
  const f=fixture();change(f);assert.throws(()=>sealStemPairSuccessor(f.template,f.baseline,f.bindings))
 }
})

test('decoder successor uses its own two arms and cannot seal a consumed pair',()=>{
 const source=fixture();
 const t=structuredClone(source.template),b=structuredClone(source.baseline)
 t.arm='stem-decoder-baseline';t.comparisonBindingStatus='pending_completed_stem_decoder_support1';b.arm='stem-decoder-support1'
 const next=sealStemDecoderSuccessor(t,b,source.bindings)
 assert.equal(next.comparisonBindingStatus,'bound_completed_stem_decoder_support1')
 assert.equal(next.training.supportStructureWeight,.1)
 assert.throws(()=>sealStemPairSuccessor(t,b,source.bindings))
})
