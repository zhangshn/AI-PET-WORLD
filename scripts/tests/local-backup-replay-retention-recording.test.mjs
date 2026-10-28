import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {DatabaseSync} from 'node:sqlite'
import {classifyReplayRetention,describeReplayRetention,reviewRowShard} from '../lib/ai-painter-replay-retention-review-v1.mjs'
import {readReplayRetentionWorkEvidence,validateReplayRetentionFitPackage} from '../../src/server/local-backup/replay-retention-work-evidence.mjs'
import {createStore,initializeStore} from '../../src/server/local-backup/store.mjs'
import {createWorkProducersForIsolatedTests} from '../../src/server/local-backup/work-producers.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex'),copy=v=>JSON.parse(JSON.stringify(v))
const TARGET='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3',CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
const flags={formalQualificationGranted:false,checkpointPromotable:false,runtimePublicationAllowed:false,automaticNextTraining:false}
const PLAN='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md',REG='.runtime/ai-painter/current-execution-registry'
const at='2026-10-27T05:00:00.000Z',states={generator:'c'.repeat(64),discriminator:'d'.repeat(64)}

// Pure mode explicitly mocks authenticated old metadata. onDisk mode copies
// only named frozen JSON metadata and generates private, fake new artifacts;
// neither mode loads model/PNG bytes or runs a model.
export function createReplayRetentionFixture({arm='mixed',onDisk=false,large=true,failure=false,regressed=false,fitMutation=null}={}) {
 const entries=new Map(),fixed=(p,v,bytes=1000,s)=>{entries.set(p,{value:v,byteLength:bytes,sha256:s});return {path:p,sha256:s}}
 const put=(p,v)=>{const bytes=Buffer.from(JSON.stringify(v)),ref={path:p,sha256:sha(bytes)};entries.set(p,{value:v,bytes,byteLength:bytes.length,sha256:ref.sha256});return ref}
 const load=b=>{const bytes=fs.readFileSync(b.path);assert.equal(sha(bytes),b.sha256);entries.set(b.path,{value:JSON.parse(bytes),bytes,byteLength:bytes.length,sha256:b.sha256});return entries.get(b.path)}
 const policyPath='data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json',policyBytes=fs.readFileSync(policyPath),policy=JSON.parse(policyBytes),policyBinding={path:policyPath,sha256:sha(policyBytes)};load(policyBinding)
 const fitPath=`data/ai-painter/system-governance/ai-painter-replay-retention-${arm}-policy-v1.json`,fitBytes=fs.readFileSync(fitPath),fit=JSON.parse(fitBytes),fitBinding={path:fitPath,sha256:sha(fitBytes)};load(fitBinding)
 let parentPackage,sourcePlan,train,validation
 if(onDisk){parentPackage=load(policy.parentExperiment.package).value;sourcePlan=load(parentPackage.sourcePlan).value;train=load(sourcePlan.trainSplit).value.sampleIds;validation=load(sourcePlan.validationSplit).value.sampleIds;for(const b of [policy.parentExperiment.terminal,policy.parentExperiment.result,policy.single149Experiment.package,policy.single149Experiment.terminal,policy.single149Experiment.result])load(b)}
 else {
  train=arm==='balanced-boundary'?JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-mixed-train-terrain-ecology-policy-v1.json')).sampleIds:[TARGET,...Array.from({length:46},(_,n)=>'fixture-train-'+n),'mvp64-slot164-objects-v5-20261020'];validation=Array.from({length:8},(_,n)=>'fixture-devval-'+n)
  const trainSplit=put('.runtime/ai-painter/fixture-members/train.json',{sampleIds:train}),validationSplit=put('.runtime/ai-painter/fixture-members/validation.json',{sampleIds:validation})
  const planBinding=put('.runtime/ai-painter/fixture-members/plan.json',{trainSplit,validationSplit});sourcePlan=entries.get(planBinding.path).value
  const root=path.posix.dirname(policy.parentExperiment.package.path)
  parentPackage={schemaVersion:'mixed-train-rehearsal-package-v1',selectedSampleIds:train,training:{pairs:448},qualificationGranted:false,experimentIdentity:path.posix.basename(root),outputRoot:root,sourcePlan:planBinding}
  fixed(policy.parentExperiment.package.path,parentPackage,1247999,policy.parentExperiment.package.sha256)
  fixed(policy.parentExperiment.terminal.path,{executionState:'completed',executionPackage:policy.parentExperiment.package,result:policy.parentExperiment.result},2008,policy.parentExperiment.terminal.sha256)
  fixed(policy.parentExperiment.result.path,{optimizerSteps:{generator:448,discriminator:448},artifacts:[policy.parentExperiment.checkpoint]},129166,policy.parentExperiment.result.sha256)
  fixed(policy.single149Experiment.package.path,{checkpoint:policy.parentExperiment.checkpoint},400000,policy.single149Experiment.package.sha256)
  fixed(policy.single149Experiment.terminal.path,{executionState:'completed',executionPackage:policy.single149Experiment.package,result:policy.single149Experiment.result},2000,policy.single149Experiment.terminal.sha256)
  fixed(policy.single149Experiment.result.path,{artifacts:[policy.single149Experiment.checkpoint]},100000,policy.single149Experiment.result.sha256)
 }
 const runId='replay-retention-'+arm+'-fixture001',sourceRoot='.runtime/ai-painter/learning-capacity-experiments/'+runId,pairs=arm==='short'?100:200,selected=arm==='short'?[TARGET]:train,others=train.filter(s=>s!==TARGET)
 const balanced=['balanced','balanced-boundary'].includes(arm)
 const schedule=balanced?[...train,...train,...train,...train,...train.slice(0,8)]:arm==='mixed'?Array.from({length:100},(_,n)=>[TARGET,others[n%47]]).flat():Array(100).fill(TARGET),visits=Object.fromEntries(selected.map(s=>[s,0]));for(const id of schedule)visits[id]++
 const program={path:'ml/ai-painter/scripts/fixture-only.py',sha256:'9'.repeat(64)}
 const sourcePackageValue={schemaVersion:'replay-retention-fit-package-v1',experimentIdentity:runId,outputRoot:sourceRoot,arm,policy:fitBinding,modelCapability:CAPABILITY,checkpoint:fit.parentExperiment.checkpoint,parentExperiment:fit.parentExperiment,sourcePlan:parentPackage.sourcePlan,selectedSampleIds:selected,training:fit.training,schedule,plannedSampleVisits:visits,parentStateHashes:states,programs:[program],qualificationGranted:false,...(large?{privateFixturePadding:'x'.repeat(1100000)}:{})}
 if(arm==='balanced-boundary'){
  sourcePackageValue.sampleIdentities=train.map((sampleId,n)=>({sampleId,split:'train',image:{path:`data/fake/${n}.png`,sha256:'a'.repeat(64)},conditionPack:{path:`data/fake/${n}.json`,sha256:'b'.repeat(64)},channels:[{id:'terrain_path_ground',path:`data/fake/${n}-road.png`,sha256:'c'.repeat(64)}]}))
  sourcePackageValue.boundaryInputBindings=sourcePackageValue.sampleIdentities.map(i=>({sampleId:i.sampleId,image:i.image,conditionPack:i.conditionPack,road:{path:i.channels[0].path,sha256:i.channels[0].sha256}}))
  sourcePackageValue.inputs=sourcePackageValue.boundaryInputBindings.flatMap(i=>[i.image,i.road,i.conditionPack])
 }
 fitMutation?.(sourcePackageValue)
 const sourcePackage=put(sourceRoot+'/package.json',sourcePackageValue)
 const cp={path:sourceRoot+'/checkpoint-final.pt',sha256:'e'.repeat(64)}
 const sourceResult=put(sourceRoot+'/result.json',{experimentIdentity:runId,arm,...(arm==='balanced-boundary'?{trainingObjective:fit.training.trainingObjective}:{}),status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,sameParentStartVerified:true,formalQualificationGranted:false,optimizerSteps:{generator:pairs,discriminator:pairs},targetUpdates:balanced?5:100,replayUpdates:balanced?195:arm==='mixed'?100:0,parentStateHashes:states,initialStateHashes:states,finalStateHashes:states,sampleVisits:visits,artifacts:[cp]})
 const sourceTerminal=put(sourceRoot+'/terminal.json',{schemaVersion:'ai-painter-learning-capacity-experiment-terminal-v1',runId,executionState:'completed',status:'experiment_completed_not_formal_qualified',executionPackage:sourcePackage,result:sourceResult,formalTrainingQualified:false,checkpointPromotable:false,worldEntryAllowed:false})
 const reviewId='replay-retention-review-v1-fixture001',outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId
 const pkg=put(outputRoot+'/package.json',{schemaVersion:'ai-painter-replay-retention-review-package-v1',reviewId,outputRoot,policy:policyBinding,sourceTerminal,sourcePackage,sourceCheckpoint:cp,sourceModelCapability:CAPABILITY,trainSampleIds:train,validationSampleIds:validation,...flags})
 const metric=(mae=.1)=>({fullRgbMae:mae,regions:Object.fromEntries(['core','support'].map(region=>[region,Object.fromEntries(['object_footprints','object_tree','object_rock','object_vegetation'].map(role=>[role,{pixels:10,rgbMae:.1,correlation:.5}]))]))})
 const obsRefs=[],observations=[],rows=[]
 for(const [n,sampleId]of [...train,...validation].entries()){
  const split=n<48?'train':'validation',prediction={path:outputRoot+'/prediction-'+n+'.png',sha256:'f'.repeat(64)},identity={sampleId,split,image:{path:'data/world-samples/fixture/reference-'+n+'.png',sha256:'1'.repeat(64)},conditionPack:{path:'data/world-samples/fixture/condition-'+n+'.json',sha256:'2'.repeat(64)}}
  const observation={schemaVersion:'ai-painter-replay-retention-observation-v1',reviewId,executionPackage:pkg,sampleId,split,identity,prediction,metrics:metric(sampleId===TARGET?.09:regressed&&n===1?.2:.1),nativePredictionDimensions:{width:256,height:192},referenceNativeDimensions:{width:1024,height:768},imageTiming:{scope:'CPU_forward_transfer_PNG_publication',startedAtUtc:at,endedAtUtc:at,elapsedSeconds:.01}}
  const ref=put(outputRoot+'/observation-'+n+'.json',observation);obsRefs.push({sampleId,split,binding:ref});observations.push(observation)
  const parentPrediction={path:'.runtime/ai-painter/fixture-parent/prediction-'+n+'.png',sha256:'3'.repeat(64)}
  const audit=(kind,pred)=>({passed:false,issueCodes:['fixture_existing_absolute_failure'],evidence:put(outputRoot+'/'+kind+'-'+n+'-audit.json',{sampleId,split,prediction:pred,reference:identity.image,condition:identity.conditionPack,projection:{path:outputRoot+'/'+kind+'-'+n+'-projection.png',sha256:'4'.repeat(64)},nativePredictionDimensions:observation.nativePredictionDimensions,referenceNativeDimensions:observation.referenceNativeDimensions,projectionDimensions:{width:1024,height:768,kernel:'nearest'},projectionIsModelOutput:false,detail:{passed:false,issueCodes:['fixture_existing_absolute_failure']},aesthetic:{passed:true,issues:[]},alignment:{passed:true,issues:[]},...flags})})
  rows.push({...observation,parentMetrics:metric(),aMetrics:metric(),parentPrediction,aPrediction:parentPrediction,parentAbsolute:audit('parent',parentPrediction),candidateAbsolute:audit('candidate',prediction)})
 }
 const inputRefs=[sourcePackage,sourceResult,sourceTerminal,policyBinding,program],inputPart=put(outputRoot+'/input-bindings-00.json',{schemaVersion:'ai-painter-replay-retention-input-bindings-v1',reviewId,executionPackage:pkg,offset:0,bindings:inputRefs})
 const cross={scope:'cross_device_observation_not_same_device_reload_gate'}
 const inference=put(outputRoot+'/inference.json',{schemaVersion:'ai-painter-replay-retention-review-inference-v1',reviewId,executionPackage:pkg,sourceCheckpoint:cp,actualProjectSources:[program],observationsStorage:'sha256_per_sample_json_v1',observationBindings:obsRefs,inputsStorage:'sha256_binding_chunks_v1',inputCount:inputRefs.length,inputManifestBindings:[inputPart],actualCalls:{generatorForwards:56,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0},stateBefore:['a'.repeat(64),'b'.repeat(64)],stateAfter:['a'.repeat(64),'b'.repeat(64)],trainingNamedStateBefore:states,trainingNamedStateAfter:states,parentStateVerification:{named091:states,generatorForwards:0},historicalPixelReproductions:['parent','A'].flatMap(arm=>[...train.slice(0,2),...validation].map(sampleId=>({arm,sampleId}))),final149CrossDeviceComparison:cross,startedAtUtc:at,endedAtUtc:at,elapsedSeconds:1,timingScope:'worker_after_imports_and_package_read_through_observation_and_input_chunks_before_inference_manifest_write',gpuInitialized:false,optimizerUpdates:0,formalQualificationGranted:false})
 const decision=classifyReplayRetention(rows,policy),rowBindings=decision.rows.map((row,n)=>({sampleId:row.sampleId,split:row.split,binding:put(outputRoot+'/row-'+n+'.json',reviewRowShard(row,obsRefs[n].binding,{reviewId,executionPackage:pkg}))})),{rows:omitted,...summary}=decision;void omitted
 const report=put(outputRoot+'/review.json',{schemaVersion:'ai-painter-replay-retention-review-result-v1',reviewId,sourceRunId:runId,arm,executionPackage:pkg,sourceTerminal,sourceCheckpoint:cp,inference,policy:policyBinding,parentEvaluation:policy.parentEvaluation,single149Evaluation:policy.single149Evaluation,...(arm==='balanced'?{descriptiveRetention:describeReplayRetention(decision.rows,policy)}:{}),historicalMetricsAuthority:'frozen_evaluations_revalidated_by_worker_not_ledger',rowsStorage:'sha256_per_sample_json_v1',rowBindings,absoluteImageAudits:112,parentGeneratorForwards:0,...summary,final149CrossDeviceComparison:cross,recordedAtUtc:at,elapsedSeconds:2,timingScope:'review_controller_package_worker_and_absolute_audits_before_terminal_commit'})
 const terminalRef=put(outputRoot+'/terminal.json',{schemaVersion:'ai-painter-replay-retention-review-terminal-v1',runId:reviewId,packageId:reviewId,executionPackage:pkg,sourceRunId:runId,sourceTerminal,executionState:failure?'failed_closed':'completed',status:failure?'replay_retention_review_execution_failed':'replay_retention_review_completed_absolute_failed',report:failure?undefined:report,visualOutcome:failure?'unknown':decision.absoluteOutcome,relativeOutcome:failure?'unknown':decision.recommendation,startedAtUtc:at,recordedAtUtc:at,elapsedSeconds:2,optimizerUpdates:0,gpuInitialized:false,...flags})
 const read=(p,s)=>{const r=entries.get(p);if(!r||r.sha256!==s)throw Error('fixture_missing_or_hash');return r}
 const mutate=(ref,fn)=>{const r=entries.get(ref.path);r.value=copy(r.value);fn(r.value);r.bytes=undefined;r.byteLength=Buffer.byteLength(JSON.stringify(r.value))}
 const materialize=(root)=>{for(const [p,r]of entries){assert(r.bytes,'onDisk fixture requires actual authenticated metadata bytes');const dest=path.join(root,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,r.bytes)}}
 return {entries,read,mutate,materialize,terminal:entries.get(terminalRef.path).value,terminalRef,pkg,sourcePackage,sourceResult,sourceTerminal,report,inference,obsRefs,rowBindings,observations,policy,policyBinding,reviewId,outputRoot,runId}
}

