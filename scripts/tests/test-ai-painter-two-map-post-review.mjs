import {EventEmitter} from 'node:events'
import {stopReviewWorker} from '../lib/ai-painter-two-map-post-review-v1.mjs'
import fs from 'node:fs'
import {stemPolicies} from '../lib/ai-painter-mixed-train-rehearsal-v1.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewDecision,validateReviewSource} from '../lib/ai-painter-two-map-post-review-v1.mjs'
import {twoMapSamples,twoMapCheckpointSuccessorPolicy} from '../lib/ai-painter-two-map-experiment-v1.mjs'
import {readTwoMapPostReviewWorkEvidence} from '../../src/server/local-backup/two-map-post-review-work-evidence.mjs'
import {reviewThenDeliver} from '../lib/ai-painter-post-review-delivery-v1.mjs'
const flags={formalQualificationGranted:false,checkpointPromotable:false,runtimePublicationAllowed:false,automaticNextTraining:false}
function rows(){return [...twoMapSamples,...Array.from({length:8},(_,i)=>'validation-'+i)].map((sampleId,i)=>({sampleId,split:i<2?'train':'validation',passed:true,issueCodes:[]}))}
function source(){
 const pkg={experimentIdentity:'source',outputRoot:'.runtime/source',schemaVersion:'two-map-checkpoint-fit-package-v1',policy:{path:twoMapCheckpointSuccessorPolicy},selectedSampleIds:twoMapSamples,training:{pairs:200,visitsPerSample:100}}
 const cp={path:pkg.outputRoot+'/checkpoint-final.pt',sha256:'a'.repeat(64)},terminal={runId:'source',executionState:'completed',executionPackage:{path:pkg.outputRoot+'/package.json'},exitCode:0,timedOut:false}
 const policy={schemaVersion:'ai-painter-two-map-post-review-policy-v1',sourceTerminal:{path:pkg.outputRoot+'/terminal.json'},sourceCheckpoint:cp,trainSampleIds:twoMapSamples,resources:{maxWallSeconds:300,cpuThreads:2,generatorForwards:10,maxOutputMiB:24,minimumFreeDiskMiB:2048,automaticRetries:0},trainingAllowed:false,gpuAllowed:false,optimizerUpdates:0,...flags}
 const result={experimentIdentity:'source',status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,formalQualificationGranted:false,optimizerSteps:{generator:200,discriminator:200},sampleVisits:Object.fromEntries(twoMapSamples.map(s=>[s,100])),artifacts:[{...cp}]}
 return {pkg,terminal,policy,result}
}
test('all component passes never grant qualification or retraining',()=>{const d=reviewDecision(rows());assert.equal(d.visualOutcome,'component_checks_passed_not_qualified');for(const k of Object.keys(flags))assert.equal(d[k],false)})
test('one validation failure rejects the aggregate without changing training',()=>{const r=rows();r[3]={...r[3],passed:false,issueCodes:['object_tree_mismatch']};assert.deepEqual(reviewDecision(r).failedSampleIds,['validation-1'])})
test('missing, duplicate, wrong-split and contradictory evidence are rejected',()=>{
 assert.throws(()=>reviewDecision(rows().slice(1)))
 for(const change of [r=>r[2].sampleId=r[3].sampleId,r=>r[3].split='train',r=>r[3].passed=false,r=>r[3].issueCodes=['hidden_failure']]){const r=rows();change(r);assert.throws(()=>reviewDecision(r))}
})
test('failed, incomplete or foreign checkpoint source cannot be reviewed',()=>{
 const f=source();validateReviewSource(f.policy,f.terminal,f.pkg,f.result)
 for(const change of [x=>x.terminal.executionState='failed_closed',x=>x.result.checkpointReloadExact=false,x=>x.result.optimizerSteps.generator=199,x=>x.policy.sourceCheckpoint.sha256='b'.repeat(64),x=>x.policy.gpuAllowed=true,x=>x.policy.resources.automaticRetries=1]){const x=structuredClone(f);change(x);assert.throws(()=>validateReviewSource(x.policy,x.terminal,x.pkg,x.result))}
})
test('work adapter rejects false qualification and missing immutable report',()=>{
 assert.equal(readTwoMapPostReviewWorkEvidence({terminal:{schemaVersion:'unrelated'},read(){throw Error('unexpected')}}),null)
 assert.throws(()=>readTwoMapPostReviewWorkEvidence({terminal:{schemaVersion:'ai-painter-two-map-post-review-terminal-v1',executionState:'completed',...flags,formalQualificationGranted:true},read(){throw Error('unexpected')}}))
})
function workFixture(){
 const hash='a'.repeat(64),outputRoot='.runtime/ai-painter/review-fixture',binding=name=>({path:outputRoot+'/'+name,sha256:hash})
 const executionPackage=binding('package.json'),sourceTerminal=binding('source.json'),sourceCheckpoint=binding('checkpoint.pt')
 const pkg={schemaVersion:'ai-painter-two-map-post-review-package-v1',reviewId:'review',outputRoot,sourceTerminal,sourceCheckpoint,trainSampleIds:twoMapSamples,validationSampleIds:rows().slice(2).map(r=>r.sampleId)}
 const audits=rows().map((r,i)=>({...r,evidence:binding('audit-'+i+'.json')}));audits[3].passed=false;audits[3].issueCodes=['tree_mismatch']
 const observations=audits.map((r,i)=>({sampleId:r.sampleId,prediction:binding('prediction-'+i+'.png'),identity:{image:binding('reference-'+i+'.png'),conditionPack:binding('condition-'+i+'.json')}}))
 const inference={reviewId:'review',executionPackage,sourceCheckpoint,observations,actualCalls:{generatorForwards:10,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0},stateBefore:['same'],stateAfter:['same'],optimizerUpdates:0,gpuInitialized:false}
 const report={schemaVersion:'ai-painter-two-map-post-review-result-v1',reviewId:'review',executionPackage,sourceTerminal,sourceCheckpoint,inference:binding('inference.json'),audits,visualOutcome:'failed',issueCodes:['tree_mismatch'],...flags}
 const terminal={schemaVersion:'ai-painter-two-map-post-review-terminal-v1',runId:'review',packageId:'review',sourceRunId:'source',sourceTerminal,executionPackage,executionState:'completed',status:'post_training_visual_review_failed',visualOutcome:'failed',report:binding('review.json'),optimizerUpdates:0,gpuInitialized:false,...flags}
 const values=new Map([[executionPackage.path,pkg],[sourceTerminal.path,{runId:'source',executionState:'completed'}],[terminal.report.path,report],[report.inference.path,inference]])
 for(const [i,row] of audits.entries())values.set(row.evidence.path,{sampleId:row.sampleId,split:row.split,prediction:observations[i].prediction,reference:observations[i].identity.image,condition:observations[i].identity.conditionPack,detail:{passed:true,issueCodes:[]},aesthetic:{passed:true,issues:[]},alignment:{passed:row.passed,issues:row.issueCodes.map(code=>({code}))}})
 return {terminal,pkg,report,inference,values,read:p=>{assert.ok(values.has(p),'missing bound evidence');return {value:values.get(p)}}}
}
test('machine work event distinguishes executed review from failed visual result',()=>{const f=workFixture();const r=readTwoMapPostReviewWorkEvidence(f);assert.equal(r.executionResult,'succeeded');assert.equal(r.failedSamples,1);assert.deepEqual(r.issueCodes,['tree_mismatch'])})
test('work event rejects swapped predictions, hidden failures, updated weights and missing files',()=>{
 for(const change of [f=>f.inference.stateAfter=['changed'],f=>f.inference.actualCalls.optimizerAttempts=1,f=>f.report.issueCodes=[],f=>f.report.audits[3].passed=true,f=>f.values.delete(f.report.audits[0].evidence.path),f=>f.values.get(f.report.audits[0].evidence.path).prediction={path:'foreign',sha256:'b'.repeat(64)}]){const f=workFixture();change(f);assert.throws(()=>readTwoMapPostReviewWorkEvidence(f))}
})
test('local orchestration delivers after review without a second user step',async()=>{
 const order=[];const outcome=await reviewThenDeliver(async()=>{order.push('review');return {visualOutcome:'failed'}},async()=>{order.push('deliver');return {recorded:true}},()=>order.push('receipt'))
 assert.deepEqual(order,['review','deliver','receipt']);assert.equal(outcome.visualOutcome,'failed')
})
test('delivery failure cannot replace the primary review failure or rerun it',async()=>{
 const primary=Error('primary inference failure');let calls=0,receipt
 await assert.rejects(reviewThenDeliver(async()=>{calls++;throw primary},async()=>{throw Error('ledger unavailable')},r=>receipt=r),e=>e===primary)
 assert.equal(calls,1);assert.equal(receipt.recorded,false)
})

