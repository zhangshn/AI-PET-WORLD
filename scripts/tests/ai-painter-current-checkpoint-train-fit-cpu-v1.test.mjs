import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateRows,validateComparisonRows,FIT_OUT} from '../check-ai-painter-current-checkpoint-train-fit-cpu-v1.mjs'
const roles=['object_footprints','object_tree','object_rock','object_vegetation']
const ids=Array.from({length:48},(_,i)=>'sample-'+i)
const rows=()=>ids.map(sampleId=>({sampleId,split:'train',epoch:24,fullRgbMae:.1,objectCorrelations:Object.fromEntries(roles.map(role=>[role,.2]))}))
test('accept exact48 bound train rows',()=>assert.equal(validateRows(rows(),ids),true))
test('reject wrong count',()=>assert.throws(()=>validateRows(rows().slice(1),ids)))
test('reject duplicate or reordered identity',()=>{const x=rows();x[0]=x[1];assert.throws(()=>validateRows(x,ids))})
test('reject validation substitution',()=>{const x=rows();x[0].split='validation';assert.throws(()=>validateRows(x,ids))})
test('reject nonfinite metrics',()=>{const x=rows();x[0].fullRgbMae=NaN;assert.throws(()=>validateRows(x,ids))})
test('reject invalid correlation',()=>{const x=rows();x[0].objectCorrelations.object_rock=2;assert.throws(()=>validateRows(x,ids))})
test('accept explicit nonapplicable null',()=>{const x=rows();x[0].objectCorrelations.object_rock=null;assert.equal(validateRows(x,ids),true)})
test('host uses existing transport, one-shot claim and CPU-only environment',()=>{
  const source=fs.readFileSync(new URL('../check-ai-painter-current-checkpoint-train-fit-cpu-v1.mjs',import.meta.url),'utf8')
  for(const value of ['runParameter60OwnedWorker','attempt-claim.json',"CUDA_VISIBLE_DEVICES:'-1'",'automaticRetries:0',"fs.openSync(paths.file(logical),'wx')"])assert.ok(source.includes(value))
})

const valIds=Array.from({length:8},(_,i)=>'validation-'+i)
function comparisonRows() {
  return [...ids,...valIds].map((sampleId,i)=>({sampleId,split:i<48?'train':'validation',fullRgbMae:.1,
    regions:Object.fromEntries(['core','support'].map(kind=>[kind,Object.fromEntries(roles.map(role=>
      [role,{pixels:12,rgbMae:.1,correlation:.2,naReason:null}]))]))}))
}
test('FIT006 exact 48/8, same metrics and independent output',()=>{
  assert.equal(validateComparisonRows(comparisonRows(),ids,valIds),true)
  assert.match(FIT_OUT,/fit-comparison-006-20261022\/evaluation-v1$/)
})
test('FIT006 rejects split/order substitutions and repeated membership',()=>{
  const swapped=comparisonRows();swapped[48].split='train'
  assert.throws(()=>validateComparisonRows(swapped,ids,valIds))
  assert.throws(()=>validateComparisonRows(comparisonRows(),ids,[...valIds.slice(1),ids[0]]))
})
test('FIT006 NA must have explicit reason; zero is not missing',()=>{
  const rows=comparisonRows(),value=rows[0].regions.support.object_rock
  value.correlation=0;assert.equal(validateComparisonRows(rows,ids,valIds),true)
  value.correlation=null;assert.throws(()=>validateComparisonRows(rows,ids,valIds))
  value.naReason='constant_reference_region';assert.equal(validateComparisonRows(rows,ids,valIds),true)
})
