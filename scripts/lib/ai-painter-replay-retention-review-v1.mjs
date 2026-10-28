import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import sharp from 'sharp'
import {boundaryTraining,boundaryPolicyBinding,validateBoundaryIdentity} from './ai-painter-replay-retention-fit-v1.mjs'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'

export const REPLAY_REVIEW_POLICY='data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json'
export const REPLAY_REVIEW_POLICY_SHA='308d607e3f15bb936279be93b2525a37f1707365990941efdf6e78459029bcf4'
export const REPLAY_REVIEW_WORKER='ml/ai-painter/scripts/painter_replay_retention_review_v1.py'
export const REPLAY_REVIEW_DYNAMIC_HELPER='ml/ai-painter/scripts/painter_replay_retention_review_recovery_v1.py'
export const HISTORICAL_SOURCE_BASELINE=Object.freeze({path:'.runtime/ai-painter/controller-repair-reviews/balanced-map-followup-093-20261027/historical-source-baseline.json',sha256:'0f3e6109f5f1490c52d318604c6a7141f754f16579414e18740b25401e01547e'})
export const TARGET='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
const SELF='scripts/lib/ai-painter-replay-retention-review-v1.mjs'
const flags=Object.freeze({formalQualificationGranted:false,checkpointPromotable:false,runtimePublicationAllowed:false,automaticNextTraining:false})
const sha=b=>createHash('sha256').update(b).digest('hex')
const finite=x=>typeof x==='number'&&Number.isFinite(x)
export const MAX_REVIEW_JSON_BYTES=1048576

export function encodeReviewJson(value){
 const bytes=Buffer.from(JSON.stringify(value,(_key,v)=>{assert(typeof v!=='number'||Number.isFinite(v),'nonfinite review JSON number');return v})+'\n')
 assert(bytes.length<=MAX_REVIEW_JSON_BYTES,'review JSON exceeds1MiB')
 return bytes
}

export function expandInferenceManifest(inference,{pkg,packageBinding,read}){
 assert.equal(inference.schemaVersion,'ai-painter-replay-retention-review-inference-v1');assert.equal(inference.reviewId,pkg.reviewId);assert.deepEqual(inference.executionPackage,packageBinding)
 assert.equal(inference.observationsStorage,'sha256_per_sample_json_v1');assert.equal(inference.inputsStorage,'sha256_binding_chunks_v1')
 assert.equal(inference.observationBindings.length,56);assert.equal(inference.observations,undefined);assert.equal(inference.inputs,undefined)
 const ids=[...pkg.trainSampleIds,...pkg.validationSampleIds],seen=new Set()
 assert.equal(ids.length,56);assert.equal(new Set(ids).size,56)
 const bound=b=>{assert(typeof b.path==='string'&&b.path.startsWith(pkg.outputRoot+'/')&&!b.path.includes('\\')&&!b.path.split('/').some(p=>p==='..'||p==='.'||!p));assert.match(b.sha256,/^[a-f0-9]{64}$/);assert(!seen.has(b.path),'duplicate shard binding');seen.add(b.path);return read(b)}
 const observations=inference.observationBindings.map((entry,n)=>{
  assert.equal(entry.sampleId,ids[n]);assert.equal(entry.split,n<48?'train':'validation')
  const value=bound(entry.binding);assert.equal(value.schemaVersion,'ai-painter-replay-retention-observation-v1');assert.equal(value.reviewId,pkg.reviewId);assert.deepEqual(value.executionPackage,packageBinding)
  assert.equal(value.sampleId,entry.sampleId);assert.equal(value.split,entry.split);assert.equal(value.identity.sampleId,value.sampleId)
  assert.deepEqual(value.nativePredictionDimensions,{width:256,height:192});assert(Number.isInteger(value.referenceNativeDimensions.width)&&value.referenceNativeDimensions.width>0&&Number.isInteger(value.referenceNativeDimensions.height)&&value.referenceNativeDimensions.height>0)
  return value
 })
 assert(Number.isInteger(inference.inputCount)&&inference.inputCount>0&&inference.inputCount<=8192)
 assert.equal(inference.inputManifestBindings.length,Math.ceil(inference.inputCount/256))
 const inputs=[]
 for(const binding of inference.inputManifestBindings){const part=bound(binding);assert.equal(part.schemaVersion,'ai-painter-replay-retention-input-bindings-v1');assert.equal(part.reviewId,pkg.reviewId);assert.deepEqual(part.executionPackage,packageBinding);assert.equal(part.offset,inputs.length);assert.equal(part.bindings.length,Math.min(256,inference.inputCount-inputs.length));for(const b of part.bindings){assert(typeof b.path==='string');assert.match(b.sha256,/^[a-f0-9]{64}$/)}inputs.push(...part.bindings)}
 assert.equal(inputs.length,inference.inputCount);assert.equal(new Set(inputs.map(b=>b.path)).size,inputs.length)
 return {observations,inputs}
}

export function reviewRowShard(row,observation,context){
 return {schemaVersion:'ai-painter-replay-retention-review-row-v1',...context,sampleId:row.sampleId,split:row.split,observation,parentMetrics:row.parentMetrics,aMetrics:row.aMetrics,parentPrediction:row.parentPrediction,aPrediction:row.aPrediction,parentAbsolute:row.parentAbsolute,candidateAbsolute:row.candidateAbsolute,relative:row.relative,absolute:row.absolute}
}

