import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readBaselineFile} from '../lib/natural-world-baseline.mjs'
import {baselineSha256 as sha,BASELINE_SELECTION,verifyNaturalWorldBaselineProof} from '../lib/natural-world-baseline-proof.mjs'
import {COMPAT_ROOT,verifyNaturalWorldBaselineCompatibility} from '../lib/natural-world-baseline-compatibility.mjs'
import {readCurrentWorldBaseline} from '../../src/server/local-backup/natural-world-baseline-reader.mjs'

test('read-only compatibility: archived generation plus current independent Store; tampering rejected', {timeout:60000}, async t=>{
  const before=readBaselineFile(BASELINE_SELECTION)
  const run=spawnSync(process.execPath,['scripts/run-natural-world-baseline-compatibility.mjs'],{encoding:'utf8',timeout:35000,maxBuffer:1024*1024,windowsHide:true})
  assert.equal(run.status,0,run.stderr);const {selection,verified,published}=JSON.parse(run.stdout)
  console.log('compatibility evidence: '+selection.proofRef.path)
  assert.equal(published,false);assert.deepEqual(readBaselineFile(BASELINE_SELECTION),before)
  assert.equal(verified.status,'verified_bound_machine_readback');assert.equal(verified.compatibility.sourceReplay,false)
  assert(Object.values(verified.qualification).every(v=>v===false))
  const read=readBaselineFile,proof=JSON.parse(read(selection.proofRef.path)),manifest=JSON.parse(read(proof.archiveManifestRef.path))
  await t.test('consumer distinguishes new schema; legacy verifier remains strict',()=>{
    assert.throws(()=>verifyNaturalWorldBaselineProof({selection,read}),/baseline_selection/)
    const previous=JSON.parse(read(COMPAT_ROOT+'previous-selection.json'))
    assert.throws(()=>verifyNaturalWorldBaselineProof({selection:previous,read}),/baseline_ref_digest|baseline_read_bytes/)
    const selectedBytes=Buffer.from(JSON.stringify(selection));const reader=(p,max)=>{const bytes=p===BASELINE_SELECTION?selectedBytes:read(p,max);return {bytes,sha256:sha(bytes)}}
    const result=readCurrentWorldBaseline({read:reader,readFresh:reader,readAtUtc:new Date().toISOString(),deliveryId:'WORLD-BASELINE-001'})
    assert.equal(result.status,'baseline_verified');assert.match(result.readVerification,/历史生成证据/)
  })
  for(const target of [manifest.sources[0].snapshotPath,proof.currentCodeBindings.find(x=>x.path.endsWith('world-evolution-transaction.ts')).path,
    verified.store.path,proof.readerRef.path,proof.processRef.path,verified.conditions.manifestRef.path]){
    await t.test('byte tamper rejects '+target,()=>assert.throws(()=>verifyNaturalWorldBaselineCompatibility({selection,
      read:(p,max)=>{const b=read(p,max);if(p!==target)return b;const c=Buffer.from(b);c[c.length-1]^=1;return c}}),/baseline_.*digest/))
  }
  function altered(change){
    const p=structuredClone(proof),m=structuredClone(manifest),overrides=new Map();change(p,m)
    const mb=Buffer.from(JSON.stringify(m));overrides.set(p.archiveManifestRef.path,mb);p.archiveManifestRef={...p.archiveManifestRef,bytes:mb.length,sha256:sha(mb)}
    const pb=Buffer.from(JSON.stringify(p));overrides.set(selection.proofRef.path,pb)
    const s={...selection,proofRef:{...selection.proofRef,bytes:pb.length,sha256:sha(pb)}}
    return ()=>verifyNaturalWorldBaselineCompatibility({selection:s,read:(q,max)=>overrides.get(q)??read(q,max)})
  }
  await t.test('missing archive rejected even with rehashed manifests',()=>assert.throws(altered((_p,m)=>m.sources.pop()),/compat_archive_set/))
  await t.test('duplicate archive rejected',()=>assert.throws(altered((_p,m)=>m.sources[1]=m.sources[0]),/compat_archive_binding/))
  await t.test('archive cannot redirect to live data',()=>assert.throws(altered((_p,m)=>m.sources[0].snapshotPath=verified.store.path),/compat_archive_binding/))
  await t.test('current helper binding cannot be omitted',()=>assert.throws(altered(p=>p.currentCodeBindings.pop()),/compat_current_code_set/))
  await t.test('qualification cannot be asserted',()=>assert.throws(altered(p=>p.qualification.mvpQualified=true),/compat_schema/))
  await t.test('rehashed archive SHA cannot replace historical source identity',()=>assert.throws(altered((_p,m)=>m.sources[0].sha256='0'.repeat(64)),/compat_archive_binding/))
  for(const [name,change] of [['stdout detached',o=>o.stdout='{}'],['same process',o=>o.parentPid=o.pid]]){
    await t.test('self-consistent outer hashes still reject '+name,()=>{
      const p=structuredClone(proof),o=JSON.parse(read(p.processRef.path));change(o)
      const ob=Buffer.from(JSON.stringify(o));p.processRef={...p.processRef,sha256:sha(ob),bytes:ob.length}
      const pb=Buffer.from(JSON.stringify(p)),s={...selection,proofRef:{...selection.proofRef,sha256:sha(pb),bytes:pb.length}}
      assert.throws(()=>verifyNaturalWorldBaselineCompatibility({selection:s,read:(q,max)=>q===p.processRef.path?ob:q===s.proofRef.path?pb:read(q,max)}),/compat_process/)
    })
  }
})
