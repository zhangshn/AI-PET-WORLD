import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {checkWeatherCoverage,prepareNaturalWorldWeatherTarget} from '../lib/world-environment-target-profile.mjs'
import {readWeatherFieldDomain,checkDailyWeatherRow,verifyWeatherRows} from '../lib/world-weather-field-domain.mjs'
import {createEvolutionInputReader} from '../lib/natural-world-evolution-input.mjs'
import {runtime,json,digest} from '../lib/world-initialized-evolution.mjs'

test('coverage counts dates only once and includes exact endpoints',()=>{
  const r=checkWeatherCoverage(['a','b'],[[0,1],[0,2]],[
    {date:'A',values:[0,2]},{date:'B',values:[-2,3]},{date:'C',values:[1,0]}])
  assert.equal(r.daysOutside,1)
  assert.deepEqual(r.perField.a.outside,[{date:'B',value:-2}])
  assert.deepEqual(r.perField.b.outside,[{date:'B',value:3}])
  assert.throws(()=>checkWeatherCoverage(['a'],[[0,2]],[{date:'D',values:[NaN]}]),/invalid_value/)
})

test('fixed target uses the formal six identities, historical inputs and held-out dates without allowing a release',()=>{
  const p=prepareNaturalWorldWeatherTarget()
  assert.equal(p.identity.worldId,'mvp-natural-world-001')
  assert.equal(p.initialState.before.tick,0)
  assert.equal(p.initialState.context.values.length,7)
  assert.equal(p.observedSupport.days,365)
  assert.equal(p.predictedSupport.days,358)
  assert.deepEqual(p.observedSupport.perField.WS2M.outside.map(x=>x.date),
    ['20250111','20250914','20251111','20251118','20251119'])
  assert.deepEqual(p.predictedSupport.perField.WS2M.outside.map(x=>x.date),['20250112'])
  assert.equal(p.registryWrites,0)
  assert.equal(p.productionAdmitted,false)
  assert.equal(p.fieldDomainChecks.seed.acceptedRows,7)
  assert.equal(p.fieldDomainChecks.independentSource.acceptedRows,365)
  assert.equal(p.fieldDomainChecks.savedPredictions.acceptedRows,358)
  assert.equal(p.fieldDomainChecks.savedRollouts.length,12)
  assert.ok(p.fieldDomainChecks.savedRollouts.every(run=>run.acceptedRows===30 && run.rejectedRows===0))
  assert.deepEqual(p.fieldDomainChecks.independentSource.outsideTraining,
    p.observedSupport.perField.WS2M.outside.map(v=>({...v,field:'WS2M'})))
  assert.deepEqual(p.fieldDomainChecks.savedPredictions.outsideTraining,
    p.predictedSupport.perField.WS2M.outside.map(v=>({...v,field:'WS2M'})))
})

const fields=readWeatherFieldDomain(createEvolutionInputReader().read).domainFields
const training=[[0,118.78],[36.44,96.16],[14.06,31.83],[0.55,4.3]]
test('published inclusive field limits reject invalid values and keep uncommon values intact',()=>{
  const limits=[[0,12000],[0,100],[-125,80],[0,50]]
  for(const [i,[min,max]] of limits.entries()){
    for(const [value,expected] of [[min,true],[max,true],[min-0.01,false],[max+0.01,false],
      [null,false],['1',false],[NaN,false],[Infinity,false],[-999,false]]){
      const values=[0,70,25,3]
      values[i]=value
      assert.equal(checkDailyWeatherRow(fields,training,values).status==='within_source_domain',expected)
    }
  }
  const sample=Object.freeze([0,70,25,5.25])
  assert.deepEqual(checkDailyWeatherRow(fields,training,sample),
    {status:'within_source_domain',reasons:[],outsideTraining:['WS2M']})
  assert.throws(()=>verifyWeatherRows(fields,training,[{date:'invalid',values:[0,70,25,-1]}]),/invalid_WS2M:outside_source_domain/)
  assert.equal(checkDailyWeatherRow(fields,training,[0,70,25]).status,'reject')
})
test('changed metadata or receipt bytes stop preparation',()=>{
  const reader=createEvolutionInputReader()
  for(const name of ['metadata.json','receipt.json']){
    assert.throws(()=>readWeatherFieldDomain((p,limit)=>p.endsWith('/'+name)?Buffer.from('{}'):reader.read(p,limit)),/source_changed/)
  }
})
test('original Runtime validator consumes the sourced descriptors and enforces the same wind boundary',async()=>{
  const r=await runtime()
  const run='.runtime/ai-painter/controller-repair-reviews/world-environment-background-166-20261031/runtime/actual-run/'
  const policy=json(run+'private-policy.json')
  delete policy.contentSha256
  policy.domainFields=fields
  policy.contentSha256=r.policy.computeWorldEvolutionPolicySha(policy)
  const beforeValues=Object.fromEntries(fields.map((rule,i)=>[rule.fieldId,[0,70,25,3][i]]))
  const change=(value)=>r.domain.validateWorldEnvironmentDelta({policy,identity:policy.identity,
    interval:json(run+'step-1/input.json').interval,beforeValues,result:'changes',
    changes:[{fieldId:'environment.WS2M',operation:'replace',beforeValueSha256:digest(3),newValue:value,
      reasonRefs:[digest({test:'source wind boundary'})]}]})
  assert.equal(change(5.25).nextValues['environment.WS2M'],5.25)
  assert.equal(change(50).domainValid,true)
  assert.throws(()=>change(50.01),/field_value/)
})

const cli='scripts/publish-ai-painter-machine-capability-release.mjs'
for(const [name,extra,reason] of [
  ['world scope cannot fall back to generic publication',['--required-capability-scope','world_evolution'],/unsupported_scope/],
  ['misspelled scope option cannot fall back',['--capability-scope','world_evolution'],/unknown, incomplete or duplicate/],
  ['ambiguous draft is rejected',['--draft','second.json'],/unknown, incomplete or duplicate/],
  ['preparation cannot be combined with publication',['--prepare-world-weather-target'],/unknown, incomplete or duplicate/],
])test(name,()=>{
  const p=spawnSync(process.execPath,[cli,'--draft','does-not-exist.json','--expected-registry-revision','0',...extra],{encoding:'utf8'})
  assert.notEqual(p.status,0);assert.match(p.stderr,reason)
  assert.doesNotMatch(p.stderr,/draft path is invalid or missing/)
})
test('ordinary unscoped CLI still reaches draft validation',()=>{
  const p=spawnSync(process.execPath,[cli,'--draft','does-not-exist.json','--expected-registry-revision','0'],{encoding:'utf8'})
  assert.notEqual(p.status,0);assert.match(p.stderr,/draft path is invalid or missing/)
})