export function selectCurrentSource(previous,explicitSource=null){
 assert(previous.ok&&previous.registry.activeExecution===null,'active execution or invalid registry')
 const latest=previous.registry.latestTrainingTerminal
 assert(typeof latest?.path==='string'&&/^[a-f0-9]{64}$/.test(latest.sha256),'verified latest training terminal required')
 const binding={path:latest.path,sha256:latest.sha256}
 if(explicitSource)assert.deepEqual(explicitSource,binding,'explicit source is not current latest')
 return binding
}

export function validateReviewPolicy(p){
 assert.equal(p.schemaVersion,'ai-painter-replay-retention-review-policy-v1')
 assert.equal(p.sourceSelection,'current_registry_latest_completed_replay_retention_terminal')
 assert.equal(p.automaticPostReview,true);assert.equal(p.targetSampleId,TARGET)
 assert.equal(p.gpuAllowed,false);assert.equal(p.trainingAllowed,false);assert.equal(p.optimizerUpdates,0);assert.equal(p.sourceMutationAllowed,false)
 for(const [k,v]of Object.entries(flags))assert.equal(p[k],v)
 assert.deepEqual(p.resources,{maxWallSeconds:900,workerMaxWallSeconds:600,cpuThreads:2,generatorForwards:56,maxOutputMiB:128,maximumImageAudits:112,minimumFreeDiskMiB:2048,maximumStreamMiB:8,terminalReserveBytes:65536,automaticRetries:0})
 const d=p.relativeRetention
 for(const key of ['comparisonEpsilon','targetFullRgbMaeMinimumReduction','maximumPerImageMaeIncrease','maximumCorrelationDrop','maximumGroupMeanFullRgbMaeIncrease'])assert(finite(d[key])&&d[key]>=0,key)
 assert.deepEqual(d.regionKinds,['core','support']);assert.deepEqual(d.metricRoles,['object_footprints','object_tree','object_rock','object_vegetation'])
 assert.deepEqual(d.quantiles,[.5,.9,.95]);assert.equal(d.worstCount,8)
 assert.equal(d.missingOrNonfinite,'unknown_never_pass');assert.equal(d.emptyRegion,'not_applicable')
 assert.equal(d.scope,'preregistered_diagnostic_only_not_formal_quality_threshold')
 assert.equal(p.adoptionRule,'deny_any_new_absolute_issue_or_relative_regression')
 assert(Array.isArray(p.absolutePrograms)&&p.absolutePrograms.length>=4)
}

export function validateReviewSource(policy,terminal,source,result){
 validateReviewPolicy(policy)
 assert.equal(terminal.executionState,'completed');assert.equal(terminal.status,'experiment_completed_not_formal_qualified')
 assert.equal(source.schemaVersion,'replay-retention-fit-package-v1');assert(['mixed','short','balanced','balanced-boundary'].includes(source.arm))
 assert.equal(terminal.runId,source.experimentIdentity);assert.equal(result.experimentIdentity,source.experimentIdentity);assert.equal(result.arm,source.arm)
 assert.equal(source.modelCapability,policy.modelCapability);assert.equal(result.modelCapability,source.modelCapability)
 const boundary=source.arm==='balanced-boundary',balanced=source.arm==='balanced'||boundary
 const pairs=source.arm==='short'?100:200,targetPairs=balanced?5:100,replayPairs=pairs-targetPairs
 assert.equal(source.training.pairs,pairs);assert.equal(source.training.targetPairs,targetPairs);assert.equal(source.training.replayPairs,replayPairs)
 assert.deepEqual(result.optimizerSteps,{generator:pairs,discriminator:pairs});assert.equal(result.targetUpdates,targetPairs);assert.equal(result.replayUpdates,replayPairs)
 if(balanced){
  assert.deepEqual(source.policy,boundary?boundaryPolicyBinding:{path:'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json',sha256:'4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db'})
  assert.deepEqual(source.training,boundary?boundaryTraining():{pairs:200,targetPairs:5,replayPairs:195,seed:20260929,supportStructureWeight:.1,checkpointSelection:'final_step_only',observations:[0,25,50,100,150,200],sampling:'original48_round_robin_four_passes_then_first8'})
  const train=source.selectedSampleIds;assert.equal(train.length,48);assert.equal(new Set(train).size,48);assert(train.includes(TARGET))
  assert.deepEqual(source.schedule,[...train,...train,...train,...train,...train.slice(0,8)])
  const visits=Object.fromEntries(train.map((sid,n)=>[sid,n<8?5:4]));assert.equal(visits[TARGET],5)
  assert.deepEqual(source.plannedSampleVisits,visits);assert.deepEqual(result.sampleVisits,visits)
 }
 if(boundary)validateBoundaryIdentity(source,result)
 assert.equal(result.status,'experiment_executed_not_visual_qualified');assert.equal(result.checkpointReloadExact,true);assert.equal(result.sameParentStartVerified,true)
 assert.deepEqual(result.parentStateHashes,result.initialStateHashes)
 for(const field of ['parentStateHashes','initialStateHashes','finalStateHashes']){assert.deepEqual(Object.keys(result[field]).sort(),['discriminator','generator']);assert(Object.values(result[field]).every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)))}
 assert.deepEqual(source.checkpoint,policy.parentExperiment.checkpoint)
 for(const [k,b]of Object.entries(policy.parentExperiment))assert.deepEqual(source.parentExperiment[k],b,'parent '+k)
 assert.equal(terminal.executionPackage.path,source.outputRoot+'/package.json')
 assert.equal(result.artifacts.filter(b=>b.path===source.outputRoot+'/checkpoint-final.pt').length,1)
 assert.equal(result.formalQualificationGranted,false)
}

