// Only deterministic numeric measurements and fixed absence codes are public.
// This is a presentation boundary, never a data/model qualification decision.
const absentReasons=new Set(['empty_region','fewer_than_two_pixels','constant_reference_region'])
function selectedValue(v,key) {
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v
  if(typeof v==='string'&&v.length<=1024)return v
  if(['optimizerSteps','actualFinalOptimizerSteps','lastConfirmedOptimizerSteps','optimizerStepCeiling'].includes(key))
    return v&&typeof v==='object'?Object.fromEntries(['generator','discriminator'].map(k=>[k,Number.isSafeInteger(v[k])&&v[k]>=0?v[k]:null])):null
  if(key==='resolution'&&Array.isArray(v)&&v.length===2&&v.every(Number.isSafeInteger))return v
  if(key==='secondaryErrors'&&Array.isArray(v))return v.slice(0,8).filter(x=>typeof x==='string'&&/^[a-z0-9_]{1,96}$/u.test(x))
  return undefined
}
const select=(v,keys)=>Object.fromEntries(keys.map(k=>[k,selectedValue(v?.[k],k)]).filter(([,v])=>v!==undefined))
const binding=v=>v?select(v,['path','sha256']):null
const clock=v=>v?select(v,['scope','status','startedAtUtc','endedAtUtc','elapsedSeconds']):null
export function publicMeasurements(value) {
  let nodes=0,measured=0
  function visit(v,key,depth) {
    if(++nodes>4096||depth>6)throw Error('training_observation_metric_limit')
    if(v===null)return v
    if(typeof v==='boolean'){measured++;return v}
    if(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e100){measured++;return v}
    if(key==='naReason'&&typeof v==='string'&&absentReasons.has(v))return v
    if(Array.isArray(v)&&v.length<=128)return v.map(x=>visit(x,'',depth+1))
    if(v&&typeof v==='object'&&!Array.isArray(v)) {
      const entries=Object.entries(v)
      if(entries.length>128||!entries.length)throw Error('training_observation_metric_missing')
      return Object.fromEntries(entries.map(([k,x])=>{
        if(!/^[A-Za-z0-9_.-]{1,96}$/u.test(k)||['__proto__','prototype','constructor'].includes(k))throw Error('training_observation_metric_key_invalid')
        return [k,visit(x,k,depth+1)]
      }))
    }
    throw Error('training_observation_metric_value_invalid')
  }
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('training_observation_metric_missing')
  const result=visit(value,'',0)
  if(!measured)throw Error('training_observation_metric_missing')
  return result
}
const artifact=a=>({...select(a,['role','sampleId','split','optimizerStep','measurementScope','resolution','promotable']),
  binding:binding(a.binding),...(a.imageTiming?{imageTiming:clock(a.imageTiming)}:{})})
export function publicObservationArtifact(role,value) {
  if(role==='condition')return {contentStatus:'metadata_only'}
  if(role==='result'||role==='terminal')return {
    ...select(value,['schemaVersion','status','executionState','runId','experimentIdentity','packageId','capabilityVersion',
      'recordedAtUtc','gpuStarted','trainingStarted','optimizerSteps','actualFinalOptimizerSteps','lastConfirmedOptimizerSteps',
      'checkpointReloadExact','elapsedSeconds','formalQualificationGranted','formalTrainingQualified','formalStageAdvanced',
      'checkpointPromotable','worldEntryAllowed','timedOut','exitCode']),
    executionPackage:binding(value.executionPackage),trainingObservation:binding(value.trainingObservation),
    lastWorkerProgress:binding(value.lastWorkerProgress),controllerExecutionTiming:clock(value.controllerExecutionTiming),
    errorRecorded:typeof value.error==='string'||typeof value.errorCode==='string',
    errorDisclosure:'raw_error_retained_in_original_evidence_not_public_preview'}
  if(role==='request') {
    const c=value.interfaceContract
    return {...select(value,['schemaVersion','experimentIdentity','runId','outputRoot']),interfaceContract:c?{
      ...select(c,['schemaVersion','purpose','producerVersion','recordFile','progressFile','resolution','optimizerStepCeiling']),
      producer:binding(c.producer),samples:c.samples?.map(s=>({...select(s,['sampleId','split']),image:binding(s.image),conditionPack:binding(s.conditionPack)})),
      artifactPlan:c.artifactPlan?.map(a=>select(a,['role','sampleId','split','optimizerStep','measurementScope']))}:null}
  }
  if(value.schemaVersion==='ai-painter-training-observation-v1') return {
    ...select(value,['schemaVersion','runId','producerVersion','recordedAtUtc','executionState','optimizerSteps','qualificationGranted','secondaryErrors']),
    executionPackage:binding(value.executionPackage),workerTiming:clock(value.workerTiming),artifacts:value.artifacts?.map(artifact)}
  if(value.values!==undefined||value.metrics!==undefined)return {
    ...select(value,['sampleId','step','optimizerSteps','recordedAtUtc','measurementScope']),measurements:publicMeasurements(value.values??value.metrics)}
  // Capsule/transaction and any unknown record retain bounded provenance only.
  return {...select(value,['schemaVersion','transactionId','taskId','runId','registryRevision','eventSequence','status','currentSha256']),
    contentStatus:'controlled_metadata_only'}
}
