import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {beginLocalTaskRun} from '../../src/server/ai-painter-local-task-run-store.mjs'

const taskContract={taskTypeId:'private-task-lock-fixture',executionCommand:null}
function fixture(t) {
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'local-task-lock-'))
  t.after(()=>{assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('local-task-lock-'));assert.equal(fs.realpathSync(root),root);assert(!fs.lstatSync(root).isSymbolicLink());fs.rmSync(root,{recursive:true})})
  return {root,lock:path.join(root,'active-task.lock'),begin:()=>beginLocalTaskRun({storeRoot:root,taskContract,simulation:true})}
}

test('local task lifecycle preserves normal success/failure and mutually exclusive admission',t=>{
  const f=fixture(t),run=f.begin();assert.throws(f.begin,error=>error.code==='task_mutex_locked')
  assert.equal(run.complete('private success').status,'completed');assert(!fs.existsSync(f.lock))
  const next=f.begin();assert.equal(next.fail(Error('private failure')).status,'failed');assert(!fs.existsSync(f.lock))
})

test('local task release preserves another file substituted at its lock path',t=>{
  const f=fixture(t),run=f.begin(),original=path.join(f.root,'held.lock')
  fs.renameSync(f.lock,original);fs.writeFileSync(f.lock,JSON.stringify({taskId:'replacement'}),{flag:'wx'})
  assert.throws(()=>run.complete(),error=>error.code==='task_mutex_identity_changed')
  assert.equal(JSON.parse(fs.readFileSync(f.lock,'utf8')).taskId,'replacement')
  assert.equal(JSON.parse(fs.readFileSync(original,'utf8')).taskId,run.taskId)
})

test('local task release preserves a changed owner even when the file inode is unchanged',t=>{
  const f=fixture(t),run=f.begin(),identity=fs.statSync(f.lock)
  fs.writeFileSync(f.lock,JSON.stringify({taskId:'replacement'}))
  assert.equal(fs.statSync(f.lock).ino,identity.ino)
  assert.throws(()=>run.complete(),error=>error.code==='task_mutex_identity_changed')
  assert.equal(JSON.parse(fs.readFileSync(f.lock,'utf8')).taskId,'replacement')
})

test('local task lock initialization preserves the primary error if close reports a second failure',t=>{
  const f=fixture(t),open=fs.openSync,write=fs.writeFileSync,close=fs.closeSync,stat=fs.fstatSync
  const original=Object.assign(Error('private write failed'),{code:'EIO'});let owned
  t.mock.method(fs,'openSync',(file,...args)=>{const fd=open(file,...args);if(file===f.lock)owned=fd;return fd})
  t.mock.method(fs,'writeFileSync',(file,...args)=>{if(file===owned)throw original;return write(file,...args)})
  t.mock.method(fs,'closeSync',fd=>{close(fd);if(fd===owned)throw Error('private close failed')})
  assert.throws(f.begin,error=>error===original)
  assert.throws(()=>stat(owned),error=>error.code==='EBADF');assert(fs.existsSync(f.lock))
})
