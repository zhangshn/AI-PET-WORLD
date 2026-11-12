import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {createGitStore} from '../../src/server/local-backup/git-store.mjs'

function fixture(t) {
  const parent=fs.realpathSync(os.tmpdir())
  const root=fs.mkdtempSync(path.join(parent,'git-lock-boundary-'))
  t.after(()=>{
    assert.equal(path.dirname(root),parent)
    assert(path.basename(root).startsWith('git-lock-boundary-'))
    assert(!fs.lstatSync(root).isSymbolicLink())
    assert.equal(fs.realpathSync(root),root)
    fs.rmSync(root,{recursive:true})
  })
  return {root,file:path.join(root,'publish.lock'),storage:createGitStore(root)}
}

test('git lock distinguishes existing ownership from permission and IO failures',t=>{
  const f=fixture(t)
  const release=f.storage.lock()
  assert.throws(()=>f.storage.lock(),error=>error.message==='git_operation_lock_present'&&error.status===409)
  release()
  assert(!fs.existsSync(f.file))
  const open=fs.openSync
  for(const code of ['EACCES','EIO']){
    const failure=Object.assign(new Error('private open failure'),{code})
    const mock=t.mock.method(fs,'openSync',(file,...args)=>{
      if(file===f.file)throw failure
      return open(file,...args)
    })
    try{assert.throws(()=>f.storage.lock(),error=>error===failure)}finally{mock.mock.restore()}
    assert(!fs.existsSync(f.file))
  }
})

for(const phase of ['writeFileSync','fstatSync']){
  test(`git lock closes its descriptor after ${phase} failure and preserves the failed lock`,t=>{
    const f=fixture(t),open=fs.openSync,operation=fs[phase],stat=fs.fstatSync
    const failure=Object.assign(new Error('private '+phase+' failure'),{code:'EIO'})
    let ownedFd,closed=false
    const openMock=t.mock.method(fs,'openSync',(file,...args)=>{
      const fd=open(file,...args)
      if(file===f.file)ownedFd=fd
      return fd
    })
    const operationMock=t.mock.method(fs,phase,(fd,...args)=>{
      if(fd===ownedFd)throw failure
      return operation(fd,...args)
    })
    try{
      assert.throws(()=>f.storage.lock(),error=>error===failure)
      assert.equal(typeof ownedFd,'number')
      try{stat(ownedFd)}catch(error){if(error.code==='EBADF')closed=true;else throw error}
      assert.equal(closed,true,'failed lock initialization must close its descriptor')
      assert(fs.existsSync(f.file),'the failed lock is evidence and must remain')
    }finally{
      operationMock.mock.restore();openMock.mock.restore()
      if(typeof ownedFd==='number'&&!closed)fs.closeSync(ownedFd)
    }
    assert.throws(()=>f.storage.lock(),/git_operation_lock_present/)
  })
}

test('git lock release preserves a replacement lock instead of deleting another owner',t=>{
  const f=fixture(t),release=f.storage.lock(),original=path.join(f.root,'original.lock')
  fs.renameSync(f.file,original)
  fs.writeFileSync(f.file,'another-owner',{flag:'wx'})
  assert.throws(release,/git_operation_lock_changed/)
  assert.equal(fs.readFileSync(f.file,'utf8'),'another-owner')
  assert.equal(JSON.parse(fs.readFileSync(original,'utf8')).processId,process.pid)
})
