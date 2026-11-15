import test from 'node:test'
import assert from 'node:assert/strict'
import * as decode1 from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'
import * as decode1Package from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs'
import * as ecologyDecode1 from '../lib/ai-painter-ecology-decode1-quality-owned-native-v1.mjs'
import * as ecologyDecode1Package from '../lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs'
import * as failureCapture from '../lib/ai-painter-ecology-failure-capture-owned-native-v1.mjs'
import * as failureCapturePackage from '../lib/ai-painter-ecology-failure-capture-package-chain-v1.mjs'
import * as ecology from '../lib/ai-painter-ecology-quality-owned-native-v1.mjs'
import * as ecologyPackage from '../lib/ai-painter-ecology-quality-package-chain-v1.mjs'
import * as terrainDetail from '../lib/ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs'
import * as terrainDetailPackage from '../lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs'
import * as support from '../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs'
import * as supportPackage from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs'

// Exercise the actual admission functions, without launching an owner or
// creating any execution package, registry record, file or GPU process.
for (const [name, native, chain] of [
  ['decode1', decode1, decode1Package],
  ['ecology-decode1', ecologyDecode1, ecologyDecode1Package],
  ['failure-capture', failureCapture, failureCapturePackage],
  ['ecology', ecology, ecologyPackage],
  ['terrain-detail', terrainDetail, terrainDetailPackage],
  ['support', support, supportPackage],
]) {
  test(`${name} CPU finalization rejects caller-created and serialized receipts`, async () => {
    assert.equal(Object.hasOwn(chain, 'finalizeCpuAcceptance'), false)
    const claimed = { phase: 'cpu', proof: { exitCode: 0, activeProcessesAfterCleanup: 0, killOnJobClose: true }, cpuNegativeInputs: { fixtureLinksRemoved: true } }
    for (const receipt of [null, {}, claimed, JSON.parse(JSON.stringify(claimed)), Object.create(claimed)]) {
      assert.equal(native.hasLiveOwnedProof(receipt), false)
      assert.equal(native.hasLiveCpuFixtureCleanup(receipt), false)
      await assert.rejects(() => native.finalizeCpuAcceptance({
        root: process.cwd(), requestBinding: null,
        result: { ownedReceipt: receipt, stdout: '{}', receiptBinding: null },
      }), /same live CPU call required/u)
    }
    assert.equal(Object.hasOwn(native, 'retainLiveOwnedReceipt'), false)
    assert.equal(Object.hasOwn(native, 'liveReceipts'), false)
  })
}


import {validateParameter60NativeProof as frozenProof} from '../lib/ai-painter-parameter60-owned-worker-v1.mjs'
import {validateParameter60NativeProof as qualificationProofV2} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v2.mjs'
import {validateParameter60NativeProof as qualificationProofV3} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v3.mjs'
import {validateParameter60NativeProof as qualificationProofV4} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs'

test('qualification proof versions preserve legacy identity, closure and byte-limit decisions',()=>{
  const variants=[qualificationProofV2,qualificationProofV3,qualificationProofV4]
  assert.equal(variants[0],variants[1]);assert.equal(variants[1],variants[2])
  const observed={ownerPid:4321,bindingBase64:'cHJpdmF0ZQ==',ownerClosed:true,ownerExitCode:0,ownerSignal:null,
    stdoutClosed:true,stderrClosed:true,protocolError:null,ownerError:'',forced:false,stdoutBytes:3,stderrBytes:2,maxBuffer:8*1024*1024}
  const proof={ownerPid:4321,rootPid:6789,rootCreationDateUtc:'2026-10-14T08:00:00.000Z',bindingBase64:observed.bindingBase64,
    assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,totalProcesses:1,exitCode:0,stopReason:null,
    streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,transportCompleted:true,
    cleanupError:null,observationError:null,streamCaptureError:null,streamTransportError:null,stdoutBytes:3,stderrBytes:2}
  const check=(p,o)=>{const expected=frozenProof(p,o);for(const variant of variants)assert.deepEqual(variant(p,o),expected)}
  assert.deepEqual(frozenProof(proof,observed),{valid:true,emptyJob:true,errors:[]});check(proof,observed)
  const values=[null,undefined,false,true,0,-1,NaN,Infinity,'',{},[],8*1024*1024,Number.MAX_SAFE_INTEGER+1]
  for(const value of values)check(value,observed)
  for(const key of Object.keys(proof)){
    const missing={...proof};delete missing[key];check(missing,observed)
    for(const value of values)check({...proof,[key]:value},observed)
  }
  for(const key of Object.keys(observed)){
    const missing={...observed};delete missing[key];check(proof,missing)
    for(const value of values)check(proof,{...observed,[key]:value})
  }
  for(const bytes of [0,8*1024*1024-1,8*1024*1024,8*1024*1024+1])
    check({...proof,stdoutBytes:bytes,stderrBytes:0},{...observed,stdoutBytes:bytes,stderrBytes:0})
})


