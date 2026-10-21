import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateRows} from '../check-ai-painter-current-checkpoint-train-fit-cpu-v1.mjs'
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
