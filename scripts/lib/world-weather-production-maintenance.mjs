import assert from 'node:assert/strict'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {bound,digest,featureSha,idOf,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {BASELINE_IDENTITY,verifyNaturalRecordBytes} from './natural-world-baseline-proof.mjs'
import {EVOLUTION_STORE,buildEvolutionDiagnosticFeatures} from './natural-world-evolution-input.mjs'
import {readPowerDailySource} from './natural-world-temporal-data.mjs'
import {FIRST_WEATHER_POLICY_PATH} from './world-weather-release-policy.mjs'

const authorityPath='data/ai-painter/system-governance/mvp-natural-world-weather-maintenance-v1.json'
const authoritySha='5feeefb800c43c31bb0be42f7c4556db3247c62d3e646d1132f40abf42aaff0f'
const base='.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-178-20261103'
const draft='.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-policy-179-20261103/maintenance-policy.draft.json'
const firstForecastClone='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103/qualification/store'
const scopedVersion='sakaerat-bootstrap-weather-maintenance-v1'
const exactFields=(obj,fields)=>assert.deepEqual(Object.keys(obj).sort(),[...fields].sort())
const ref=b=>({id:b.path,version:scopedVersion,sha256:b.sha256})

export function decodeWeatherMaintenanceAuthority(raw){
  assert.equal(sha(raw),authoritySha,'unregistered weather maintenance policy bytes')
  const a=JSON.parse(raw)
  exactFields(a,['schemaVersion','contractId','identity','before','worldRef','policyRef',
    'preparationSha256','epochUtc','limits','validationRef'])
  assert.equal(a.schemaVersion,'world-weather-initial-maintenance-contract-v1')
  assert.equal(a.contractId,scopedVersion)
  assert.deepEqual(a.identity,BASELINE_IDENTITY)
  assert.equal(a.worldRef.path,EVOLUTION_STORE)
  assert.deepEqual([a.before.tick,a.before.stateVersion,a.before.eventCursor],[0,0,0])
  assert.equal(a.before.fileSha256,a.worldRef.sha256)
  assert.equal(a.policyRef.path,FIRST_WEATHER_POLICY_PATH)
  assert.deepEqual(a.limits,{maintenanceCommits:1,evolutionCommits:0,modelForwards:0})
  return a
}

// The authority binds a separate validation artifact. Check its underlying POWER
// time series and fitted-code lineage again; never accept a "validated" caller flag.
function readSources(a){
  const report=JSON.parse(bound(a.validationRef))
  exactFields(report,['preparationRef','sourceRefs','epochUtc','fieldOrder','units','lastValues','contextValueSha256','worldRef'])
  assert.equal(report.preparationRef.sha256,a.preparationSha256)
  const seed=JSON.parse(bound(report.preparationRef)),policy=JSON.parse(bound(a.policyRef))
  const {contentSha256,...content}=seed
  assert.equal(contentSha256,digest(content))
  assert.deepEqual(seed.before,a.before);assert.deepEqual(seed.identity,a.identity);assert.deepEqual(policy.identity,a.identity)
  assert.deepEqual(report.worldRef,a.worldRef);assert.deepEqual(seed.worldRef,a.worldRef)
  assert.deepEqual(seed.sourceRefs,report.sourceRefs)
  assert.equal(report.epochUtc,a.epochUtc);assert.equal(seed.simulation.epochUtc,a.epochUtc)
  assert.equal(seed.modelRef.sha256,policy.modelRef.sha256)
  for(const b of [seed.modelRef,...seed.codeBindings])bound(b)
  assert.equal(policy.maintenancePolicy.mode,'migration')
  for(const r of [policy.maintenancePolicy.migrationEvidenceRef,policy.maintenancePolicy.resumeRule,policy.validatorRef]){
    bound({path:r.id,sha256:r.sha256})
  }
  const source=readPowerDailySource(bound(report.sourceRefs.archive),JSON.parse(bound(report.sourceRefs.receipt)),
    {start:'20200101',end:'20200131',latitude:14.5078,longitude:101.895,returnedCoordinates:[101.895,14.508]})
  const history=buildEvolutionDiagnosticFeatures(source)
  assert.equal(history.asOfUtc,a.epochUtc)
  for(const k of ['fieldOrder','units','dates','periods','values'])assert.deepEqual(seed.context[k],history[k])
  assert.equal(featureSha(history.values),report.contextValueSha256)
  assert.deepEqual(report.lastValues,history.values.at(-1))
  assert.deepEqual(report.units,history.units);assert.deepEqual(report.fieldOrder,history.fieldOrder)
  assert.deepEqual(seed.initialWeather.values,report.lastValues)
  assert.equal(seed.initialWeather.period.logicalEndUtc,a.epochUtc)
  assert.deepEqual(seed.initialWeather,seed.candidate.environmentEvolution.weather)
  assert.deepEqual(seed.worldHistory,{origin:'bootstrap_no_events',eventCursor:0,events:[]})
  return {report,seed,policy}
}

function eventData(a,file,sources){
  const {report,policy}=sources,b=a.before,epoch=a.epochUtc
  const checks=[a.validationRef.sha256]
  const changes=report.fieldOrder.map((name,i)=>({fieldId:'environment.'+name,operation:'set',
    beforeValueSha256:digest({status:'unavailable',reason:'environment_evolution_not_initialized'}),newValue:report.lastValues[i],reasonRefs:checks}))
  changes.push({fieldId:'environment.logicalEndUtc',operation:'set',beforeValueSha256:digest({status:'unavailable',reason:'logical_anchor_not_initialized'}),
    newValue:epoch,reasonRefs:checks})
  return {schemaVersion:'world-evolution-event-v1',identity:a.identity,eventKind:'maintenance',eventId:scopedVersion,
    fromTick:0,toTick:0,fromStateVersion:0,toStateVersion:1,cursor:1,previousEventSha256:null,
    before:{expectedTick:0,expectedStateVersion:0,expectedFileSha256:b.fileSha256,worldFactsPayloadSha256:b.worldFactsPayloadSha256,
      statePayloadSha256:b.statePayloadSha256,recordContentSha256:b.recordContentSha256},
    interval:{logicalStartUtc:epoch,logicalEndUtc:epoch,durationSeconds:0},policyRef:ref({path:file,sha256:authoritySha}),
    externalInputRefs:[ref(report.sourceRefs.archive),ref(report.sourceRefs.receipt)],historyInputRef:ref(report.preparationRef),
    evidence:{kind:'maintenance',maintenanceContext:{targetPolicyRef:ref(a.policyRef),targetRuleVersion:policy.ruleVersion,
      targetModelRef:policy.modelRef,migrationEvidenceRef:policy.maintenancePolicy.migrationEvidenceRef,executorId:'world-weather-production-maintenance-v1'},
      migrationArtifactRef:ref(report.preparationRef),validationRef:ref(a.validationRef)},changes,reasonRefs:checks}
}

function buildRequest(a,original,sources,event,key,api,savedAt){
  const old=verifyNaturalRecordBytes(original,a.identity),b=a.before
  assert.equal(sha(original),b.fileSha256)
  for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])assert.equal(old[k],b[k])
  assert.equal(digest(old.randomState),b.randomStateSha256)
  assert(!Object.hasOwn(old.worldState.payload.environment,'evolution'))
  assert(sources.policy.maintenancePolicy.compatibleFromVersions.includes(old.ruleVersion))
  const record=structuredClone(old)
  for(const field of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete record[field]
  record.stateVersion=1;record.eventCursor=1;record.savedAt=savedAt
  record.worldState.payload.environment.evolution=structuredClone(sources.seed.candidate.environmentEvolution)
  const sealed=api.sealWorldEvolutionEvent({...event,businessKey:key,domainAfterSha256:api.computeWorldEvolutionDomainSha(record)})
  record.worldState.payload.environment.evolution.commit={businessKey:key,eventId:sealed.eventId,eventSha256:sealed.eventSha256,
    historyHead:{cursor:1,eventSha256:sealed.eventSha256}}
  return {record,event:sealed,expectedTick:0,expectedStateVersion:0,expectedFileSha256:b.fileSha256}
}

