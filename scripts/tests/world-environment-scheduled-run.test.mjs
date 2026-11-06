import test from 'node:test'
import assert from 'node:assert/strict'
import {BASE,makeInput,checkedOutput} from '../lib/world-environment-scheduled-run.mjs'
import {json,bound} from '../lib/world-initialized-evolution.mjs'

const c=json(BASE+'/model/model-contract.json')
const get=ref=>JSON.parse(bound(ref))
const current={record:get(c.sourceRecordRef),status:'found',fileSha256:c.sourceRecordRef.sha256}
const prior=get(c.sourceInputRef), output=get(c.sourceOutputRef), event=get(c.sourceEventRef)
test('a later tick cannot be scheduled from the original store anchor',()=>{
  assert.throws(()=>makeInput(2,current,event,prior,output),/counts/)
})
test('an event from a different world cannot supply the next weather row',()=>{
  const wrong=structuredClone(event);wrong.identity.worldId+='-other'
  assert.throws(()=>makeInput(1,current,wrong,prior,output),/committed_weather/)
})
test('a stored event and model output that disagree cannot supply history',()=>{
  const wrong=structuredClone(event);wrong.changes[0].newValue=999
  assert.throws(()=>makeInput(1,current,wrong,prior,output),/committed_weather/)
})
test('a previously successful model process is not a new step',()=>{
  const proc=get(c.sourceForwardProcessRef)
  assert.throws(()=>checkedOutput(prior,bound(c.sourceInputRef),proc),/output_schema/)
})