function privateContext(f) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-work-'));fs.writeFileSync(path.join(root,'.local-work-private-fixture'),'local-work-test-only');fs.mkdirSync(path.join(root,'.runtime'));f.materialize(root)
 fs.mkdirSync(path.join(root,'docs/game-world-generation'),{recursive:true});fs.writeFileSync(path.join(root,PLAN),'| 2 | training |\n| 9 | backup |\n')
 const moduleRoot=path.join(root,'.runtime/local-backup');initializeStore(moduleRoot,{schemaVersion:'local_backup_inventory_v1'});const store=createStore(moduleRoot)
 const save=(logical,value)=>{const file=path.join(root,logical);fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(file,bytes);return sha(bytes)}
 const head={schemaVersion:'ai-painter-current-execution-registry-v1',writerIdentity:'local_ai_capability_lifecycle_orchestrator',registryRevision:1,eventSequence:1,transactionId:'tx-fixture',runId:f.reviewId,taskId:f.reviewId,terminalEvidence:f.terminalRef}
 const digest=save(REG+'/transactions/tx-fixture/current.staged.json',head);save(REG+'/transactions/tx-fixture/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId:'tx-fixture',registryRevision:1,eventSequence:1,currentSha256:digest});save(REG+'/events.jsonl',{schemaVersion:'ai-painter-current-execution-registry-event-v1',registryRevision:1,eventSequence:1,transactionId:'tx-fixture',currentSha256:digest,runId:f.reviewId,taskId:f.reviewId})
 const db=new DatabaseSync(path.join(root,REG,'registry.sqlite'));db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,run_id TEXT,task_id TEXT);CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)');db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(1,1,'tx-fixture',digest,f.reviewId,f.reviewId);db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run('tx-fixture','committed',digest);db.close()
 return {root,ctx:createWorkProducersForIsolatedTests({projectRoot:root,store,readRegistry:async()=>({ok:true,status:'verified',registry:head})})}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 test('balanced uses original48 four passes and first8 with exact149 and164 exposure',()=>{
  const f=createReplayRetentionFixture({arm:'balanced'}),source=f.read(f.sourcePackage.path,f.sourcePackage.sha256).value,fit=validateReplayRetentionFitPackage(source,f.read),v=readReplayRetentionWorkEvidence(f)
  assert.deepEqual(source.schedule,[...fit.train,...fit.train,...fit.train,...fit.train,...fit.train.slice(0,8)])
  assert.equal(source.schedule.length,200);assert.equal(fit.visits[TARGET],5);assert.equal(fit.visits['mvp64-slot164-objects-v5-20261020'],4)
  assert.equal(Object.values(fit.visits).filter(n=>n===5).length,8);assert.equal(Object.values(fit.visits).filter(n=>n===4).length,40)
  assert.equal(v.arm,'balanced');assert.equal(v.executionResult,'succeeded');assert.equal(v.absoluteOutcome,'failed');assert.equal(v.relativeOutcome,'eligible_for_further_diagnostic_comparison_not_qualified')
  assert.equal(v.readCoverage.maxPackageBytes,4*1024**2);assert.equal(v.readCoverage.maxTotalBytes,8*1024**2)
 })
 test('short original100 target-only package remains valid below1MiB',()=>{
  const f=createReplayRetentionFixture({arm:'short',large:false}),v=readReplayRetentionWorkEvidence(f);assert.equal(v.arm,'short');assert.equal(v.executionResult,'succeeded')
 })
 test('boundary arm reuses56 review evidence with exact new policy and5/195 exposure',()=>{
  const f=createReplayRetentionFixture({arm:'balanced-boundary'}),v=readReplayRetentionWorkEvidence(f)
  assert.equal(v.arm,'balanced-boundary');assert.equal(v.samples.length,56)
  const pkg=f.entries.get(f.sourcePackage.path).value
  validateReplayRetentionFitPackage(pkg,f.read)
  assert.equal(pkg.plannedSampleVisits[TARGET],5)
  assert.equal(pkg.plannedSampleVisits['mvp64-slot164-objects-v5-20261020'],4)
  for(const mutate of [p=>p.training.boundaryRgbWeight=.02,p=>p.boundaryInputBindings.pop(),
   p=>p.inputs.pop(),p=>p.policy.sha256='0'.repeat(64)]){
   const changed=copy(pkg);mutate(changed);assert.throws(()=>validateReplayRetentionFitPackage(changed,f.read))
  }
  f.mutate(f.sourceResult,r=>r.trainingObjective='balanced')
  assert.throws(()=>readReplayRetentionWorkEvidence(f))
 })
 for(const [name,change]of [
  ['self-consistent reordered schedule',f=>f.mutate(f.sourcePackage,v=>{[v.schedule[1],v.schedule[2]]=[v.schedule[2],v.schedule[1]]})],
  ['self-consistent altered roster',f=>f.mutate(f.sourcePackage,v=>{[v.selectedSampleIds[1],v.selectedSampleIds[2]]=[v.selectedSampleIds[2],v.selectedSampleIds[1]];v.schedule=[...v.selectedSampleIds,...v.selectedSampleIds,...v.selectedSampleIds,...v.selectedSampleIds,...v.selectedSampleIds.slice(0,8)]})],
  ['B checkpoint substitution',f=>f.mutate(f.sourcePackage,v=>{v.checkpoint={path:'.runtime/ai-painter/learning-capacity-experiments/replay-retention-mixed-v1-1ad38bb5ad5d995ca8af/checkpoint-final.pt',sha256:'a'.repeat(64)};v.parentExperiment.checkpoint=v.checkpoint})],
  ['wrong balanced policy SHA',f=>f.mutate(f.sourcePackage,v=>v.policy.sha256='0'.repeat(64))],
  ['source exposure forgery',f=>f.mutate(f.sourceResult,v=>{v.targetUpdates=100;v.replayUpdates=100})],
  ['source optimizer mismatch',f=>f.mutate(f.sourceResult,v=>v.optimizerSteps.generator=199)],
  ['package over4MiB',f=>{const r=f.entries.get(f.sourcePackage.path);r.bytes=undefined;r.byteLength=4*1024**2+1}],
  ['qualification escalation',f=>f.mutate(f.sourcePackage,v=>v.qualificationGranted=true)]
 ])test('balanced rejects '+name,()=>{const f=createReplayRetentionFixture({arm:'balanced'});change(f);assert.throws(()=>readReplayRetentionWorkEvidence(f))})
 test('train48 descriptive extra summary cannot override original adoption gates',()=>{
  const f=createReplayRetentionFixture({arm:'balanced',regressed:true});f.mutate(f.report,v=>{v.descriptiveRetention.train48.fullRgbMaeDelta.mean=-100;v.recommendation='eligible_for_further_diagnostic_comparison_not_qualified'});f.terminal.relativeOutcome='eligible_for_further_diagnostic_comparison_not_qualified';assert.throws(()=>readReplayRetentionWorkEvidence(f),/recommendation_conflict/)
 })
 test('balanced actual-byte private delivery is idempotent and leaves qualification unknown',async()=>{
  const f=createReplayRetentionFixture({arm:'balanced',onDisk:true}),{ctx}=privateContext(f),first=await ctx.observeCommittedRegistry({limit:1})
  assert.equal(first.recorded,true,JSON.stringify(first));assert.equal(first.eventIds.length,1)
  const event=ctx.ledger.find(first.eventIds[0]);assert.equal(event.executionResult,'succeeded');assert.equal(event.sourceCategory,'local_program');assert.equal(event.validationStatus,'unknown');assert.equal(event.acceptanceStatus,'unknown');assert.equal(Object.keys(event.workReport).length,10)
  assert.equal((await ctx.observeCommittedRegistry({limit:1})).recorded,true);assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,1)
 })
 test('boundary actual-byte large package delivers through original producer and remains idempotent',async()=>{
  const f=createReplayRetentionFixture({arm:'balanced-boundary',onDisk:true}),{ctx}=privateContext(f)
  assert(f.entries.get(f.sourcePackage.path).byteLength>1048576)
  const first=await ctx.observeCommittedRegistry({limit:1})
  assert.equal(first.recorded,true,JSON.stringify(first));assert.equal(first.eventIds.length,1)
  const event=ctx.ledger.find(first.eventIds[0])
  assert.equal(event.executionResult,'succeeded');assert.equal(event.validationStatus,'unknown');assert.equal(event.acceptanceStatus,'unknown')
  assert.equal((await ctx.observeCommittedRegistry({limit:1})).recorded,true)
  assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,1)
 })
 for(const [name,fitMutation]of [['objective',p=>p.training.boundaryRgbWeight=.02],
  ['policy',p=>p.policy.sha256='0'.repeat(64)]])test('boundary actual-byte large package rejects forged '+name,async()=>{
  const f=createReplayRetentionFixture({arm:'balanced-boundary',onDisk:true,fitMutation}),{ctx}=privateContext(f)
  const result=await ctx.observeCommittedRegistry({limit:1})
  assert.equal(result.recorded,false);assert.equal(result.reasonCode,'work_large_package_identity_invalid')
  assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,0)
 })
 for(const [name,fitMutation]of [['balanced schedule',v=>{[v.schedule[1],v.schedule[2]]=[v.schedule[2],v.schedule[1]]}],['balanced policy',v=>v.policy.sha256='0'.repeat(64)],['balanced parent',v=>v.checkpoint.sha256='0'.repeat(64)]])test('actual-byte balanced reader rejects '+name,async()=>{
  const f=createReplayRetentionFixture({arm:'balanced',onDisk:true,fitMutation}),{ctx}=privateContext(f),result=await ctx.observeCommittedRegistry({limit:1});assert.equal(result.recorded,false);assert.equal(result.reasonCode,'work_large_package_identity_invalid');assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,0)
 })
 test('56 sharded review separates execution success, absolute failure and retained relative diagnostics',()=>{
  const f=createReplayRetentionFixture(),v=readReplayRetentionWorkEvidence(f)
  assert.equal(v.executionResult,'succeeded');assert.equal(v.absoluteOutcome,'failed');assert.equal(v.relativeOutcome,'eligible_for_further_diagnostic_comparison_not_qualified');assert.equal(v.samples.length,56);assert.equal(v.auditRows.length,56);assert.equal(v.failedSamples,56);assert(v.readCoverage.jsonBytes<=8*1024**2);assert.equal(v.readCoverage.oldEvaluationBodiesRead,false)
 })
 test('registered execution failure does not invent an absolute verdict, inference or measured elapsed',()=>{
  const f=createReplayRetentionFixture({failure:true}),v=readReplayRetentionWorkEvidence(f);assert.equal(v.executionResult,'failed');assert.equal(v.absoluteOutcome,'unknown');assert.equal(v.inference,null);assert.equal(v.clock.elapsedSeconds,null)
 })
 test('unknown terminal schemas are not classified as the new review',()=>assert.equal(readReplayRetentionWorkEvidence({terminal:{schemaVersion:'old-review'},read(){throw Error('must not read')}}),null))
 for(const [name,change]of [
  ['wrong policy',f=>{f.terminal.executionPackage.sha256='0'.repeat(64)}],
  ['cross Run',f=>f.mutate(f.obsRefs[2].binding,v=>v.reviewId='other-review')],
  ['missing shard',f=>f.entries.delete(f.rowBindings[2].binding.path)],
  ['duplicate row',f=>f.mutate(f.report,v=>v.rowBindings[2]=v.rowBindings[1])],
  ['wrong split',f=>f.mutate(f.obsRefs[0].binding,v=>v.split='validation')],
  ['GPU call',f=>f.mutate(f.inference,v=>v.actualCalls.cudaAttempts=1)],
  ['mutated model',f=>f.mutate(f.inference,v=>v.stateAfter=['0'.repeat(64),'1'.repeat(64)])],
  ['fake formal qualification',f=>f.mutate(f.report,v=>v.formalQualificationGranted=true)],
  ['missing parent identity',f=>f.mutate(f.sourcePackage,v=>v.checkpoint.sha256='0'.repeat(64))],
  ['bad audit SHA',f=>{f.entries.get(f.rowBindings[0].binding.path).value.parentAbsolute.evidence.sha256='0'.repeat(64);f.entries.get(f.rowBindings[0].binding.path).bytes=undefined}],
  ['projection claimed as model',f=>{const b=f.entries.get(f.rowBindings[0].binding.path).value.candidateAbsolute.evidence;f.mutate(b,v=>v.projectionIsModelOutput=true)}],
  ['nonpackage over1MiB',f=>{const r=f.entries.get(f.report.path);r.bytes=undefined;r.byteLength=1048577}],
  ['closure over8MiB',f=>{for(const [p,r]of f.entries)if(p.endsWith('-audit.json')){r.bytes=undefined;r.byteLength=90000}}],
  ['wrong frozen schedule',f=>f.mutate(f.sourcePackage,v=>v.schedule.reverse())],
  ['fake visit counts',f=>f.mutate(f.sourcePackage,v=>v.plannedSampleVisits[TARGET]=99)]
 ])test('rejects '+name,()=>{const f=createReplayRetentionFixture();change(f);assert.throws(()=>readReplayRetentionWorkEvidence(f))})
 test('a false saved recommendation cannot turn observed retention regression into eligibility',()=>{const f=createReplayRetentionFixture({regressed:true});f.mutate(f.report,v=>v.recommendation='eligible_for_further_diagnostic_comparison_not_qualified');f.terminal.relativeOutcome='eligible_for_further_diagnostic_comparison_not_qualified';assert.throws(()=>readReplayRetentionWorkEvidence(f),/recommendation_conflict/)})
 test('altered saved observation metrics or input chunk offset are rejected',()=>{
  for(const variant of ['metrics','offset']){const f=createReplayRetentionFixture();if(variant==='metrics')f.mutate(f.obsRefs[1].binding,v=>v.metrics.fullRgbMae=.8);else{const b=f.entries.get(f.inference.path).value.inputManifestBindings[0];f.mutate(b,v=>v.offset=1)}assert.throws(()=>readReplayRetentionWorkEvidence(f))}
 })
 test('source bytes with a mismatched SHA are rejected before their contents are trusted',()=>{const f=createReplayRetentionFixture();f.entries.get(f.report.path).bytes=Buffer.from('{}');assert.throws(()=>readReplayRetentionWorkEvidence(f),/json_hash_conflict/)})
 test('short packages have no new greater-than1MiB exception',()=>{const f=createReplayRetentionFixture({arm:'short'});assert.throws(()=>readReplayRetentionWorkEvidence(f),/large_package_only/)})
 test('package validator accepts the exact frozen schedule and rejects a different arm or parent',()=>{const f=createReplayRetentionFixture();assert.equal(validateReplayRetentionFitPackage(f.read(f.sourcePackage.path,f.sourcePackage.sha256).value,f.read).train.length,48);f.mutate(f.sourcePackage,v=>v.arm='unregistered');assert.throws(()=>validateReplayRetentionFitPackage(f.read(f.sourcePackage.path,f.sourcePackage.sha256).value,f.read))})
 test('private actual-byte registry delivery is local_program, idempotent and does not change machine qualification',async t=>{
  const p=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json'));if(!fs.existsSync(p.parentExperiment.package.path)){t.skip('named frozen parent JSON fixture unavailable');return}
  const f=createReplayRetentionFixture({onDisk:true}),root=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-work-'));fs.writeFileSync(path.join(root,'.local-work-private-fixture'),'local-work-test-only');fs.mkdirSync(path.join(root,'.runtime'));f.materialize(root)
  fs.mkdirSync(path.join(root,'docs/game-world-generation'),{recursive:true});fs.writeFileSync(path.join(root,PLAN),'| 2 | training |\n| 9 | backup |\n')
  const moduleRoot=path.join(root,'.runtime/local-backup');initializeStore(moduleRoot,{schemaVersion:'local_backup_inventory_v1'});const store=createStore(moduleRoot)
  const save=(logical,value)=>{const file=path.join(root,logical);fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(file,bytes);return sha(bytes)}
  const head={schemaVersion:'ai-painter-current-execution-registry-v1',writerIdentity:'local_ai_capability_lifecycle_orchestrator',registryRevision:1,eventSequence:1,transactionId:'tx-fixture',runId:f.reviewId,taskId:f.reviewId,terminalEvidence:f.terminalRef}
  const digest=save(REG+'/transactions/tx-fixture/current.staged.json',head);save(REG+'/transactions/tx-fixture/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId:'tx-fixture',registryRevision:1,eventSequence:1,currentSha256:digest});save(REG+'/events.jsonl',{schemaVersion:'ai-painter-current-execution-registry-event-v1',registryRevision:1,eventSequence:1,transactionId:'tx-fixture',currentSha256:digest,runId:f.reviewId,taskId:f.reviewId})
  const db=new DatabaseSync(path.join(root,REG,'registry.sqlite'));db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,run_id TEXT,task_id TEXT);CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)');db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(1,1,'tx-fixture',digest,f.reviewId,f.reviewId);db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run('tx-fixture','committed',digest);db.close()
  const ctx=createWorkProducersForIsolatedTests({projectRoot:root,store,readRegistry:async()=>({ok:true,status:'verified',registry:head})}),first=await ctx.observeCommittedRegistry({limit:1});assert.equal(first.recorded,true,JSON.stringify(first));assert.equal(first.eventIds.length,1)
  const event=ctx.ledger.find(first.eventIds[0]);assert.equal(event.sourceCategory,'local_program');assert.equal(event.validationStatus,'unknown');assert.equal(event.acceptanceStatus,'unknown');assert.equal(event.executionResult,'succeeded');assert.equal(Object.keys(event.workReport).length,10);assert(event.workReport.results.some(s=>s.includes('绝对审核：failed')));assert(event.evidenceReferences.length<=5)
  assert.equal((await ctx.observeCommittedRegistry({limit:1})).recorded,true);assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,1)
 })
 for(const [name,fitMutation]of [['policy',v=>v.policy={...v.policy,sha256:'0'.repeat(64)}],['schedule',v=>v.schedule=[...v.schedule].reverse()],['qualification',v=>v.qualificationGranted=true]])test('actual-byte large-package reader refuses wrong '+name+' without advancing delivery',async t=>{
  const p=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json'));if(!fs.existsSync(p.parentExperiment.package.path)){t.skip('named frozen parent JSON fixture unavailable');return}
  const f=createReplayRetentionFixture({onDisk:true,fitMutation}),{ctx}=privateContext(f),result=await ctx.observeCommittedRegistry({limit:1});assert.equal(result.recorded,false);assert.equal(result.reasonCode,'work_large_package_identity_invalid');assert.equal(ctx.ledger.events(new URLSearchParams()).records.length,0)
 })
}
