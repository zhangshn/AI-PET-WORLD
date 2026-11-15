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

for (const mode of ['open','write','sync','close','write-close','sync-close','success']) {
  test(`backup evidence write preserves ${mode}, original bytes and private permissions`,t=>{
    const f=fixture(t),directory=path.join(f.root,'runs',id,'events')
    fs.mkdirSync(directory,{recursive:true})
    const file=path.join(directory,'0001.json'),value={kind:'private-fixture',text:'原始证据'},raw=Buffer.from(JSON.stringify(value))
    const primary=new Error('fixture write failure'),cleanup=new Error('fixture close failure')
    const originals={openSync:fs.openSync,writeFileSync:fs.writeFileSync,fsyncSync:fs.fsyncSync,closeSync:fs.closeSync}
    let ownedFd,permission,closes=0
    const mocks=[]
    mocks.push(t.mock.method(fs,'openSync',(target,...args)=>{
      if(target===file){permission=args[1];assert.equal(args[0],'wx');if(mode==='open')throw primary}
      const fd=originals.openSync(target,...args);if(target===file)ownedFd=fd;return fd
    }))
    for(const [operation,phase] of [['writeFileSync','write'],['fsyncSync','sync']])mocks.push(t.mock.method(fs,operation,(fd,...args)=>{
      if(fd===ownedFd&&mode.startsWith(phase))throw primary
      return originals[operation](fd,...args)
    }))
    mocks.push(t.mock.method(fs,'closeSync',fd=>{
      if(fd!==ownedFd)return originals.closeSync(fd)
      closes++;originals.closeSync(fd);if(mode.includes('close'))throw cleanup
    }))
    let result,error
    try{result=f.storage.event(id,1,value)}catch(problem){error=problem}
    finally{for(const mock of mocks.reverse())mock.mock.restore()}
    assert.equal(permission,0o600)
    assert.equal(closes,mode==='open'?0:1)
    if(mode==='success'){
      assert.equal(error,undefined);assert.match(result,/^[a-f0-9]{64}$/)
      assert.deepEqual(fs.readFileSync(file),raw)
    }else if(mode==='write-close'||mode==='sync-close'){
      assert(error instanceof AggregateError);assert.deepEqual(error.errors,[primary,cleanup]);assert.equal(error.cause,primary)
      assert.ok(error.message.includes(primary.message));assert.ok(error.message.includes(cleanup.message))
    }else assert.equal(error,mode==='close'?cleanup:primary)
    assert.equal(fs.existsSync(file),mode!=='open')
    if(mode!=='open'){
      assert.deepEqual(fs.readFileSync(file),mode.startsWith('write')?Buffer.alloc(0):raw)
      const before=fs.readFileSync(file)
      assert.throws(()=>f.storage.event(id,1,{replace:true}),e=>e.code==='EEXIST')
      assert.deepEqual(fs.readFileSync(file),before)
    }
  })
}

test('backup evidence rejects size and serialization failures before opening a file',t=>{
  const f=fixture(t),directory=path.join(f.root,'runs',id,'events')
  fs.mkdirSync(directory,{recursive:true})
  assert.throws(()=>f.storage.event(id,1,{text:'x'.repeat(1024*1024)}),/backup_evidence_limit/)
  const cyclic={};cyclic.self=cyclic
  assert.throws(()=>f.storage.event(id,2,cyclic),/circular/i)
  assert.deepEqual(fs.readdirSync(directory),[])
})

