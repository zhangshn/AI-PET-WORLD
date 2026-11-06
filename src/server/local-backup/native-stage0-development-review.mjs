import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createEvolutionInputReader} from '../../../scripts/lib/natural-world-evolution-input.mjs'

const runId='stage0-native-256-formal-229',run='.runtime/ai-painter/native-stage0-formal-training/'+runId
const policy='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json'
const policyHash='3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1'
const hash=b=>createHash('sha256').update(b).digest('hex')
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const error=(code,status)=>Object.assign(new Error(code),{code,status})
const parse=b=>JSON.parse(b.toString('utf8'))
export function parseDevelopmentQuery(url){
  const p=new URL(url).searchParams,keys=[...p.keys()],epoch=p.get('epoch')
  if(!['12','24'].includes(epoch)||new Set(keys).size!==keys.length)throw error('invalid_epoch_request',400)
  if(keys.length===1)return {epoch:Number(epoch)}
  const role=p.get('role'),index=p.get('index'),token=p.get('token')
  if(keys.length!==4||!['source','prediction'].includes(role)||!/^\d$/.test(index??'')||Number(index)>7||!digest(token))throw error('invalid_image_request',400)
  return {epoch:Number(epoch),role,index:Number(index),token}
}
export function readDevelopmentReview(query){
  const reader=createEvolutionInputReader(process.cwd()),{epoch}=query
  assert([12,24].includes(epoch))
  const dir=run+'/segments/'+epoch*2,review=run+'/review/epoch-'+epoch+'.json',receiptPath=run+'/review/receipt-'+epoch+'.json'
  let receiptBytes
  try{receiptBytes=reader.read(receiptPath,16384)}catch(e){if(e.code==='ENOENT')throw error('fixed_review_not_sealed',404);throw e}
  const bound=(ref,expected,max=4*1024*1024)=>{
    assert.equal(ref.path,expected);assert(digest(ref.sha256))
    const b=reader.read(expected,max);assert.equal(hash(b),ref.sha256)
    if(ref.bytes!==undefined)assert.equal(ref.bytes,b.length)
    return b
  }
  const spec=parse(bound({path:policy,sha256:policyHash},policy))
  const release=parse(bound(spec.sourceRelease,spec.sourceRelease.path))
  const split=parse(bound(spec.validationMembership,release.splits.validation.path))
  const index=parse(bound(release.sourceIndex,release.sourceIndex.path))
  const receipt=parse(receiptBytes),token=hash(receiptBytes)
  if(query.token&&query.token!==token)throw error('review_identity_changed',409)
  const doc=parse(bound(receipt.report,review)),seal=parse(bound(receipt.seal,dir+'/seal.json'))
  assert.equal(seal.runId,runId);assert.equal(seal.segment,2*epoch);assert.equal(seal.endPair,48*epoch)
  assert.deepEqual(receipt.checkpoint,seal.checkpoint)
  assert.equal(doc.runId,runId);assert.equal(doc.epoch,epoch);assert.equal(doc.segmentSeal.sha256,receipt.seal.sha256)
  assert.equal(doc.workerResult.sha256,seal.result.sha256)
  const result=parse(bound(seal.result,dir+'/result.json'))
  assert.deepEqual(result.validation.checkpoint,receipt.checkpoint)
  assert.equal(split.split,'validation');assert.equal(split.sampleIds.length,8);assert.equal(new Set(split.sampleIds).size,8)
  assert.deepEqual(doc.rows.map(r=>r.sampleId),split.sampleIds);assert.deepEqual(result.validation.rows.map(r=>r.sampleId),split.sampleIds)
  const rows=doc.rows.map((r,i)=>{
    const original=index.samples.find(s=>s.split==='validation'&&s.sampleId===r.sampleId)
    assert(original);assert.deepEqual(r.sourceImage,original.image);assert.deepEqual(r.conditionPack,original.conditionPack)
    const trained=result.validation.rows[i]
    assert.deepEqual(trained.sourceImage,original.image);assert.equal(trained.split,'validation');assert.equal(trained.epoch,epoch)
    const expected=dir+'/validation-'+String(i).padStart(2,'0')+'.png'
    assert.equal(r.prediction.path,expected);assert.deepEqual(r.prediction,trained.image)
    assert(Number.isFinite(r.floatRgbMae)&&r.floatRgbMae===trained.fullRgbMae)
    if(query.index===i){
      const ref=query.role==='source'?original.image:r.prediction
      const b=bound(ref,query.role==='source'?original.image.path:expected)
      assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      if(query.role==='prediction')assert(b.readUInt32BE(16)===256&&b.readUInt32BE(20)===192)
      return {bytes:b}
    }
    assert(Number.isFinite(r.baselineRgbMae))
    return {sample:r.sampleId,rgbMae:r.floatRgbMae,baselineRgbMae:r.baselineRgbMae,objects:Object.fromEntries(['object_footprints','object_tree','object_rock','object_vegetation'].map(id=>{
      const value=r.byObject[id]?.candidate;assert(value===null||Number.isFinite(value));return [id,value]
    }))}
  })
  assert.equal(hash(createEvolutionInputReader(process.cwd()).read(receiptPath,16384)),token)
  if(query.role)return rows[query.index]
  const current=doc.metrics,baseline=doc.baseline.metrics
  assert([current.meanValidationRgbMae,baseline.meanValidationRgbMae,current.worstApplicableObjectCorrelation,baseline.worstApplicableObjectCorrelation].every(Number.isFinite))
  return {epoch,token,status:doc.status,rows,summary:{rgbMae:current.meanValidationRgbMae,baselineRgbMae:baseline.meanValidationRgbMae,
    worstObject:current.worstApplicableObjectCorrelation,baselineWorstObject:baseline.worstApplicableObjectCorrelation}}
}
