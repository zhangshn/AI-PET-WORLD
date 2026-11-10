import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {runProductionBuild} from '../build-next-production.mjs'

test('production compile preserves an external runtime mount and forwards compiler failures', () => {
  const scope=fs.mkdtempSync(path.join(os.tmpdir(),'build-boundary-'))
  const root=path.join(scope,'project'),data=path.join(scope,'data')
  fs.mkdirSync(root);fs.mkdirSync(data)
  fs.writeFileSync(path.join(data,'evidence.json'),'original-evidence')
  fs.symlinkSync(data,path.join(root,'.runtime'),process.platform==='win32'?'junction':'dir')
  let calls=0
  const runner=(exe,args,options)=>{
    calls++;assert.equal(exe,process.execPath);assert.equal(options.cwd,root)
    assert.equal(options.windowsHide,true)
    assert.deepEqual(args,['--max-old-space-size=16384',path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'])
    assert.equal(fs.realpathSync(path.join(root,'.runtime')),fs.realpathSync(data))
    return {status:7}
  }
  assert.equal(runProductionBuild({root,runner,env:{}}),7)
  assert.equal(calls,1)
  assert.equal(fs.readFileSync(path.join(data,'evidence.json'),'utf8'),'original-evidence')
  assert.deepEqual(fs.readdirSync(root),['.runtime'])
  assert.throws(()=>runProductionBuild({root,runner:()=>({error:Error('compiler unavailable')})}),/compiler unavailable/)
  // Preserve the small linked fixture; no recursive deletion through junctions.
})

test('a stale legacy hold is reported without invoking a compiler or restoring paths', () => {
  const scope=fs.mkdtempSync(path.join(os.tmpdir(),'build-hold-')),root=path.join(scope,'project')
  const hold=path.join(scope,'.ai-pet-world-runtime-junction-production-build-hold')
  fs.mkdirSync(root);fs.mkdirSync(hold)
  fs.writeFileSync(path.join(hold,'evidence'),'unchanged')
  assert.throws(()=>runProductionBuild({root,runner:()=>assert.fail('compiler must not start')}),/Interrupted legacy build hold/)
  assert.equal(fs.readFileSync(path.join(hold,'evidence'),'utf8'),'unchanged')
  assert.deepEqual(fs.readdirSync(root),[])
})
