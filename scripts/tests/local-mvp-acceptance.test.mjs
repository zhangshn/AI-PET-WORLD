import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {initializeStore,createStore} from '../../src/server/local-backup/store.mjs'
import {createWorkProducersForIsolatedTests} from '../../src/server/local-backup/work-producers.mjs'
import {createWorkLedger} from '../../src/server/local-backup/work-ledger.mjs'
import {LEGACY_MVP,MVP_SCOPE,MVP_PRODUCER,MVP_INDEX,factIdentity,factHash,validateMvpFact,verifyFrozenMvpBindings} from '../../src/server/local-backup/mvp-acceptance-contracts.mjs'
import {reduceMvpFacts} from '../../src/server/local-backup/mvp-acceptance-reducer.mjs'
import {createMvpAcceptanceVerifier} from '../../src/server/local-backup/mvp-acceptance-verifier.mjs'
import {progressFixture} from './local-backup-project-progress.test.mjs'
import {applyMvpAcceptance} from '../../src/server/local-backup/project-progress-mvp.mjs'
export function acceptanceFixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-work-'))
 fs.writeFileSync(path.join(root,'.local-work-private-fixture'),'local-work-test-only')
 for(const file of ['docs/LOCAL_BACKUP_AND_WORK_LEDGER_SPEC.md','docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md',...LEGACY_MVP.map(s=>s.path)]){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest)}
 const moduleRoot=path.join(root,'.runtime/local-backup');initializeStore(moduleRoot,{schemaVersion:'local_backup_inventory_v1',observedAtUtc:new Date().toISOString(),coverageComplete:false,totalBytes:null,totalFiles:null,categoriesOverlap:true})
 const store=createStore(moduleRoot),make=()=>createWorkProducersForIsolatedTests({projectRoot:root,store}),ctx=make(),file=p=>path.join(root,p)
 const read=(logical,expected)=>{const bytes=fs.readFileSync(file(logical)),sha256=factHash(bytes.toString('utf8'));if(expected)assert.equal(sha256,expected);return {logicalPath:logical,sha256,bytes,value:JSON.parse(bytes)}}
 const verifier=createMvpAcceptanceVerifier({projectRoot:root,read})
 return {root,moduleRoot,store,ctx,make,file,verifier,base:()=>progressFixture().read().projection.mvp,mvp:()=>applyMvpAcceptance(progressFixture().read().projection.mvp,ctx.readMvpAcceptance())}
}
export function changedFact(original,{outcome=original.outcome,revision=original.origin.revision,key=original.origin.sourceKey,predecessor=null,worldId=original.applicability.worldId,decisionClass=original.decisionClass}={}){
 const f=structuredClone(original);f.outcome=outcome;f.origin.revision=revision;f.origin.sourceKey=key;f.predecessor=predecessor;f.applicability.worldId=worldId;f.decisionClass=decisionClass;f.origin.sourceCategory=decisionClass==='legacy_external_component'?'codex':'local_program';f.reasonCode=outcome==='revoked'?'verified_revocation':'isolated_verified_fact';f.factId=factIdentity(f);return validateMvpFact(f)
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
test('real frozen reports import exactly3 compatible checkpoints plus historical refusal; machine acceptance remains unknown',()=>{
 const f=acceptanceFixture();assert.equal(f.ctx.readMvpAcceptance().dataStatus,'not_connected');const r=f.ctx.consumeMvpAcceptance();assert.equal(r.recorded,true,JSON.stringify(r));const rows=f.ctx.ledger.mvpFacts().events;assert.equal(rows.length,4)
 for(const e of rows){assert.equal(e.sourceCategory,'local_program');assert.equal(e.eventKind,'progress_report');assert.equal(e.validationStatus,'unknown');assert.equal(e.acceptanceStatus,'unknown');assert.equal(e.acceptanceFact.origin.sourceCategory,'codex');assert.equal(e.producerId,MVP_PRODUCER)}
 const m=f.mvp();assert.equal(m.completed,3);assert.equal(m.knownAcceptanceRatio,6.3);assert.equal(m.denominator,48);assert.equal(m.legacyCompleted,3);assert.equal(m.productionCompleted,0);assert.equal(m.acceptance.dataStatus,'partial')
 assert.equal(m.groups[1].completed,0);assert.equal(m.groups[2].completed,0);assert(m.groups.filter(g=>g.id.startsWith('WORLD')).every(g=>g.completed===0))
 assert(f.ctx.ledger.summary(new URLSearchParams({limit:'50'})).records.every(r=>r.acceptanceCompleted===0))
})
test('duplicate notifications and fresh process contexts are idempotent and retain original immutable event bytes',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const before=f.ctx.ledger.mvpFacts();const next=f.make();next.consumeMvpAcceptance();assert.deepEqual(next.ledger.mvpFacts().events,before.events);assert.equal(next.ledger.mvpFacts().moduleRevision,before.moduleRevision)
})
test('ordinary producer cannot carry acceptanceFact or gain a verifier capability by a passed boolean',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const event=f.ctx.ledger.mvpFacts().events[0],{receivedAtUtc,producerId,sourceCategory,workDateAsiaShanghai,eventSchemaVersion,planReferenceResolution,producerSequence,...input}=event;void receivedAtUtc;void producerId;void sourceCategory;void workDateAsiaShanghai;void eventSchemaVersion;void planReferenceResolution;void producerSequence
 const ordinary={id:'ordinary-program',sourceCategory:'local_program',canAccept:true,verifyEvidence:()=>true,verifyPlan:()=>true};const ledger=createWorkLedger(f.store,[ordinary]);assert.throws(()=>ledger.appendProduced(ordinary,input),/mvp_acceptance_producer_required/)
})
test('Codex fixed entrance refuses injected structured acceptance and keeps its provenance',async()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const e=f.ctx.ledger.mvpFacts().events[0],input={eventId:'codex-injection',moduleId:'local-backup',taskId:'private-task',runId:null,eventKind:'execution_finished',executionResult:'unknown',workReport:e.workReport,attributedClaims:{validationStatus:'unknown',acceptanceStatus:'unknown'},evidenceReferences:e.evidenceReferences,originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,originalEventAtUtc:null,planReference:e.planReference,acceptanceFact:e.acceptanceFact}
 const r=await f.ctx.recordCodex(input,'codex-backup');assert.equal(r.recorded,false);assert.equal(r.reasonCode,'invalid_fields');assert.equal(f.ctx.ledger.mvpFacts().events.length,4)
})
test('no unregistered production protocol is promoted even with passed flags and valid-looking hashes',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const fact=changedFact(f.ctx.ledger.mvpFacts().events[0].acceptanceFact,{decisionClass:'production_machine_acceptance'});assert.throws(()=>f.verifier.verifyStored(fact),/mvp_production_protocol_not_registered/);assert.throws(()=>f.verifier.verifyProduction({passed:true,sha256:'a'.repeat(64)}),/not_registered/)
})
test('actual seed digest conflict stays unknown instead of granting a component',()=>{
 const f=acceptanceFixture();fs.appendFileSync(f.file(LEGACY_MVP[0].path),' ');const r=f.ctx.consumeMvpAcceptance();assert.equal(r.recorded,false);assert.equal(r.failures.length,1);assert.equal(f.mvp().completed,2);assert.equal(f.mvp().denominator,48)
})
test('unsupported checkpoint, future verification and arbitrary evidence snapshot are refused',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const original=f.ctx.ledger.mvpFacts().events[0].acceptanceFact
 const wrong=structuredClone(original);wrong.checkpointId='MVP-VIS-99:1';wrong.factId=factIdentity(wrong);assert.throws(()=>f.verifier.verifyStored(wrong),/identity/)
 const future=structuredClone(original);future.verifiedAtUtc='2099-01-01T00:00:00Z';assert.throws(()=>f.verifier.verifyStored(future),/future_time/)
 const arbitrary=structuredClone(original);arbitrary.evidence.logicalPath='.runtime/local-backup/secret.json';arbitrary.factId=factIdentity(arbitrary);assert.throws(()=>f.verifier.verifyStored(arbitrary),/snapshot_path/)
})
test('ordered source revisions and explicit predecessors beat arrival order; duplicate facts count once',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const a=f.ctx.ledger.mvpFacts().events[0].acceptanceFact,b=changedFact(a,{outcome:'failed',revision:2}),c=changedFact(b,{outcome:'passed',revision:3})
 const options={checklist:a.checklist,scopeId:MVP_SCOPE},head=facts=>reduceMvpFacts(facts,options).find(h=>h.checkpointId===a.checkpointId)
 assert.equal(head([c,a,b,a]).outcome,'passed');assert.deepEqual(head([c,a,b]),head([a,b,c]));assert.equal(head([b,a]).outcome,'failed')
 const revoked=changedFact(a,{outcome:'revoked',revision:1,predecessor:{factId:a.factId,sha256:factHash(a)}});assert.equal(head([revoked,a]).outcome,'revoked')
 const restored=changedFact(revoked,{outcome:'passed',revision:2,predecessor:{factId:revoked.factId,sha256:factHash(revoked)}});assert.equal(head([a,restored,revoked]).outcome,'passed')
})
test('unexplained contradictions, different applicable world, bad predecessor and bare revocation never pass',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const a=f.ctx.ledger.mvpFacts().events[0].acceptanceFact,options={checklist:a.checklist,scopeId:MVP_SCOPE},head=facts=>reduceMvpFacts(facts,options).find(h=>h.checkpointId===a.checkpointId)
 assert.equal(head([a,changedFact(a,{outcome:'failed',key:'other-verified-source'})]).outcome,'conflict')
 assert.equal(head([a,changedFact(a,{worldId:'another-world',revision:100})]).outcome,'conflict')
 assert.equal(head([a,changedFact(a,{outcome:'revoked',revision:2,predecessor:{factId:a.factId,sha256:'0'.repeat(64)}})]).outcome,'conflict')
 assert.equal(head([changedFact(a,{outcome:'revoked',revision:2})]).outcome,'conflict')
})
test('revoked and conflict heads reduce percentage without removing unknown items from denominator',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const q=f.ctx.readMvpAcceptance(),a=q.facts.find(f=>f.checkpointId==='MVP-VIS-01:1'),revoked=changedFact(a,{outcome:'revoked',revision:1,predecessor:{factId:a.factId,sha256:factHash(a)}}),facts=[...q.facts,revoked],heads=reduceMvpFacts(facts,{checklist:q.checklist,scopeId:MVP_SCOPE});const m=applyMvpAcceptance(f.base(),{...q,facts,heads});assert.equal(m.completed,2);assert.equal(m.knownAcceptanceRatio,4.2);assert.equal(m.denominator,48);assert.equal(m.revoked,1)
})
test('same source revision with two different immutable digests conflicts even if both claim the same outcome',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const a=f.ctx.ledger.mvpFacts().events[0].acceptanceFact,b=structuredClone(a);b.origin.sha256='b'.repeat(64);b.evidence.sha256=b.origin.sha256;b.factId=factIdentity(b);const h=reduceMvpFacts([a,b],{checklist:a.checklist,scopeId:MVP_SCOPE}).find(h=>h.checkpointId===a.checkpointId);assert.equal(h.outcome,'conflict')
})
test('verifier refuses caller-selected checkpoints and fabricated read objects with a valid-looking digest',()=>{
 const f=acceptanceFixture(),seed=LEGACY_MVP[0],r=f.verifier.readSeed(seed),evidence={logicalPath:'.runtime/local-backup/work-recording/evidence/program/'+seed.sha256+'.json',sha256:seed.sha256}
 assert.throws(()=>f.verifier.build({...seed,checkpointId:'WORLD-AUTO-004:1'},r,evidence),/adapter_unregistered/)
 assert.throws(()=>f.verifier.readSeed({...seed,path:'.runtime/local-backup/arbitrary.json'}),/adapter_unregistered/)
 assert.throws(()=>f.verifier.build(seed,{...r,bytes:Buffer.from('{}')},evidence),/legacy_evidence_conflict/)
 assert.throws(()=>f.verifier.build(seed,{...r,value:{...r.value,taskId:'forged'}},evidence),/legacy_evidence_conflict/)
})
test('pre-ingestion static fallback also pins the authorized legacy source bytes',()=>{
 assert.equal(verifyFrozenMvpBindings(LEGACY_MVP),true);assert.equal(verifyFrozenMvpBindings([]),true)
 assert.throws(()=>verifyFrozenMvpBindings(LEGACY_MVP.map((s,i)=>i===0?{...s,sha256:'0'.repeat(64)}:s)),/frozen_source_sha_conflict/)
})
test('equivalent re-verification versions do not duplicate heads or escape a valid source revocation',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const a=f.ctx.ledger.mvpFacts().events[0].acceptanceFact,versions=Array.from({length:10},(_,i)=>{const b=structuredClone(a);b.verifier.implementationSha256=String(i).repeat(64);b.factId=factIdentity(b);return b}),options={checklist:a.checklist,scopeId:MVP_SCOPE};const h=reduceMvpFacts([a,...versions],options).find(h=>h.checkpointId===a.checkpointId);assert.equal(h.outcome,'passed');assert.equal(h.factIds.length,1)
 const revoked=changedFact(a,{outcome:'revoked',key:'canonical-revocation',predecessor:{factId:a.factId,sha256:factHash(a)}});assert.equal(reduceMvpFacts([a,...versions,revoked],options).find(h=>h.checkpointId===a.checkpointId).outcome,'revoked')
})
}
