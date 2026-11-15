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

for(const phase of ['writeFileSync', 'fstatSync'])for(const primitive of [false,true]) {
  test(`git lock preserves ${phase} plus close failure (${primitive?'null':'Error'})`,t=>{
    const f=fixture(t),originals={openSync:fs.openSync,closeSync:fs.closeSync,[phase]:fs[phase]}
    const first=primitive?null:new Error('fixture initialization failed'),closeError=new Error('fixture close failed')
    let ownedFd,closes=0,caught=false,failure
    const mocks=[t.mock.method(fs,'openSync',(file,...args)=>{const fd=originals.openSync(file,...args);if(file===f.file)ownedFd=fd;return fd}),
      t.mock.method(fs,phase,(fd,...args)=>{if(fd===ownedFd)throw first;return originals[phase](fd,...args)}),
      t.mock.method(fs,'closeSync',fd=>{if(fd!==ownedFd)return originals.closeSync(fd);closes++;originals.closeSync(fd);throw closeError})]
    try{f.storage.lock()}catch(error){caught=true;failure=error}finally{for(const mock of mocks.reverse())mock.mock.restore()}
    assert.equal(caught,true);assert.equal(closes,1);assert(failure instanceof AggregateError)
    assert.deepEqual(failure.errors,[first,closeError]);assert.equal(failure.cause,first)
    assert(failure.message.includes(primitive?'null':first.message));assert(failure.message.includes(closeError.message))
    assert(fs.existsSync(f.file),'failed initialization evidence must remain')
  })
}
for(const mode of ['success','close','stat','unlink','replacement']) {
  test(`git lock release is single-attempt and preserves ${mode} outcome`,t=>{
    const f=fixture(t),originals={openSync:fs.openSync,closeSync:fs.closeSync,lstatSync:fs.lstatSync,unlinkSync:fs.unlinkSync}
    let ownedFd,closes=0,stats=0,unlinks=0
    const openMock=t.mock.method(fs,'openSync',(file,...args)=>{const fd=originals.openSync(file,...args);if(file===f.file)ownedFd=fd;return fd})
    let release
    try{release=f.storage.lock()}finally{openMock.mock.restore()}
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
  test(`git service preserves escaped operation and release errors: ${scenario}`,async()=>{
    const handled=scenario.startsWith('handled'),operationFails=scenario.startsWith('operation')||scenario.startsWith('both'),releaseFails=scenario==='release'||scenario==='handled-release'||scenario.startsWith('both')
    const operationError=scenario.endsWith('null')?null:scenario.endsWith('undefined')?undefined:new Error('fixture escaped operation'),releaseError=new Error('fixture release')
    const events=[],release=()=>{events.push('release');if(releaseFails)throw releaseError}
    const input={previewId:'a'.repeat(64),expectedRevision:1,idempotencyKey:'fixture-service-release',message:'fixture only'},requestSha256=serviceContracts.hash(input)
    let reads=0
    const store={read(kind){events.push('read:'+kind);if(kind==='previews')return{revision:1,selected:[],repository:{}};if(++reads===1)return null;if(operationFails||handled)throw Error('fixture error while checking operation');return{requestSha256,status:'succeeded',push:{status:'succeeded'},commit:{status:'verified'}}},lock(){events.push('lock');return release},put(){events.push('record-failure');if(!handled)throw operationError}}
    const globals={...serviceContracts,Error,AggregateError,performance,createGitStore:()=>store,createRepository:()=>{events.push('external-operation');throw Error('must not create repository')},guardClosure:()=>[],prepareGuard:()=>{throw Error('must not prepare push')}}
    const source=fs.readFileSync(new URL('../../src/server/local-backup/git-service.mjs',import.meta.url),'utf8')
    const factory=runInNewContext(source.replace(/^import .+\r?$/gmu,'').replace(/export (async )?function /gu,'$1function ')+`;createGitService`,globals)
    let result,caught=false,failure
    try{result=factory('fixture-project','fixture-state').publish(input)}catch(error){caught=true;failure=error}
    assert.equal(events.filter(x=>x==='release').length,1)
    assert.equal(caught,operationFails||releaseFails)
    if(operationFails&&releaseFails){assert(failure instanceof AggregateError);assert.deepEqual(failure.errors,[operationError,releaseError]);assert.equal(failure.cause,operationError);assert(failure.message.includes(String(operationError instanceof Error?operationError.message:operationError)));assert(failure.message.includes(releaseError.message))}
    else if(caught)assert.equal(failure,operationFails?operationError:releaseError)
    else{assert.equal(result.replayed,!handled);assert.equal(result.dataStatus,'connected');if(handled)assert.equal(result.operation.status,'failed')}
    assert.equal(events.includes('external-operation'),false)
  })
}


import ts from 'typescript'

for(const scenario of ['stable','executable','file-replaced','device-replaced','mtime-changed','ctime-changed']) {
  test(`git capture exact identity: ${scenario}`,t=>{
    const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'git-capture-identity-'))
    const file='README.md',absolute=path.join(root,file),bytes=Buffer.from('private candidate content\n')
    fs.writeFileSync(absolute,bytes,{flag:'wx'});t.diagnostic(`retained private fixture: ${root}`)
    const sourcePath='src/server/local-backup/git-repository.mjs',source=fs.readFileSync(sourcePath,'utf8')
    const sf=ts.createSourceFile(sourcePath,source,ts.ScriptTarget.Latest,true);let fn
    function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='capture')fn=node;ts.forEachChild(node,visit)}
    visit(sf);assert(fn,'execute the actual nested capture function')
    let read=false;const commands=[]
    const facade={existsSync:fs.existsSync,lstatSync(target,options){
      if(target!==absolute)return fs.lstatSync(target,options)
      const stat=fs.lstatSync(target,options),big=options?.bigint===true,encode=v=>big?v:Number(v)
      stat.ino=encode(9007199254740992n+(read&&scenario==='file-replaced'?1n:0n))
      stat.dev=encode(9007199254740992n+(read&&scenario==='device-replaced'?1n:0n))
      stat.mode=encode(scenario==='executable'?0o100755n:0o100644n)
      if(big){stat.mtimeNs=1700000000000000000n+(read&&scenario==='mtime-changed'?1n:0n);stat.ctimeNs=1700000000000000000n+(read&&scenario==='ctime-changed'?1n:0n)}
      else{stat.mtimeMs=1700000000000;stat.ctimeMs=1700000000000}
      return stat
    },readFileSync(target){assert.equal(target,absolute);read=true;return fs.readFileSync(target)}}
    const capture=runInNewContext(fn.getText(sf)+';capture',{
      fs:facade,path,...serviceContracts,allowedPath:value=>value===file,oid:/^[a-f0-9]{40}$/,
      git(args){commands.push(args);if(args[0]==='ls-tree')return{stdout:Buffer.from('100644 blob '+'a'.repeat(40)+'\tREADME.md\0')};if(args[0]==='check-attr')return{stdout:Buffer.from('README.md\0filter\0unspecified\0README.md\0working-tree-encoding\0unspecified\0')};throw Error('unexpected external operation')},
      textWithInput(args,input){assert.equal(args[0],'hash-object');assert.deepEqual(input,bytes);commands.push(args);return 'b'.repeat(40)},
    })
    if(['stable','executable'].includes(scenario)){
      const result=capture(file,{root,head:'c'.repeat(40),coreFilemode:true})
      assert.equal(result.workingSha256,serviceContracts.hash(bytes));assert.equal(result.sizeBytes,bytes.length)
      assert.equal(result.mode,scenario==='executable'?'100755':'100644');assert.equal(result.newFile,false)
      assert.equal(typeof result.mtimeMs,'number');assert.equal(typeof result.ctimeMs,'number');assert.doesNotThrow(()=>JSON.stringify(result))
      assert.deepEqual(commands.map(v=>v[0]),['ls-tree','check-attr','hash-object'])
    }else{
      assert.throws(()=>capture(file,{root,head:'c'.repeat(40),coreFilemode:true}),error=>error.message==='git_file_changed')
      assert.deepEqual(commands.map(v=>v[0]),['ls-tree'],'reject replacement before attribute or blob processing')
    }
    assert.deepEqual(fs.readFileSync(absolute),bytes)
  })
}


