import { baselineJson, baselineSha256, baselineDigest } from './natural-world-baseline-proof.mjs'
import { createEvolutionInputReader } from './natural-world-evolution-input.mjs'
import { prepareWorldEnvironmentInitialization } from './world-environment-initialization.mjs'
import { inspectWorldEnvironmentCandidateQualification } from './world-environment-qualification.mjs'
import {readWeatherFieldDomain, verifyWeatherRows} from './world-weather-field-domain.mjs'

const PROFILE = 'data/ai-painter/system-governance/mvp-natural-world-weather-target-v1.json'
const REVIEWS = '.runtime/ai-painter/controller-repair-reviews/'
const need = (condition, why) => { if (!condition) throw Error('world_weather_target_' + why) }
const same = (a, b) => baselineDigest(a) === baselineDigest(b)
const formatDay = d => d.toISOString().slice(0, 10).replaceAll('-', '')
const asDate = s => new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T00:00:00.000Z')

// Keep one joint-day count as well as the individual field failures. Nothing is clipped.
export function checkWeatherCoverage(fields, ranges, rows) {
  const outside = fields.map(() => [])
  let daysOutside = 0
  for (const {date, values} of rows) {
    need(values.length === fields.length, 'field_count')
    let any = false
    fields.forEach((_, i) => {
      const [lo, hi] = ranges[i], value = values[i]
      need([lo, hi, value].every(Number.isFinite) && lo <= hi, 'invalid_value')
      if (value < lo || value > hi) { outside[i].push({date, value}); any = true }
    })
    if (any) daysOutside++
  }
  return {days: rows.length, daysInside: rows.length-daysOutside, daysOutside,
    perField: Object.fromEntries(fields.map((f,i) => [f,{minimum:ranges[i][0],maximum:ranges[i][1],outside:outside[i]}]))}
}

function daily(source, p, start, end) {
  need(source.header.time_standard === 'UTC' && source.header.start <= start && source.header.end >= end, 'source_time')
  need(same(source.geometry.coordinates.slice(0,2), [p.geography.returnedLongitude,p.geography.returnedLatitude]), 'source_point')
  need(p.fields.every((f,i) => source.parameters[f].units === p.units[i]), 'source_units')
  const rows = []
  for (const d=asDate(start); d<=asDate(end); d.setUTCDate(d.getUTCDate()+1)) {
    const date=formatDay(d), values=p.fields.map(f=>source.properties.parameter[f][date])
    need(values.every(x=>Number.isFinite(x) && x!==source.header.fill_value),'source_missing_'+date)
    rows.push({date,values})
  }
  return rows
}

