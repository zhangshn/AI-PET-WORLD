import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {test} from 'node:test'
import {runFirstWeatherRuntime,readFirstWeatherRuntime} from '../lib/world-first-weather-runtime.mjs'

const runner=path.resolve('scripts/run-world-environment-scheduled.mjs')
test('production entry rejects caller-supplied release, budget, receipt or mode',()=>{
  for(const run of [runFirstWeatherRuntime,readFirstWeatherRuntime]){
    for(const value of [true,'qualification',{productionAdmitted:true},{release:'released'}])assert.throws(()=>run(value),/fixed production mode/)
  }
})
test('normal production command fails at trusted registry on empty project before any Store or reservation',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'first-weather-no-release-'))
  try{
    for(const mode of ['--first-committed-weather','--read-first-committed-weather']){
      const child=spawnSync(process.execPath,[runner,mode],{cwd:dir,encoding:'utf8',windowsHide:true,timeout:10000})
      assert.notEqual(child.status,0)
      assert.match(child.stderr,/registry|ENOENT|not found|no such file|unavailable/iu)
      assert.deepEqual(fs.readdirSync(dir),[])
    }
  }finally{fs.rmdirSync(dir)}
})
test('normal production command cannot select a different Store, input or capability',()=>{
  const result=spawnSync(process.execPath,[runner,'--first-committed-weather','--authority=local'],{windowsHide:true,encoding:'utf8',timeout:10000})
  assert.notEqual(result.status,0);assert.match(result.stderr,/one fixed scheduled-world command/)
})
