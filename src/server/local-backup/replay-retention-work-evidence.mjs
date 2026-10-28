import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
import {boundaryPolicyBinding,validateBoundaryIdentity} from '../../../scripts/lib/ai-painter-replay-retention-fit-v1.mjs'

const MIB=1024*1024,MAX_TOTAL=8*MIB,MAX_READS=512
const TARGET='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
const CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
const REVIEW_POLICY={path:'data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json',sha256:'308d607e3f15bb936279be93b2525a37f1707365990941efdf6e78459029bcf4'}
const FIT_POLICIES={mixed:{path:'data/ai-painter/system-governance/ai-painter-replay-retention-mixed-policy-v1.json',sha256:'d22352e9cc241fcdb53504b6c853b819165df4fb758eaae00773a8e944b32e88'},short:{path:'data/ai-painter/system-governance/ai-painter-replay-retention-short-policy-v1.json',sha256:'e259abe3a5d43e3db576a3121baee05d501e6d8f3ffe4515f85fb8db6b430c8a'},balanced:{path:'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json',sha256:'4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db'}}
const FLAGS=['formalQualificationGranted','checkpointPromotable','runtimePublicationAllowed','automaticNextTraining']
FIT_POLICIES['balanced-boundary']=boundaryPolicyBinding
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const check=(ok,code)=>{if(!ok)throw Error('replay_retention_evidence_'+code)}
const same=(a,b,code)=>check(isDeepStrictEqual(a,b),code)
const binding=b=>{check(object(b)&&typeof b.path==='string'&&/^(?:\.runtime\/ai-painter|data|ml\/ai-painter|scripts|src|docs)\//.test(b.path)&&!/[\\:\x00-\x1f]/.test(b.path)&&b.path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&p!=='latest.json')&&/^[a-f0-9]{64}$/.test(b.sha256??''),'binding_invalid');return b}
const plainBinding=b=>({path:binding(b).path,sha256:b.sha256})
const sameBinding=(a,b,code)=>same(plainBinding(a),plainBinding(b),code)
const noQualification=v=>{for(const k of FLAGS)check(v[k]===false,'qualification_conflict')}

// Exact versioned package exception. Used by the existing reader only after
// actual bytes/SHA/path checks; this grants no execution or qualification.
export function validateReplayRetentionFitPackage(value,read) {
 check(value?.schemaVersion==='replay-retention-fit-package-v1'&&Object.hasOwn(FIT_POLICIES,value.arm),'fit_schema')
 const policyBinding=FIT_POLICIES[value.arm];sameBinding(value.policy,policyBinding,'fit_policy_binding')
 const policy=read(policyBinding.path,policyBinding.sha256)
 check(policy.value.schemaVersion==='replay-retention-fit-policy-v1'&&policy.value.arm===value.arm,'fit_policy_schema')
 const p=policy.value,parent=read(p.parentExperiment.package.path,p.parentExperiment.package.sha256)
 same(value.parentExperiment,p.parentExperiment,'fit_parent_identity');sameBinding(value.checkpoint,p.parentExperiment.checkpoint,'fit_parent_checkpoint')
 sameBinding(value.sourcePlan,parent.value.sourcePlan,'fit_source_plan')
 const plan=read(value.sourcePlan.path,value.sourcePlan.sha256),split=read(plan.value.trainSplit.path,plan.value.trainSplit.sha256)
 const train=split.value.sampleIds
 check(Array.isArray(train)&&train.length===48&&new Set(train).size===48&&train.includes(TARGET),'fit_train_members')
 const mixed=value.arm==='mixed',balanced=['balanced','balanced-boundary'].includes(value.arm),selected=mixed||balanced?train:[TARGET],others=train.filter(s=>s!==TARGET)
 if(value.arm==='balanced-boundary')validateBoundaryIdentity(value)
 same(value.selectedSampleIds,selected,'fit_selected_members');same(value.training,p.training,'fit_training_policy')
 check(value.training.pairs===(mixed||balanced?200:100)&&value.training.targetPairs===(balanced?5:100)&&value.training.replayPairs===(balanced?195:mixed?100:0)
  &&value.training.seed===20260929&&value.training.supportStructureWeight===0.1,'fit_training_counts')
 const schedule=balanced?[...train,...train,...train,...train,...train.slice(0,8)]:mixed?Array.from({length:100},(_,i)=>[TARGET,others[i%47]]).flat():Array(100).fill(TARGET)
 same(value.schedule,schedule,'fit_schedule')
 const visits=Object.fromEntries(selected.map(s=>[s,0]));for(const id of schedule)visits[id]++
 if(balanced)check(visits[TARGET]===5&&visits['mvp64-slot164-objects-v5-20261020']===4,'fit_balanced_exposure')
 same(value.plannedSampleVisits,visits,'fit_sample_visits')
 check(value.modelCapability===CAPABILITY&&p.modelCapability===CAPABILITY&&value.qualificationGranted===false,'fit_qualification_or_model')
 check(typeof value.experimentIdentity==='string'&&/^[a-z0-9][a-z0-9-]{7,127}$/.test(value.experimentIdentity)
  &&value.outputRoot==='.runtime/ai-painter/learning-capacity-experiments/'+value.experimentIdentity,'fit_output_identity')
 return {policy,parent,plan,train,visits}
}

function boundReader(read) {
 const cache=new Map();let bytes=0
 const get=b=>{
  b=plainBinding(b);const key=JSON.stringify(b)
  if(cache.has(key))return cache.get(key)
  check(cache.size<MAX_READS,'read_count_limit')
  const r=read(b.path,b.sha256);check(object(r)&&object(r.value),'json_shape')
  const size=Buffer.isBuffer(r.bytes)?r.bytes.length:r.byteLength
  check(Number.isSafeInteger(size)&&size>=0,'json_size_metadata_required')
  if(Buffer.isBuffer(r.bytes))check(createHash('sha256').update(r.bytes).digest('hex')===b.sha256,'json_hash_conflict')
  if(r.sha256!==undefined)check(r.sha256===b.sha256,'json_hash_conflict')
  const v=r.value,large=size>MIB
  check(size<=(large?4*MIB:MIB),'json_size_limit')
  if(large)check(b.path===v.outputRoot+'/package.json'&&(
   v.schemaVersion==='mixed-train-rehearsal-package-v1'&&v.training?.pairs===448&&v.qualificationGranted===false
    &&Array.isArray(v.selectedSampleIds)&&v.selectedSampleIds.length===48&&new Set(v.selectedSampleIds).size===48
    &&v.outputRoot==='.runtime/ai-painter/learning-capacity-experiments/'+v.experimentIdentity
   ||v.schemaVersion==='replay-retention-fit-package-v1'&&['mixed','balanced','balanced-boundary'].includes(v.arm)),'large_package_only')
  bytes+=size;check(bytes<=MAX_TOTAL,'total_bytes_limit');cache.set(key,r)
  if(large&&v.schemaVersion==='replay-retention-fit-package-v1')validateReplayRetentionFitPackage(v,(p,s)=>get({path:p,sha256:s}))
  return r
 }
 return {get,coverage:()=>({jsonFiles:cache.size,jsonBytes:bytes,maxJsonBytes:MIB,maxPackageBytes:4*MIB,maxTotalBytes:MAX_TOTAL,maxReadCount:MAX_READS})}
}

// The caller authenticates the terminal via the committed registry and owns
// safe, SHA-checked I/O. All child discovery is from exact bindings below.
export function readReplayRetentionWorkEvidence({terminal,read}) {
 if(terminal?.schemaVersion!=='ai-painter-replay-retention-review-terminal-v1')return null
 const reader=boundReader(read),get=reader.get
 check(['completed','failed_closed'].includes(terminal.executionState),'terminal_state')
 noQualification(terminal)
 const pkg=get(terminal.executionPackage),p=pkg.value
 check(p.schemaVersion==='ai-painter-replay-retention-review-package-v1'&&p.reviewId===terminal.runId
  &&terminal.packageId===terminal.runId&&p.outputRoot==='.runtime/ai-painter/learning-capacity-experiments/'+terminal.runId,'package_identity')
 sameBinding(terminal.executionPackage,{path:p.outputRoot+'/package.json',sha256:terminal.executionPackage.sha256},'package_path')
 noQualification(p);sameBinding(p.policy,REVIEW_POLICY,'review_policy_binding')
 const policy=get(p.policy),pol=policy.value
 check(pol.schemaVersion==='ai-painter-replay-retention-review-policy-v1'&&pol.targetSampleId===TARGET
  &&pol.optimizerUpdates===0&&pol.trainingAllowed===false&&pol.gpuAllowed===false,'review_policy')
 noQualification(pol)
 sameBinding(terminal.sourceTerminal,p.sourceTerminal,'source_terminal_binding')
 const source=get(p.sourceTerminal),t=source.value
 check(t.schemaVersion==='ai-painter-learning-capacity-experiment-terminal-v1'&&t.executionState==='completed'
  &&t.status==='experiment_completed_not_formal_qualified'&&t.runId===terminal.sourceRunId,'source_terminal')
 check(t.formalTrainingQualified===false&&t.checkpointPromotable===false&&t.worldEntryAllowed===false,'source_qualification')
 sameBinding(t.executionPackage,p.sourcePackage,'source_package_binding')
 const sourcePackage=get(p.sourcePackage),s=sourcePackage.value
 const fit=validateReplayRetentionFitPackage(s,(a,b)=>get({path:a,sha256:b}))
 check(s.experimentIdentity===t.runId&&s.modelCapability===p.sourceModelCapability,'source_run')
 const sourceResult=get(t.result),r=sourceResult.value,pairs=s.arm==='short'?100:200
 check(r.experimentIdentity===t.runId&&r.arm===s.arm&&r.status==='experiment_executed_not_visual_qualified'
  &&r.checkpointReloadExact===true&&r.sameParentStartVerified===true&&r.formalQualificationGranted===false,'source_result')
 same(r.optimizerSteps,{generator:pairs,discriminator:pairs},'source_steps')
 same(r.parentStateHashes,r.initialStateHashes,'source_parent_start')
 same(r.parentStateHashes,s.parentStateHashes,'source_named_parent')
 same(r.sampleVisits,s.plannedSampleVisits,'source_visits')
 check(r.targetUpdates===(['balanced','balanced-boundary'].includes(s.arm)?5:100)&&r.replayUpdates===(['balanced','balanced-boundary'].includes(s.arm)?195:s.arm==='mixed'?100:0),'source_exposure')
 if(s.arm==='balanced-boundary')validateBoundaryIdentity(s,r)
 const checkpoints=r.artifacts?.filter(b=>b.path===s.outputRoot+'/checkpoint-final.pt')??[]
 check(checkpoints.length===1,'source_checkpoint')
 sameBinding(checkpoints[0],p.sourceCheckpoint,'source_checkpoint_binding')
 const parent=pol.parentExperiment
 for(const k of ['package','terminal','result','checkpoint'])sameBinding(s.parentExperiment[k],parent[k],'policy_parent_'+k)
 const parentTerminal=get(parent.terminal),parentResult=get(parent.result)
 check(parentTerminal.value.executionState==='completed','parent_not_completed')
 sameBinding(parentTerminal.value.executionPackage,parent.package,'parent_package_binding')
 sameBinding(parentTerminal.value.result,parent.result,'parent_result_binding')
 same(parentResult.value.optimizerSteps,{generator:448,discriminator:448},'parent_steps')
 check(parentResult.value.artifacts?.some(b=>isDeepStrictEqual(plainBinding(b),plainBinding(parent.checkpoint))),'parent_checkpoint_missing')
 sameBinding(s.checkpoint,parent.checkpoint,'parent_checkpoint')
 const aPackage=get(pol.single149Experiment.package),aTerminal=get(pol.single149Experiment.terminal),aResult=get(pol.single149Experiment.result)
 check(aTerminal.value.executionState==='completed','a_not_completed')
 sameBinding(aTerminal.value.executionPackage,pol.single149Experiment.package,'a_package_binding')
 sameBinding(aTerminal.value.result,pol.single149Experiment.result,'a_result_binding')
 sameBinding(aPackage.value.checkpoint,parent.checkpoint,'a_parent_checkpoint')
 check(aResult.value.artifacts?.some(b=>isDeepStrictEqual(plainBinding(b),plainBinding(pol.single149Experiment.checkpoint))),'a_checkpoint_missing')
 const validation=get(fit.plan.value.validationSplit),val=validation.value.sampleIds
 check(Array.isArray(val)&&val.length===8&&new Set([...fit.train,...val]).size===56,'review_members')
 same(p.trainSampleIds,fit.train,'review_train_roster');same(p.validationSampleIds,val,'review_validation_roster')
 const common={pkg,source,sourcePackage,sourceResult,policy,parentPackage:fit.parent,parentTerminal,parentResult,aPackage,aTerminal,aResult,arm:s.arm,
  samples:[...fit.train,...val].map((sampleId,i)=>({sampleId,split:i<48?'train':'validation'}))}
 if(terminal.executionState==='failed_closed') {
  check(terminal.status==='replay_retention_review_execution_failed'&&terminal.visualOutcome==='unknown'&&terminal.relativeOutcome==='unknown','failed_outcome')
  return {...common,report:null,inference:null,auditRows:[],executionResult:'failed',absoluteOutcome:'unknown',relativeOutcome:'unknown',classification:null,
   clock:{startedAtUtc:terminal.startedAtUtc??null,finishedAtUtc:terminal.recordedAtUtc??null,elapsedSeconds:null},actualCalls:null,readCoverage:reader.coverage()}
 }
 check(terminal.optimizerUpdates===0&&terminal.gpuInitialized===false,'review_updates_or_gpu')
 return readCompletedReview({terminal,common,get,reader})
}

const finite=n=>typeof n==='number'&&Number.isFinite(n)
// Cross-check the saved scalar comparison; never run image audits or infer
// missing historical metrics. The frozen policy remains the sole threshold.
function verifyRelative(saved,before,after,d) {
 const checks=[]
 const compare=(name,a,b,kind,na=false)=>{
  if(na){checks.push({name,status:'not_applicable',before:a,after:b,delta:null});return}
  if(!finite(a)||!finite(b)||(kind!=='correlation'&&(a<0||b<0||a>1||b>1))||(kind==='correlation'&&(Math.abs(a)>1||Math.abs(b)>1))){checks.push({name,status:'unknown',before:finite(a)?a:null,after:finite(b)?b:null,delta:null});return}
  const delta=b-a,limit=kind==='correlation'?d.maximumCorrelationDrop:d.maximumPerImageMaeIncrease
  checks.push({name,before:a,after:b,delta,status:(kind==='correlation'?-delta:delta)<=limit+d.comparisonEpsilon?'retained':'regressed'})
 }
 compare('fullRgbMae',before?.fullRgbMae,after?.fullRgbMae,'mae')
 for(const region of d.regionKinds)for(const role of d.metricRoles){const a=before?.regions?.[region]?.[role],b=after?.regions?.[region]?.[role],matching=a&&b&&Number.isInteger(a.pixels)&&a.pixels>=0&&a.pixels===b.pixels
  for(const metric of ['rgbMae','correlation']){const na=matching&&a[metric]===null&&b[metric]===null&&a.naReason===b.naReason&&((a.pixels===0&&a.naReason==='empty_region')||(metric==='correlation'&&['fewer_than_two_pixels','constant_reference_region'].includes(a.naReason)));compare(region+'.'+role+'.'+metric,matching?a[metric]:undefined,matching?b[metric]:undefined,metric,na)}}
 same(saved,{checks,status:checks.some(c=>c.status==='unknown')?'unknown':checks.some(c=>c.status==='regressed')?'regressed':'retained',fullRgbMaeDelta:checks[0].delta},'relative_scalar_conflict')
}
function clock(value,scope,ceiling) {
 check(value.timingScope===scope&&finite(value.elapsedSeconds)&&value.elapsedSeconds>=0&&value.elapsedSeconds<=ceiling,'clock_scope_or_elapsed')
 return {scope,startedAtUtc:value.startedAtUtc??null,finishedAtUtc:value.endedAtUtc??value.recordedAtUtc??null,elapsedSeconds:value.elapsedSeconds}
}
function readCompletedReview({terminal,common,get,reader}) {
 const {pkg,sourceResult,policy}=common,p=pkg.value,pol=policy.value,root=p.outputRoot
 const used=new Set(),own=b=>{binding(b);check(b.path.startsWith(root+'/')&&b.path.endsWith('.json')&&!used.has(b.path),'shard_scope_or_duplicate');used.add(b.path);return get(b)}
 sameBinding(terminal.report,{path:root+'/review.json',sha256:terminal.report?.sha256},'report_path')
 const report=own(terminal.report),v=report.value
 check(v.schemaVersion==='ai-painter-replay-retention-review-result-v1'&&v.reviewId===terminal.runId&&v.sourceRunId===terminal.sourceRunId&&v.arm===common.arm,'report_identity')
 sameBinding(v.executionPackage,terminal.executionPackage,'report_package');sameBinding(v.sourceTerminal,p.sourceTerminal,'report_source')
 sameBinding(v.sourceCheckpoint,p.sourceCheckpoint,'report_checkpoint');sameBinding(v.policy,p.policy,'report_policy')
 sameBinding(v.parentEvaluation,pol.parentEvaluation,'parent_evaluation_binding');sameBinding(v.single149Evaluation,pol.single149Evaluation,'a_evaluation_binding')
 check(v.historicalMetricsAuthority==='frozen_evaluations_revalidated_by_worker_not_ledger','historical_authority')
 noQualification(v)
 check(v.rowsStorage==='sha256_per_sample_json_v1'&&v.rows===undefined&&Array.isArray(v.rowBindings)&&v.rowBindings.length===56,'row_manifest')
 sameBinding(v.inference,{path:root+'/inference.json',sha256:v.inference?.sha256},'inference_path')
 const inference=own(v.inference),i=inference.value
 check(i.schemaVersion==='ai-painter-replay-retention-review-inference-v1'&&i.reviewId===p.reviewId,'inference_identity')
 sameBinding(i.executionPackage,terminal.executionPackage,'inference_package');sameBinding(i.sourceCheckpoint,p.sourceCheckpoint,'inference_checkpoint')
 same(i.actualCalls,{generatorForwards:56,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0},'inference_calls')
 check(i.optimizerUpdates===0&&i.gpuInitialized===false&&i.formalQualificationGranted===false,'inference_qualification')
 check(Array.isArray(i.stateBefore)&&i.stateBefore.length===2&&i.stateBefore.every(h=>/^[a-f0-9]{64}$/.test(h)),'inference_state_shape')
 same(i.stateBefore,i.stateAfter,'inference_state_mutated')
 same(i.trainingNamedStateBefore,sourceResult.value.finalStateHashes,'inference_training_state')
 same(i.trainingNamedStateAfter,i.trainingNamedStateBefore,'inference_named_mutation')
 same(i.parentStateVerification?.named091,sourceResult.value.parentStateHashes,'inference_parent_state')
 check(i.parentStateVerification?.generatorForwards===0,'parent_forward')
 check(Array.isArray(i.historicalPixelReproductions)&&i.historicalPixelReproductions.length===20,'historical_reproduction_count')
 for(const arm of ['parent','A'])check(new Set(i.historicalPixelReproductions.filter(r=>r.arm===arm).map(r=>r.sampleId)).size===10,'historical_reproduction_members')
 check(i.final149CrossDeviceComparison?.scope==='cross_device_observation_not_same_device_reload_gate','cross_device_scope')
 same(v.final149CrossDeviceComparison,i.final149CrossDeviceComparison,'cross_device_report')
 check(i.observationsStorage==='sha256_per_sample_json_v1'&&i.observations===undefined&&Array.isArray(i.observationBindings)&&i.observationBindings.length===56,'observation_manifest')
 check(i.inputsStorage==='sha256_binding_chunks_v1'&&i.inputs===undefined&&Number.isInteger(i.inputCount)&&i.inputCount>0&&i.inputCount<=8192
  &&Array.isArray(i.inputManifestBindings)&&i.inputManifestBindings.length===Math.ceil(i.inputCount/256),'input_manifest')
 const inputs=[]
 for(const b of i.inputManifestBindings){const part=own(b).value;check(part.schemaVersion==='ai-painter-replay-retention-input-bindings-v1'&&part.reviewId===p.reviewId,'input_chunk_identity');sameBinding(part.executionPackage,terminal.executionPackage,'input_chunk_package');check(part.offset===inputs.length&&Array.isArray(part.bindings)&&part.bindings.length===Math.min(256,i.inputCount-inputs.length),'input_chunk_order');for(const ref of part.bindings)binding(ref);inputs.push(...part.bindings)}
 check(inputs.length===i.inputCount&&new Set(inputs.map(b=>b.path)).size===inputs.length,'input_duplicates')
 const programs=[...(common.sourcePackage.value.programs??[]),...(p.programs??[])]
 check(Array.isArray(i.actualProjectSources)&&i.actualProjectSources.length>0&&i.actualProjectSources.length<=1024,'project_sources')
 for(const actual of i.actualProjectSources){binding(actual);check(programs.some(b=>b.path===actual.path&&b.sha256===actual.sha256)&&inputs.some(b=>b.path===actual.path&&b.sha256===actual.sha256),'project_source_binding')}
 const auditRows=[],samples=[]
 for(let n=0;n<56;n++){
  const expected=common.samples[n],o=i.observationBindings[n],r=v.rowBindings[n]
  check(o?.sampleId===expected.sampleId&&o.split===expected.split&&r?.sampleId===expected.sampleId&&r.split===expected.split,'member_order')
  const observation=own(o.binding).value,row=own(r.binding).value
  check(observation.schemaVersion==='ai-painter-replay-retention-observation-v1'&&row.schemaVersion==='ai-painter-replay-retention-review-row-v1','member_schema')
  for(const entry of [observation,row]){check(entry.reviewId===p.reviewId&&entry.sampleId===expected.sampleId&&entry.split===expected.split,'member_identity');sameBinding(entry.executionPackage,terminal.executionPackage,'member_package')}
  sameBinding(row.observation,o.binding,'row_observation')
  check(observation.identity?.sampleId===expected.sampleId&&observation.identity?.split===expected.split,'sample_identity')
  binding(observation.identity.image);binding(observation.identity.conditionPack);binding(observation.prediction)
  check(observation.prediction.path.startsWith(root+'/')&&observation.prediction.path.endsWith('.png'),'prediction_root')
  same(observation.nativePredictionDimensions,{width:256,height:192},'native_dimensions')
  const d=observation.referenceNativeDimensions;check(Number.isInteger(d?.width)&&d.width>0&&d.width<=8192&&Number.isInteger(d?.height)&&d.height>0&&d.height<=8192,'reference_dimensions')
  check(observation.imageTiming?.scope==='CPU_forward_transfer_PNG_publication'&&finite(observation.imageTiming.elapsedSeconds)&&observation.imageTiming.elapsedSeconds>=0,'image_clock')
  const auditPair={sampleId:expected.sampleId,split:expected.split}
  for(const [role,prediction]of [['parent',row.parentPrediction],['candidate',observation.prediction]]){
   binding(prediction);const declared=row[role+'Absolute'];check(object(declared)&&typeof declared.passed==='boolean'&&Array.isArray(declared.issueCodes),'audit_declaration')
   const detail=own(declared.evidence).value
   check(detail.sampleId===expected.sampleId&&detail.split===expected.split,'audit_member')
   sameBinding(detail.prediction,prediction,'audit_prediction');sameBinding(detail.reference,observation.identity.image,'audit_reference');sameBinding(detail.condition,observation.identity.conditionPack,'audit_condition')
   noQualification(detail);same(detail.nativePredictionDimensions,observation.nativePredictionDimensions,'audit_native_dimensions');same(detail.referenceNativeDimensions,d,'audit_reference_dimensions')
   same(detail.projectionDimensions,{width:1024,height:768,kernel:'nearest'},'audit_projection_dimensions');check(detail.projectionIsModelOutput===false,'projection_model_output')
   binding(detail.projection);check(detail.projection.path.startsWith(root+'/')&&detail.projection.path.endsWith('.png'),'projection_root')
   check([detail.detail?.passed,detail.aesthetic?.passed,detail.alignment?.passed].every(x=>typeof x==='boolean')&&Array.isArray(detail.detail.issueCodes)&&Array.isArray(detail.aesthetic.issues)&&Array.isArray(detail.alignment.issues),'audit_components')
   const codes=[...new Set([...detail.detail.issueCodes,...detail.aesthetic.issues.map(x=>x.code),...detail.alignment.issues.map(x=>x.code)])]
   check(codes.every(c=>typeof c==='string')&&declared.passed===(detail.detail.passed&&detail.aesthetic.passed&&detail.alignment.passed)&&declared.passed===(codes.length===0),'audit_pass_conflict')
   same(declared.issueCodes,codes,'audit_codes');auditPair[role]={binding:declared.evidence,value:detail}
  }
  const a=row.parentAbsolute,b=row.candidateAbsolute,absolute={status:b.passed?'passed':'failed',parentPassed:a.passed,candidatePassed:b.passed,newIssueCodes:b.issueCodes.filter(c=>!a.issueCodes.includes(c)),existingIssueCodes:b.issueCodes.filter(c=>a.issueCodes.includes(c)),resolvedIssueCodes:a.issueCodes.filter(c=>!b.issueCodes.includes(c))}
  same(row.absolute,absolute,'absolute_delta')
  check(['retained','regressed','unknown'].includes(row.relative?.status)&&Array.isArray(row.relative.checks)&&row.relative.checks.length===17,'relative_shape')
  verifyRelative(row.relative,row.parentMetrics,observation.metrics,pol.relativeRetention)
  const normalized={...observation,observationBinding:o.binding,rowBinding:r.binding,parentMetrics:row.parentMetrics,aMetrics:row.aMetrics,parentPrediction:row.parentPrediction,aPrediction:row.aPrediction,relative:row.relative,absolute:row.absolute,parentAbsolute:a,candidateAbsolute:b}
  samples.push(normalized);auditRows.push(auditPair)
 }
 check(v.absoluteImageAudits===112&&v.parentGeneratorForwards===0,'audit_count')
 const absoluteOutcome=samples.some(r=>r.relative.status==='unknown')?'unknown':samples.some(r=>r.absolute.status==='failed')?'failed':'component_checks_passed_not_qualified'
 check(v.absoluteOutcome===absoluteOutcome&&terminal.visualOutcome===absoluteOutcome,'absolute_outcome')
 check(typeof v.recommendation==='string'&&terminal.relativeOutcome===v.recommendation,'relative_outcome')
 for(const [name,subset]of [['target149',samples.filter(r=>r.sampleId===TARGET)],['other47',samples.filter(r=>r.split==='train'&&r.sampleId!==TARGET)],['developmentValidation8',samples.filter(r=>r.split==='validation')]]){
  const g=v.groups?.[name];check(g?.count===subset.length&&g.retainedCount===subset.filter(r=>r.relative.status==='retained').length&&g.regressedCount===subset.filter(r=>r.relative.status==='regressed').length&&g.unknownCount===subset.filter(r=>r.relative.status==='unknown').length,'group_count')
  const deltas=subset.map(r=>r.relative.fullRgbMaeDelta).filter(finite),mean=deltas.length?deltas.reduce((a,b)=>a+b,0)/deltas.length:null,limit=name==='target149'?null:pol.relativeRetention.maximumGroupMeanFullRgbMaeIncrease
  const meanPass=limit===null||finite(mean)&&mean<=limit+pol.relativeRetention.comparisonEpsilon
  check(g.fullRgbMaeDelta?.mean===mean&&g.status===(g.unknownCount?'unknown':g.regressedCount||!meanPass?'regressed':'retained'),'group_scalar_conflict')
 }
 const unknown=samples.some(r=>r.relative.status==='unknown'),target=samples.find(r=>r.sampleId===TARGET),d=pol.relativeRetention
 const improved=finite(target.relative.fullRgbMaeDelta)?-target.relative.fullRgbMaeDelta+d.comparisonEpsilon>=d.targetFullRgbMaeMinimumReduction:null
 const targetRegression=target.relative.checks.some(c=>c.name!=='fullRgbMae'&&c.status==='regressed'),newFailure=samples.some(r=>r.absolute.newIssueCodes.length>0)
 const retained=v.groups.other47.status==='retained'&&v.groups.developmentValidation8.status==='retained'
 const recommendation=unknown?'evidence_unknown':newFailure?'do_not_adopt_new_absolute_failures':targetRegression?'do_not_adopt_target_object_regression':!retained?'do_not_adopt_retention_regression':!improved?'do_not_adopt_no_target_improvement':'eligible_for_further_diagnostic_comparison_not_qualified'
 check(v.targetFullRgbMaeImproved===improved&&v.targetObjectRegression===targetRegression&&v.newAbsoluteFailure===newFailure&&v.retentionPreserved===(unknown?null:retained)&&v.recommendation===recommendation,'relative_recommendation_conflict')
 const expectedStatus=absoluteOutcome==='unknown'?'replay_retention_review_evidence_unknown':absoluteOutcome==='failed'?'replay_retention_review_completed_absolute_failed':'replay_retention_review_completed_not_qualified'
 check(terminal.status===expectedStatus,'terminal_outcome')
 const reportClock=clock(v,'review_controller_package_worker_and_absolute_audits_before_terminal_commit',900)
 const workerClock=clock(i,'worker_after_imports_and_package_read_through_observation_and_input_chunks_before_inference_manifest_write',600)
 return {...common,report,inference,samples,auditRows,inputs,executionResult:'succeeded',absoluteOutcome,relativeOutcome:v.recommendation,
  classification:{groups:v.groups,targetFullRgbMaeImproved:v.targetFullRgbMaeImproved,targetObjectRegression:v.targetObjectRegression,retentionPreserved:v.retentionPreserved,newAbsoluteFailure:v.newAbsoluteFailure,recommendation:v.recommendation},
  clock:reportClock,workerClock,actualCalls:i.actualCalls,failedSamples:samples.filter(r=>!r.candidateAbsolute.passed).length,
  issueCodes:[...new Set(samples.flatMap(r=>r.candidateAbsolute.issueCodes))],readCoverage:{...reader.coverage(),oldEvaluationBodiesRead:false,modelOrImageBytesRead:false,oldFloatingPointMetricsReaudited:false}}
}
