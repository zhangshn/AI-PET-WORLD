import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {inspectWorldEnvironmentCandidateQualification as inspect,ENVIRONMENT_QUALIFICATION_MANIFEST as MANIFEST} from '../lib/world-environment-qualification.mjs'
import {ENVIRONMENT_EVIDENCE_MANIFEST as OLD_MANIFEST} from '../lib/world-environment-evidence.mjs'
import {createHistoricalWeatherFixture,HISTORICAL_WORLD_PATH,HISTORICAL_WORLD_SHA} from './helpers/historical-environment-qualification.mjs'

const root=path.resolve(import.meta.dirname,'../..'),sha=b=>createHash('sha256').update(b).digest('hex')
const {fixture,manifest,cleanup}=createHistoricalWeatherFixture()
after(cleanup)
const mutate=(p,fn)=>{const file=path.join(fixture,p),before=fs.readFileSync(file);try{const replacement=fn(Buffer.from(before));fs.writeFileSync(file,replacement);return assert.throws(()=>inspect({projectRoot:fixture}),/environment_qualification_|environment_evidence_|evolution_input_/)}finally{fs.writeFileSync(file,before)}}
const jsonMutation=(key,fn)=>mutate(manifest.roots[key].path,b=>{const v=JSON.parse(b);fn(v);return Buffer.from(JSON.stringify(v))})
function inventory(){return fs.readdirSync(fixture,{recursive:true}).filter(p=>fs.statSync(path.join(fixture,p)).isFile()).sort().map(p=>[p,sha(fs.readFileSync(path.join(fixture,p)))])}

