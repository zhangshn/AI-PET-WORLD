import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { backupFixture, targetRuns, completeMarkers, fileHashes } from './helpers/local-backup-adapter-fixture.mjs'
import { createBackupService, runBackupAndRecord } from '../../src/server/local-backup/backup-service.mjs'
import { hash } from '../../src/server/local-backup/contracts.mjs'
import { validateBackupConfiguration, safeRelative } from '../../src/server/local-backup/backup-contract.mjs'

test('configuration containment uses path components: ..named children are inside, adjacent roots are outside',()=>{
 const f=backupFixture(),config=structuredClone(f.configuration)
 config.target.path=path.join(f.source,'..nested');assert.throws(()=>validateBackupConfiguration(config),/backup_target_inside_source/)
 config.target.path=f.target;config.sources[0].path=path.join(f.target,'..nested');assert.throws(()=>validateBackupConfiguration(config),/backup_source_inside_target/)
 config.sources[0].path=f.source;assert.equal(validateBackupConfiguration(config),config)
 config.target.path=f.source;assert.throws(()=>validateBackupConfiguration(config),/backup_target_inside_source/)
 for(const relative of ['.git/config.','.. /outside','CON','folder/one.txt ','dir\\one.txt'])assert.throws(()=>safeRelative(relative),/backup_path_invalid/)
})

