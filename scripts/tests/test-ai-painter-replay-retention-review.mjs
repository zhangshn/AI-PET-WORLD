// Pure CPU policy/classification fixtures; no 56-image model or training run.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {boundaryPolicyBinding,boundaryTraining} from '../lib/ai-painter-replay-retention-fit-v1.mjs'
import {REPLAY_REVIEW_POLICY,REPLAY_REVIEW_POLICY_SHA,REPLAY_REVIEW_DYNAMIC_HELPER,HISTORICAL_SOURCE_BASELINE,TARGET,validateReviewPolicy,validateReviewSource,selectCurrentSource,metricChanges,numericSummary,absoluteDelta,classifyReplayRetention,describeReplayRetention,MAX_REVIEW_JSON_BYTES,encodeReviewJson,expandInferenceManifest,reviewRowShard} from '../lib/ai-painter-replay-retention-review-v1.mjs'

const clone=v=>JSON.parse(JSON.stringify(v))
const policyBytes=fs.readFileSync(REPLAY_REVIEW_POLICY),policy=JSON.parse(policyBytes)
function metrics(full=.1,regionMae=.1,correlation=.5){return {fullRgbMae:full,regions:Object.fromEntries(['core','support'].map(kind=>[kind,Object.fromEntries(policy.relativeRetention.metricRoles.map(role=>[role,{pixels:10,rgbMae:regionMae,correlation,naReason:null}]))]))}}
function rows(){return Array.from({length:56},(_,n)=>({sampleId:n===0?TARGET:'sample-'+n,split:n<48?'train':'validation',parentMetrics:metrics(),metrics:metrics(n===0?.095:.1),parentAbsolute:{passed:true,issueCodes:[]},candidateAbsolute:{passed:true,issueCodes:[]}}))}

function manifestFixture(){
 const raw=new Map(),root='.runtime/private-review',packageBinding={path:root+'/package.json',sha256:'a'.repeat(64)},input=rows(),pkg={reviewId:'private-review',outputRoot:root,trainSampleIds:input.slice(0,48).map(r=>r.sampleId),validationSampleIds:input.slice(48).map(r=>r.sampleId)}
 const publish=(name,value)=>{const path=root+'/'+name,bytes=encodeReviewJson(value);raw.set(path,bytes);return {path,sha256:createHash('sha256').update(bytes).digest('hex')}}
 const observationBindings=input.map((r,n)=>({sampleId:r.sampleId,split:r.split,binding:publish('observation-'+n+'.json',{schemaVersion:'ai-painter-replay-retention-observation-v1',reviewId:pkg.reviewId,executionPackage:packageBinding,sampleId:r.sampleId,split:r.split,identity:{sampleId:r.sampleId},metrics:r.metrics,nativePredictionDimensions:{width:256,height:192},referenceNativeDimensions:{width:1024,height:768}})}))
 const bindings=Array.from({length:513},(_,n)=>({path:'input-'+n+'.json',sha256:'b'.repeat(64)})),inputManifestBindings=[]
 for(let offset=0;offset<bindings.length;offset+=256)inputManifestBindings.push(publish('input-'+offset+'.json',{schemaVersion:'ai-painter-replay-retention-input-bindings-v1',reviewId:pkg.reviewId,executionPackage:packageBinding,offset,bindings:bindings.slice(offset,offset+256)}))
 const inference={schemaVersion:'ai-painter-replay-retention-review-inference-v1',reviewId:pkg.reviewId,executionPackage:packageBinding,observationsStorage:'sha256_per_sample_json_v1',observationBindings,inputsStorage:'sha256_binding_chunks_v1',inputCount:bindings.length,inputManifestBindings}
 const read=b=>{const bytes=raw.get(b.path);assert(bytes);assert(bytes.length<=MAX_REVIEW_JSON_BYTES);assert.equal(createHash('sha256').update(bytes).digest('hex'),b.sha256);return JSON.parse(bytes)}
 return {raw,pkg,packageBinding,inference,read,publish}
}