export function classifyWeatherMaintenanceState(a,current,key){
  assert.equal(current.status,'found','weather maintenance world unavailable')
  const r=current.record
  assert.deepEqual(idOf(r),a.identity,'weather maintenance foreign world')
  if(r.tick===0&&r.stateVersion===0&&r.eventCursor===0){
    assert.equal(current.fileSha256,a.worldRef.sha256,'weather maintenance stale pre-state')
    return 'initial'
  }
  assert(r.tick===0&&r.stateVersion===1&&r.eventCursor===1&&
    r.worldState.payload.environment.evolution?.commit?.businessKey===key,'weather maintenance previously evolved or foreign event')
  return 'duplicate'
}

async function readContext(file,root){
  const a=decodeWeatherMaintenanceAuthority(read(file,64*1024)),sources=readSources(a),api=await runtime()
  api.policy.validateWorldEvolutionPolicy(sources.policy,a.identity)
  const ev=eventData(a,file,sources),key=api.transaction.computeWorldEvolutionBusinessKey(ev)
  const store=api.store.createProductionWorldRuntimeStore(safe(root)),id=a.identity
  const query={ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId}
  const stored=root+'/'+id.ownerId+'/'+id.worldId+'.json'
  return {a,sources,api,ev,key,store,query,stored,file}
}