test('uninstalled configuration and malformed requests cannot create runs or change metadata',async()=>{
 const f=backupFixture(),service=createBackupService({moduleRoot:f.moduleRoot,store:f.store,configuration:null}),before=fileHashes(f.moduleRoot)
 await assert.rejects(service.run(f.input()),/production_backup_adapter_not_connected/)
 await assert.rejects(service.run({...f.input(),target:'arbitrary'}),/invalid_fields/)
 assert.deepEqual(fileHashes(f.moduleRoot),before);assert.deepEqual(targetRuns(f),[])
 f.configuration.limits.concurrency=2;await assert.rejects(f.service.run(f.input()),/backup_concurrency_unsupported/)
})
test('declared small scope copies and verifies every entry, omits protected bodies/hashes and creates the exclusive completion marker last',async()=>{
 let f,beforeMarker=false
 const secret='private protected fixture value 123456789',entries=[{rootId:'fixture',relativePath:'one.txt',capture:'file'},{rootId:'fixture',relativePath:'.env',capture:'protected'}]
 f=backupFixture({entries,contents:{'one.txt':'public scoped data','.env':secret},hooks:{beforeComplete:()=>{const run=path.join(f.target,targetRuns(f)[0]);beforeMarker=fs.existsSync(path.join(run,'manifest.json'))&&completeMarkers(run).length===0}}})
 const input=f.input(),result=await f.service.run(input),run=path.join(f.target,result.backupId),manifest=JSON.parse(fs.readFileSync(path.join(run,'manifest.json')))
 assert.equal(result.terminal.state,'completed');assert.equal(result.terminal.coverage,'partial');assert.equal(result.terminal.verificationStatus,'verified');assert.equal(result.terminal.restorabilityStatus,'unknown');assert(beforeMarker)
 assert.equal(completeMarkers(run).length,1);assert.equal(completeMarkers(run)[0],'completed-'+hash(fs.readFileSync(path.join(run,'manifest.json'))));assert.equal(manifest.entries.length,1);assert.equal(manifest.protectedEntryCount,1)
 assert(manifest.entries[0].snapshotIdentity.ino);assert(manifest.entries[0].targetIdentity.ino);assert(manifest.entries[0].capturedAtUtc.endsWith('Z'));assert(manifest.entries[0].verifiedAtUtc.endsWith('Z'))
 const publicBytes=JSON.stringify([manifest,result.terminal,f.store.entries(result.backupId,new URLSearchParams()).records]);assert(!publicBytes.includes(secret));assert(!publicBytes.includes(hash(secret)));assert(!publicBytes.includes('.env'))
 assert.equal(f.store.runs(new URLSearchParams()).total,1);assert.equal(f.store.entries(result.backupId,new URLSearchParams()).total,1)
 const before=fileHashes(f.target),repeat=await f.service.run({...input});assert.equal(repeat.replayed,true);assert.deepEqual(fileHashes(f.target),before)
 await assert.rejects(f.service.run({...input,expectedModuleRevision:input.expectedModuleRevision+1}),/backup_idempotency_conflict/)
})
test('same request in flight only observes it; another key cannot acquire the single-task lock',async()=>{
 let reached,release;const entered=new Promise(resolve=>{reached=resolve}),gate=new Promise(resolve=>{release=resolve})
 const f=backupFixture({hooks:{afterPreflight:async()=>{reached();await gate}}}),input=f.input(),running=f.service.run(input);await entered
 const same=await f.service.run(input);assert.equal(same.replayed,true);assert.equal(same.record.state,'unknown')
 await assert.rejects(f.service.run({...input,idempotencyKey:'other'}),/backup_task_lock_present/)
 release();const done=await running;assert.equal(done.terminal.state,'completed');assert.equal(targetRuns(f).length,1)
})
test('a stale module revision refuses before allocating a Run and leaves user evidence intact',async()=>{
 const f=backupFixture(),input=f.input();f.store.saveJournal({date:'2026-10-22',completedText:'private prior work',planText:'',backupId:null,expectedRevision:0})
 await assert.rejects(f.service.run(input),/backup_module_revision_conflict/);assert.equal(f.store.runs(new URLSearchParams()).total,0);assert.deepEqual(targetRuns(f),[])
})
test('source change during bounded capture fails before transfer and preserves local incomplete staging',async()=>{
 let f,changed=false;f=backupFixture({contents:{'one.txt':Buffer.alloc(16384,65)},hooks:{duringCapture:()=>{if(!changed){changed=true;fs.appendFileSync(path.join(f.source,'one.txt'),'changed')}}}})
 const result=await f.service.run(f.input());assert.equal(result.terminal.state,'failed');assert.equal(result.terminal.failureCode,'backup_source_changed');assert.deepEqual(targetRuns(f),[]);assert(fs.existsSync(path.join(f.moduleRoot,'staging',result.backupId)))
})
test('replaced target root is refused; retained old target and replacement content are not overwritten',async()=>{
 let f;f=backupFixture({hooks:{beforeTransfer:()=>{assert.equal(path.dirname(f.target),f.root);fs.renameSync(f.target,path.join(f.root,'retained-target'));fs.mkdirSync(f.target);fs.writeFileSync(path.join(f.target,'replacement.txt'),'keep')}}})
 const result=await f.service.run(f.input());assert.equal(result.terminal.state,'failed');assert.equal(result.terminal.failureCode,'backup_directory_identity_changed');assert.equal(fs.readFileSync(path.join(f.target,'replacement.txt'),'utf8'),'keep');assert.equal(completeMarkers(path.join(f.root,'retained-target',result.backupId)).length,0)
})
test('child junctions and hardlinked source files are refused without following or copying them',async()=>{
 const f=backupFixture({entries:[{rootId:'fixture',relativePath:'jump/one.txt',capture:'file'}],contents:{}}),outside=path.join(f.root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'one.txt'),'outside private content');fs.symlinkSync(outside,path.join(f.source,'jump'),'junction')
 assert.equal((await f.service.run(f.input())).terminal.state,'failed');assert.deepEqual(targetRuns(f),[])
 const g=backupFixture();fs.linkSync(path.join(g.source,'one.txt'),path.join(g.source,'second.txt'));assert.equal((await g.service.run(g.input())).terminal.failureCode,'backup_file_boundary');assert.deepEqual(targetRuns(g),[])
})
test('existing destination is retained; no old file is overwritten to reuse a backupId',async()=>{
 let f;f=backupFixture({hooks:{afterPreflight:()=>{const id=fs.readdirSync(path.join(f.moduleRoot,'runs')).find(name=>name.startsWith('backup-'));fs.mkdirSync(path.join(f.target,id));fs.writeFileSync(path.join(f.target,id,'keep.txt'),'old')}}})
 const result=await f.service.run(f.input());assert.equal(result.terminal.failureCode,'backup_destination_exists');assert.equal(fs.readFileSync(path.join(f.target,result.backupId,'keep.txt'),'utf8'),'old');assert.equal(completeMarkers(path.join(f.target,result.backupId)).length,0)
})
test('transport failure and cancellation retain partial target files and never create completion markers',async()=>{
 const f=backupFixture({contents:{'one.txt':Buffer.alloc(16384,65)},hooks:{duringTransfer:()=>{throw Error('simulated transport loss')}}}),result=await f.service.run(f.input())
 assert.equal(result.terminal.state,'failed');assert.equal(result.terminal.failureCode,'backup_transport_or_io_failure');assert.equal(completeMarkers(path.join(f.target,result.backupId)).length,0);assert(fs.statSync(path.join(f.target,result.backupId,'files','0.snapshot')).size>0)
 const signal=new AbortController(),g=backupFixture({hooks:{beforeTransfer:()=>signal.abort()}}),stopped=await g.service.run(g.input(),{signal:signal.signal});assert.equal(stopped.terminal.state,'interrupted');assert.equal(completeMarkers(path.join(g.target,stopped.backupId)).length,0)
})
test('SQLite uses online backup including committed WAL rows, checks the copy and leaves source main/WAL bytes unchanged',async()=>{
 const f=backupFixture({entries:[{rootId:'fixture',relativePath:'live.sqlite',capture:'sqlite'}],contents:{}}),file=path.join(f.source,'live.sqlite'),writer=new DatabaseSync(file)
 try{writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE examples(value TEXT); INSERT INTO examples VALUES (\'committed WAL fixture\');');const before=hash(fs.readFileSync(file)),walBefore=hash(fs.readFileSync(file+'-wal')),result=await f.service.run(f.input());assert.equal(result.terminal.state,'completed')
 const copied=new DatabaseSync(path.join(f.target,result.backupId,'files','0.snapshot'),{readOnly:true});try{assert.equal(copied.prepare('SELECT value FROM examples').get().value,'committed WAL fixture');assert.equal(copied.prepare('PRAGMA integrity_check').get().integrity_check,'ok')}finally{copied.close()}
 assert.equal(hash(fs.readFileSync(file)),before);assert.equal(hash(fs.readFileSync(file+'-wal')),walBefore);const manifest=JSON.parse(fs.readFileSync(path.join(f.target,result.backupId,'manifest.json')));assert.equal(manifest.entries[0].source.sha256,null);assert.equal(manifest.entries[0].source.hashStatus,'active_sqlite_raw_hash_unavailable')
 }finally{writer.close()}
})
test('SQLite header cannot be disguised by a normal filename or declared stable-file mode',async()=>{
 const f=backupFixture({contents:{}}),database=new DatabaseSync(path.join(f.source,'one.txt'));database.exec('CREATE TABLE example(value);');database.close()
 const result=await f.service.run(f.input());assert.equal(result.terminal.failureCode,'backup_sqlite_capture_required');assert.deepEqual(targetRuns(f),[])
})
test('insufficient free space and changed installation marker refuse without a complete result',async()=>{
 const f=backupFixture({limits:{minFreeBytes:Number.MAX_SAFE_INTEGER}}),result=await f.service.run(f.input());assert.equal(result.terminal.failureCode,'backup_free_space_limit');assert.deepEqual(targetRuns(f),[])
 const g=backupFixture();fs.writeFileSync(path.join(g.target,'.ai-pet-world-backup-installation.json'),'replaced');assert.equal((await g.service.run(g.input())).terminal.failureCode,'backup_installation_identity_changed')
})
test('copy and Manifest tampering are detected before the final marker',async()=>{
 let f;f=backupFixture({hooks:{beforeVerify:()=>fs.writeFileSync(path.join(f.target,targetRuns(f)[0],'files','0.snapshot'),'corrupt')}});const result=await f.service.run(f.input());assert.equal(result.terminal.failureCode,'backup_destination_hash_conflict');assert.equal(completeMarkers(path.join(f.target,result.backupId)).length,0)
 let g;g=backupFixture({hooks:{beforeComplete:()=>fs.writeFileSync(path.join(g.target,targetRuns(g)[0],'manifest.json'),'corrupt')}});const other=await g.service.run(g.input());assert.equal(other.terminal.failureCode,'backup_manifest_hash_conflict');assert.equal(completeMarkers(path.join(g.target,other.backupId)).length,0)
})
test('recognized secret content fails before remote transfer and its digest never enters the terminal or public index',async()=>{
 const secret='ghp_'+Array(30).fill('A').join(''),f=backupFixture({contents:{'one.txt':secret}}),result=await f.service.run(f.input())
 assert.equal(result.terminal.failureCode,'backup_protected_content_not_connected');assert.deepEqual(targetRuns(f),[]);assert(!JSON.stringify(result).includes(secret));assert(!JSON.stringify(result).includes(hash(secret)))
})
test('a killed private process leaves unknown observed state and its lock; replay does not resume copying',async()=>{
 const f=backupFixture({contents:{'one.txt':Buffer.alloc(16384,65)}}),input=f.input(),configurationFile=path.join(f.root,'private-input.json');fs.writeFileSync(configurationFile,JSON.stringify({configuration:f.configuration,moduleRoot:f.moduleRoot,root:f.root,input}))
 const serviceUrl=pathToFileURL(path.resolve('src/server/local-backup/backup-service.mjs')).href,storeUrl=pathToFileURL(path.resolve('src/server/local-backup/store.mjs')).href
 const code=`import fs from 'node:fs';import {createBackupService} from ${JSON.stringify(serviceUrl)};import {createStore} from ${JSON.stringify(storeUrl)};const v=JSON.parse(fs.readFileSync(process.argv[1]));await createBackupService({moduleRoot:v.moduleRoot,store:createStore(v.moduleRoot),configuration:v.configuration,privateFixtureRoot:v.root,hooks:{duringTransfer:()=>process.exit(17)}}).run(v.input);`
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,configurationFile],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:8192});assert.equal(child.status,17)
 const before=fileHashes(f.target),replay=await f.make().run(input);assert.equal(replay.replayed,true);assert.equal(replay.record.state,'unknown');assert(fs.existsSync(path.join(f.moduleRoot,'backup-publish.lock')));assert.deepEqual(fileHashes(f.target),before);assert.equal(completeMarkers(path.join(f.target,replay.backupId)).length,0)
})
test('a work-ledger failure cannot undo the durable terminal or repeat successful copying',async()=>{
 const f=backupFixture(),input=f.input();let supplied
 const result=await runBackupAndRecord(f.service,input,async binding=>{supplied=binding;throw Error('private ledger unavailable')})
 assert.equal(result.terminal.state,'completed');assert.equal(result.workRecording.recorded,false);assert.equal(supplied.sha256,hash(fs.readFileSync(path.join(f.moduleRoot,'runs',result.backupId,'terminal.json'))))
 const before=fileHashes(f.target);await runBackupAndRecord(f.service,input,async()=>({recorded:true}));assert.deepEqual(fileHashes(f.target),before)
})
test('SQLite progress cancellation stays bounded and records interruption in an isolated private process',()=>{
 const f=backupFixture({entries:[{rootId:'fixture',relativePath:'live.sqlite',capture:'sqlite'}],contents:{},limits:{maxFileBytes:4*1024*1024,maxTotalBytes:8*1024*1024}}),database=new DatabaseSync(path.join(f.source,'live.sqlite'))
 database.exec('CREATE TABLE values_blob(value BLOB); WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<300) INSERT INTO values_blob SELECT zeroblob(4096) FROM numbers;');database.close()
 const input=f.input(),configurationFile=path.join(f.root,'progress-input.json');fs.writeFileSync(configurationFile,JSON.stringify({configuration:f.configuration,moduleRoot:f.moduleRoot,root:f.root,input}))
 const serviceUrl=pathToFileURL(path.resolve('src/server/local-backup/backup-service.mjs')).href,storeUrl=pathToFileURL(path.resolve('src/server/local-backup/store.mjs')).href
 const code=`import fs from 'node:fs';import {createBackupService} from ${JSON.stringify(serviceUrl)};import {createStore} from ${JSON.stringify(storeUrl)};const v=JSON.parse(fs.readFileSync(process.argv[1])),controller=new AbortController();const result=await createBackupService({moduleRoot:v.moduleRoot,store:createStore(v.moduleRoot),configuration:v.configuration,privateFixtureRoot:v.root,hooks:{beforeCapture:()=>setTimeout(()=>controller.abort(),1)}}).run(v.input,{signal:controller.signal});console.log(JSON.stringify({state:result.terminal.state,failureCode:result.terminal.failureCode}));`
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,configurationFile],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:8192});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{state:'interrupted',failureCode:'backup_interrupted'});assert.deepEqual(targetRuns(f),[])
})