test('compact JSON checks actual UTF8 bytes and rejects oversized/nonfinite values',()=>{
 assert.deepEqual(JSON.parse(encodeReviewJson({text:'汉字'})),{text:'汉字'})
 for(const value of [{text:'a'.repeat(MAX_REVIEW_JSON_BYTES)},{text:'汉'.repeat(MAX_REVIEW_JSON_BYTES/2)},{number:NaN}])assert.throws(()=>encodeReviewJson(value))
})
test('56 observation and 513 input bindings expand only after exact SHA and complete offsets',()=>{
 const f=manifestFixture(),expanded=expandInferenceManifest(f.inference,f)
 assert.equal(expanded.observations.length,56);assert.equal(expanded.inputs.length,513)
 assert.deepEqual(expanded.observations.map(r=>r.sampleId),[...f.pkg.trainSampleIds,...f.pkg.validationSampleIds])
 for(const bytes of f.raw.values())assert(bytes.length<=MAX_REVIEW_JSON_BYTES)
})
test('missing duplicate foreign wrong-SHA or wrongly ordered shards reject',()=>{
 for(const mutate of [f=>f.inference.observationBindings.pop(),f=>f.inference.observationBindings[1]=f.inference.observationBindings[0],f=>f.inference.observationBindings[0].binding.sha256='c'.repeat(64),f=>f.inference.observationBindings[0].binding.path='../other.json',f=>f.inference.inputManifestBindings.reverse(),f=>f.inference.inputCount--,f=>f.inference.observations=[]]){
  const f=manifestFixture();mutate(f);assert.throws(()=>expandInferenceManifest(f.inference,f))
 }
 const f=manifestFixture();f.raw.set(f.inference.observationBindings[0].binding.path,Buffer.from('{}'));assert.throws(()=>expandInferenceManifest(f.inference,f))
})
test('row projection carries SHA observation reference without duplicating full identity or current metrics',()=>{
 const row={...rows()[0],aMetrics:metrics(),relative:{status:'retained'},absolute:{status:'passed'}},ref={path:'observation.json',sha256:'a'.repeat(64)},context={reviewId:'review',executionPackage:{path:'package',sha256:'b'.repeat(64)}}
 const shard=reviewRowShard(row,ref,context)
 assert.equal(shard.schemaVersion,'ai-painter-replay-retention-review-row-v1');assert.deepEqual(shard.observation,ref)
 for(const name of ['identity','metrics','prediction','imageTiming'])assert.equal(Object.hasOwn(shard,name),false)
 assert(shard.parentMetrics&&shard.aMetrics);assert(encodeReviewJson(shard).length<MAX_REVIEW_JSON_BYTES)
})