for(const phase of ['writeFileSync', 'fsyncSync', 'fstatSync'])for(const primitive of [false,true]) {
  test(`backup lock preserves ${phase} plus close failure (${primitive?'null':'Error'})`,t=>{
    const f=fixture(t),originals={openSync:fs.openSync,closeSync:fs.closeSync,[phase]:fs[phase]}
    const first=primitive?null:new Error('fixture initialization failed'),closeError=new Error('fixture close failed')
    let ownedFd,closes=0,caught=false,failure
    const mocks=[t.mock.method(fs,'openSync',(file,...args)=>{const fd=originals.openSync(file,...args);if(file===f.file)ownedFd=fd;return fd}),
      t.mock.method(fs,phase,(fd,...args)=>{if(fd===ownedFd)throw first;return originals[phase](fd,...args)}),
      t.mock.method(fs,'closeSync',fd=>{if(fd!==ownedFd)return originals.closeSync(fd);closes++;originals.closeSync(fd);throw closeError})]
    try{f.storage.lock(id)}catch(error){caught=true;failure=error}finally{for(const mock of mocks.reverse())mock.mock.restore()}
    assert.equal(caught,true);assert.equal(closes,1);assert(failure instanceof AggregateError)
    assert.deepEqual(failure.errors,[first,closeError]);assert.equal(failure.cause,first)
    assert(failure.message.includes(primitive?'null':first.message));assert(failure.message.includes(closeError.message))
    assert(fs.existsSync(f.file),'failed initialization evidence must remain')
  })
}
for(const mode of ['success','close','stat','unlink','replacement']) {
  test(`backup lock release is single-attempt and preserves ${mode} outcome`,t=>{
    const f=fixture(t),originals={openSync:fs.openSync,closeSync:fs.closeSync,lstatSync:fs.lstatSync,unlinkSync:fs.unlinkSync}
    let ownedFd,closes=0,stats=0,unlinks=0
    const openMock=t.mock.method(fs,'openSync',(file,...args)=>{const fd=originals.openSync(file,...args);if(file===f.file)ownedFd=fd;return fd})
    let release
    try{release=f.storage.lock(id)}finally{openMock.mock.restore()}
    if(mode==='replacement'){fs.renameSync(f.file,path.join(f.root,'retained-original.lock'));fs.writeFileSync(f.file,'other owner',{flag:'wx'})}
    const problem=new Error('fixture release '+mode),mocks=[
      t.mock.method(fs,'closeSync',fd=>{if(fd!==ownedFd)return originals.closeSync(fd);closes++;originals.closeSync(fd);if(mode==='close')throw problem}),
      t.mock.method(fs,'lstatSync',(file,...args)=>{if(file===f.file){stats++;if(mode==='stat')throw problem}return originals.lstatSync(file,...args)}),
      t.mock.method(fs,'unlinkSync',file=>{if(file===f.file){unlinks++;if(mode==='unlink')throw problem}return originals.unlinkSync(file)})]
    const attempts=[]
    try{
      for(let i=0;i<2;i++){try{release();attempts.push({ok:true})}catch(error){attempts.push({ok:false,error})}}
    }finally{for(const mock of mocks.reverse())mock.mock.restore()}
    assert.equal(closes,1,'never close a descriptor twice, including after failure')
    assert.equal(stats,mode==='close'?0:1)
    assert.equal(unlinks,['success','unlink'].includes(mode)?1:0)
    if(mode==='success'){assert.deepEqual(attempts,[{ok:true},{ok:true}]);assert(!fs.existsSync(f.file));fs.writeFileSync(f.file,'later owner',{flag:'wx'});release();assert.equal(fs.readFileSync(f.file,'utf8'),'later owner')}
    else{assert.equal(attempts[0].ok,false);assert.equal(attempts[1].ok,false);assert.equal(attempts[1].error,attempts[0].error);if(mode!=='replacement')assert.equal(attempts[0].error,problem);assert(fs.existsSync(f.file));if(mode==='replacement')assert.equal(fs.readFileSync(f.file,'utf8'),'other owner')}
  })
}

import {runInNewContext} from 'node:vm'
import * as serviceContracts from '../../src/server/local-backup/contracts.mjs'

for(const scenario of ['success','release','operation-error','operation-null','operation-undefined','both-error','both-null','both-undefined','handled','handled-release']) {
  test(`backup service preserves escaped operation and release errors: ${scenario}`,async()=>{
    const handled=scenario.startsWith('handled'),operationFails=scenario.startsWith('operation')||scenario.startsWith('both'),releaseFails=scenario==='release'||scenario==='handled-release'||scenario.startsWith('both')
    const operationError=scenario.endsWith('null')?null:scenario.endsWith('undefined')?undefined:new Error('fixture escaped operation'),releaseError=new Error('fixture release')
    const events=[],release=()=>{events.push('release');if(releaseFails)throw releaseError}
    let requests=0
    const storage={request(){events.push('request');if(++requests===1||handled)return null;if(operationFails)throw operationError;return{backupId:'fixture-backup'}},lock(){events.push('lock');return release},observed(){events.push('observe');return{terminal:{state:'failed'}}},metadataRevision:()=>0,begin:()=>{},event:()=>{},project:()=>{},terminal(){if(handled)return{value:{state:'failed'}};throw Error('unexpected terminal read')}}
    const globals={...serviceContracts,Error,AggregateError,fs,path,performance,randomUUID:()=> 'fixture-uuid',parseBackupRequest:x=>x,validateBackupConfiguration:()=>{},createBackupStorage:()=>storage,directoryIdentity:()=>{},verifyDirectory:()=>{},executeBackup:()=>{if(handled){events.push('simulated-copy-failure');throw Error('handled fixture failure')}events.push('external-operation');throw Error('must not execute backup')},backupFailureCode:()=> 'fixture-failed'}
    const source=fs.readFileSync(new URL('../../src/server/local-backup/backup-service.mjs',import.meta.url),'utf8')
    const factory=runInNewContext(source.replace(/^import .+\r?$/gmu,'').replace(/export (async )?function /gu,'$1function ')+`;createBackupService`,globals)
    let result,caught=false,failure
    try{result=await factory({moduleRoot:'fixture',store:{},configuration:{coverageGaps:[]}}).run({scopeId:'fixture',expectedModuleRevision:0})}catch(error){caught=true;failure=error}
    assert.equal(events.filter(x=>x==='release').length,1)
    assert.equal(caught,operationFails||releaseFails)
    if(operationFails&&releaseFails){assert(failure instanceof AggregateError);assert.deepEqual(failure.errors,[operationError,releaseError]);assert.equal(failure.cause,operationError);assert(failure.message.includes(String(operationError instanceof Error?operationError.message:operationError)));assert(failure.message.includes(releaseError.message))}
    else if(caught)assert.equal(failure,operationFails?operationError:releaseError)
    else{assert.equal(result.replayed,!handled);assert.equal(result.dataStatus,'partial');if(handled)assert.equal(result.terminal.state,'failed')}
    assert.equal(events.includes('external-operation'),false)
  })
}
