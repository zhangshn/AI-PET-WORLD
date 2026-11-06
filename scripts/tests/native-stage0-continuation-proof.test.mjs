import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {verifyNativeContinuationBoundary as boundary,buildNativeContinuationSeal as seal,
  verifyNativeContinuationReap as reap,verifyNativeContinuationFinalReadback as final} from '../lib/native-stage0-continuation-proof.mjs'

const root='.runtime/ai-painter/native-stage0-formal-training/stage0-native-256-formal-229'
const available=fs.existsSync(root+'/segments/13/recovery.pt')
const originalOnly=available&&!fs.existsSync(root+'/segments/14')
const normalize=v=>String(v).replaceAll('\\','/').toLowerCase()
// Intercept a single read in this isolated Node test process. None of the cases writes a run artifact.
function corruptRead(t,suffix,{stream=false,edit}={}){
  const target=normalize(suffix),fds=new Set(),originalOpen=fs.openSync,originalClose=fs.closeSync
  t.mock.method(fs,'openSync',function(...args){
    const fd=originalOpen.apply(this,args);if(normalize(args[0]).endsWith(target))fds.add(fd);return fd
  })
  t.mock.method(fs,'closeSync',function(fd){fds.delete(fd);return originalClose.call(this,fd)})
  if(stream){
    const original=fs.readSync
    t.mock.method(fs,'readSync',function(fd,buf,...rest){
      const n=original.call(this,fd,buf,...rest);if(n>0&&fds.has(fd))buf[0]^=1;return n
    })
  }else{
    const original=fs.readFileSync
    t.mock.method(fs,'readFileSync',function(fd,...args){
      const bytes=original.call(this,fd,...args)
      return fds.has(fd)?Buffer.from(edit(bytes.toString())):bytes
    })
  }
}
test('immutable resource terminal, thirteen real native jobs and protected recovery checkpoint read back', {skip:!available},()=>{
  const b=boundary()
  assert.equal(b.terminal.status,'failed_closed');assert.equal(b.terminal.sealedPairs,312)
  assert.equal(b.checkpoint13.bytes,30107037);assert.equal(b.checkpoint13.sha256,'82c930dd25042493fae7a085e8c60c2571734ee520e40b1ab9e760983a219ee0')
  assert.equal(b.deadlineUtc,'2026-11-03T08:09:02.105Z');assert.equal(b.nextSegment,b.endPair/24+1)
  if(originalOnly){assert.equal(b.endPair,312);assert.equal(b.reservedSegment,null);assert.deepEqual(b.latestSeal,b.seal13)}
})
test('reject modified anchor bytes before admitting any next segment',{skip:!available},t=>{
  corruptRead(t,'/segments/13/recovery.pt',{stream:true});assert.throws(boundary,/digest/)
})
test('reject altered optimizer proof despite an otherwise intact job',{skip:!available},t=>{
  corruptRead(t,'/segments/08/restore-proof.json',{edit:s=>s.replace(/"adamw":"[a-f0-9]{64}"/,'"adamw":"'+'f'.repeat(64)+'"')})
  assert.throws(boundary)
})
test('reject reaped predecessor without its authentic immutable handoff',{skip:!available},t=>{
  corruptRead(t,'/segments/12/reaped.json',{edit:s=>s.replace('30107037','30107038')})
  assert.throws(boundary)
})
test('reject early cleanup without touching the latest pinned original checkpoint',{skip:!available},t=>{
  const original=fs.existsSync
  let calls=0
  t.mock.method(fs,'existsSync',function(p){
    // First call belongs to the physical-path no-link guard, second is the gate's existence query.
    if(normalize(p).endsWith('/segments/13/reap-intent.json'))return ++calls===2
    return original.call(this,p)
  })
  assert.throws(boundary,/protected/)
})
test('cannot adopt a hole, re-seal an original segment or fabricate final readback',{skip:!originalOnly},t=>{
  for(const n of [1,13,49,NaN,'14'])assert.throws(()=>seal(n))
  assert.throws(()=>seal(14));assert.throws(()=>reap(15));assert.throws(final)
  const original=fs.readdirSync
  t.mock.method(fs,'readdirSync',function(p,...args){
    const rows=original.call(this,p,...args)
    return normalize(p).endsWith('/segments')?rows.filter(r=>r.name!=='06'):rows
  })
  assert.throws(boundary)
})
test('reserved next directory is visible but not treated as verified weights or authority to re-run',
  {skip:!originalOnly},t=>{
  const original=fs.readdirSync
  t.mock.method(fs,'readdirSync',function(p,...args){
    const rows=original.call(this,p,...args)
    return normalize(p).endsWith('/segments')?[...rows,{name:'14',isDirectory:()=>true,isSymbolicLink:()=>false}]:rows
  })
  const b=boundary();assert.equal(b.endPair,312);assert.equal(b.reservedSegment,14);assert.equal(b.nextSegment,14)
  assert.throws(()=>seal(14))
})