import fs from 'node:fs'
import path from 'node:path'

const inspectorVersions=[['ecology-decode1',ecologyDecode1],['failure-capture',failureCapture],['ecology',ecology],['terrain-detail',terrainDetail],['support',support]]
test('CPU input inspectors retain independent class identities across versions',()=>{
  assert.equal(new Set(inspectorVersions.map(([,mod])=>mod.CpuNegativeInputInspector)).size,5)
  for(const chain of [ecologyDecode1Package,failureCapturePackage,ecologyPackage,terrainDetailPackage,supportPackage])
    assert.equal(chain.ROLES.cpuNegativeInputInspector,'scripts/lib/cpu-negative-input-inspector.mjs')
})
for(const [version,mod] of inspectorVersions) for(const mode of ['ordinary','links','reappeared','unknown-link','wrong-target','file-removed','file-replaced','independent-instances'])
test(`CPU inspector ${version} retains observation boundaries: ${mode}`,t=>{
  const root=process.cwd(),parent=fs.realpathSync(path.resolve('.runtime')),fixture=fs.mkdtempSync(path.join(parent,'apw-inspector-sharing-'))
  t.after(()=>{
    assert.equal(path.dirname(fs.realpathSync(fixture)),parent);assert(path.basename(fixture).startsWith('apw-inspector-sharing-'))
    assert(!fs.lstatSync(fixture).isSymbolicLink());fs.rmSync(fixture,{recursive:true,force:false})
  })
  const physical=logical=>{assert(logical.startsWith('.runtime/'));const absolute=path.resolve(parent,logical.slice(9));assert(absolute.startsWith(fixture+path.sep));return absolute}
  const layout=mod.cpuNegativeInputLayout('.runtime/'+path.basename(fixture))
  for(const logical of [layout.root,...layout.links.map(v=>v.target),layout.root+'/program-project/scripts',layout.root+'/program-data/hot/runtime'])fs.mkdirSync(physical(logical),{recursive:true})
  const file=physical(layout.links[0].target+'/ordinary.bin');fs.writeFileSync(file,Buffer.alloc(7))
  fs.writeFileSync(physical(layout.root+'/declaration.json'),'{}')
  const inspector=new mod.CpuNegativeInputInspector(root,layout),initial=inspector.scan()
  assert.equal(initial.actualFileBytes,9);assert.equal(initial.totalBytes,9+49152)
  assert.equal(initial.reserveIsMeasurement,false);assert.equal(mod.hasLiveCpuFixtureCleanup(initial),false)
  if(mode==='ordinary'){
    assert.throws(()=>inspector.scan({requireObserved:true}),/all three/)
    assert.equal(inspector.scan({requireRemoved:true}).fixtureLinksRemoved,true)
  }else if(['links','reappeared'].includes(mode)){
    for(const slot of layout.links)fs.symlinkSync(physical(slot.target),physical(slot.path),'junction')
    const linked=inspector.scan({requireObserved:true});assert.equal(linked.actualFileBytes,9);assert.equal(linked.links.filter(v=>v.present).length,3)
    assert.throws(()=>inspector.scan({requireRemoved:true}),/cleanup incomplete/)
    for(const slot of layout.links)fs.unlinkSync(physical(slot.path))
    assert.equal(inspector.scan({requireRemoved:true,requireObserved:true}).fixtureLinksRemoved,true)
    if(mode==='reappeared'){
      const slot=layout.links[0];fs.symlinkSync(physical(slot.target),physical(slot.path),'junction')
      assert.throws(()=>inspector.scan(),/reappeared/)
    }
  }else if(mode==='unknown-link'){
    fs.symlinkSync(physical(layout.links[0].target),physical(layout.root+'/unknown'),'junction')
    assert.throws(()=>inspector.scan(),/unregistered/)
  }else if(mode==='wrong-target'){
    const slot=layout.links[0];fs.symlinkSync(physical(layout.links[1].target),physical(slot.path),'junction')
    assert.throws(()=>inspector.scan(),/target differs/)
  }else if(mode==='file-removed'){
    fs.unlinkSync(file);assert.throws(()=>inspector.scan(),/file disappeared/)
  }else{
    const replacement=physical(layout.links[0].target+'/replacement.bin');fs.writeFileSync(replacement,Buffer.alloc(11));fs.renameSync(replacement,file)
    assert.throws(()=>inspector.scan(),/file identity replaced/)
    if(mode==='independent-instances'){
      const second=new mod.CpuNegativeInputInspector(root,layout)
      assert.equal(second.scan().actualFileBytes,13)
      assert.throws(()=>inspector.scan(),/file identity replaced/)
    }
  }
})
