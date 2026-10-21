import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import ts from 'typescript'
import { initializeStore, createStore } from '../../src/server/local-backup/store.mjs'
import { createWorkLedger } from '../../src/server/local-backup/work-ledger.mjs'
import { dateKey, pageQuery, hash } from '../../src/server/local-backup/contracts.mjs'
import { copyPrivateSnapshot } from '../lib/local-backup/fixture-adapter.mjs'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-'))
const cleanups=[]
const inventory={schemaVersion:'local_backup_inventory_v1',observedAtUtc:'2026-10-21T17:50:15.192Z',coverageComplete:false,totalBytes:null,totalFiles:null,categoriesOverlap:true}
let seq=0
function fixture(){const parent=path.join(temporary,`case-${++seq}`);fs.mkdirSync(parent);const root=path.join(parent,'module');initializeStore(root,inventory);return {parent,root,store:createStore(root)}}
function journal(extra={}) {return {date:'2026-10-22',completedText:'人工备注，不是机器验收',planText:'下一步核对',backupId:null,expectedRevision:0,...extra}}
function sqlite(root,operation){const db=new DatabaseSync(path.join(root,'module.sqlite'));try{return operation(db)}finally{db.close()}}
function fileSnapshot(root){const found=[];for(const d of ['','inventory'])for(const n of fs.readdirSync(path.join(root,d))){const f=path.join(root,d,n);if(fs.statSync(f).isFile())found.push([`${d}/${n}`,hash(fs.readFileSync(f))])}return found}
test('GET-shaped reads never initialize missing store or alter existing files',()=>{
 const root=path.join(temporary,'does-not-exist');assert.throws(()=>createStore(root).inventory(),/not_initialized/);assert.equal(fs.existsSync(root),false)
 const f=fixture(),before=fileSnapshot(f.root);assert.equal(f.store.inventory().totalBytes,null);assert.equal(f.store.journal('2026-10-22'),null);assert.deepEqual(f.store.runs(new URLSearchParams()).records,[]);assert.deepEqual(fileSnapshot(f.root),before)
})
test('journal real transaction, revisions, empty note and lost-update protection',()=>{
 const f=fixture();const first=f.store.saveJournal(journal());assert.equal(first.revision,1);assert.equal(first.sourceCategory,'human');assert.equal(f.store.journal(first.date).completedText,journal().completedText)
 assert.throws(()=>f.store.saveJournal(journal()),/revision_conflict/)
 const second=f.store.saveJournal(journal({expectedRevision:1,completedText:'',planText:'<script>not HTML</script>'}));assert.equal(second.revision,2)
 const revisions=sqlite(f.root,db=>db.prepare('SELECT revision,completed_text FROM daily_record_revisions ORDER BY revision').all());assert.deepEqual(revisions.map(x=>x.revision),[1,2]);assert.equal(revisions[0].completed_text,journal().completedText)
 assert.throws(()=>f.store.saveJournal(journal({expectedRevision:2,backupId:'absent'})),/association_missing/);assert.equal(f.store.journal(first.date).revision,2)
})
test('strict date, fields, limit, typed revision, backup ID and text limits',()=>{
 const f=fixture();for(const date of ['2026-02-30','2026-00-00','x','2026-10-22T00:00:00Z'])assert.throws(()=>dateKey(date),/invalid_date/)
 for(const extra of [{expectedRevision:'0'},{completedText:'x'.repeat(16001)},{backupId:'../escape'},{date:'2026-13-01'},{actor:'local_program'}])assert.throws(()=>f.store.saveJournal(journal(extra)))
 for(const q of ['limit=51','limit=0','limit=2&limit=3','path=C:/','cursor=!!!'])assert.throws(()=>f.store.runs(new URLSearchParams(q)))
 const first=pageQuery(new URLSearchParams(),[],2,'same');const cursor=first.next(20);assert.equal(pageQuery(new URLSearchParams({cursor}),[],2,'same').offset,20);assert.throws(()=>pageQuery(new URLSearchParams({cursor}),[],3,'same'),/revision_conflict/);assert.throws(()=>pageQuery(new URLSearchParams({cursor}),[],2,'different'),/revision_conflict/)
})
test('corrupt inventory/journal, symlink store and outstanding recovery fail closed',()=>{
 const f=fixture();fs.appendFileSync(path.join(f.root,'inventory/initial-v1.json'),' ');assert.throws(()=>f.store.inventory(),/hash_conflict/)
 const j=fixture();j.store.saveJournal(journal());sqlite(j.root,db=>db.exec("UPDATE daily_records SET completed_text='tampered'"));assert.throws(()=>j.store.journal('2026-10-22'),/integrity_conflict/)
 const k=fixture();fs.writeFileSync(path.join(k.root,'module.sqlite-journal'),'unfinished');assert.throws(()=>k.store.journal('2026-10-22'),/recovery_required/)
 const l=fixture(),alias=path.join(l.parent,'alias');fs.symlinkSync(l.root,alias,process.platform==='win32'?'junction':'dir');assert.throws(()=>createStore(alias).journal('2026-10-22'),/root_boundary/)
})
function event(extra={}){return {eventId:'evt-1',producerSequence:1,moduleId:'module-9',taskId:'test-task',runId:'test-run',eventKind:'execution_finished',executionResult:'succeeded',validationStatus:'unknown',acceptanceStatus:'unknown',evidenceReferences:[],originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,originalEventAtUtc:'2026-10-21T16:00:00Z',planReference:null,...extra}}
test('no connected production work producer means unknown, never fabricated zero',()=>{
 const f=fixture(),ledger=createWorkLedger(f.store);assert.equal(ledger.summary(new URLSearchParams()).dataStatus,'not_connected');assert.equal(ledger.summary(new URLSearchParams()).records,null);assert.equal(ledger.summary(new URLSearchParams()).total,null);assert.throws(()=>ledger.append({sourceCategory:'local_program'},event()),/not_registered/)
})
test('event provenance, evidence, idempotency, Beijing late arrival and separate metrics',()=>{
 const f=fixture(),evidence=path.join(f.parent,'actual-test-result.json');fs.writeFileSync(evidence,JSON.stringify({testResult:'passed',fixture:true}));const ref={logicalPath:'actual-test-result.json',sha256:hash(fs.readFileSync(evidence))}
 const producer={id:'fixture-program',sourceCategory:'local_program',canAccept:true,verifyEvidence:e=>e.logicalPath===ref.logicalPath&&hash(fs.readFileSync(evidence))===e.sha256,verifyPlan:p=>p.authorityPath==='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'&&p.documentSha256===hash('fixture-plan')}
 const codex={id:'fixture-codex',sourceCategory:'codex',canAccept:false,verifyEvidence:()=>false},ledger=createWorkLedger(f.store,[producer,codex])
 ledger.append(producer,event());assert.equal(ledger.append(producer,event()).replayed,true);assert.throws(()=>ledger.append(producer,event({executionResult:'failed'})),/idempotency_conflict/)
 ledger.append(producer,event({eventId:'evt-2',producerSequence:2,eventKind:'validation_finished',validationStatus:'passed',evidenceReferences:[ref]}))
 ledger.append(producer,event({eventId:'evt-3',producerSequence:3,eventKind:'acceptance_finished',acceptanceStatus:'accepted',evidenceReferences:[ref]}))
 ledger.append(producer,event({eventId:'evt-4',producerSequence:4,taskId:'failed-task',executionResult:'failed'}))
 ledger.append(producer,event({eventId:'evt-5',producerSequence:5,taskId:'blocked-task',eventKind:'blocked',executionResult:'blocked',originalEventAtUtc:'2026-10-21T15:59:59Z'}))
 ledger.append(codex,event({eventId:'codex-1',producerSequence:1,taskId:'claimed-task'}))
 assert.throws(()=>ledger.append(codex,event({eventId:'codex-2',producerSequence:2,acceptanceStatus:'accepted',eventKind:'acceptance_finished'})),/not_machine_validation/)
 assert.throws(()=>ledger.append(producer,{...event(),sourceCategory:'local_program'}),/invalid_fields/)
 assert.throws(()=>ledger.append(producer,event({eventId:'bad-evidence',producerSequence:7,validationStatus:'passed',evidenceReferences:[{...ref,sha256:'a'.repeat(64)}]})),/evidence_unverified/)
 const groups=ledger.summary(new URLSearchParams({date:'2026-10-22'})).records;assert.equal(groups.length,1);assert.equal(groups[0].executionEnded,2);assert.equal(groups[0].validationPassed,1);assert.equal(groups[0].acceptanceCompleted,1);assert.equal(groups[0].failed,1);assert.equal(groups[0].attributedClaims,1)
 assert.equal(ledger.summary(new URLSearchParams({date:'2026-10-21'})).records[0].blocked,1)
 assert.equal(ledger.events(new URLSearchParams({date:'2026-10-22',limit:'1'})).records[0].monotonicElapsedMs,null)
 ledger.append(producer,event({eventId:'unknown-time',producerSequence:8,taskId:'unknown-time',originalEventAtUtc:null}));assert.equal(ledger.summary(new URLSearchParams()).records.find(x=>x.date===null).executionEnded,1)
})
function backupFixture(){const root=path.join(temporary,`copy-${++seq}`);fs.mkdirSync(root);fs.writeFileSync(path.join(root,'.local-backup-private-fixture'),'private fixture only');for(const child of ['source','target'])fs.mkdirSync(path.join(root,child));fs.writeFileSync(path.join(root,'source/sample.txt'),'actual fixture bytes');return root}
test('private independent copy manifest readback and no existing destination overwrite',async()=>{
 const root=backupFixture(),manifest=await copyPrivateSnapshot(root,'run-1');assert.equal(manifest.productionBackup,false);assert.equal(manifest.restorabilityStatus,'unknown');assert.equal(fs.readFileSync(path.join(root,'target/run-1/files/sample.txt'),'utf8'),'actual fixture bytes');assert(fs.existsSync(path.join(root,'target/run-1/completed.json')))
 await assert.rejects(copyPrivateSnapshot(root,'run-1'),/destination_exists/);await assert.rejects(copyPrivateSnapshot(root,'../escape'),/invalid_identity/)
})
test('source mutation, secret, hardlink/reparse and transport interruption leave no complete marker',async()=>{
 const a=backupFixture();await assert.rejects(copyPrivateSnapshot(a,'changed',{afterRead:()=>fs.appendFileSync(path.join(a,'source/sample.txt'),'change')}),/source_changed/);assert(!fs.existsSync(path.join(a,'target/changed/completed.json')))
 const b=backupFixture();fs.writeFileSync(path.join(b,'source/.env.local'),'not-a-real-secret');await assert.rejects(copyPrivateSnapshot(b,'secret'),/protected_configuration/)
 const c=backupFixture();fs.mkdirSync(path.join(c,'outside'));fs.symlinkSync(path.join(c,'outside'),path.join(c,'source/redirect'),process.platform==='win32'?'junction':'dir');await assert.rejects(copyPrivateSnapshot(c,'link'),/link_refused/)
 const d=backupFixture();fs.linkSync(path.join(d,'source/sample.txt'),path.join(d,'source/alias'));await assert.rejects(copyPrivateSnapshot(d,'hardlink'),/file_boundary/)
 const e=backupFixture();await assert.rejects(copyPrivateSnapshot(e,'interrupted',{beforeCommit:()=>{throw new Error('simulated network loss')}}),/transport_or_io/);assert(fs.existsSync(path.join(e,'target/interrupted/failed.json')));assert(!fs.existsSync(path.join(e,'target/interrupted/completed.json')))
})
test('SQLite committed WAL content survives online backup, global recovery still unknown',async()=>{
 const root=backupFixture(),db=new DatabaseSync(path.join(root,'source/fixture.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE actual(value TEXT); INSERT INTO actual VALUES (\'committed WAL content\')')
 try{const manifest=await copyPrivateSnapshot(root,'sqlite');const copy=new DatabaseSync(path.join(root,'target/sqlite/files/fixture.sqlite'),{readOnly:true});try{assert.equal(copy.prepare('SELECT value FROM actual').get().value,'committed WAL content');assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok')}finally{copy.close()};assert.equal(manifest.globalSnapshotConsistency,'unknown');assert(manifest.entries.some(x=>x.captureMode==='sqlite_online_backup'))}finally{db.close()}
})
test('destination corruption and missing private scope never qualify a complete copy',async()=>{
 const root=backupFixture();await assert.rejects(copyPrivateSnapshot(root,'corrupt',{beforeVerify:rel=>fs.writeFileSync(path.join(root,'target/corrupt/files',rel),'corrupted')}),/hash_conflict/);assert(!fs.existsSync(path.join(root,'target/corrupt/completed.json')))
 const other=backupFixture();fs.writeFileSync(path.join(other,'.local-backup-private-fixture'),'not the scope marker');await assert.rejects(copyPrivateSnapshot(other,'wrong-scope'),/marker_required/);assert.equal(fs.existsSync(path.join(other,'target/wrong-scope')),false)
})
test('backup list and manifest entries paginate against a stable store revision',()=>{
 const f=fixture();f.store.write(db=>{for(let i=1;i<=3;i++){const id=`fixture-${i}`;db.prepare('INSERT INTO backup_runs VALUES (?,?,?,?,?,?,?,?,?)').run(id,'completed',null,null,null,'fixture_only','verified','unknown',null);db.prepare('INSERT INTO backup_entries VALUES (?,?,?,?,?)').run(id,'fixture','one.txt',3,'verified')}})
 const one=f.store.runs(new URLSearchParams({limit:'1'})),two=f.store.runs(new URLSearchParams({limit:'1',cursor:one.nextCursor}));assert.equal(one.total,3);assert.notEqual(one.records[0].backup_id,two.records[0].backup_id);assert.equal(f.store.entries('fixture-1',new URLSearchParams()).total,1)
 assert.throws(()=>f.store.entries('absent',new URLSearchParams()),/not_found/)
 f.store.saveJournal(journal());assert.throws(()=>f.store.runs(new URLSearchParams({cursor:one.nextCursor})),/revision_conflict/)
})

// Load actual TS routes/authentication without changing the live service or global configuration.
const require=createRequire(import.meta.url),cache=new Map()
function compile(file){const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute);const exports={};cache.set(absolute,exports);const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','exports',code)(name=>{
 if(name.startsWith('@/'))return load(path.join(process.cwd(),'src',name.slice(2)))
 if(name.startsWith('.'))return load(path.resolve(path.dirname(absolute),name))
 return require(name)
},exports);return exports}
function load(file){if(file.endsWith('.mjs'))return require(file);return compile(`${file.endsWith('.ts')?file:`${file}.ts`}`)}
const service=compile('src/server/local-backup/service.ts'),auth=compile('src/server/ai-console-control/operator-session.ts')
const routes={journal:compile('src/app/api/local-backup/journal/route.ts'),runs:compile('src/app/api/local-backup/runs/route.ts'),summary:compile('src/app/api/local-backup/summary/route.ts'),events:compile('src/app/api/local-backup/work-events/route.ts')}
function req(url,options={}){return new Request(`http://localhost:3000${url}`,{...options,headers:{host:'localhost:3000',...options.headers}})}
test('real API authentication, no generic machine event POST, size and hostile origin/host',async()=>{
 const f=fixture();service.store=()=>f.store;const before=fileSnapshot(f.root)
 assert.equal((await routes.summary.GET(req('/api/local-backup/summary'))).status,200);assert.deepEqual(fileSnapshot(f.root),before)
 assert.equal((await routes.journal.GET(req('/api/local-backup/journal?date=2026-10-22'))).status,200)
 assert.equal((await routes.journal.GET(req('/api/local-backup/journal?date=bad'))).status,400)
 assert.equal((await routes.summary.GET(req('/api/local-backup/summary?path=secret'))).status,400)
 assert.equal(routes.events.POST,undefined)
 service.ledger=()=>createWorkLedger(f.store)
 assert.equal((await routes.events.GET(req('/api/local-backup/work-events'))).status,503)
 assert.equal((await routes.journal.PUT(req('/api/local-backup/journal',{method:'PUT',body:JSON.stringify(journal()),headers:{'content-type':'application/json'}}))).status,403)
 const session=auth.issueLocalOperatorSession(req('/api/ai-console/control/session'));assert(session.ok)
 const headers={'content-type':'application/json',origin:'http://localhost:3000',cookie:session.setCookie.split(';')[0],'x-ai-console-csrf':session.session.csrfToken}
 const put=(input,extra={})=>routes.journal.PUT(req('/api/local-backup/journal',{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(input)}))
 const saved=await put(journal());assert.equal(saved.status,200);assert.equal((await saved.json()).record.revision,1);assert.equal((await put(journal())).status,409)
 assert.equal((await put(journal(),{origin:'http://example.com'})).status,403);assert.equal((await put(journal(),{host:'example.com'})).status,403);assert.equal((await put(journal(),{'x-forwarded-host':'example.com'})).status,403);assert.equal((await put(journal(),{'x-ai-console-csrf':'bad'})).status,403)
 assert.equal((await put(journal({completedText:'x'.repeat(66000)}))).status,413)
 const denied=await routes.runs.POST(req('/api/local-backup/runs',{method:'POST',headers,body:JSON.stringify({scopeId:'project-associated-roots-v1',idempotencyKey:'test',expectedModuleRevision:0})}));assert.equal(denied.status,503);assert.equal((await denied.json()).reasonCode,'production_backup_adapter_not_connected');assert.equal(f.store.runs(new URLSearchParams()).total,0)
 assert.equal((await routes.summary.GET(req('/api/local-backup/summary',{headers:{host:'example.com'}}))).status,403)
})
test.after(()=>{
 // All fixtures are created by this test under one verified OS temporary directory.
 const resolved=fs.realpathSync(temporary),parent=fs.realpathSync(os.tmpdir());assert(path.dirname(resolved).toLowerCase()===parent.toLowerCase()&&path.basename(resolved).startsWith('local-backup-'))
 // Preserve private evidence until the parent process exits; no cleanup of project/runtime data.
 cleanups.push(resolved)
})