export function metricChanges(before,after,diagnostic){
 const checks=[]
 const compare=(name,a,b,kind,na=false)=>{
  if(na){checks.push({name,status:'not_applicable',before:a,after:b,delta:null});return}
  if(!finite(a)||!finite(b)||kind!=='correlation'&&(a<0||b<0||a>1||b>1)||kind==='correlation'&&(Math.abs(a)>1||Math.abs(b)>1)){checks.push({name,status:'unknown',before:finite(a)?a:null,after:finite(b)?b:null,delta:null});return}
  const delta=b-a,limit=kind==='correlation'?diagnostic.maximumCorrelationDrop:diagnostic.maximumPerImageMaeIncrease
  const signed=kind==='correlation'?-delta:delta
  checks.push({name,before:a,after:b,delta,status:signed<=limit+diagnostic.comparisonEpsilon?'retained':'regressed'})
 }
 compare('fullRgbMae',before?.fullRgbMae,after?.fullRgbMae,'mae')
 for(const region of diagnostic.regionKinds)for(const role of diagnostic.metricRoles){
  const a=before?.regions?.[region]?.[role],b=after?.regions?.[region]?.[role],name=region+'.'+role
  const matching=a&&b&&Number.isInteger(a.pixels)&&a.pixels>=0&&a.pixels===b.pixels
  for(const metric of ['rgbMae','correlation']){
   const unavailable=matching&&a[metric]===null&&b[metric]===null&&a.naReason===b.naReason&&(
    (a.pixels===0&&a.naReason==='empty_region')||(metric==='correlation'&&['fewer_than_two_pixels','constant_reference_region'].includes(a.naReason)))
   compare(name+'.'+metric,matching?a[metric]:undefined,matching?b[metric]:undefined,metric,unavailable)
  }
 }
 return {checks,status:checks.some(c=>c.status==='unknown')?'unknown':checks.some(c=>c.status==='regressed')?'regressed':'retained',fullRgbMaeDelta:checks[0].delta}
}

export function numericSummary(values,epsilon=0.000001,direction='lower'){
 const numbers=values.filter(finite).sort((a,b)=>a-b),n=numbers.length
 const q=p=>n?numbers[Math.max(0,Math.ceil(p*n)-1)]:null
 const sign=direction==='higher'?-1:1
 return {validCount:n,unknownCount:values.length-n,mean:n?numbers.reduce((a,b)=>a+b,0)/n:null,minimum:n?numbers[0]:null,maximum:n?numbers.at(-1):null,p50:q(.5),p90:q(.9),p95:q(.95),improvedCount:numbers.filter(x=>sign*x< -epsilon).length,unchangedCount:numbers.filter(x=>Math.abs(x)<=epsilon).length,worsenedCount:numbers.filter(x=>sign*x>epsilon).length,improvementDirection:direction,quantileMethod:'nearest_rank'}
}

export function absoluteDelta(parent,candidate){
 if(!parent||!candidate||typeof parent.passed!=='boolean'||typeof candidate.passed!=='boolean'||!Array.isArray(parent.issueCodes)||!Array.isArray(candidate.issueCodes))return {status:'unknown',newIssueCodes:[],existingIssueCodes:[],resolvedIssueCodes:[]}
 assert.equal(parent.passed,parent.issueCodes.length===0);assert.equal(candidate.passed,candidate.issueCodes.length===0)
 const a=new Set(parent.issueCodes),b=new Set(candidate.issueCodes)
 return {status:candidate.passed?'passed':'failed',parentPassed:parent.passed,candidatePassed:candidate.passed,newIssueCodes:[...b].filter(x=>!a.has(x)),existingIssueCodes:[...b].filter(x=>a.has(x)),resolvedIssueCodes:[...a].filter(x=>!b.has(x))}
}

