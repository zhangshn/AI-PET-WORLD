import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {backupFixture,fileHashes,completeMarkers} from './helpers/local-backup-adapter-fixture.mjs'
import {runBackupAndRecord} from '../../src/server/local-backup/backup-service.mjs'
import {createBackupStorage} from '../../src/server/local-backup/backup-storage.mjs'
import {hash} from '../../src/server/local-backup/contracts.mjs'

async function localWriteFault(phase,withRecorder=false) {
 const f=backupFixture(),input=f.input(),originalOpen=fs.openSync;let attempts=0,injected=false,callbacks=0,binding
 fs.openSync=function(file,flags,...args){if(typeof file==='string'&&file.startsWith(path.join(f.moduleRoot,'runs')+path.sep)&&path.basename(file)===phase+'.json'&&flags==='wx'){attempts++;if(!injected){injected=true;throw Object.assign(Error('private one-shot write fault'),{code:'EIO'})}}return originalOpen.call(fs,file,flags,...args)}
 let result
 try{result=withRecorder?await runBackupAndRecord(f.service,input,async value=>{callbacks++;binding=value;return{recorded:true}}):await f.service.run(input)}finally{fs.openSync=originalOpen}
 assert(injected);assert.equal(attempts,1,'a failed local persistence step must not be retried')
 const target=path.join(f.target,result.backupId),manifest=fs.readFileSync(path.join(target,'manifest.json'))
 assert.equal(result.terminal.state,'completed');assert.equal(result.terminal.verificationStatus,'verified');assert.equal(result.terminal.manifestSha256,hash(manifest));assert.equal(result.terminal.completionMarker,completeMarkers(target)[0]);assert.equal(result.terminal.failureCode,`backup_local_${phase}_persistence_failed`)
 assert(!result.terminal.coverageGaps.includes('backup_scope_incomplete'));assert.equal(result.record.state,'completed');assert.equal(result.record.verification_status,'verified')
 const before=fileHashes(f.target),replay=await f.make().run(input);assert.equal(replay.replayed,true);assert.equal(replay.terminal.manifestSha256,result.terminal.manifestSha256);assert.equal(replay.terminal.completionMarker,result.terminal.completionMarker);assert.equal(replay.terminal.failureCode,result.terminal.failureCode);assert.deepEqual(fileHashes(f.target),before)
 const projection=f.make().observed(result.backupId);assert.equal(projection.record.state,'completed');assert.equal(projection.record.failure_code,result.terminal.failureCode)
 return{f,result,callbacks,binding}
}
test('local Manifest EIO preserves completed copy facts, records the exact local failure and never retries the write or copy',async()=>{
 const {f,result}=await localWriteFault('manifest')
 assert.equal(result.terminalRecorded,true);assert(!fs.existsSync(path.join(f.moduleRoot,'runs',result.backupId,'manifest.json')))
 const terminal=JSON.parse(fs.readFileSync(path.join(f.moduleRoot,'runs',result.backupId,'terminal.json')));assert.equal(terminal.state,'completed');assert.equal(terminal.failureCode,'backup_local_manifest_persistence_failed')
})
test('first terminal EIO preserves completed identity in immutable events and replay without fabricating a canonical terminal',async()=>{
 const {f,result}=await localWriteFault('terminal')
 assert.equal(result.terminalRecorded,false);assert(!fs.existsSync(path.join(f.moduleRoot,'runs',result.backupId,'terminal.json')));assert.equal(f.service.terminalBinding(result.backupId),null)
})
test('projection failure remains separate from the existing immutable completed terminal and needs no automatic projection retry',async()=>{
 let f,fail=false,writes=0;f=backupFixture({hooks:{beforeComplete:()=>{fail=true}}});const originalWrite=f.store.write
 f.store.write=function(fn){if(fail){fail=false;writes++;throw Object.assign(Error('private projection EIO'),{code:'EIO'})}return originalWrite(fn)}
 const input=f.input(),result=await f.service.run(input),terminalPath=path.join(f.moduleRoot,'runs',result.backupId,'terminal.json'),original=fs.readFileSync(terminalPath)
 assert.equal(writes,1);assert.equal(result.terminal.state,'completed');assert.equal(result.terminal.failureCode,'backup_local_projection_persistence_failed');assert.equal(result.record.state,'completed');assert.equal(result.record.verification_status,'verified');assert.equal(f.store.run(result.backupId).state,'verifying')
 assert.equal(JSON.parse(original).failureCode,null,'terminal bytes predate and must not be overwritten by projection failure')
 const before=fileHashes(f.target),replay=await f.make().run(input);assert.equal(replay.terminal.state,'completed');assert.equal(replay.terminal.failureCode,'backup_local_projection_persistence_failed');assert.equal(writes,1);assert.deepEqual(fs.readFileSync(terminalPath),original);assert.deepEqual(fileHashes(f.target),before)
})
test('the fixed recorder may receive a durable completed terminal with Manifest persistence failure, but never a missing terminal',async()=>{
 const first=await localWriteFault('manifest',true);assert.equal(first.callbacks,1);assert.equal(first.result.workRecording.recorded,true);assert.equal(first.binding.sha256,hash(fs.readFileSync(path.join(first.f.moduleRoot,'runs',first.result.backupId,'terminal.json'))))
 const second=await localWriteFault('terminal',true);assert.equal(second.callbacks,0);assert.equal(second.result.workRecording.recorded,false);assert.equal(second.result.workRecording.reasonCode,'backup_terminal_not_recorded')
})
test('earlier failed terminal evidence remains failed and byte-identical; new completion projection does not reinterpret it',async()=>{
 const f=backupFixture(),input=f.input(),id='backup-33333333-3333-3333-3333-333333333333',storage=createBackupStorage(f.moduleRoot,f.store),startedAtUtc=new Date().toISOString()
 storage.begin(input,id,hash(f.configuration),startedAtUtc)
 storage.finish({schemaVersion:'local_backup_run_terminal_v1',backupId:id,state:'failed',startedAtUtc,finishedAtUtc:startedAtUtc,elapsedMs:0,coverage:'partial',verificationStatus:'unknown',restorabilityStatus:'unknown',failureCode:'backup_transport_or_io_failure',coverageGaps:['backup_scope_incomplete']})
 const file=path.join(f.moduleRoot,'runs',id,'terminal.json'),before=fs.readFileSync(file),result=await f.service.run(input)
 assert.equal(result.replayed,true);assert.equal(result.terminal.state,'failed');assert.equal(result.terminal.failureCode,'backup_transport_or_io_failure');assert.deepEqual(fs.readFileSync(file),before);assert.equal(fs.readdirSync(f.target).filter(name=>name.startsWith('backup-')).length,0)
})
test('absent, damaged or wrong-request/configuration completion evidence stays unknown and never reconstructs from target directories',async()=>{
 for(const variant of ['absent','damaged','wrong-request','wrong-configuration','wrong-start','wrong-failure-code']){
  const {f,result}=await localWriteFault('terminal'),events=path.join(f.moduleRoot,'runs',result.backupId,'events'),input=f.input()
  input.expectedModuleRevision=0
  // Only this case's private synthetic evidence is altered. No original QA or
  // production record is changed, deleted or used as a source for reconstruction.
  for(const sequence of ['0005.json','0006.json']){
   const file=path.join(events,sequence),value=JSON.parse(fs.readFileSync(file))
   if(variant==='absent')fs.renameSync(file,file+'.retained')
   else if(variant==='damaged')fs.writeFileSync(file,'incomplete synthetic json')
   else{if(variant==='wrong-request')value.requestSha256='a'.repeat(64);if(variant==='wrong-configuration')value.configurationSha256='b'.repeat(64);if(variant==='wrong-start')value.startedAtUtc='2020-01-01T00:00:00Z';if(variant==='wrong-failure-code'&&sequence==='0006.json')value.failureCode='backup_local_unregistered_stage';fs.writeFileSync(file,JSON.stringify(value))}
  }
  const before=fileHashes(f.target),replay=await f.make().run(input);assert.equal(replay.replayed,true);assert.equal(replay.record.state,'unknown',variant);assert.equal(replay.record.verification_status,'unknown',variant);assert.equal(replay.terminal,null,variant);assert.deepEqual(fileHashes(f.target),before)
 }
})
