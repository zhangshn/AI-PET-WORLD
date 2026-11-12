import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {createBackupStorage} from '../../src/server/local-backup/backup-storage.mjs'

function fixture(t) {
  const parent=fs.realpathSync(os.tmpdir())
  const root=fs.mkdtempSync(path.join(parent,'backup-lock-boundary-'))
  t.after(()=>{
    assert.equal(path.dirname(root),parent)
    assert(path.basename(root).startsWith('backup-lock-boundary-'))
    assert(!fs.lstatSync(root).isSymbolicLink())
    assert.equal(fs.realpathSync(root),root)
    fs.rmSync(root,{recursive:true})
  })
  return {root,file:path.join(root,'backup-publish.lock'),storage:createBackupStorage(root,{})}
}
const id='backup-33333333-3333-3333-3333-333333333333'

test('backup lock distinguishes existing ownership from permission and IO failures',t=>{
  const f=fixture(t)
  const release=f.storage.lock(id)
  assert.throws(()=>f.storage.lock(id),error=>error.message==='backup_task_lock_present'&&error.status===409)
  release()
  assert(!fs.existsSync(f.file))
  const open=fs.openSync
  for(const code of ['EACCES','EIO']){
    const failure=Object.assign(new Error('private open failure'),{code})
    const mock=t.mock.method(fs,'openSync',(file,...args)=>{
      if(file===f.file)throw failure
      return open(file,...args)
    })
    try{assert.throws(()=>f.storage.lock(id),error=>error===failure)}finally{mock.mock.restore()}
    assert(!fs.existsSync(f.file))
  }
})

for(const phase of ['writeFileSync','fsyncSync','fstatSync']){
  test(`backup lock closes its descriptor after ${phase} failure and preserves the failed lock`,t=>{
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
      assert.throws(()=>f.storage.lock(id),error=>error===failure)
      assert.equal(typeof ownedFd,'number')
      try{stat(ownedFd)}catch(error){if(error.code==='EBADF')closed=true;else throw error}
      assert.equal(closed,true,'failed lock initialization must close its descriptor')
      assert(fs.existsSync(f.file),'the failed lock is evidence and must remain')
    }finally{
      operationMock.mock.restore();openMock.mock.restore()
      if(typeof ownedFd==='number'&&!closed)fs.closeSync(ownedFd)
    }
    assert.throws(()=>f.storage.lock(id),/backup_task_lock_present/)
  })
}

test('backup lock release preserves a replacement lock instead of deleting another owner',t=>{
  const f=fixture(t),release=f.storage.lock(id),original=path.join(f.root,'original.lock')
  fs.renameSync(f.file,original)
  fs.writeFileSync(f.file,'another-owner',{flag:'wx'})
  assert.throws(release,/backup_lock_identity_changed/)
  assert.equal(fs.readFileSync(f.file,'utf8'),'another-owner')
  assert.equal(JSON.parse(fs.readFileSync(original,'utf8')).backupId,id)
})