export function classifyReplayRetention(rows,policy){
 validateReviewPolicy(policy);assert.equal(rows.length,56);assert.equal(new Set(rows.map(r=>r.sampleId)).size,56)
 assert.equal(rows.filter(r=>r.split==='train').length,48);assert.equal(rows.filter(r=>r.split==='validation').length,8)
 assert(rows.some(r=>r.sampleId===TARGET&&r.split==='train'))
 const d=policy.relativeRetention
 const comparisons=rows.map(row=>({...row,relative:metricChanges(row.parentMetrics,row.metrics,d),absolute:row.absoluteComparison??absoluteDelta(row.parentAbsolute,row.candidateAbsolute)}))
 const groups={}
 for(const [key,subset]of [['target149',comparisons.filter(r=>r.sampleId===TARGET)],['other47',comparisons.filter(r=>r.split==='train'&&r.sampleId!==TARGET)],['developmentValidation8',comparisons.filter(r=>r.split==='validation')]]){
  const delta=numericSummary(subset.map(r=>r.relative.fullRgbMaeDelta),d.comparisonEpsilon)
  const unknown=subset.filter(r=>r.relative.status==='unknown').length,regressed=subset.filter(r=>r.relative.status==='regressed').length
  const groupLimit=key==='target149'?null:d.maximumGroupMeanFullRgbMaeIncrease
  const meanPass=groupLimit===null||finite(delta.mean)&&delta.mean<=groupLimit+d.comparisonEpsilon
  const names=subset[0].relative.checks.map(c=>c.name)
  const metricDeltas=Object.fromEntries(names.map(name=>{
   const values=subset.map(r=>({sampleId:r.sampleId,...r.relative.checks.find(c=>c.name===name)}))
   const applicable=values.filter(v=>v.status!=='not_applicable'),direction=name.endsWith('.correlation')?'higher':'lower'
   return [name,{...numericSummary(applicable.map(v=>v.delta),d.comparisonEpsilon,direction),notApplicableCount:values.length-applicable.length,sampleCount:values.length,worstSamples:applicable.filter(v=>finite(v.delta)).sort((a,b)=>(direction==='higher'?a.delta-b.delta:b.delta-a.delta)||a.sampleId.localeCompare(b.sampleId)).slice(0,d.worstCount).map(v=>({sampleId:v.sampleId,delta:v.delta,status:v.status}))}]
  }))
  groups[key]={count:subset.length,status:unknown?'unknown':regressed||!meanPass?'regressed':'retained',retainedCount:subset.filter(r=>r.relative.status==='retained').length,regressedCount:regressed,unknownCount:unknown,fullRgbMaeDelta:delta,parentFullRgbMaeMean:subset.reduce((n,r)=>n+(finite(r.parentMetrics?.fullRgbMae)?r.parentMetrics.fullRgbMae:NaN),0)/subset.length,candidateFullRgbMaeMean:subset.reduce((n,r)=>n+(finite(r.metrics?.fullRgbMae)?r.metrics.fullRgbMae:NaN),0)/subset.length,meanFullRgbMaeLimit:groupLimit,meanFullRgbMaePassed:unknown?null:meanPass,metricDeltas,worstSamples:[...subset].sort((a,b)=>(b.relative.fullRgbMaeDelta??-Infinity)-(a.relative.fullRgbMaeDelta??-Infinity)||a.sampleId.localeCompare(b.sampleId)).slice(0,d.worstCount).map(r=>({sampleId:r.sampleId,delta:r.relative.fullRgbMaeDelta,status:r.relative.status})),absoluteFailedCount:subset.filter(r=>r.absolute.status==='failed').length,newAbsoluteFailures:subset.filter(r=>r.absolute.newIssueCodes.length).map(r=>({sampleId:r.sampleId,issueCodes:r.absolute.newIssueCodes})),existingAbsoluteFailures:subset.filter(r=>r.absolute.existingIssueCodes.length).map(r=>({sampleId:r.sampleId,issueCodes:r.absolute.existingIssueCodes}))}
  for(const field of ['parentFullRgbMaeMean','candidateFullRgbMaeMean'])if(!finite(groups[key][field]))groups[key][field]=null
 }
 const target=comparisons.find(r=>r.sampleId===TARGET)
 const targetFullRgbMaeImproved=finite(target.relative.fullRgbMaeDelta)?-target.relative.fullRgbMaeDelta+d.comparisonEpsilon>=d.targetFullRgbMaeMinimumReduction:null
 const unknown=comparisons.some(r=>r.relative.status==='unknown'||r.absolute.status==='unknown')
 const newAbsoluteFailure=comparisons.some(r=>r.absolute.newIssueCodes.length>0)
 const retentionPreserved=groups.other47.status==='retained'&&groups.developmentValidation8.status==='retained'
 const targetObjectRegression=target.relative.checks.some(c=>c.name!=='fullRgbMae'&&c.status==='regressed')
 const recommendation=unknown?'evidence_unknown':newAbsoluteFailure?'do_not_adopt_new_absolute_failures':targetObjectRegression?'do_not_adopt_target_object_regression':!retentionPreserved?'do_not_adopt_retention_regression':!targetFullRgbMaeImproved?'do_not_adopt_no_target_improvement':'eligible_for_further_diagnostic_comparison_not_qualified'
 return {rows:comparisons,groups,targetFullRgbMaeImproved,targetObjectChanges:target.relative.checks.filter(c=>c.name!=='fullRgbMae'),targetObjectRegression,retentionPreserved:unknown?null:retentionPreserved,newAbsoluteFailure,absoluteOutcome:unknown?'unknown':comparisons.some(r=>r.absolute.status==='failed')?'failed':'component_checks_passed_not_qualified',recommendation,nextDiagnostic:{action:unknown?'inspect_missing_or_conflicting_evidence':newAbsoluteFailure?'inspect_new_absolute_failures':targetObjectRegression?'inspect_target_per_role_response':!retentionPreserved?'compare_target_exposure_and_replay_effects':!targetFullRgbMaeImproved?'inspect_target_per_role_response':'independent_semantic_and_generalization_diagnosis',automaticTraining:false},...flags}
}