test('complete private fixture verifies numerical and initialized transition evidence but never admits production',()=>{
 const before=inventory(),r=inspect({projectRoot:fixture})
 assert.equal(r.verifierSupported,true);assert.equal(r.numericalEvidenceVerified,true);assert.equal(r.initializedPrivateTransitionVerified,true);assert.equal(r.productionScopeSupported,false);assert.equal(r.productionAdmitted,false)
 assert.equal(r.fullContextRetrospectiveInitializationVerified,true);assert.equal(r.insufficientContextColdStartSupported,false);assert.equal(r.operationalAsOfSupported,false)
 assert.equal(r.registry.releaseCount,0);assert.equal(r.registry.revision,0);assert.deepEqual(r.privateTransition.before,{tick:0,stateVersion:1,eventCursor:1});assert.deepEqual(r.privateTransition.after,{tick:1,stateVersion:2,eventCursor:2})
 assert.equal(r.privateTransition.maintenanceEventCount,1);assert.equal(r.privateTransition.evolutionEventCount,1);assert.equal(r.privateTransition.sourceArchiveRows,6);assert.equal(r.privateTransition.savedWeatherRows,1)
 assert.equal(r.modelForwards,0);assert.equal(r.trainingUpdates,0);assert.equal(r.worldWrites,0);assert.equal(r.registryWrites,0);assert(r.referenceVerification.combinedReadBudgetBytes<=16*1024*1024)
 assert(Object.isFrozen(r)&&Object.isFrozen(r.privateTransition)&&Object.isFrozen(r.privateTransition.values));assert.throws(()=>r.privateTransition.values[0]=999,TypeError)
 assert.deepEqual(inventory(),before)
})
test('historical input old current SHA is resolved through persisted before evidence, not overwritten current',()=>{
 const input=JSON.parse(fs.readFileSync(path.join(fixture,manifest.roots.input164.path))),before=manifest.roots.beforeRecord164,after=manifest.roots.record164
 assert.equal(input.provenance[6].sourceRef.path,after.path);assert.equal(input.provenance[6].sourceRef.sha256,before.sha256);assert.notEqual(before.sha256,after.sha256)
 assert.equal(inspect({projectRoot:fixture}).initializedPrivateTransitionVerified,true)
})
test('current committed world is rejected as old evidence; mutating the original pre-state also fails',()=>{
 const live=fs.readFileSync(path.join(root,HISTORICAL_WORLD_PATH)),current=JSON.parse(live)
 assert(current.stateVersion>0&&current.eventCursor>0)
 assert.notEqual(sha(live),HISTORICAL_WORLD_SHA)
 assert.equal(sha(fs.readFileSync(path.join(fixture,HISTORICAL_WORLD_PATH))),HISTORICAL_WORLD_SHA)
 mutate(HISTORICAL_WORLD_PATH,()=>live)
 mutate(HISTORICAL_WORLD_PATH,bytes=>{const forged=JSON.parse(bytes);forged.eventCursor++;return Buffer.from(JSON.stringify(forged))})
 assert.throws(()=>inspect({projectRoot:root}),/environment_qualification_|environment_evidence_|evolution_input_/)
 assert.equal(sha(fs.readFileSync(path.join(fixture,HISTORICAL_WORLD_PATH))),HISTORICAL_WORLD_SHA)
})
test('a genuine newer trusted registry cannot replace revision zero in historical qualification',()=>{
 const name=manifest.roots.registry.path,current=fs.readFileSync(path.join(root,name))
 const actual=JSON.parse(current)
 assert(actual.registryRevision>=1&&actual.releaseRecords.length>=1)
 assert.notEqual(sha(current),manifest.roots.registry.sha256)
 mutate(name,()=>current)
 assert.equal(sha(fs.readFileSync(path.join(fixture,name))),manifest.roots.registry.sha256)
})
test('claims, readers, manifest paths and unknown fields reject before any I/O',()=>{
 for(const key of ['passed','productionAdmitted','qualified','reader','manifest','manifestPath','pathOverride','thresholds'])assert.throws(()=>inspect({projectRoot:'does-not-exist',[key]:true}),/environment_qualification_options/)
 for(const v of [undefined,null,[],{},Object.create(null),{projectRoot:0},{projectRoot:new String(fixture)},{projectRoot:''}])assert.throws(()=>inspect(v),/environment_qualification_options/)
 assert.throws(()=>inspect({projectRoot:fixture,[Symbol('claim')]:true}),/environment_qualification_options/)
})
test('accessors and proxies are rejected without running traps or getters',()=>{
 let calls=0;const getter={get projectRoot(){calls++;throw Error('executed')}};assert.throws(()=>inspect(getter),/options_project_root/)
 const proxy=new Proxy({projectRoot:fixture},{getPrototypeOf(){calls++;throw Error('executed')},ownKeys(){calls++;throw Error('executed')},get(){calls++;throw Error('executed')}});assert.throws(()=>inspect(proxy),/options/)
 const revoked=Proxy.revocable({projectRoot:fixture},{});revoked.revoke();assert.throws(()=>inspect(revoked.proxy),/options/);assert.equal(calls,0)
})
test('fixed manifest cannot be redirected to a custom reader path or mutable state',()=>{
 mutate(MANIFEST,b=>{const m=JSON.parse(b);m.roots.input164.path='../escape';return Buffer.from(JSON.stringify(m))})
 mutate(MANIFEST,b=>Buffer.concat([b,Buffer.from(' ')]))
 mutate(OLD_MANIFEST,b=>b.subarray(0,b.length-1))
})
test('input/output/PID/old value evidence changes fail closed instead of becoming missing prerequisites',()=>{
 for(const [key,change] of [
  ['input164',v=>v.window.values[6][1]+=1],['output164',v=>v.values[1]+=1],['forwardProcess164',v=>v.pid+=1],
  ['candidate164',v=>v.event.changes[0].beforeValueSha256='0'.repeat(64)],['event164',v=>v.changes[0].newValue+=1],
  ['record163',v=>v.worldState.payload.environment.evolution.weather.values[1]+=1],['record164',v=>v.eventCursor=1],
  ['readbackProcess164',v=>v.exitCode=1],['replay164',v=>v.replayed=false],['policy164',v=>v.domainFields[0].constraints.max=1e9],
  ['transaction164',v=>v.recordPath+='-foreign'],['receipt164',v=>v.fileSha256='0'.repeat(64)],['registry',v=>v.revision=999],
 ])jsonMutation(key,change)
})
test('truncated checkpoint, missing evidence and legacy-only venv tampering are rejected',()=>{
 mutate(manifest.roots.checkpoint153.path,b=>b.subarray(0,1))
 mutate('ml/ai-painter/.venv/pyvenv.cfg',b=>Buffer.concat([b,Buffer.from('\n# changed')]))
 const p=path.join(fixture,manifest.roots.readback164.path),backup=p+'.test-missing';fs.renameSync(p,backup)
 try{assert.throws(()=>inspect({projectRoot:fixture}),/ENOENT/)}finally{fs.renameSync(backup,p)}
})
test('unknown publication blocks operational as-of only, complete retrospective context remains verified',()=>{
 const r=inspect({projectRoot:fixture});assert.equal(r.initialization.mode,'full_context_retrospective_archival_seed');assert.equal(r.initialization.publicationAvailability,'unknown');assert.equal(r.initialization.epochUtc,'2020-01-08T00:00:00.000Z')
 assert.equal(r.initialization.insufficientContextAlternative,'unsupported_not_required_for_verified_full_context');assert(!r.productionBlockers.some(x=>x.includes('cold_start')||x.includes('publication')))
 assert.equal(r.productionInitializationStatus,'not_registered_for_production_scope')
})
