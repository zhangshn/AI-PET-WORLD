import {performance} from 'node:perf_hooks'
import {need} from './contracts.mjs'
import {LEGACY_MVP,MVP_INDEX,MVP_LIMITS,MVP_SOURCE,MVP_SCOPE,factHash} from './mvp-acceptance-contracts.mjs'
import {reduceMvpFacts} from './mvp-acceptance-reducer.mjs'
export const MVP_CONSUMER_VERSION='mvp-acceptance-136-v1'
export function createMvpAcceptanceConsumer({verifier,ledger,snapshot,read,put,appendFact,getState,saveState,now=()=>new Date().toISOString()}){
 function committed(){
  const stream=ledger.mvpFacts();for(const event of stream.events){verifier.verifyStored(event.acceptanceFact);const legacy=event.acceptanceFact.decisionClass==='legacy_external_component';need(event.eventKind===(legacy?'progress_report':'acceptance_finished')&&(!legacy||event.validationStatus==='unknown'&&event.acceptanceStatus==='unknown'),'mvp_stored_event_claim_conflict',409)}
  const checklist=verifier.currentChecklist(),heads=reduceMvpFacts(stream.events.map(e=>e.acceptanceFact),{checklist,scopeId:MVP_SCOPE})
  return {...stream,checklist,heads}
 }
 function readIndex(){try{const r=read(MVP_INDEX,null,MVP_LIMITS.index),e=r.value;need(e.schemaVersion==='mvp-acceptance-index-v1'&&e.sha256===factHash(e.value),'mvp_index_integrity_conflict',409);return {...e,fileSha256:r.sha256}}catch(e){if(e.code==='ENOENT')return null;throw e}}
 function query(){
  const s=committed(),index=readIndex(),state=getState(MVP_SOURCE)
  const observed=getState('ai-painter-registry-v1').observerRuntime??null,selfStarted=Date.now()-process.uptime()*1000
  const processMatches=!!observed&&observed.processId===process.pid&&Date.parse(observed.startedAtUtc)>=selfStarted-5000
  const closureMatches=!!observed&&observed.implementationVersion==='mvp-acceptance-observer-136-v1'&&observed.contextImplementationVersion==='mvp-acceptance-ledger-136-v1'&&observed.acceptanceImplementation?.sha256===verifier.implementationSha256
  const runtimeProgramObservation={status:processMatches&&closureMatches?'observed_current_version':observed?'recorded_version_not_currently_matched':'not_observed',version:observed?.implementationVersion??null,contextVersion:observed?.contextImplementationVersion??null,processId:observed?.processId??null,startedAtUtc:observed?.startedAtUtc??null,observedAtUtc:observed?.observedAtUtc??null,implementationSha256:observed?.acceptanceImplementation?.sha256??null,matchesCurrentProcess:processMatches,matchesCurrentClosure:closureMatches,independentAcceptance:'not_inferred_from_program_observation'}
  need((state.cursor??0)<=s.producerSequence&&(index?.value.producerSequence??0)<=s.producerSequence,'mvp_fact_revision_regressed',409)
  const matches=index&&index.value.scopeId===MVP_SCOPE&&factHash(index.value.checklist)===factHash(s.checklist)&&index.value.producerSequence===s.producerSequence&&index.value.headSha===s.headSha&&factHash(index.value.heads)===factHash(s.heads)
  const current=matches&&state.cursor===s.producerSequence&&state.status!=='stale'
  return {dataStatus:!s.events.length&&!index?'not_connected':current?'partial':'unknown_or_stale',reasonCode:!s.events.length&&!index?'mvp_ingestion_not_started':current?'legacy_components_only_no_production_protocol':'mvp_index_or_source_stale',scopeId:MVP_SCOPE,checklist:s.checklist,heads:s.heads,facts:s.events.map(e=>e.acceptanceFact),watermarks:{business:state.coverage?.business??null,committedFactSequence:s.producerSequence,derivedSequence:index?.value.producerSequence??null,consumerSequence:state.cursor??0},coverage:{complete:false,legacySupportedCheckpoints:LEGACY_MVP.filter(s=>s.outcome==='passed').map(s=>s.checkpointId),productionSupportedCheckpoints:[],productionAcceptance:'not_verified',runtimeAdoption:state.runtimeAdoption??'not_verified',runtimeProgramObservation,sourceFailure:state.coverage?.sourceFailures??[],historicalCoverageComplete:false},indexSha256:index?.fileSha256??null,derivedValueSha256:index?.sha256??null,readAtUtc:now()}
 }
 function consume({business=null}={}){
  const began=performance.now(),failures=[],eventIds=[]
  for(const seed of LEGACY_MVP){
   try{need(performance.now()-began<MVP_LIMITS.ms,'mvp_consumption_time_limit',409);const original=verifier.readSeed(seed),evidence=snapshot(original,'program'),fact=verifier.build(seed,original,evidence),id='mvp-'+fact.factId,previous=ledger.find(id)
    if(previous){verifier.verifyStored(previous.acceptanceFact);eventIds.push(id)}else eventIds.push(appendFact(fact).event.eventId)
   }catch(error){failures.push({checkpointId:seed.checkpointId,reasonCode:/^[a-z][a-z0-9_]{0,159}$/.test(error?.message??'')?error.message:'mvp_source_unavailable'})}
  }
  const s=committed(),prior=getState(MVP_SOURCE);need((prior.cursor??0)<=s.producerSequence,'mvp_fact_revision_regressed',409)
  const coverage={complete:false,business,legacySeedsChecked:LEGACY_MVP.length,productionSupportedCheckpoints:[],productionAcceptance:'not_verified',sourceFailures:failures}
  // Event transaction precedes both derived index and the independent watermark.
  const value={scopeId:MVP_SCOPE,checklist:s.checklist,producerSequence:s.producerSequence,headSha:s.headSha,heads:s.heads,verifiedAtUtc:now(),coverage}
  put(MVP_INDEX,{schemaVersion:'mvp-acceptance-index-v1',value,sha256:factHash(value)})
  saveState(MVP_SOURCE,{status:failures.length?'stale':'partial',cursor:s.producerSequence,reasonCode:failures.length?'mvp_source_unavailable':'legacy_components_only_no_production_protocol',coverage,runtimeAdoption:'not_verified',consumerImplementationVersion:MVP_CONSUMER_VERSION,lastSuccessAtUtc:failures.length?prior.lastSuccessAtUtc??null:now()})
  return {recorded:failures.length===0,eventIds,producerSequence:s.producerSequence,failures,productionAcceptance:'not_verified'}
 }
 return {consume:options=>verifier.withReadPass(()=>consume(options)),query:()=>verifier.withReadPass(query),readIndex,implementationVersion:MVP_CONSUMER_VERSION}
}