export function describeReplayRetention(comparisons,policy){
 const train=comparisons.filter(r=>r.split==='train'),epsilon=policy.relativeRetention.comparisonEpsilon
 assert.equal(comparisons.length,56);assert.equal(train.length,48)
 const mean=values=>values.every(finite)?values.reduce((a,b)=>a+b,0)/values.length:null
 const worst=values=>values.filter(v=>finite(v.delta)).sort((a,b)=>b.delta-a.delta||a.sampleId.localeCompare(b.sampleId)).slice(0,8)
 const objectRegionChanges=Object.fromEntries(train[0].relative.checks.filter(c=>c.name!=='fullRgbMae').map(c=>{
  const applicable=train.map(r=>r.relative.checks.find(v=>v.name===c.name)).filter(v=>v.status!=='not_applicable')
  return [c.name,{...numericSummary(applicable.map(v=>v.delta),epsilon,c.name.endsWith('.correlation')?'higher':'lower'),notApplicableCount:48-applicable.length}]
 }))
 const perImage=comparisons.map(r=>({sampleId:r.sampleId,split:r.split,fullRgbMaeDelta:r.relative.fullRgbMaeDelta,relativeStatus:r.relative.status,absoluteStatus:r.absolute.status,objectChanges:r.relative.checks.filter(c=>c.name!=='fullRgbMae'),roadChanges:Object.fromEntries(['newIssueCodes','existingIssueCodes','resolvedIssueCodes'].map(k=>[k,(r.absolute[k]??[]).filter(code=>code.startsWith('condition_terrain_path_ground_'))]))}))
 return {scope:'descriptive_only_no_adoption_gate_or_recognition_claim',train48:{count:48,weighting:'equal_one_weight_per_train_image',parentFullRgbMaeMean:mean(train.map(r=>r.parentMetrics?.fullRgbMae)),candidateFullRgbMaeMean:mean(train.map(r=>r.metrics?.fullRgbMae)),fullRgbMaeDelta:numericSummary(train.map(r=>r.relative.fullRgbMaeDelta),epsilon),objectRegionChanges,worstFullRgbMaeChanges:worst(train.map(r=>({sampleId:r.sampleId,delta:r.relative.fullRgbMaeDelta,status:r.relative.status})))},perImage,roadNewFailureImageCount:perImage.filter(r=>r.roadChanges.newIssueCodes.length).length,...flags}
}