import {createHash} from 'node:crypto'

function guardReadFixture(t,target,scenario) {
  const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'git-guard-read-'))
  const node=path.join(root,'private-node'),caller=path.join(root,'scripts/lib/local-backup/git-pre-push'),validator=caller+'.mjs'
  fs.mkdirSync(path.dirname(caller),{recursive:true})
  for(const file of [node,caller,validator])fs.writeFileSync(file,Buffer.from('private guard fixture '+path.basename(file)),{flag:'wx'})
  const selected=target==='node'?node:target==='caller'?caller:validator,original=fs.readFileSync(selected),fds=new Map()
  let read=false,closes=0,opens=0
  const primary=scenario==='both-null'?null:scenario==='both-undefined'?undefined:new Error('private read failure'),cleanup=new Error('private close failure')
  const stat=(file,options,descriptor=false)=>{
    const s=fs.lstatSync(file,options);if(file!==selected)return s
    const big=options?.bigint===true,number=v=>big?v:Number(v)
    s.ino=number(9007199254740992n+((read&&scenario==='file-replaced')||(descriptor&&scenario==='opened-replaced')?1n:0n))
    s.dev=number(9007199254740992n+(read&&scenario==='device-replaced'?1n:0n))
    if(big){s.mtimeNs=1700000000000000000n+(read&&scenario==='mtime-changed'?1n:0n);s.ctimeNs=1700000000000000000n+(read&&scenario==='ctime-changed'?1n:0n)}
    else{s.mtimeMs=1700000000000;s.ctimeMs=1700000000000}
    return s
  }
  const facade={...fs,realpathSync:{native:file=>{assert.equal(file,node);return node}},
    lstatSync:(file,options)=>stat(file,options),
    openSync(file,...args){const fd=fs.openSync(file,...args);fds.set(fd,file);if(file===selected)opens++;return fd},
    fstatSync(fd,options){assert(fds.has(fd));return stat(fds.get(fd),options,true)},
    readSync(fd,...args){if(fds.get(fd)===selected){read=true;if(scenario==='read'||scenario.startsWith('both-'))throw primary;if(scenario==='short-read')return 0}return fs.readSync(fd,...args)},
    readFileSync(file,...args){if(file===selected){read=true;if(scenario==='read'||scenario.startsWith('both-'))throw primary;if(scenario==='short-read')return Buffer.alloc(0)}return fs.readFileSync(file,...args)},
    closeSync(fd){const file=fds.get(fd);assert(file);fs.closeSync(fd);fds.delete(fd);if(file===selected){closes++;if(scenario==='close'||scenario.startsWith('both-'))throw cleanup}},
  }
  const safeFile=(file,max)=>{const s=facade.lstatSync(file);serviceContracts.need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=max,'store_file_boundary',409);return s}
  const checkDirectory=directory=>{assert(!path.relative(root,directory).startsWith('..'));assert(fs.lstatSync(directory).isDirectory())}
  const source=fs.readFileSync('src/server/local-backup/git-trusted-guard.mjs','utf8')
  const api=runInNewContext(source.replace(/^import .+\r?$/gmu,'').replace(/export function /gu,'function ')+';({guardClosure,prepareGuard})',{
    fs:facade,path,createHash,...serviceContracts,safeFile,checkDirectory,process:{cwd:()=>root,execPath:node},Buffer,Error,AggregateError,
  })
  t.after(()=>{for(const fd of fds.keys())fs.closeSync(fd);assert.deepEqual(fs.readFileSync(selected),original)})
  t.diagnostic(`retained private fixture: ${root}`)
  return{...api,root,node,caller,validator,primary,cleanup,openCount:()=>opens,closeCount:()=>closes,remaining:()=>fds.size}
}

