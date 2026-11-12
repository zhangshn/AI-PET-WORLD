import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {runProductionBuild} from '../build-next-production.mjs'

function createFixture(t, prefix) {
  const parent=fs.realpathSync(os.tmpdir())
  const scope=fs.mkdtempSync(path.join(parent,prefix))
  const cleanup=()=>{
    assert.equal(path.dirname(path.resolve(scope)),parent)
    assert(path.basename(scope).startsWith(prefix))
    if(!fs.existsSync(scope))return
    assert(!fs.lstatSync(scope).isSymbolicLink())
    assert.equal(fs.realpathSync(scope),scope)
    const mount=path.join(scope,'project','.runtime')
    const stat=fs.lstatSync(mount,{throwIfNoEntry:false})
    if(stat){
      assert(stat.isSymbolicLink(),'fixture mount must remain a link')
      const data=path.join(scope,'data')
      assert.equal(fs.realpathSync(data),data)
      assert.equal(fs.realpathSync(mount),data)
      fs.unlinkSync(mount)
      assert(fs.existsSync(data),'unlink must preserve the fixture data')
    }
    fs.rmSync(scope,{recursive:true})
  }
  t.after(cleanup)
  return {scope,cleanup}
}

test('production compile preserves an external runtime mount and forwards compiler failures', (t) => {
  const {scope}=createFixture(t,'build-boundary-')
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
})

test('a stale legacy hold is reported without invoking a compiler or restoring paths', (t) => {
  const {scope}=createFixture(t,'build-hold-'),root=path.join(scope,'project')
  const hold=path.join(scope,'.ai-pet-world-runtime-junction-production-build-hold')
  fs.mkdirSync(root);fs.mkdirSync(hold)
  fs.writeFileSync(path.join(hold,'evidence'),'unchanged')
  assert.throws(()=>runProductionBuild({root,runner:()=>assert.fail('compiler must not start')}),/Interrupted legacy build hold/)
  assert.equal(fs.readFileSync(path.join(hold,'evidence'),'utf8'),'unchanged')
  assert.deepEqual(fs.readdirSync(root),[])
})

test('fixture cleanup rejects a changed mount target and removes only its owned scope', (t) => {
  const {scope,cleanup}=createFixture(t,'build-boundary-')
  const root=path.join(scope,'project'),data=path.join(scope,'data'),other=path.join(scope,'other')
  fs.mkdirSync(root);fs.mkdirSync(data);fs.mkdirSync(other)
  fs.writeFileSync(path.join(other,'evidence'),'unchanged')
  const mount=path.join(root,'.runtime'),kind=process.platform==='win32'?'junction':'dir'
  fs.symlinkSync(other,mount,kind)
  assert.throws(cleanup,assert.AssertionError)
  assert.equal(fs.readFileSync(path.join(other,'evidence'),'utf8'),'unchanged')
  fs.unlinkSync(mount)
  fs.symlinkSync(data,mount,kind)
  cleanup()
  assert(!fs.existsSync(scope))
})