async function runReview({projectRoot=process.cwd(),sourceTerminal:explicitSource=null,policy:explicitPolicy=null}={}){
 const root=path.resolve(projectRoot);assert.equal(root,path.resolve(process.cwd()),'audit components require the actual project working directory')
 const {replaceHeartbeatFile}=await import('../run-ai-painter-learning-capacity-experiment.mjs')
 const {stopReviewWorker}=await import('./ai-painter-two-map-post-review-v1.mjs')
 const started=Date.now(),mono=performance.now(),observed=new Map()
 const absolute=p=>{assert(typeof p==='string'&&!p.includes('\\')&&!p.includes(':')&&!path.posix.isAbsolute(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'),'logical path');return path.join(root,p)}
 const bind=p=>({path:p,sha256:sha(fs.readFileSync(absolute(p)))})
 const read=(b,maximum=16*1024**2)=>{const bytes=fs.readFileSync(absolute(b.path));assert(bytes.length<=maximum,'bounded JSON');assert.equal(sha(bytes),b.sha256,b.path);observed.set(b.path,b.sha256);return JSON.parse(bytes)}
 const readNew=b=>read(b,MAX_REVIEW_JSON_BYTES)
 const verify=b=>{assert.deepEqual(bind(b.path),{path:b.path,sha256:b.sha256});observed.set(b.path,b.sha256)}
 const policyBinding=bind(REPLAY_REVIEW_POLICY);assert.equal(policyBinding.sha256,REPLAY_REVIEW_POLICY_SHA,'frozen review policy changed');if(explicitPolicy)assert.deepEqual(explicitPolicy,policyBinding)
 const policy=read(policyBinding);validateReviewPolicy(policy)
 for(const b of [...policy.absolutePrograms,policy.numericReview,policy.detailReview])verify(b)
 const thresholds=read(policy.numericReview),detailContract=read(policy.detailReview);verify(thresholds.styleFingerprint)
 const previous=await readCurrentExecutionRegistry(root),sourceTerminal=selectCurrentSource(previous,explicitSource)
 const terminal=read(sourceTerminal),source=read(terminal.executionPackage),result=read(terminal.result);validateReviewSource(policy,terminal,source,result)
 const checkpoint=result.artifacts.find(b=>b.path===source.outputRoot+'/checkpoint-final.pt');verify(checkpoint)
 for(const b of [...Object.values(policy.parentExperiment),...Object.values(policy.single149Experiment)])verify(b)
 const parent=read(policy.parentEvaluation),single=read(policy.single149Evaluation),parentRows=parent.rows.filter(r=>r.arm==='candidate')
 assert.equal(parentRows.length,56);assert.equal(single.rows.length,56)
 const parentPackage=read(policy.parentExperiment.package),plan=read(source.sourcePlan)
 assert.deepEqual(source.sourcePlan,parentPackage.sourcePlan)
 const train=read(plan.trainSplit).sampleIds,validation=read(plan.validationSplit).sampleIds
 assert.equal(train.length,48);assert.equal(validation.length,8);assert.equal(new Set([...train,...validation]).size,56);assert(train.includes(TARGET))
 assert.deepEqual(parentRows.map(r=>r.sampleId),[...train,...validation]);assert.deepEqual(single.rows.map(r=>r.sampleId),[...train,...validation])
 if(['balanced','balanced-boundary'].includes(source.arm))assert.deepEqual(source.selectedSampleIds,train,'balanced original train order')
 read(HISTORICAL_SOURCE_BASELINE)
 const programPaths=[SELF,REPLAY_REVIEW_WORKER,REPLAY_REVIEW_DYNAMIC_HELPER,'scripts/tests/test-ai-painter-replay-retention-review.mjs','ml/ai-painter/tests/test_replay_retention_review_v1.py',...policy.absolutePrograms.map(b=>b.path),'src/server/ai-painter-current-execution-registry.mjs','ml/ai-painter/scripts/current_checkpoint_fit_metrics_v1.py']
 const payload={schemaVersion:'ai-painter-replay-retention-review-package-v1',policy:policyBinding,historicalSourceBaseline:HISTORICAL_SOURCE_BASELINE,sourceTerminal,sourcePackage:terminal.executionPackage,sourceCheckpoint:checkpoint,sourceModelCapability:source.modelCapability,trainSampleIds:train,validationSampleIds:validation,programs:[...new Set(programPaths)].map(bind),specification:bind('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),resources:policy.resources,...flags}
 const reviewId='replay-retention-review-v1-'+sha(JSON.stringify(payload)).slice(0,20),outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId
 const put=(p,v,replace=false)=>{const file=absolute(p),bytes=Buffer.isBuffer(v)?v:encodeReviewJson(v);fs.mkdirSync(path.dirname(file),{recursive:true});if(replace){const tmp=file+'.'+process.pid+'.next';fs.writeFileSync(tmp,bytes,{flag:'wx'});replaceHeartbeatFile(tmp,file)}else fs.writeFileSync(file,bytes,{flag:'wx'});return bind(p)}
 assert(!fs.existsSync(absolute(outputRoot)),'consumed review output; no retry')
 const packageBinding=put(outputRoot+'/package.json',{...payload,reviewId,outputRoot,deadlineUnixMs:started+policy.resources.maxWallSeconds*1000})
 const proc=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}';$p.CreationDate.ToUniversalTime().ToString('o')`],{windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(proc.status,0);assert(Number.isFinite(Date.parse(proc.stdout.trim())))
 const identity={runId:reviewId,packageId:reviewId,capabilityVersion:reviewId,processId:process.pid,processStartIdentity:process.pid+':'+proc.stdout.trim()}
 const lock=put(outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity})
 let registered=false,child=null,childClosed=false,timer=null,heartbeatError=null,heartbeatBusy=false,cleanupPromise=null
 const requestStop=error=>{heartbeatError??=error;if(child&&!childClosed&&!cleanupPromise)cleanupPromise=stopReviewWorker(child,{closed:childClosed}).catch(e=>{heartbeatError.cleanupError=String(e.stack??e)})}
 const heartbeat=()=>put(outputRoot+'/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120},fs.existsSync(absolute(outputRoot+'/heartbeat.json')))
 const budget=()=>{assert(Date.now()-started<900000,'total review deadline');let size=0;const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),s=fs.lstatSync(p);assert(!s.isSymbolicLink());if(s.isDirectory())walk(p);else{assert(s.isFile()&&s.nlink===1);size+=s.size}}};walk(absolute(outputRoot));assert(size+65536<128*1024**2,'review output limit')}
 const commit=async(evidence,state,activity,active=null)=>{const current=await readCurrentExecutionRegistry(root);assert(current.ok);assert(registered?current.registry.runId===reviewId:current.registrySha256===previous.registrySha256,'registry changed');const capsule=put(outputRoot+(active?'/active-capsule.json':'/terminal-capsule-'+evidence.sha256.slice(0,12)+'.json'),{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:reviewId,integrity:{status:'verified'},evidence:[packageBinding,evidence].map(b=>({...b,kind:'replay_retention_review',sha256Verified:true}))});const changed=await advanceCurrentExecutionRegistry({projectRoot:root,...identity,taskId:reviewId,taskKind:'readonly_post_training_visual_review',taskGoal:'56-image relative retention and unchanged absolute audits; no training or qualification',queueStatus:active?'running':state==='failed_closed'?'failed_closed':'completed',nextMachineAction:null,lifecycleStage:'isolated_implementation',executionState:state,activity,taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution:active,expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});assert(changed.ok,changed.errorCode);return changed}
 try{
  heartbeat();budget()
  const ready=put(outputRoot+'/ready.json',{executionState:'completed',status:'replay_review_inputs_verified',sourceTerminal,recordedAtUtc:new Date().toISOString(),...flags})
  const active={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:{controller:bind(SELF),worker:bind(REPLAY_REVIEW_WORKER)},lock,heartbeat:{path:outputRoot+'/heartbeat.json',ttlSeconds:120}}
  const activeCommit=await commit(ready,'reviewing','replay_retention_review_running',active);registered=true
  timer=setInterval(()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{heartbeat();budget()}catch(error){requestStop(error)}finally{heartbeatBusy=false}},5000)
  let stdout='',stderr=''
  const exitCode=await new Promise((resolve,reject)=>{
   child=spawn(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B',absolute(REPLAY_REVIEW_WORKER),packageBinding.path,packageBinding.sha256],{cwd:root,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONIOENCODING:'utf-8',PYTHONUNBUFFERED:'1'},stdio:['ignore','pipe','pipe']})
   assert(Number.isInteger(child.pid));put(outputRoot+'/worker-lease.json',{reviewId,controllerPid:process.pid,launcherPid:child.pid,controllerStartIdentity:identity.processStartIdentity,registryRevision:activeCommit.registry.registryRevision})
   const stream=(which,b)=>{if(which==='out')stdout+=b.toString();else stderr+=b.toString();if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>policy.resources.maximumStreamMiB*1024**2)requestStop(new Error('review stream limit'))}
   child.stdout.on('data',b=>stream('out',b));child.stderr.on('data',b=>stream('err',b));child.once('error',reject);child.once('close',code=>{childClosed=true;resolve(code)})
  })
  if(cleanupPromise)await cleanupPromise
  put(outputRoot+'/worker-streams.json',{exitCode,stdout,stderr});assert.ifError(heartbeatError);assert.equal(exitCode,0,'review inference failed');budget()
  const inferenceBinding=JSON.parse(stdout.trim());assert.equal(inferenceBinding.path,outputRoot+'/inference.json');const inference=readNew(inferenceBinding)
  assert.deepEqual(inference.executionPackage,packageBinding);assert.equal(inference.reviewId,reviewId);assert.deepEqual(inference.actualCalls,{generatorForwards:56,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0});assert.deepEqual(inference.stateBefore,inference.stateAfter);assert.equal(inference.gpuInitialized,false);assert.equal(inference.final149CrossDeviceComparison?.scope,'cross_device_observation_not_same_device_reload_gate');assert.equal(inference.historicalPixelReproductions.length,20)
  assert.equal(inference.optimizerUpdates,0);assert.deepEqual(inference.sourceCheckpoint,checkpoint)
  assert.deepEqual(inference.trainingNamedStateBefore,result.finalStateHashes);assert.deepEqual(inference.trainingNamedStateAfter,result.finalStateHashes)
  assert.deepEqual(inference.parentStateVerification.named091,result.parentStateHashes);assert.equal(inference.parentStateVerification.generatorForwards,0)
  for(const arm of ['parent','A'])assert.equal(new Set(inference.historicalPixelReproductions.filter(r=>r.arm===arm).map(r=>r.sampleId)).size,10)
  const expanded=expandInferenceManifest(inference,{pkg:{...payload,reviewId,outputRoot},packageBinding,read:readNew})
  assert.deepEqual(expanded.observations.map(r=>r.sampleId),[...train,...validation]);sharp.concurrency(2)
  const rows=[];let imageAudits=0
  const audit=async(observation,prediction,prefix)=>{
   budget();heartbeat();const id=observation.identity
   for(const b of [prediction,id.image,id.conditionPack,...id.channels])verify({path:b.path,sha256:b.sha256})
   const projection=put(outputRoot+'/'+prefix+'-projection.png',await sharp(absolute(prediction.path)).resize(1024,768,{kernel:'nearest'}).png().toBuffer())
   const detail=await auditMvp256DetailSufficiency({candidatePath:absolute(prediction.path),referencePath:absolute(id.image.path),contract:detailContract})
   const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:absolute(prediction.path),thresholdContract:thresholds,styleFingerprintPath:absolute(thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
   const alignment=await auditAiAssistedConditionAlignment({record:{recordId:reviewId+'-'+prefix,conditionBinding:{conditionPackPath:id.conditionPack.path,worldId:id.worldId,tick:id.tick},classification:{monsoonSeason:observation.monsoonSeason,regionalLandscapeType:null}},imagePath:projection.path,referenceImagePath:id.image.path})
   const issueCodes=[...new Set([...detail.issueCodes,...aesthetic.issues.map(i=>i.code),...alignment.issues.map(i=>i.code)])]
   const passed=detail.passed&&aesthetic.passed&&alignment.passed;assert.equal(passed,issueCodes.length===0);imageAudits++;assert(imageAudits<=112)
   const evidence=put(outputRoot+'/'+prefix+'-audit.json',{sampleId:observation.sampleId,split:observation.split,prediction,reference:id.image,condition:id.conditionPack,projection,nativePredictionDimensions:observation.nativePredictionDimensions,referenceNativeDimensions:observation.referenceNativeDimensions,projectionDimensions:{width:1024,height:768,kernel:'nearest'},projectionIsModelOutput:false,detail,aesthetic,alignment,...flags})
   return {passed,issueCodes,evidence}
  }
  for(let n=0;n<56;n++){
   const observation=expanded.observations[n],parentRow=parentRows[n],aRow=single.rows[n]
   assert.deepEqual(observation.identity,parentRow.identity);assert.deepEqual(aRow.identity,parentRow.identity)
   verify(aRow.afterPrediction)
   assert.equal(observation.split,n<48?'train':'validation')
   const parentAbsolute=await audit(observation,parentRow.prediction,'parent-'+n),candidateAbsolute=await audit(observation,observation.prediction,'candidate-'+n)
   rows.push({...observation,parentMetrics:parentRow.metrics,aMetrics:aRow.afterMetrics,parentPrediction:parentRow.prediction,aPrediction:aRow.afterPrediction,parentAbsolute,candidateAbsolute})
  }
  const decision=classifyReplayRetention(rows,policy)
  const aComparison=classifyReplayRetention(rows.map(r=>({...r,metrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy)
  const candidateToA=classifyReplayRetention(rows.map(r=>({...r,parentMetrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy)
  const descriptive=comparison=>({groups:comparison.groups,targetFullRgbMaeImproved:comparison.targetFullRgbMaeImproved,targetObjectChanges:comparison.targetObjectChanges,absoluteEvaluated:false,note:'paired descriptive metrics only; absolute recommendations are reported only for the current candidate versus parent'})
  for(const b of [...payload.programs,payload.specification,payload.policy,payload.sourceTerminal,payload.sourceCheckpoint,...expanded.inputs])verify(b)
  for(const [p,h]of observed)assert.equal(bind(p).sha256,h,p);budget();assert.ifError(heartbeatError)
  const context={reviewId,executionPackage:packageBinding}
  const rowBindings=decision.rows.map((row,n)=>({sampleId:row.sampleId,split:row.split,binding:put(outputRoot+`/row-${String(n).padStart(2,'0')}.json`,reviewRowShard(row,inference.observationBindings[n].binding,context))}))
  const {rows:expandedRows,...summary}=decision
  const report=put(outputRoot+'/review.json',{schemaVersion:'ai-painter-replay-retention-review-result-v1',reviewId,sourceRunId:terminal.runId,arm:source.arm,executionPackage:packageBinding,sourceTerminal,sourceCheckpoint:checkpoint,inference:inferenceBinding,policy:policyBinding,parentEvaluation:policy.parentEvaluation,single149Evaluation:policy.single149Evaluation,dynamicReadAudit:inference.dynamicReadAudit,historicalSourceBaseline:HISTORICAL_SOURCE_BASELINE,historicalSourceReads:inference.historicalSourceReads,descriptiveRetention:describeReplayRetention(decision.rows,policy),historicalMetricsAuthority:'frozen_evaluations_revalidated_by_worker_not_ledger',rowsStorage:'sha256_per_sample_json_v1',rowBindings,absoluteImageAudits:imageAudits,parentGeneratorForwards:0,...summary,aVersusParent:descriptive(aComparison),candidateVersusA:descriptive(candidateToA),final149CrossDeviceComparison:inference.final149CrossDeviceComparison,qualificationScope:'paired_numeric_and_existing_visual_components_not_object_recognition_or_release',recordedAtUtc:new Date().toISOString(),elapsedSeconds:(performance.now()-mono)/1000,timingScope:'review_controller_package_worker_and_absolute_audits_before_terminal_commit'})
  clearInterval(timer);timer=null
  const final=put(outputRoot+'/terminal.json',{schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:decision.absoluteOutcome==='unknown'?'replay_retention_review_evidence_unknown':decision.absoluteOutcome==='failed'?'replay_retention_review_completed_absolute_failed':'replay_retention_review_completed_not_qualified',executionState:'completed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal,report,visualOutcome:decision.absoluteOutcome,relativeOutcome:decision.recommendation,recordedAtUtc:new Date().toISOString(),startedAtUtc:new Date(started).toISOString(),elapsedSeconds:(performance.now()-mono)/1000,optimizerUpdates:0,gpuInitialized:false,...flags})
  await commit(final,'completed','replay_retention_review_completed');return {terminal:final,report,visualOutcome:decision.absoluteOutcome,relativeOutcome:decision.recommendation}
 }catch(error){
  if(timer)clearInterval(timer);timer=null;let cleanupError=null
  try{if(cleanupPromise)await cleanupPromise;else await stopReviewWorker(child,{closed:childClosed})}catch(e){cleanupError=String(e.stack??e)}
  const failure=put(outputRoot+'/failure.json',{schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:'replay_retention_review_execution_failed',executionState:'failed_closed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal,visualOutcome:'unknown',relativeOutcome:'unknown',recordedAtUtc:new Date().toISOString(),error:String(error.stack??error),heartbeatPublication:error.heartbeatPublication??heartbeatError?.heartbeatPublication??null,cleanupError,...flags})
  if(registered)await commit(failure,'failed_closed','replay_retention_review_execution_failed');error.reviewFailureEvidence=failure;throw error
 }finally{if(timer)clearInterval(timer)}
}

export async function runReplayRetentionReview(options={}){
 try{return await runReview(options)}catch(error){
  if(!error.reviewFailureEvidence){
   const root=path.resolve(options.projectRoot??process.cwd());assert.equal(root,path.resolve(process.cwd()))
   const reviewId='replay-retention-review-rejected-v1-'+process.pid+'-'+Date.now()
   const outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId,logical=outputRoot+'/failure.json'
   fs.mkdirSync(path.join(root,outputRoot),{recursive:true})
   const bytes=Buffer.from(JSON.stringify({schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:'replay_retention_review_preflight_failed',executionState:'failed_closed',runId:reviewId,registered:false,sourceTerminal:options.sourceTerminal??null,visualOutcome:'unknown',relativeOutcome:'unknown',recordedAtUtc:new Date().toISOString(),error:String(error.stack??error),...flags},null,2)+'\n')
   assert(bytes.length<65536);fs.writeFileSync(path.join(root,logical),bytes,{flag:'wx'});error.reviewFailureEvidence={path:logical,sha256:sha(bytes)}
  }
  throw error
 }
}
