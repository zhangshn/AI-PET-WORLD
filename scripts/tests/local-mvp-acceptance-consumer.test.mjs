import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {acceptanceFixture} from './local-mvp-acceptance.test.mjs'
import {MVP_INDEX,LEGACY_MVP,factHash} from '../../src/server/local-backup/mvp-acceptance-contracts.mjs'
import {createWorkObserver} from '../../src/server/local-backup/work-observer.mjs'
test('query does no writes or directory scans, before and after actual compatible import',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const paths=[MVP_INDEX,'.runtime/local-backup/module.sqlite','.runtime/local-backup/work-recording/sources/mvp-acceptance-v1.json'],before=paths.map(p=>fs.readFileSync(f.file(p))),write=fs.writeFileSync,mkdir=fs.mkdirSync,readDir=fs.readdirSync
 fs.writeFileSync=()=>{throw Error('GET write forbidden')};fs.mkdirSync=()=>{throw Error('GET mkdir forbidden')};fs.readdirSync=()=>{throw Error('GET directory scan forbidden')};try{const q=f.ctx.readMvpAcceptance();assert.equal(q.facts.length,4)}finally{fs.writeFileSync=write;fs.mkdirSync=mkdir;fs.readdirSync=readDir}assert(paths.every((p,i)=>fs.readFileSync(f.file(p)).equals(before[i])))
})
test('crash after event commit before index rename recovers without duplicating facts',()=>{
 const f=acceptanceFixture(),rename=fs.renameSync;let failed=false;fs.renameSync=(from,to)=>{if(String(to).endsWith(path.join('mvp-acceptance','index.json'))&&!failed){failed=true;throw Error('isolated index commit interruption')}return rename(from,to)}
 try{assert.throws(()=>f.ctx.consumeMvpAcceptance(),/isolated index/)}finally{fs.renameSync=rename}
 assert.equal(f.ctx.ledger.mvpFacts().events.length,4);assert.equal(f.ctx.readMvpAcceptance().dataStatus,'unknown_or_stale');f.make().consumeMvpAcceptance();assert.equal(f.ctx.ledger.mvpFacts().events.length,4);assert.equal(f.ctx.readMvpAcceptance().dataStatus,'partial')
})
test('index commit before independent watermark failure is detected and repaired on bounded replay',()=>{
 const f=acceptanceFixture(),rename=fs.renameSync;let failed=false;fs.renameSync=(from,to)=>{if(String(to).endsWith(path.join('sources','mvp-acceptance-v1.json'))&&!failed){failed=true;throw Error('isolated watermark interruption')}return rename(from,to)}
 try{assert.throws(()=>f.ctx.consumeMvpAcceptance(),/watermark interruption/)}finally{fs.renameSync=rename}
 assert.equal(f.ctx.readMvpAcceptance().dataStatus,'unknown_or_stale');const before=f.ctx.ledger.mvpFacts().moduleRevision;f.make().consumeMvpAcceptance();assert.equal(f.ctx.ledger.mvpFacts().moduleRevision,before);assert.equal(f.ctx.readMvpAcceptance().dataStatus,'partial')
})
test('temporarily unreadable original does not revoke immutable imported evidence or change the old event',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const before=f.ctx.ledger.mvpFacts().events,source=f.file(LEGACY_MVP[0].path);fs.renameSync(source,source+'.retained');const result=f.ctx.consumeMvpAcceptance();assert.equal(result.recorded,false);assert.equal(f.ctx.readMvpAcceptance().dataStatus,'unknown_or_stale');assert.equal(f.mvp().completed,3);assert.deepEqual(f.ctx.ledger.mvpFacts().events,before);fs.renameSync(source+'.retained',source);f.ctx.consumeMvpAcceptance();assert.equal(f.ctx.readMvpAcceptance().dataStatus,'partial')
})
test('corrupt index and hardlinked immutable proof fail closed; no GET repair',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const file=f.file(MVP_INDEX),index=JSON.parse(fs.readFileSync(file));index.value.producerSequence=99;fs.writeFileSync(file,JSON.stringify(index));assert.throws(()=>f.ctx.readMvpAcceptance(),/mvp_index_integrity_conflict/)
 const other=acceptanceFixture();other.ctx.consumeMvpAcceptance();const proof=other.ctx.ledger.mvpFacts().events[0].acceptanceFact.evidence.logicalPath;fs.linkSync(other.file(proof),other.file(proof)+'.retained-link');assert.throws(()=>other.ctx.readMvpAcceptance(),/work_evidence_boundary/)
})
test('business historical gap stays independent, and ordinary training cannot become a passed production fact',()=>{
 const f=acceptanceFixture();f.ctx.saveState('ai-painter-registry-v1',{cursor:0,status:'partial',coverage:{historyFailure:{revision:1,reasonCode:'missing'},historyThroughRevision:0,liveThroughRevision:616}});const original=fs.readFileSync(f.file('.runtime/local-backup/work-recording/sources/ai-painter-registry-v1.json'));f.ctx.consumeMvpAcceptance({business:{historyFailure:{revision:1,reasonCode:'missing'},liveThroughRevision:616}});assert(fs.readFileSync(f.file('.runtime/local-backup/work-recording/sources/ai-painter-registry-v1.json')).equals(original));const q=f.ctx.readMvpAcceptance();assert.equal(q.watermarks.business.historyFailure.revision,1);assert.equal(q.coverage.productionAcceptance,'not_verified');assert.equal(q.coverage.runtimeAdoption,'not_verified')
})
test('one existing watcher performs bounded acceptance catch-up and a notification without duplicate facts',async()=>{
 const f=acceptanceFixture(),directory=f.file('.runtime/ai-painter/current-execution-registry');fs.mkdirSync(directory,{recursive:true});let watches=0,consumes=0;const watch=fs.watch
 fs.watch=(...args)=>{watches++;return watch(...args)}
 const context={...f.ctx,observeCommittedRegistry:async()=>({processed:0,coverage:{liveBacklog:0,historyFailure:{revision:1}}}),consumeMvpAcceptance:options=>{consumes++;return f.ctx.consumeMvpAcceptance(options)}}
 let observer;try{observer=createWorkObserver(context);await observer.ready;assert.equal(watches,1);assert.equal(consumes,1);assert.equal(f.ctx.ledger.mvpFacts().events.length,4);fs.writeFileSync(path.join(directory,'current.json'),'{}');for(let n=0;n<50&&consumes<2;n++)await new Promise(r=>setTimeout(r,10));assert(consumes>=2);assert.equal(f.ctx.ledger.mvpFacts().events.length,4)}finally{observer?.dispose();fs.watch=watch}assert.equal(observer.active,false)
})
test('acceptance failure, including its own failure receipt, cannot relabel or retry the business lane',async()=>{
 const f=acceptanceFixture(),directory=f.file('.runtime/ai-painter/current-execution-registry');fs.mkdirSync(directory,{recursive:true});let business=0;const failureSources=[]
 const observer=createWorkObserver({...f.ctx,observeCommittedRegistry:async()=>{business++;return {processed:0,coverage:{liveBacklog:0}}},consumeMvpAcceptance:()=>{throw Error('isolated acceptance fault')},failure:source=>{failureSources.push(source);throw Error('isolated receipt fault')}})
 try{await observer.ready;assert.equal(business,1);assert.deepEqual(failureSources,['mvp-acceptance-v1'])}finally{observer.dispose()}
})
test('self-consistent fake derived heads cannot grant completion; only actual committed facts are projected',()=>{
 const f=acceptanceFixture();f.ctx.consumeMvpAcceptance();const file=f.file(MVP_INDEX),index=JSON.parse(fs.readFileSync(file));for(const head of index.value.heads)head.outcome='passed';index.sha256=factHash(index.value);fs.writeFileSync(file,JSON.stringify(index));assert.equal(f.ctx.readMvpAcceptance().dataStatus,'unknown_or_stale');assert.equal(f.mvp().completed,3);assert.equal(f.mvp().knownAcceptanceRatio,6.3)
})