for(const target of ['node','caller','validator'])for(const scenario of ['stable','opened-replaced','file-replaced','device-replaced','mtime-changed','ctime-changed','short-read','read','close','both-error','both-null','both-undefined']) {
  test(`git guard verified read ${target}/${scenario}`,t=>{
    const f=guardReadFixture(t,target,scenario);let caught=false,error,result
    try{result=f.guardClosure()}catch(e){caught=true;error=e}
    if(scenario==='stable'){
      assert.equal(caught,false)
      for(const [key,file]of [['interpreter',f.node],['caller',f.caller],['validator',f.validator]]){assert.equal(result[key+'Path'],file);assert.equal(result[key+'Sha256'],serviceContracts.hash(fs.readFileSync(file)))}
      assert.doesNotThrow(()=>JSON.stringify(result))
    }else{
      assert.equal(caught,true,'changed/incomplete files and failed close cannot produce a trusted closure')
      if(scenario.startsWith('both-')){assert(error instanceof AggregateError);assert.deepEqual(error.errors,[f.primary,f.cleanup]);assert.equal(error.cause,f.primary)}
      else if(scenario==='read')assert.equal(error,f.primary)
      else if(scenario==='close')assert.equal(error,f.cleanup)
      else assert.match(error.message,/git_guard_(node|source)_changed/)
    }
    assert.equal(f.remaining(),0);assert.equal(f.openCount(),1);assert.equal(f.closeCount(),1)
  })
}


for(const scenario of ['stable','source-changed','copy-changed'])test(`git guard private hook preparation ${scenario}`,t=>{
  const f=guardReadFixture(t,'node','stable'),expected=f.guardClosure(),stateRoot=path.join(f.root,'state')
  fs.mkdirSync(stateRoot)
  if(scenario==='source-changed'){
    fs.appendFileSync(f.caller,'changed after preview')
    assert.throws(()=>f.prepareGuard(stateRoot,expected,'a'.repeat(40),'fixture'),/git_guard_source_changed/)
    assert.equal(fs.existsSync(path.join(stateRoot,'hooks')),false)
  }else{
    const first=f.prepareGuard(stateRoot,expected,'a'.repeat(40),'fixture',{root:f.root,targetUrl:'https://example.invalid/private'})
    assert.equal(first.environment.AI_PET_WORLD_GIT_GUARD_NODE,f.node)
    assert.equal(first.environment.AI_PET_WORLD_GIT_GUARD_REF,'refs/heads/fixture')
    assert.equal(serviceContracts.hash(fs.readFileSync(path.join(first.directory,'pre-push'))),expected.callerSha256)
    assert.equal(serviceContracts.hash(fs.readFileSync(path.join(first.directory,'validator.mjs'))),expected.validatorSha256)
    if(scenario==='copy-changed'){
      const copy=path.join(first.directory,'pre-push');fs.writeFileSync(copy,'tampered private copy')
      assert.throws(()=>f.prepareGuard(stateRoot,expected,'a'.repeat(40),'fixture'),/git_guard_copy_changed/)
      assert.equal(fs.readFileSync(copy,'utf8'),'tampered private copy','never overwrite the failed copy')
    }
  }
  assert.equal(f.remaining(),0)
})
