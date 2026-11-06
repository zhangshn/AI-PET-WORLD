import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {rankNativeDevelopment,compareNativeDevelopment,readNativeStage0ReviewReferences,inspectNativeStage0ReviewComponent,readNativeStage0FormalReview} from '../lib/native-stage0-formal-review.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/native-stage0-formal-training-229-20261103'
const folder=base+'/worker/cpu-review-component-v2/segments/48'
const observed=JSON.parse(fs.readFileSync(folder+'/observation.json','utf8')),ids=observed.rows.map(r=>r.sampleId)
test('verified fixed sources match all eight original V24 CPU baseline rows, unchanged despite 164 train replacement',()=>{
  const v=readNativeStage0ReviewReferences()
  assert.deepEqual(v.ids,ids);assert.equal(v.reference.meanValidationRgbMae,0.06140733743086457)
  assert.equal(v.reference.worstApplicableObjectCorrelation,-0.08459185063838959)
  assert.equal(v.baselineCheckpoint.sha256,'17ef6676f9fc99cf87cd3e75462d9fe052b6ceff40546b3c0c83f9652ff14e1e')
})
test('fixed order, numeric rank, applicable classes and split reject rebinding or missing evidence',()=>{
  const expected=rankNativeDevelopment(24,ids,observed.rows)
  assert.deepEqual(expected.rank,observed.metrics.rank)
  for(const tweak of [r=>r.reverse(),r=>r.pop(),r=>r[0].split='train',r=>r[0].epoch=12,r=>r[0].fullRgbMae=NaN,
    r=>r[0].objectCorrelations.object_tree=1.1,r=>r.forEach(x=>x.objectCorrelations.object_rock=null)]){
    const r=structuredClone(observed.rows);tweak(r);assert.throws(()=>rankNativeDevelopment(24,ids,r))
  }
  const noTarget=structuredClone(observed.rows);noTarget[0].objectCorrelations.object_rock=null
  assert.equal(rankNativeDevelopment(24,ids,noTarget).applicableImageCounts.object_rock,7)
})
test('old retention inequality is inclusive on mean RGB and strictly improves worst applicable correlation',()=>{
 const original=readNativeStage0ReviewReferences().reference
 const measure=(mae,r)=>compareNativeDevelopment({meanValidationRgbMae:mae,worstApplicableObjectCorrelation:r},original)
 assert.equal(measure(original.meanValidationRgbMae,original.worstApplicableObjectCorrelation).passed,false)
 assert.equal(measure(original.meanValidationRgbMae,original.worstApplicableObjectCorrelation+0.001).passed,true)
 assert.equal(measure(original.meanValidationRgbMae+0.001,0.9).passed,false)
})
test('actual untrained component binds all saved PNGs and yields separate per-gate machine verdict, never a formal checkpoint',async()=>{
 const result=await inspectNativeStage0ReviewComponent({folder})
 assert.equal(result.formalRunReviewed,false);assert.equal('stageAdvanceAllowed' in result,false);assert.equal(result.absolute.decision.status,'dry_single_world_review_failed_closed')
 assert.equal(result.absolute.decision.waterAbsencePassed,true);assert.equal(result.absolute.decision.aestheticPassed,true)
 assert.equal(result.absolute.decision.detailPassed,false);assert.equal(result.absolute.decision.objectSemanticsPassed,false)
 assert.equal(result.absolute.decision.runtimePublicationGranted,false);assert.equal(result.retention.passed,false)
 assert.deepEqual(result.rows.map(r=>r.sampleId),ids);assert(result.rows.every(r=>r.independentMaskReadback.object_tree.pixels===r.maskPixels.object_tree))
 assert(result.issues.includes('condition_object_rock_reference_semantic_mismatch'))
 assert(result.issues.includes('validation_not_improved_without_mean_rgb_regression'))
})
test('rehearsal files cannot be reinterpreted as a sealed formal run, and non-review epochs are prohibited',async()=>{
 await assert.rejects(()=>inspectNativeStage0ReviewComponent({folder:folder+'/../48'}),/outside component/)
 await assert.rejects(()=>inspectNativeStage0ReviewComponent({folder:'.runtime/ai-painter/native-stage0-formal-training/stage0-native-256-formal-229/segments/48'}),/outside component/)
 for(const value of [0,1,36,'24'])await assert.rejects(()=>readNativeStage0FormalReview(value),/only immutable/)
})
