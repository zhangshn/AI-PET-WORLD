import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {describeRollingTrialBudget,preflightRollingWeather,rollingWeatherCommand} from '../lib/world-rolling-weather-runtime.mjs'
const runner=path.resolve('scripts/run-world-rolling-weather.mjs')

test('durable quota includes launched, failed and incomplete reservations even after a server restart',()=>{
  assert.deepEqual(describeRollingTrialBudget([],1),{reserved:0,committed:0,remainingModelSlots:2,unresolved:false,exhausted:false})
  assert.deepEqual(describeRollingTrialBudget([2],1),{reserved:1,committed:0,remainingModelSlots:1,unresolved:true,exhausted:false})
  assert.deepEqual(describeRollingTrialBudget([2],2),{reserved:1,committed:1,remainingModelSlots:1,unresolved:false,exhausted:false})
  assert.deepEqual(describeRollingTrialBudget([2,3],2),{reserved:2,committed:1,remainingModelSlots:0,unresolved:true,exhausted:false})
  assert.deepEqual(describeRollingTrialBudget([2,3],3),{reserved:2,committed:2,remainingModelSlots:0,unresolved:false,exhausted:true})
  for(const [claims,tick] of [[[3],1],[[2,2],2],[[],3],[[2,3],1],[[2,3,4],3],[[],4]])assert.throws(()=>describeRollingTrialBudget(claims,tick))
})
test('normal server entry rejects user-provided authority, arbitrary modes and third activation',async()=>{
  await assert.rejects(rollingWeatherCommand('--launch',{allowed:true}),/no authority/)
  await assert.rejects(rollingWeatherCommand('--serve','3'),/fixed activation/)
  await assert.rejects(rollingWeatherCommand('--serve','1','--unlimited'),/fixed activation/)
  await assert.rejects(rollingWeatherCommand('--arbitrary'),/fixed weather runtime/)
})
test('normal launch on a project without an actual v4 registry never opens a Store or creates a reservation',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'weather-v4-no-capability-'))
  try{
    const c=spawnSync(process.execPath,[runner,'--launch'],{cwd:tmp,encoding:'utf8',windowsHide:true,timeout:10000})
    assert.notEqual(c.status,0);assert.match(c.stderr,/registry|ENOENT|not found|unsupported/iu)
    assert.deepEqual(fs.readdirSync(tmp),[])
  }finally{fs.rmdirSync(tmp)}
})
test('read-only formal preflight binds the actual world and cannot launch even if a version has since released',async()=>{
  const p=await preflightRollingWeather()
  assert.equal(p.worldWrites,0);assert.equal(p.workerStarts,0)
  assert(p.before.tick>=1&&p.before.tick<=3)
  assert.equal(p.anchor.businessKey,'7412d747bfa104f06a6c1796a8bca44a38123c724018c858563b36ee9dbeb61f')
  if(p.before.tick===1)assert.equal(p.currentInputSha256,'9dd1328a722c7b8719b0719def007def72a21fb6938e2c1a43091a5c2c015733')
})
