import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {describeMorphology,readNaturalFrameAudit} from '../lib/natural-current-frame-review.mjs'

test('retain abstention and scope a rock window under its recorded kind',()=>{
  const counts=describeMorphology([{kind:'rock',prediction:'vegetation'},{kind:'rock',prediction:'abstain'},{kind:'tree',prediction:'vegetation'}])
  assert.deepEqual(counts,{rock:{total:2,predictionCounts:{vegetation:1,abstain:1}},tree:{total:1,predictionCounts:{vegetation:1}}})
  assert.equal(counts.rock.predictionCounts.rock,undefined)
})

test('read only the sealed audit for the requested current sources',async t=>{
  if(!fs.existsSync('.runtime/ai-painter/style-fingerprints/latest.json')){t.skip('no local calibration installed');return}
  assert.throws(()=>readNaturalFrameAudit({token:'../relative'}))
  assert.equal(readNaturalFrameAudit({token:'0'.repeat(64)}),null)
  if(!fs.existsSync('data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json')){t.skip('no registered world');return}
  const {readCurrentNaturalFrameCandidate}=await import('../lib/natural-current-frame-source.mjs')
  const view=await readCurrentNaturalFrameCandidate(),report=readNaturalFrameAudit(view)
  if(!report){t.skip('current version has no sealed audit');return}
  assert.equal(report.releaseEligible,false)
  assert.equal(report.sources.image.sha256,view.image.sha256)
  assert.deepEqual(report.programs.map(p=>p.sha256.length),report.programs.map(()=>64))
  assert.throws(()=>readNaturalFrameAudit({...view,sources:{...view.sources,descriptor:{...view.sources.descriptor,sha256:'f'.repeat(64)}}}))
  if(report.sources.image.sha256==='31ab6985d20684879f01b9f38998f25403cc0654484219775ac6bb35c0b8eeda'){
    const gates=Object.fromEntries(report.gates.map(g=>[g.id,g]))
    assert.equal(gates.terrain_path_ground.status,'passed');assert.equal(gates.water_connectivity.status,'not_applicable')
    assert.equal(gates.water_connectivity.measurements.waterPixels,0);assert.equal(gates.object_recognizability.status,'not_qualified')
    assert.equal(gates.object_recognizability.measurements.objects,52);assert.equal(gates.formal_visual_judge.status,'not_qualified')
    assert.equal(gates.paired_reference_fidelity.status,'not_applicable')
  }
  await view.assertCurrent()
})