test('bound079/086 row geometry fits sharded JSON and bounded8MiB metadata estimate without models',()=>{
 const parentPath='.runtime/ai-painter/controller-repair-reviews/terrain-ecology-all-samples-079-20261027/result.json',aPath='.runtime/ai-painter/controller-repair-reviews/single149-all-retention-086-20261027/result.json'
 const parent=JSON.parse(fs.readFileSync(parentPath)),single=JSON.parse(fs.readFileSync(aPath)),parents=parent.rows.filter(r=>r.arm==='candidate')
 assert.equal(single.rows.length,56);assert.equal(parents.length,56)
 const root='.runtime/private-size-fixture',packageBinding={path:root+'/package.json',sha256:'a'.repeat(64)},context={reviewId:'private-size-fixture',executionPackage:packageBinding},parts=[]
 const publish=(name,value)=>{const bytes=encodeReviewJson(value),binding={path:root+'/'+name,sha256:createHash('sha256').update(bytes).digest('hex')};parts.push({name,bytes:bytes.length});return binding}
 const observations=single.rows.map((r,n)=>({schemaVersion:'ai-painter-replay-retention-observation-v1',...context,sampleId:r.sampleId,split:r.split,identity:r.identity,slot:r.slot,ecologyIndex:r.ecologyIndex,monsoonSeason:'fixture',prediction:r.afterPrediction,metrics:r.afterMetrics,nativePredictionDimensions:{width:256,height:192},referenceNativeDimensions:{width:1024,height:768},imageTiming:r.imageTiming}))
 const observationBindings=observations.map((value,n)=>({sampleId:value.sampleId,split:value.split,binding:publish('observation-'+n+'.json',value)}))
 const oldReview='.runtime/ai-painter/learning-capacity-experiments/single149-post-review-v1-4bc5d6f499fb5cfb00d8/',template=JSON.parse(fs.readFileSync(oldReview+'audit-0.json'))
 const input=observations.map((o,n)=>{
  const audit=prefix=>{const raw={...template,sampleId:o.sampleId,split:o.split,prediction:prefix==='parent'?parents[n].prediction:o.prediction,reference:o.identity.image,condition:o.identity.conditionPack,nativePredictionDimensions:o.nativePredictionDimensions,referenceNativeDimensions:o.referenceNativeDimensions,projectionDimensions:{width:1024,height:768,kernel:'nearest'}}
   const issueCodes=[...new Set([...raw.detail.issueCodes,...raw.aesthetic.issues.map(i=>i.code),...raw.alignment.issues.map(i=>i.code)])]
   return {passed:raw.detail.passed&&raw.aesthetic.passed&&raw.alignment.passed,issueCodes,evidence:publish(prefix+'-'+n+'-audit.json',raw)}
  }
  return {...o,parentMetrics:parents[n].metrics,aMetrics:single.rows[n].afterMetrics,parentPrediction:parents[n].prediction,aPrediction:single.rows[n].afterPrediction,parentAbsolute:audit('parent'),candidateAbsolute:audit('candidate')}
 })
 const decision=classifyReplayRetention(input,policy),rowBindings=decision.rows.map((r,n)=>({sampleId:r.sampleId,split:r.split,binding:publish('row-'+n+'.json',reviewRowShard(r,observationBindings[n].binding,context))}))
 const {rows:ignored,...summary}=decision
 const a=classifyReplayRetention(input.map(r=>({...r,metrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy),ca=classifyReplayRetention(input.map(r=>({...r,parentMetrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy)
 const describe=v=>({groups:v.groups,targetFullRgbMaeImproved:v.targetFullRgbMaeImproved,targetObjectChanges:v.targetObjectChanges})
 publish('review.json',{schemaVersion:'ai-painter-replay-retention-review-result-v1',...context,rowsStorage:'sha256_per_sample_json_v1',rowBindings,...summary,aVersusParent:describe(a),candidateVersusA:describe(ca),sizeFixtureOnly:true})
 const uniqueInputs=[...new Map([...parent.inputs,...single.inputs].map(b=>[b.path,b])).values()],inputManifestBindings=[]
 for(let offset=0;offset<uniqueInputs.length;offset+=256)inputManifestBindings.push(publish('input-'+offset+'.json',{schemaVersion:'ai-painter-replay-retention-input-bindings-v1',...context,offset,bindings:uniqueInputs.slice(offset,offset+256)}))
 publish('inference.json',{schemaVersion:'ai-painter-replay-retention-review-inference-v1',...context,observationsStorage:'sha256_per_sample_json_v1',observationBindings,inputsStorage:'sha256_binding_chunks_v1',inputCount:uniqueInputs.length,inputManifestBindings,actualProjectSources:single.actualProjectSources,stateBefore:single.stateBefore,stateAfter:single.stateAfter,actualCalls:single.actualCalls,sizeFixtureOnly:true})
 const oldPackageBytes=Object.values(policy.parentExperiment).filter(b=>b.path.endsWith('/package.json')).reduce((n,b)=>n+fs.statSync(b.path).size,0)+Object.values(policy.single149Experiment).filter(b=>b.path.endsWith('/package.json')).reduce((n,b)=>n+fs.statSync(b.path).size,0)
 // Estimate the new B package using the larger existing parent48 package plus
 //256KiB explicit extra closure/schedule metadata. This is not a real package.
 const syntheticPackageEstimate=fs.statSync(policy.parentExperiment.package.path).size+262144
 const metadataBytes=parts.reduce((n,p)=>n+p.bytes,0)+oldPackageBytes+syntheticPackageEstimate+65536
 assert(parts.every(p=>p.bytes<=MAX_REVIEW_JSON_BYTES));assert(metadataBytes<8*1024**2)
 const result={kind:'private_bound_row_geometry_and_fake_audit_size_estimate_not_model_or_review',rowCount:56,parts,uniqueJsonEstimate:parts.length+10,estimatedMetadataBytes:metadataBytes,maximumNewJsonBytes:Math.max(...parts.map(p=>p.bytes)),syntheticNewPackageEstimate:syntheticPackageEstimate,originalEvidenceUntouched:true,nativeModelForwards:0,note:'8MiB estimate is not actual new B/C closure acceptance; consumer must enforce its real512 unique JSON/8MiB bound.'}
 const output=path.resolve(process.env.AI_PAINTER_REPLAY_REVIEW_TEST_OUTPUT??'.runtime/ai-painter/controller-repair-reviews/replay-retention-091-20261027/review/fixtures');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'measured-shard-sizes-'+randomUUID()+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
})

test('exact effective policy SHA and diagnostic-only resources and flags',()=>{
 assert.equal(createHash('sha256').update(policyBytes).digest('hex'),REPLAY_REVIEW_POLICY_SHA);validateReviewPolicy(policy)
 assert.equal(policy.relativeRetention.comparisonEpsilon,1e-6);assert.equal(policy.relativeRetention.maximumGroupMeanFullRgbMaeIncrease,.0005)
 for(const patch of [{gpuAllowed:true},{trainingAllowed:true},{optimizerUpdates:1},{formalQualificationGranted:true},{automaticNextTraining:true},{resources:{...policy.resources,generatorForwards:57}},{resources:{...policy.resources,workerMaxWallSeconds:901}}])assert.throws(()=>validateReviewPolicy({...policy,...patch}))
})
test('latest terminal selection cannot substitute history, explicit other SHA or activity',()=>{
 const b={path:'.runtime/latest/terminal.json',sha256:'a'.repeat(64)},previous={ok:true,registry:{activeExecution:null,latestTrainingTerminal:{...b,runId:'run'}}}
 assert.deepEqual(selectCurrentSource(previous),b);assert.deepEqual(selectCurrentSource(previous,b),b)
 assert.throws(()=>selectCurrentSource(previous,{...b,sha256:'b'.repeat(64)}))
 assert.throws(()=>selectCurrentSource({...previous,registry:{...previous.registry,activeExecution:{runId:'active'}}}))
 assert.throws(()=>selectCurrentSource({...previous,ok:false}));assert.throws(()=>selectCurrentSource({ok:true,registry:{activeExecution:null,latestTrainingTerminal:null}}))
})
test('finite equal numbers retain and comparisons never claim object recognition',()=>{
 const result=metricChanges(metrics(),metrics(),policy.relativeRetention)
 assert.equal(result.status,'retained');assert.equal(result.checks.length,17)
 const decision=classifyReplayRetention(rows(),policy)
 assert.equal(decision.targetFullRgbMaeImproved,true);assert.equal(decision.retentionPreserved,true)
 assert.equal(decision.groups.other47.count,47);assert.equal(decision.groups.developmentValidation8.count,8)
 assert.equal(decision.formalQualificationGranted,false);assert.equal(decision.automaticNextTraining,false)
 assert.equal(decision.targetObjectChanges.every(c=>c.delta===0),true)
})
test('image tolerance boundary and epsilon preserve fixed .002 bound',()=>{
 const d=policy.relativeRetention
 assert.equal(metricChanges(metrics(),metrics(.102),d).status,'retained')
 assert.equal(metricChanges(metrics(),metrics(.102+2e-6),d).status,'regressed')
 assert.equal(metricChanges(metrics(),metrics(.1,.103),d).status,'regressed')
 assert.equal(metricChanges(metrics(),metrics(.1,.1,.489),d).status,'regressed')
})
test('47-image group mean veto is independent from all per-image bounds',()=>{
 const input=rows();for(const r of input.slice(1,48))r.metrics.fullRgbMae+=.0006
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.groups.other47.regressedCount,0);assert.equal(d.groups.other47.meanFullRgbMaePassed,false)
 assert.equal(d.groups.other47.status,'regressed');assert.equal(d.recommendation,'do_not_adopt_retention_regression')
})
test('devval is separate and one severe image cannot be hidden by group improvement',()=>{
 const input=rows();input[48].metrics.fullRgbMae=.11
 for(const r of input.slice(49))r.metrics.fullRgbMae=.08
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.groups.other47.status,'retained');assert.equal(d.groups.developmentValidation8.status,'regressed')
 assert.equal(d.groups.developmentValidation8.regressedCount,1);assert.equal(d.groups.developmentValidation8.worstSamples[0].sampleId,'sample-48')
})
test('target full improvement stays separate from per-role object changes',()=>{
 const input=rows();input[0].metrics.regions.core.object_tree.rgbMae=.12
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.targetFullRgbMaeImproved,true)
 assert.equal(d.targetObjectChanges.find(c=>c.name==='core.object_tree.rgbMae').status,'regressed')
 assert.equal(d.targetObjectRegression,true);assert.equal(d.recommendation,'do_not_adopt_target_object_regression')
 assert.equal(d.groups.target149.status,'regressed');assert.equal(d.formalQualificationGranted,false)
 const unchanged=rows();unchanged[0].metrics.fullRgbMae=.0999
 assert.equal(classifyReplayRetention(unchanged,policy).recommendation,'do_not_adopt_no_target_improvement')
})
test('new absolute failure vetoes recommendation even when numeric retention passes',()=>{
 const input=rows();input[3].candidateAbsolute={passed:false,issueCodes:['layout_condition_failed']}
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.retentionPreserved,true);assert.equal(d.absoluteOutcome,'failed');assert.equal(d.newAbsoluteFailure,true)
 assert.equal(d.recommendation,'do_not_adopt_new_absolute_failures')
 assert.deepEqual(d.groups.other47.newAbsoluteFailures,[{sampleId:'sample-3',issueCodes:['layout_condition_failed']}])
})
test('existing absolute failures stay failed alongside relative pass',()=>{
 const input=rows();input[2].parentAbsolute=input[2].candidateAbsolute={passed:false,issueCodes:['detail_failed']}
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.retentionPreserved,true);assert.equal(d.absoluteOutcome,'failed');assert.equal(d.newAbsoluteFailure,false)
 assert.deepEqual(d.groups.other47.existingAbsoluteFailures,[{sampleId:'sample-2',issueCodes:['detail_failed']}])
 assert.equal(d.formalQualificationGranted,false)
})
test('NA stays distinct from unknown in all-NA role summaries',()=>{
 const input=rows()
 for(const row of input)for(const m of [row.parentMetrics,row.metrics])m.regions.core.object_rock={pixels:0,rgbMae:null,correlation:null,naReason:'empty_region'}
 const d=classifyReplayRetention(input,policy),s=d.groups.other47.metricDeltas['core.object_rock.rgbMae']
 assert.equal(d.groups.other47.status,'retained');assert.equal(s.notApplicableCount,47);assert.equal(s.unknownCount,0);assert.equal(s.validCount,0);assert.equal(s.mean,null)
})
test('NaN, missing metric, mismatched masks and missing absolute evidence never pass',()=>{
 for(const mutate of [row=>row.metrics.fullRgbMae=NaN,row=>delete row.metrics.regions.core.object_tree,row=>row.metrics.regions.core.object_tree.rgbMae=1.1,row=>row.metrics.regions.core.object_tree.rgbMae=-.1,row=>row.metrics.regions.core.object_tree.pixels++,row=>row.candidateAbsolute=null]){
  const input=rows();mutate(input[3]);const d=classifyReplayRetention(input,policy)
  assert.equal(d.recommendation,'evidence_unknown');assert.equal(d.retentionPreserved,null)
 }
})
test('statistics keep nearest-rank quantiles, counts and correct correlation direction',()=>{
 const s=numericSummary([-.1,0,.1,.2,null],1e-6)
 assert.equal(s.validCount,4);assert.equal(s.unknownCount,1);assert.equal(s.p50,0);assert.equal(s.p95,.2);assert.equal(s.improvedCount,1);assert.equal(s.worsenedCount,2)
 assert.equal(numericSummary([-.1,.1,.2],1e-6,'higher').improvedCount,2)
 const input=rows();input[2].metrics.regions.support.object_tree.correlation=.51
 const d=classifyReplayRetention(input,policy)
 assert.equal(d.groups.other47.metricDeltas['support.object_tree.correlation'].improvedCount,1)
})
test('duplicate, omitted, split-substituted cases and inconsistent audit booleans reject',()=>{
 assert.throws(()=>classifyReplayRetention(rows().slice(1),policy))
 const duplicate=rows();duplicate[1].sampleId=TARGET;assert.throws(()=>classifyReplayRetention(duplicate,policy))
 const wrongSplit=rows();wrongSplit[48].split='train';assert.throws(()=>classifyReplayRetention(wrongSplit,policy))
 assert.throws(()=>absoluteDelta({passed:true,issueCodes:['fail']},{passed:true,issueCodes:[]}))
})
test('both source arms require same parent, full counts and strict final state evidence',()=>{
 for(const arm of ['mixed','short']){
  const pairs=arm==='mixed'?200:100,run='run-'+arm,out='.runtime/'+run
  const source={schemaVersion:'replay-retention-fit-package-v1',arm,modelCapability:policy.modelCapability,experimentIdentity:run,outputRoot:out,checkpoint:policy.parentExperiment.checkpoint,parentExperiment:policy.parentExperiment,training:{pairs,targetPairs:100,replayPairs:arm==='mixed'?100:0}}
  const terminal={status:'experiment_completed_not_formal_qualified',executionState:'completed',runId:run,executionPackage:{path:out+'/package.json'}}
  const result={experimentIdentity:run,arm,modelCapability:source.modelCapability,status:'experiment_executed_not_visual_qualified',optimizerSteps:{generator:pairs,discriminator:pairs},targetUpdates:100,replayUpdates:source.training.replayPairs,checkpointReloadExact:true,sameParentStartVerified:true,parentStateHashes:{generator:'a'.repeat(64),discriminator:'b'.repeat(64)},initialStateHashes:{generator:'a'.repeat(64),discriminator:'b'.repeat(64)},finalStateHashes:{generator:'c'.repeat(64),discriminator:'d'.repeat(64)},artifacts:[{path:out+'/checkpoint-final.pt',sha256:'a'.repeat(64)}],formalQualificationGranted:false}
  validateReviewSource(policy,terminal,source,result)
  for(const patch of [{checkpointReloadExact:false},{parentStateHashes:['wrong','d']},{targetUpdates:99},{optimizerSteps:{generator:pairs-1,discriminator:pairs}},{formalQualificationGranted:true}])assert.throws(()=>validateReviewSource(policy,terminal,source,{...result,...patch}))
  assert.throws(()=>validateReviewSource(policy,terminal,{...source,checkpoint:{path:'other',sha256:'b'.repeat(64)}},result))
 }
})
test('balanced source requires exact registered200 schedule,5target195others and original parent',()=>{
 const p='data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json',bytes=fs.readFileSync(p),balanced=JSON.parse(bytes),train=rows().slice(0,48).map(r=>r.sampleId),visits=Object.fromEntries(train.map((sid,n)=>[sid,n<8?5:4])),run='balanced-run',out='.runtime/'+run
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db')
 const source={schemaVersion:'replay-retention-fit-package-v1',arm:'balanced',policy:{path:p,sha256:createHash('sha256').update(bytes).digest('hex')},training:balanced.training,selectedSampleIds:train,schedule:[...train,...train,...train,...train,...train.slice(0,8)],plannedSampleVisits:visits,modelCapability:policy.modelCapability,experimentIdentity:run,outputRoot:out,checkpoint:policy.parentExperiment.checkpoint,parentExperiment:policy.parentExperiment}
 const terminal={status:'experiment_completed_not_formal_qualified',executionState:'completed',runId:run,executionPackage:{path:out+'/package.json'}}
 const initial={generator:'a'.repeat(64),discriminator:'b'.repeat(64)},result={experimentIdentity:run,arm:'balanced',modelCapability:source.modelCapability,status:'experiment_executed_not_visual_qualified',optimizerSteps:{generator:200,discriminator:200},targetUpdates:5,replayUpdates:195,sampleVisits:visits,checkpointReloadExact:true,sameParentStartVerified:true,parentStateHashes:initial,initialStateHashes:initial,finalStateHashes:{generator:'c'.repeat(64),discriminator:'d'.repeat(64)},artifacts:[{path:out+'/checkpoint-final.pt',sha256:'a'.repeat(64)}],formalQualificationGranted:false}
 validateReviewSource(policy,terminal,source,result)
 for(const mutate of [s=>s.schedule.reverse(),s=>s.plannedSampleVisits[TARGET]=4,s=>s.selectedSampleIds.reverse(),s=>s.training.targetPairs=100,s=>s.training.seed++,s=>s.policy.sha256='0'.repeat(64),s=>s.checkpoint.sha256='0'.repeat(64)]){const changed=clone(source);mutate(changed);assert.throws(()=>validateReviewSource(policy,terminal,changed,result))}
 for(const patch of [{targetUpdates:100},{replayUpdates:194},{optimizerSteps:{generator:199,discriminator:200}},{sampleVisits:{...visits,[TARGET]:4}},{checkpointReloadExact:false},{formalQualificationGranted:true}])assert.throws(()=>validateReviewSource(policy,terminal,source,{...result,...patch}))
})

test('boundary review source binds own objective, all48 inputs and5/195 exposure',()=>{
 const train=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-mixed-train-terrain-ecology-policy-v1.json')).sampleIds,
  visits=Object.fromEntries(train.map((s,n)=>[s,n<8?5:4])),run='replay-retention-balanced-boundary-v1-fixture',out='.runtime/'+run
 const sampleIdentities=train.map((sampleId,n)=>({sampleId,split:'train',image:{path:`data/fake/${n}.png`,sha256:'a'.repeat(64)},conditionPack:{path:`data/fake/${n}.json`,sha256:'b'.repeat(64)},channels:[{id:'terrain_path_ground',path:`data/fake/${n}-road.png`,sha256:'c'.repeat(64)}]}))
 const boundaryInputBindings=sampleIdentities.map(i=>({sampleId:i.sampleId,image:i.image,conditionPack:i.conditionPack,road:{path:i.channels[0].path,sha256:i.channels[0].sha256}}))
 const source={schemaVersion:'replay-retention-fit-package-v1',arm:'balanced-boundary',policy:boundaryPolicyBinding,training:boundaryTraining(),selectedSampleIds:train,schedule:[...train,...train,...train,...train,...train.slice(0,8)],plannedSampleVisits:visits,modelCapability:policy.modelCapability,experimentIdentity:run,outputRoot:out,checkpoint:policy.parentExperiment.checkpoint,parentExperiment:JSON.parse(fs.readFileSync(boundaryPolicyBinding.path)).parentExperiment,sampleIdentities,boundaryInputBindings,inputs:boundaryInputBindings.flatMap(i=>[i.image,i.road,i.conditionPack])}
 const terminal={status:'experiment_completed_not_formal_qualified',executionState:'completed',runId:run,executionPackage:{path:out+'/package.json'}}
 const initial={generator:'a'.repeat(64),discriminator:'b'.repeat(64)},result={experimentIdentity:run,arm:'balanced-boundary',modelCapability:source.modelCapability,trainingObjective:source.training.trainingObjective,status:'experiment_executed_not_visual_qualified',optimizerSteps:{generator:200,discriminator:200},targetUpdates:5,replayUpdates:195,sampleVisits:visits,checkpointReloadExact:true,sameParentStartVerified:true,parentStateHashes:initial,initialStateHashes:initial,finalStateHashes:initial,artifacts:[{path:out+'/checkpoint-final.pt',sha256:'a'.repeat(64)}],formalQualificationGranted:false}
 validateReviewSource(policy,terminal,source,result)
 for(const mutate of [s=>s.policy={...s.policy,sha256:'0'.repeat(64)},s=>s.training.boundaryRgbWeight=.02,s=>s.boundaryInputBindings.pop(),s=>s.inputs.pop(),s=>s.selectedSampleIds.reverse()]){
  const changed=clone(source);mutate(changed);assert.throws(()=>validateReviewSource(policy,terminal,changed,result))
 }
 assert.throws(()=>validateReviewSource(policy,terminal,source,{...result,trainingObjective:'balanced'}))
})

test('48train equal macro and road/object descriptions cannot override149 or absolute gates',()=>{
 const input=rows();for(const row of input.slice(1,48))row.metrics.fullRgbMae=.05
 input[0].metrics.fullRgbMae=.0999
 let decision=classifyReplayRetention(input,policy),summary=describeReplayRetention(decision.rows,policy)
 assert.equal(decision.recommendation,'do_not_adopt_no_target_improvement');assert.equal(summary.train48.count,48)
 assert.equal(summary.train48.weighting,'equal_one_weight_per_train_image');assert(summary.train48.candidateFullRgbMaeMean<.052)
 assert.equal(summary.train48.candidateFullRgbMaeMean,input.slice(0,48).reduce((n,r)=>n+r.metrics.fullRgbMae,0)/48)
 assert.equal(summary.perImage.length,56);assert.equal(summary.train48.worstFullRgbMaeChanges[0].sampleId,TARGET);assert.equal(summary.perImage[0].objectChanges.length,16)
 input[0].metrics.fullRgbMae=.09;input[5].candidateAbsolute={passed:false,issueCodes:['condition_terrain_path_ground_coverage_mismatch','object_tree_failed','broad_water_failure']}
 decision=classifyReplayRetention(input,policy);summary=describeReplayRetention(decision.rows,policy)
 assert.equal(decision.recommendation,'do_not_adopt_new_absolute_failures');assert.equal(summary.roadNewFailureImageCount,1);assert.deepEqual(summary.perImage[5].roadChanges.newIssueCodes,['condition_terrain_path_ground_coverage_mismatch'])
 assert.equal(summary.formalQualificationGranted,false);assert(encodeReviewJson(summary).length<MAX_REVIEW_JSON_BYTES)
 input[5].metrics.fullRgbMae=NaN;decision=classifyReplayRetention(input,policy);summary=describeReplayRetention(decision.rows,policy)
 assert.equal(decision.recommendation,'evidence_unknown');assert.equal(summary.train48.candidateFullRgbMaeMean,null);assert.equal(summary.train48.fullRgbMaeDelta.unknownCount,1)
 input[5].candidateAbsolute=null;decision=classifyReplayRetention(input,policy);summary=describeReplayRetention(decision.rows,policy)
 assert.equal(summary.perImage[5].absoluteStatus,'unknown');assert.equal(decision.recommendation,'evidence_unknown')
})

test('review package binds current dynamic helper separately from exact historical baseline',()=>{
 const code=fs.readFileSync('scripts/lib/ai-painter-replay-retention-review-v1.mjs','utf8')
 assert.match(code,/programPaths=\[SELF,REPLAY_REVIEW_WORKER,REPLAY_REVIEW_DYNAMIC_HELPER,/)
 assert.match(code,/historicalSourceBaseline:HISTORICAL_SOURCE_BASELINE/)
 assert.equal(REPLAY_REVIEW_DYNAMIC_HELPER,'ml/ai-painter/scripts/painter_replay_retention_review_recovery_v1.py')
 assert.equal(createHash('sha256').update(fs.readFileSync(HISTORICAL_SOURCE_BASELINE.path)).digest('hex'),HISTORICAL_SOURCE_BASELINE.sha256)
 assert.match(fs.readFileSync('ml/ai-painter/scripts/painter_replay_retention_review_v1.py','utf8'),/from painter_replay_retention_review_recovery_v1 import read_dynamic_json/)
})

test('actual preflight policy conflict writes bounded failure without registry or worker',()=>{
 const base=path.resolve(process.env.AI_PAINTER_REPLAY_REVIEW_TEST_OUTPUT??'.runtime/ai-painter/controller-repair-reviews/replay-retention-091-20261027/review/fixtures')
 fs.mkdirSync(base,{recursive:true});const root=path.join(base,'preflight-'+randomUUID());fs.mkdirSync(path.join(root,path.dirname(REPLAY_REVIEW_POLICY)),{recursive:true})
 fs.writeFileSync(path.join(root,REPLAY_REVIEW_POLICY),'{}\n',{flag:'wx'})
 const moduleUrl=pathToFileURL(path.resolve('scripts/lib/ai-painter-replay-retention-review-v1.mjs')).href
 const script=`const m=await import(${JSON.stringify(moduleUrl)});try{await m.runReplayRetentionReview({projectRoot:process.cwd()});process.exitCode=2}catch(e){if(!e.reviewFailureEvidence)throw e;console.log(JSON.stringify(e.reviewFailureEvidence))}`
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:131072,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}})
 assert.equal(child.status,0,child.stderr);const binding=JSON.parse(child.stdout),raw=fs.readFileSync(path.join(root,binding.path)),failure=JSON.parse(raw)
 assert.equal(createHash('sha256').update(raw).digest('hex'),binding.sha256)
 assert.equal(failure.registered,false);assert.equal(failure.visualOutcome,'unknown');assert.equal(failure.status,'replay_retention_review_preflight_failed');assert.match(failure.error,/frozen review policy changed/)
 assert.equal(fs.existsSync(path.join(root,'.runtime/ai-painter/current-execution-registry')),false)
 assert.equal(fs.existsSync(path.join(root,path.dirname(binding.path),'worker-lease.json')),false)
})
