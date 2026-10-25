import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDocumentReader } from '../../src/server/local-backup/document-reader.mjs'
import { documentRegistration } from '../../src/server/local-backup/document-catalog.mjs'
import { queryDocuments } from '../../src/server/local-backup/document-query.mjs'
import { createDiagramQuery, safeDiagramSource, extractDiagrams } from '../../src/server/local-backup/diagram-extract.mjs'
import { workRecordPage, workRecordDetail } from '../../src/server/local-backup/work-query.mjs'
import { createWorkLedger } from '../../src/server/local-backup/work-ledger.mjs'
import { backupFixture } from './helpers/local-backup-adapter-fixture.mjs'

const fixture=()=>{const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-docs-')));fs.mkdirSync(path.join(root,'docs'));const entry={documentId:'test-doc',relativePath:'docs/test.md',category:'project',historical:false,restricted:false};fs.writeFileSync(path.join(root,'docs/test.md'),'# 测试文档\n文档版本：`v1`\n状态：active\n程序符合状态：pending\n\n## 章节\n正文');return{root,entry,reader:createDocumentReader(root,[entry])}}
const reject=(fn,code,status)=>assert.throws(fn,e=>e.message===code&&(status===undefined||e.status===status))

test('fixed registration covers README, AGENTS and all repository docs without HTTP discovery or dictionary body reads',()=>{
 let actual=['README.md','AGENTS.md'];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.md'))actual.push(p.replaceAll('\\','/'))}}walk('docs');assert.deepEqual(documentRegistration.map(e=>e.relativePath).sort(),actual.sort());assert.equal(documentRegistration.length,55)
 const original=fs.readdirSync;fs.readdirSync=()=>{throw Error('HTTP must not enumerate')};try{const p=queryDocuments(createDocumentReader(),new URLSearchParams({limit:'50'}));assert.equal(p.registeredCount,55);assert(p.nextCursor);assert(p.records.every(d=>d.sha256===null));assert(p.records.some(d=>d.historical));}finally{fs.readdirSync=original}
})
test('metadata reads at most 8KiB, restricted item has null full SHA and no read call',()=>{
 const f=fixture();fs.writeFileSync(path.join(f.root,'docs/test.md'),'x'.repeat(20000));const read=fs.readSync,calls=[];fs.readSync=(...args)=>{calls.push(args[3]);return read(...args)};try{assert.equal(f.reader.metadata(f.entry).bytes,20000);assert.deepEqual(calls,[8192]);calls.length=0;const reader=createDocumentReader(f.root,[{...f.entry,restricted:true}]);const m=reader.metadata({...f.entry,restricted:true});assert.equal(m.sha256,null);assert.equal(m.availability,'restricted');assert.equal(calls.length,0);reject(()=>reader.body('test-doc'),'document_body_restricted',403)}finally{fs.readSync=read}
})
test('body binds full bytes and metadata revision, rejects stale revision and unknown/path identifiers',()=>{
 const f=fixture(),meta=f.reader.metadata(f.entry),doc=f.reader.body('test-doc',meta.metadataRevision);assert.equal(doc.bytes,Buffer.byteLength(doc.content));assert.match(doc.sha256,/^[a-f0-9]{64}$/);assert.equal(doc.version,'v1');assert.equal(doc.programAdoptionStatus,'pending');fs.appendFileSync(path.join(f.root,'docs/test.md'),' changed');reject(()=>f.reader.body('test-doc',meta.metadataRevision),'document_revision_conflict',409);reject(()=>f.reader.body('../.env'),'document_id_invalid',400);reject(()=>f.reader.body('unknown'),'document_not_found',404)
})
test('oversized, non-Markdown, missing and invalid UTF8 files fail explicitly before unbounded read',()=>{
 const f=fixture();fs.writeFileSync(path.join(f.root,'docs/test.md'),Buffer.alloc(512*1024+1));reject(()=>f.reader.body('test-doc'),'document_size_limit',413);fs.writeFileSync(path.join(f.root,'docs/test.md'),Buffer.from([0xff,0xfe,0xff]));reject(()=>f.reader.body('test-doc'),'document_encoding_invalid',409);reject(()=>createDocumentReader(f.root,[{...f.entry,relativePath:'src/server/source.ts'}]).body('test-doc'),'document_registration_invalid',409);reject(()=>createDocumentReader(f.root,[{...f.entry,relativePath:'docs/missing.md'}]).body('test-doc'),'document_file_missing',503)
})
test('directory junctions and hardlinks cannot expose out-of-root bytes',()=>{
 const f=fixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-outside-'));fs.writeFileSync(path.join(outside,'body.md'),'private must never return');fs.symlinkSync(outside,path.join(f.root,'docs/linked'),'junction');reject(()=>createDocumentReader(f.root,[{...f.entry,relativePath:'docs/linked/body.md'}]).body('test-doc'),'document_link_or_type_rejected',409);fs.linkSync(path.join(outside,'body.md'),path.join(f.root,'docs/hard.md'));reject(()=>createDocumentReader(f.root,[{...f.entry,relativePath:'docs/hard.md'}]).body('test-doc'),'document_link_or_type_rejected',409)
})
test('native file symlink is rejected when host permits creation',t=>{const f=fixture(),target=path.join(f.root,'docs/test.md'),link=path.join(f.root,'docs/symlink.md');try{fs.symlinkSync(target,link,'file')}catch(e){if(e.code==='EPERM')return t.skip('Windows denies native file symlink creation; original EPERM evidence retained');throw e}reject(()=>createDocumentReader(f.root,[{...f.entry,relativePath:'docs/symlink.md'}]).body('test-doc'),'document_link_or_type_rejected',409)})
test('file symlink metadata guard rejects before reading (deterministic injected metadata)',()=>{const f=fixture(),native=fs.lstatSync;fs.lstatSync=(p,...args)=>{const stat=native(p,...args);return String(p).endsWith('test.md')?Object.assign(Object.create(stat),{isSymbolicLink:()=>true}):stat};try{reject(()=>f.reader.body('test-doc'),'document_link_or_type_rejected',409)}finally{fs.lstatSync=native}})
test('concurrent replacement during read is rejected and never returned as original document',()=>{
 const f=fixture(),native=fs.readSync;let changed=false;fs.readSync=(...args)=>{const n=native(...args);if(!changed){changed=true;fs.appendFileSync(path.join(f.root,'docs/test.md'),' replacement')}return n};try{reject(()=>f.reader.body('test-doc'),'document_revision_conflict',409)}finally{fs.readSync=native}
})
test('catalog pagination binds filter/revision and rejects arbitrary queries, duplicates, limits',()=>{
 const reader=createDocumentReader(),p=queryDocuments(reader,new URLSearchParams({limit:'2'}));assert.equal(p.records.length,2);const next=queryDocuments(reader,new URLSearchParams({limit:'2',cursor:p.nextCursor}));assert(next.previousCursor);const back=queryDocuments(reader,new URLSearchParams({limit:'2',cursor:next.previousCursor}));assert.deepEqual(back.records,p.records);reject(()=>queryDocuments(reader,new URLSearchParams({limit:'2',cursor:p.nextCursor,status:'current'})),'cursor_revision_conflict',409);for(const s of ['path=.env','q=a&q=b','limit=51'])assert.throws(()=>queryDocuments(reader,new URLSearchParams(s)))
})
test('five Mermaid designs and existing text diagrams keep exact source SHA/line and stale IDs reject',()=>{
 const query=createDiagramQuery(createDocumentReader()),p=query.list(new URLSearchParams({limit:'50'}));assert.equal(p.records.filter(d=>d.type==='mermaid').length,6);assert(p.records.some(d=>d.type==='text'));assert(!p.records.some(d=>Object.hasOwn(d,'source')));const d=p.records.find(d=>d.type==='mermaid'),detail=query.detail(d.diagramId);assert.equal(detail.sourceDocumentSha256,d.sourceDocumentSha256);assert(detail.source.startsWith('flowchart'));const wrong=d.diagramId.replace(d.sourceDocumentSha256,'0'.repeat(64));reject(()=>query.detail(wrong),'diagram_source_revision_conflict',409);reject(()=>query.detail('../secret'),'diagram_id_invalid',400)
})
test('diagram config, directives, callbacks, HTML, resource URLs, oversized source and count are rejected',()=>{
 for(const extra of ['%%{init:{}}%%','click A "https://evil"','A["<script>x</script>"]','A["https://evil"]','style A fill:url(http://evil)','A["data:image/svg+xml,x"]'])reject(()=>safeDiagramSource('flowchart TD\n'+extra),'diagram_unsafe_source',409)
 reject(()=>safeDiagramSource('x'.repeat(65537)),'diagram_size_limit',413)
 reject(()=>extractDiagrams({relativePath:'docs/ARCHITECTURE.md',documentId:'a',sha256:'a'.repeat(64),content:Array.from({length:65},()=> '```text\na -> b\n```').join('\n')}),'diagram_count_limit',413)
})
test('work summary strips report/evidence and keeps real cursor/claims; exact details retain old and full fields',()=>{
 const f=backupFixture(),producer={id:'private',sourceCategory:'local_program'},ledger=createWorkLedger(f.store,[producer]);for(let i=0;i<3;i++)ledger.append(producer,{eventId:'event-'+i,producerSequence:i+1,moduleId:'local-backup',taskId:'task',runId:null,eventKind:'progress_report',executionResult:'unknown',validationStatus:'unknown',acceptanceStatus:'unknown',evidenceReferences:[],originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,originalEventAtUtc:'2026-10-21T23:00:00Z',planReference:null,title:'event '+i})
 const page=workRecordPage(ledger,new URLSearchParams({date:'2026-10-22',limit:'1'}));assert.equal(page.records.length,1);assert.equal(page.records[0].hasWorkReport,false);assert(!Object.hasOwn(page.records[0],'workReport'));assert(!Object.hasOwn(page.records[0],'evidenceReferences'));const next=workRecordPage(ledger,new URLSearchParams({date:'2026-10-22',limit:'1',cursor:page.nextCursor}));assert(next.previousCursor);assert.equal(workRecordDetail(ledger,'event-0').record.monotonicElapsedMs,null);reject(()=>workRecordDetail(ledger,'unknown'),'work_event_not_found',404);const original=f.store.inventory();assert(original)
})