test('mixed training review requires own complete checkpoint and exact numeric identity',()=>{
 const f=source(),p=JSON.parse(fs.readFileSync(stemPolicies['stem-baseline'],'utf8'))
 f.policy.sourceKind='mixed-train'
 Object.assign(f.pkg,{schemaVersion:'mixed-train-rehearsal-package-v1',policy:{path:stemPolicies['stem-baseline']},selectedSampleIds:p.sampleIds,training:p.training,arm:'stem-baseline',modelCapability:p.modelCapability,numericOperatorsChanged:true})
 Object.assign(f.result,{arm:'stem-baseline',modelCapability:p.modelCapability,backgroundAuxiliaryChanged:true,optimizerSteps:{generator:448,discriminator:448},sampleVisits:Object.fromEntries(p.sampleIds.map(s=>[s,s===p.anchorSampleId?72:8]))})
 validateReviewSource(f.policy,f.terminal,f.pkg,f.result)
 for(const change of [x=>x.result.modelCapability='foreign',x=>x.result.optimizerSteps.generator=447,x=>x.result.sampleVisits[p.sampleIds[0]]=0,x=>x.policy.sourceKind=undefined,x=>x.pkg.numericOperatorsChanged=false]){
  const bad=structuredClone(f);change(bad);assert.throws(()=>validateReviewSource(bad.policy,bad.terminal,bad.pkg,bad.result))
 }
})

 test('review cleanup does not await an already closed signal-terminated worker',async()=>{
  const child={pid:100,exitCode:null,signalCode:'SIGTERM'}
  assert.deepEqual(await stopReviewWorker(child),{alreadyStopped:true})
  assert.deepEqual(await stopReviewWorker({...child,signalCode:null},{closed:true}),{alreadyStopped:true})
 })
 test('review cleanup subscribes before stop and is bounded if close never arrives',async()=>{
  const child=Object.assign(new EventEmitter(),{pid:100,exitCode:null,signalCode:null})
  assert.deepEqual(await stopReviewWorker(child,{stop:c=>c.emit('close',null)}),{alreadyStopped:false})
  await assert.rejects(stopReviewWorker(child,{timeoutMs:10,stop:()=>{}}),/cleanup timeout/)
  assert.equal(child.listenerCount('close'),0)
 })