/** Fixed first-world preparation. A returned profile never grants publication or mutation rights. */
export function prepareNaturalWorldWeatherTarget(projectRoot=process.cwd()) {
  need(typeof projectRoot==='string' && projectRoot.length>0,'project_root')
  const {read,coverage}=createEvolutionInputReader(projectRoot)
  const pinned=(p, sha, max) => {
    const raw=read(p,max); need(baselineSha256(raw)===sha,'file_changed:'+p)
    return baselineJson(raw,max)
  }
  const p=pinned(PROFILE,'44192a477e628cf6457dbea8072d92b46a9bb5c0fddca8f00a7c92aa4c34c8a1',8192)
  const seed=prepareWorldEnvironmentInitialization({projectRoot})
  const q=inspectWorldEnvironmentCandidateQualification({projectRoot})
  const s=q.numericalEvidence.scope
  need(q.numericalEvidenceVerified && q.fullContextRetrospectiveInitializationVerified &&
    q.candidateIdentity.modelSha256===seed.modelRef.sha256 && seed.modelRef.sha256===p.modelSha256,'model')
  need(same(p.identity,seed.identity) && !same(p.identity,q.candidateIdentity.privateWorldIdentity),'target_identity')
  need(q.initialization.mode===p.initialization.mode && seed.simulation.epochUtc===p.initialization.epochUtc &&
    s.historyDays===p.initialization.historyDays && seed.context.values.length===s.historyDays &&
    s.singleForwardHorizonSeconds===p.time.singleStepSeconds && s.statistics===p.time.statistics,'mode_time')
  need(same(s.fields,p.fields)&&same(s.units,p.units)&&same(seed.context.fieldOrder,p.fields)&&same(seed.context.units,p.units),'field_contract')
  const world=pinned(seed.worldRef.path,seed.worldRef.sha256,512*1024)
  const climate=world.worldState.payload.environment.climate
  const acquisition=pinned(climate.acquisition.path,climate.acquisition.sha256,65536)
  const point=[p.geography.returnedLongitude,p.geography.returnedLatitude]
  need(acquisition.requestParameters.latitude===String(s.requestedLatitude) &&
    acquisition.requestParameters.longitude===String(s.requestedLongitude) &&
    s.requestedLatitude===p.geography.requestedLatitude && s.requestedLongitude===p.geography.requestedLongitude &&
    same(climate.point.slice(0,2),point) && same(s.returnedCoordinates,point) &&
    same(seed.sourceMetadata.responseCoordinates.slice(0,2),point),'target_point')
  const fit=p.fieldSupportTest
  const train=daily(pinned(REVIEWS+'world-environment-pilot-147-20261029/source-response.json',
    '319b7b6f9bc5310ecfdeec53679cfec6860c45d98a1865277b3fc1ce55dff183',262144),p,fit.fitStart,fit.fitEnd)
  const observed=daily(pinned(REVIEWS+'world-environment-holdout-154-20261029/source-response.json',
    '657bf887da726507591517d6705eff8d47fbe5246c6685559dd4b7db65eca973',131072),p,fit.evaluationStart,fit.evaluationEnd)
  const preds=pinned(REVIEWS+'world-environment-holdout-154-20261029/model-run-v1/predictions.json',
    '91ee7b12953fc14c92e518f5c800b1be0166da6835a78583cb27924e02785f53',1048576).rows
  need(train.length===731 && observed.length===365 && preds.length===358 && fit.fitEnd<fit.evaluationStart,'disjoint_periods')
  const projected=preds.map((r,j)=>{
    const actual=observed[j+s.historyDays]
    need(r.targetDate===actual.date && same(r.target,actual.values),'evaluation_date_or_target')
    return {date:r.targetDate,values:r.candidate153.prediction}
  })
  const ranges=p.fields.map((_,i)=>[Math.min(...train.map(r=>r.values[i])),Math.max(...train.map(r=>r.values[i]))])
  const fieldDomain = readWeatherFieldDomain(read)
  const verify = rows => verifyWeatherRows(fieldDomain.domainFields, ranges, rows)
  const seedRows = seed.context.values.map((values,index) => ({date:seed.context.dates[index], values}))
  // The candidate qualification above checks each trajectory's identity, dates and history.
  const rollouts = pinned(REVIEWS+'world-environment-holdout-154-20261029/model-run-v1/rollouts.json',
    'a31deecc71bb3d07d017a10118cbdb909eaee89a8297737f8645f7ee7d7266eb',512*1024)
  const fieldDomainChecks = {
    seed: verify(seedRows), training: verify(train), independentSource: verify(observed),
    savedPredictions: verify(projected),
    savedRollouts: rollouts.trajectories.map(trajectory => ({
      originDate: trajectory.originDate,
      ...verify(trajectory.candidate153.steps.map(step => ({date: step.date, values: step.prediction}))),
    })),
  }
  const measure=rows=>checkWeatherCoverage(p.fields,ranges,rows)
  const result={schemaVersion:'world-environment-target-preparation-v1',profileVersion:p.version,identity:p.identity,modelRef:seed.modelRef,
    initialState:{before:seed.before,worldRef:seed.worldRef,initializationMode:p.initialization.mode,
      epochUtc:seed.simulation.epochUtc,context:seed.context,initialWeather:seed.initialWeather,archiveRefs:seed.sourceRefs,
      meaning:'External historical input; not lived events or present weather.'},geography:p.geography,
    time:p.time,fields:p.fields,units:p.units,applicableModelScope:s.regionGenerality,
    testedRolloutDays:s.evaluatedRolloutDays,trainingDays:train.length,
    fieldDomain,fieldDomainChecks,
    observedSupport:measure(observed),predictedSupport:measure(projected),fieldSupportMeaning:fit.meaning,
    registeredReleases:q.registry.releaseCount,productionAdmitted:false,productionBlockers:q.productionBlockers,
    references:coverage().refs,qualificationManifest:q.referenceVerification.manifest,worldWrites:0,registryWrites:0,modelForwards:0}
  return {...result,contentSha256:baselineDigest(result)}
}
