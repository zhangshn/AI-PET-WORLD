import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {test} from 'node:test'
import {ROOT,bind,bound,json,safe} from '../lib/world-initialized-evolution.mjs'
import {executeScheduledWeatherCommand} from '../lib/world-weather-scheduled-service.mjs'
import {openRegisteredWeatherServiceAccounting} from '../lib/world-weather-service-lease.mjs'
import {readScheduledWeatherEnrollmentAnchor,readScheduledWeatherQualificationEnrollmentAnchor} from '../lib/world-weather-scheduled-history.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103'
const cfg=json(base+'/qualification/budget.json')
const opts={maxNewSteps:cfg.maximumNewSteps,batchSize:cfg.batchSize,maxBatchIssues:cfg.maximumBatchIssues,batchLeaseMs:cfg.batchLeaseMs}
test('production and historical qualification have distinct identities and identical commissioned opening weather',async()=>{
  const [official,clone]=await Promise.all([readScheduledWeatherEnrollmentAnchor(),readScheduledWeatherQualificationEnrollmentAnchor()])
  assert.deepEqual({...clone,scope:'production'},official)
  assert.deepEqual(clone,json(base+'/qualification/initial-input.json'))
  assert.deepEqual(official.verifiedTrace.map(x=>x.modelVersion),['sakaerat-weather-153-runtime-v3','sakaerat-weather-153-rolling-v4','sakaerat-weather-153-rolling-v4'])
  assert.equal(official.before.fileSha256,'812125a94cf1a1704d4dfff46b2ac218bb31a9ac4a7bc277144331610e827898')
  const pre=await executeScheduledWeatherCommand('--preflight')
  assert.equal(pre.modelStarts,0);assert.equal(pre.worldWrites,0);assert.equal(pre.remainingValidatedDays,30-pre.before.tick)
})
test('registered server rejects caller-controlled locations, counts and a fabricated original anchor',async()=>{
  const original=await readScheduledWeatherQualificationEnrollmentAnchor()
  const forged=structuredClone(original);forged.head.eventSha256='0'.repeat(64)
  await assert.rejects(openRegisteredWeatherServiceAccounting('qualification',forged,opts,false,true))
  await assert.rejects(openRegisteredWeatherServiceAccounting('qualification',original,{...opts,maxNewSteps:27},false,true))
  await assert.rejects(openRegisteredWeatherServiceAccounting('qualification',original,opts,true,true))
  await assert.rejects(executeScheduledWeatherCommand('--qualify-status',ROOT),/no caller supplied/)
  await assert.rejects(executeScheduledWeatherCommand('--force'),/fixed scheduled weather command/)
  await assert.rejects(executeScheduledWeatherCommand('--serve','0'))
  assert.throws(()=>readScheduledWeatherQualificationEnrollmentAnchor('production'))
})
test('production launch in an unregistered installation fails before enrollment or native processes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-world-weather-v5-install-'))
  try{
    const c=spawnSync(process.execPath,[safe('scripts/run-world-weather-service.mjs'),'--launch'],{cwd:dir,encoding:'utf8',windowsHide:true})
    assert.equal(c.status,1);assert.match(c.stderr,/unsupported_scope|binding|trusted|missing/i)
    assert.deepEqual(fs.readdirSync(dir),[])
  }finally{fs.rmdirSync(dir)}
})
test('original v3 and v4 immutable interface sources survive the two explicitly scoped 206 updates',()=>{
  for(const contract of ['sakaerat-first-committed-weather-runtime-v3','sakaerat-rolling-weather-runtime-v4']){
    const previous=json('data/ai-painter/system-governance/'+contract+'.json')
    for(const [key,v] of Object.entries(previous)){
      if(v?.path&&v?.sha256){bound(v);if(key==='runner'||key==='entry')assert.notEqual(v.path,cfg[key].path)}
    }
  }
  const verified=json(base+'/source-freeze-final.json')
  for(const v of verified){assert.deepEqual(bind(v.path),v)}
})