async function verifyReceipt(ctx,current){
  const {a,sources,api,ev,key,store,stored,file}=ctx
  assert.equal(classifyWeatherMaintenanceState(a,current,key),'duplicate')
  const prior=await store.readNaturalTransition({identity:a.identity,businessKey:key})
  assert.equal(prior.status,'found')
  const original=bound({...a.worldRef,path:stored+'.evolution/'+key+'.'+a.worldRef.sha256+'.before.json'})
  const request=buildRequest(a,original,sources,ev,key,api.transaction,current.record.savedAt)
  const frozen=api.transaction.snapshotNaturalWorldTransition(request)
  assert.deepEqual(prior.event,frozen.event)
  assert.deepEqual(current.record,frozen.record)
  assert.equal(prior.receipt.fileSha256,current.fileSha256)
  return {identity:a.identity,priorReceipt:prior.receipt,event:prior.event,current:{record:current.record,fileSha256:current.fileSha256},
    preparation:sources.seed,validation:sources.report,policy:sources.policy,authorityRef:{path:file,sha256:authoritySha}}
}

async function verifyCurrent(file,root){
  const ctx=await readContext(file,root)
  return verifyReceipt(ctx,await ctx.store.readNatural(ctx.query))
}

async function consume(file,root){
  const ctx=await readContext(file,root),{a,sources,api,ev,key,store,query,stored}=ctx
  async function duplicate(current){const {priorReceipt}=await verifyReceipt(ctx,current);return {ok:true,replayed:true,receipt:priorReceipt}}
  const current=await store.readNatural(query)
  if(classifyWeatherMaintenanceState(a,current,key)==='duplicate')return duplicate(current)
  const original=read(stored,512*1024)
  if(sha(original)!==a.worldRef.sha256)return duplicate(await store.readNatural(query))
  const request=buildRequest(a,original,sources,ev,key,api.transaction,new Date().toISOString())
  api.transaction.snapshotNaturalWorldTransition(request)
  const written=await store.writeNaturalTransition(request)
  if(!written.ok){
    // Another writer may have committed the identical maintenance since our read.
    // Only the original verified receipt permits returning success on this branch.
    const reread=await store.readNatural(query)
    if(reread.status==='found'&&reread.record.worldState.payload.environment.evolution?.commit?.businessKey===key)return duplicate(reread)
    throw Error('weather initialization transaction: '+written.message)
  }
  return {ok:true,replayed:written.replayed===true,receipt:written.receipt}
}

export async function applyInitialWeatherMaintenance(...args){
  assert.equal(args.length,0,'fixed formal maintenance interface')
  return consume(authorityPath,'data/world-runtime')
}

export async function verifyCommittedWeatherMaintenance(...args){
  assert.equal(args.length,0,'fixed formal maintenance read interface')
  return verifyCurrent(authorityPath,'data/world-runtime')
}

// Qualification always pairs the draft with the fixed disposable Store for that job.
export async function qualifyInitialWeatherMaintenanceClone(...args){
  assert.equal(args.length,0,'fixed clone maintenance interface')
  return consume(draft,base+'/qualification/store')
}

export async function qualifyInitialWeatherMaintenance180Clone(...args){
  assert.equal(args.length,0,'fixed forecast clone maintenance interface')
  return consume(draft,firstForecastClone)
}

export async function verifyCommittedWeatherMaintenance180Clone(...args){
  assert.equal(args.length,0,'fixed forecast clone maintenance read interface')
  return verifyCurrent(draft,firstForecastClone)
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.deepEqual(process.argv.slice(2),['--apply'])
  console.log(JSON.stringify(await applyInitialWeatherMaintenance()))
}
