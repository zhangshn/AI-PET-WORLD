import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {assessContinuationResources,parseContinuationCard,proveCompletedGradientRows,recordContinuationResourceSample} from '../lib/native-stage0-continuation-resources.mjs'
const MiB=2**20,GiB=2**30,id='GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd'
const opt={segment:14,phase:'before_ticket',runnerPid:999}
const input={atUtc:'2026-11-03T01:00:00Z',bytes:32*MiB,hostFreeBytes:13*GiB,diskFreeBytes:2048*MiB,
  card:{gpuId:id,totalMiB:10000,usedMiB:3000,freeMiB:7000,temperatureC:84.99},gradientClosed:false,guardOkay:true,pinPresent:true}
const gate=(changes={},params={})=>assessContinuationResources({...input,...changes},{...opt,...params})
test('RAM, disk, both and equality yield distinct measured pre-ticket outcomes',()=>{
  assert.equal(gate().decision,'ready')
  for(const [raw,reasons] of [
    [{hostFreeBytes:13*GiB-1},['host_memory_below_floor']],
    [{diskFreeBytes:2048*MiB-1},['disk_below_floor']],
    [{hostFreeBytes:13*GiB-1,diskFreeBytes:2048*MiB-1},['host_memory_below_floor','disk_below_floor']]]){
    const g=gate({...raw,card:null});assert.equal(g.decision,'wait');assert.deepEqual(g.codes,reasons)
    assert.equal(g.hostFreeBytes,raw.hostFreeBytes??input.hostFreeBytes);assert.equal(g.diskFreeBytes,raw.diskFreeBytes??input.diskFreeBytes)
  }
  assert.equal(gate({hostFreeBytes:10*GiB},{phase:'running'}).decision,'ready')
  assert.equal(gate({hostFreeBytes:10*GiB-1,card:null},{phase:'running'}).decision,'stop')
  assert.equal(gate({diskFreeBytes:2048*MiB-1,card:null},{phase:'running'}).decision,'stop')
  assert.equal(gate({hostFreeBytes:10*GiB},{phase:'final_readback_entry',segment:48}).decision,'wait')
})
test('stop on unknown samples; global lease, pinned CP, deadline or an actual GPU threshold cannot be waved through as a wait',()=>{
  for(const raw of [{inspectionFailure:'failed read',diskFreeBytes:null},{guardOkay:false},{legacyActive:true},{pinPresent:false},{deadlineReached:true},{stopRequested:true},{card:null}]){
    assert.equal(gate(raw).decision,'stop')
  }
  for(const [card,code] of [
    [{...input.card,temperatureC:85},'gpu_temperature_at_or_above_limit'],
    [{...input.card,usedMiB:3929},'gpu_fraction_exceeded'],
    [{...input.card,freeMiB:5119},'gpu_free_below_floor']]){
    const g=gate({card});assert.equal(g.decision,'stop');assert(g.codes.includes(code))
  }
  assert.equal(gate({card:{...input.card,usedMiB:3928,freeMiB:5120,temperatureC:84.999}}).decision,'ready')
  const parsed=parseContinuationCard(id+', 8151, 1550, 6362, 30.37');assert.equal(parsed.temperatureC,30.37)
  for(const raw of [id+', 8151, 1550, 6362, NaN',id+', 8151, 1550, 7362, 30.37','foreign, 8151, 1550, 6362, 30.37']){
    assert.throws(()=>parseContinuationCard(raw))
  }
})
test('no overlapping gradient reserve, next-checkpoint reservation, or grace below ceilings',()=>{
  const reserve=64*MiB+MiB+65536
  const fit=gate({bytes:128*MiB-reserve})
  assert.equal(fit.decision,'ready');assert.equal(fit.capacity.projectedGradientBytes,128*MiB)
  assert.equal(gate({bytes:128*MiB-reserve+1}).decision,'stop')
  const post=gate({bytes:90*MiB,gradientClosed:true},{phase:'running'});assert.equal(post.decision,'ready');assert.equal(post.capacity.failureTensorReserveBytes,0)
  assert.equal(gate({bytes:128*MiB-65536+1,gradientClosed:true},{phase:'post_training'}).decision,'stop')
  assert.equal(gate({phaseMismatch:true},{phase:'post_training'}).decision,'stop')
  assert.throws(()=>recordContinuationResourceSample(post),'synthetic read must never write official evidence')
})
test('completed gradient proof requires all 24 committed pairs, original positional history and finite losses',()=>{
  let h='0'.repeat(64);const initial=h,rows=[]
  for(let i=0;i<24;i++){
    const count=13*24+i+1,position={epoch:7,sampleId:'sample-'+i,trainIndex:i,zeroBasedEpochPosition:24+i}
    h=crypto.createHash('sha256').update(Buffer.from(h,'hex')).update(JSON.stringify(position)).digest('hex')
    rows.push({position,counts:{generator:count,discriminator:count},ledger:{generator:1,discriminator:1,sampleId:position.sampleId},
      historySha256:h,generatorLoss:0.4,discriminatorLoss:0.7})
  }
  assert.equal(proveCompletedGradientRows(rows,14,initial),true)
  assert.equal(proveCompletedGradientRows(rows.slice(1),14,initial),false)
  for(const bad of [{...rows[1],counts:{generator:313,discriminator:314}},{...rows[1],ledger:{generator:0,discriminator:1,sampleId:'sample-1'}},
    {...rows[1],historySha256:'4'.repeat(64)},{...rows[1],position:{...rows[1].position,sampleId:'sample-0'}},{...rows[1],generatorLoss:Infinity}]){
    const clone=rows.slice();clone[1]=bad;assert.equal(proveCompletedGradientRows(clone,14,initial),false)
  }
})
