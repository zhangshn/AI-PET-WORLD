import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { observationFixture } from './helpers/training-observation-fixture.mjs'
import { validateObservationRecord } from '../../src/server/ai-console/training-observation-contract.mjs'
import { readBoundTrainingPresentation } from '../../src/server/ai-console/bound-training-presentation.mjs'
import { readTrainingRun, listTrainingHistory, readTrainingRunSection, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'
import { readTrainingWorkObservation } from '../../src/server/local-backup/training-work-observation.mjs'
import { trainingTime } from './helpers/training-time-cpu.mjs'
import {publicMeasurements} from '../../src/server/ai-console/training-observation-public-fields.mjs'

const validate=f=>validateObservationRecord({pkg:f.pkg,packageBinding:f.packageBinding,runId:f.runId,terminal:f.terminal,value:f.value})
for(const route of ['cpu-route-alpha','entirely-different-cpu-beta']) test('same public protocol across route '+route,async t=>{
  const expected=route==='cpu-route-alpha'?1:2
  const f=observationFixture(t,{route,multiSample:expected===2}),before=fs.readFileSync(path.join(f.root,'.runtime/ai-painter/current-execution-registry/current.json'))
  const detail=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(detail.dataStatus,'connected');assert.equal(detail.record.optimizerSteps,expected)
  assert.equal(detail.record.samples.length,expected)
  assert.equal(detail.record.artifacts.filter(a=>a.role==='output').length,expected)
  assert.equal(detail.record.metrics.length,expected);assert.equal(detail.record.checkpoints.length,1)
  assert.equal(detail.record.qualification.formalStageQualified,false)
  const list=await listTrainingHistory({root:f.root,limit:1})
  assert.deepEqual(list.records[0].workerExecutionTiming,detail.record.workerExecutionTiming)
  const display=trainingTime.mapWorkerTiming(detail.record.workerExecutionTiming)
  assert.equal(display.available,true);assert.match(display.elapsed,/60\.123|1分0\.123/)
  const artifact=detail.record.artifacts.find(a=>a.role==='output')
  assert.deepEqual((await readTrainingArtifact(f.runId,artifact.artifactId,{root:f.root})).bytes,f.png)
  for(const section of ['metrics','artifacts','events','logs']) {
    const page=await readTrainingRunSection(f.runId,{root:f.root,section,limit:1})
    assert.equal(page.items.length,1)
  }
  const logs=await readTrainingRunSection(f.runId,{root:f.root,section:'logs'})
  assert(!JSON.stringify(logs).includes('fixture-secret'));assert.equal(logs.reasonCode,null)
  const resultArtifact=detail.record.artifacts.find(a=>a.role==='result')
  const publicResult=await readTrainingArtifact(f.runId,resultArtifact.artifactId,{root:f.root})
  assert(!JSON.stringify(publicResult).includes('fixture-private-token'))
  assert(fs.readFileSync(path.join(f.root,f.terminal.result.path),'utf8').includes('fixture-private-token'))
  const summary=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(summary.availability,'available');assert.equal(summary.targetEpochs,null)
  assert.deepEqual(summary.actualOptimizerSteps,{generator:expected,critic:expected})
  assert.deepEqual(summary.workerExecutionTiming,detail.record.workerExecutionTiming)
  assert.deepEqual(fs.readFileSync(path.join(f.root,'.runtime/ai-painter/current-execution-registry/current.json')),before)
})

for(const [name,mutate] of [
  ['unknown protocol',f=>{f.pkg.interfaceContract.schemaVersion='future'}],
  ['cross run',f=>{f.value.runId='another'}],
  ['wrong package',f=>{f.value.executionPackage={...f.packageBinding,sha256:'b'.repeat(64)}}],
  ['wrong sample',f=>{f.value.artifacts[0].sampleId='another'}],
  ['wrong split',f=>{f.value.artifacts[0].split='validation'}],
  ['wrong resolution',f=>{f.value.artifacts[0].resolution=[2,2]}],
  ['extra step',f=>{f.value.optimizerSteps.generator=3}],
  ['duplicate artifact',f=>{f.value.artifacts.push(f.value.artifacts[0])}],
  ['unbound implementation',f=>{f.pkg.programs=[]}],
  ['out of root',f=>{f.value.artifacts[0].binding.path='.runtime/ai-painter/another/output.png'}],
  ['false qualification',f=>{f.value.qualificationGranted=true}],
  ['clock not recorded',f=>{delete f.value.workerTiming}],
]) test('common protocol rejects '+name,t=>{const f=observationFixture(t);mutate(f);assert.throws(()=>validate(f),/training_observation_/)} )

test('planned omissions remain gaps; result state and actual partial artifacts survive',async t=>{
  const f=observationFixture(t,{state:'failed_closed',partial:true})
  const d=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(d.record.terminalStatus,'experiment_failed_closed')
  assert.equal(d.record.artifacts.filter(a=>a.role==='output').length,1)
  assert.equal(d.record.workerExecutionTiming.status,'failed_closed')
  f.value.executionState='completed';f.value.workerTiming.status='completed'
  f.terminal.executionState='completed';f.terminal.status='experiment_completed_not_formal_qualified'
  assert(validate(f).coverageGaps.length>0)
})

test('fresh progress needs same process lock heartbeat and package; no fabricated epoch',async t=>{
  const f=observationFixture(t),p=f.active()
  let result=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(result.currentMetrics.availability,'available');assert.equal(result.currentMetrics.epoch,null)
  assert.equal(result.currentMetrics.optimizationStep,1);assert.equal(result.workerExecutionTiming.status,'started')
  p.executionPackage={...f.packageBinding,sha256:'b'.repeat(64)};f.own('progress.json',p)
  result=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(result.currentMetrics.reasonCode,'training_progress_package_conflict')
  f.active('2020-01-01T00:00:00Z')
  result=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(result.currentMetrics.availability,'unavailable')
  assert.match(result.currentMetrics.reasonCode,/stale/)
  assert.equal(result.workerExecutionTiming,null)
})

test('a damaged child is isolated from counters and timing, while PNG bytes are rehashed',async t=>{
  const f=observationFixture(t)
  fs.appendFileSync(path.join(f.root,f.artifacts[1].binding.path),' ')
  let d=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(d.dataStatus,'partial');assert.equal(d.record.workerExecutionTiming.availability,'available')
  assert.equal(d.record.optimizerSteps,1)
  const image=d.record.artifacts.find(a=>a.role==='output')
  fs.appendFileSync(path.join(f.root,image.logicalPath),' ')
  await assert.rejects(readTrainingArtifact(f.runId,image.artifactId,{root:f.root}),/history_sha_mismatch/)
})

test('work consumer uses the same SHA-bound timing and preserves terminal on observation failure',t=>{
  const f=observationFixture(t)
  const read=(logical,sha256)=>{const bytes=fs.readFileSync(path.join(f.root,logical));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);return {value:JSON.parse(bytes),bytes,logicalPath:logical,sha256}}
  const w=readTrainingWorkObservation({terminal:f.terminal,registry:f.registry,read})
  assert.equal(w.value.workerTiming.elapsedSeconds,60.123456)
  f.terminal.trainingObservation=null
  const gap=readTrainingWorkObservation({terminal:f.terminal,registry:f.registry,read})
  assert.equal(gap.completed,true);assert.equal(gap.value,null);assert.equal(gap.gap,'training_observation_evidence_unavailable')
})

test('abrupt worker exit retains a recorded start and SHA-bound images, never a fabricated worker end or elapsed',async t=>{
  const f=observationFixture(t,{state:'failed_closed',interrupted:true})
  const d=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(d.dataStatus,'partial');assert.equal(d.record.workerExecutionTiming.status,'started')
  assert.equal(d.record.workerExecutionTiming.elapsedSeconds,null);assert.equal(d.record.workerExecutionTiming.endedAtUtc,null)
  assert.equal(d.record.artifacts.filter(a=>a.role==='output').length,1)
  const list=await listTrainingHistory({root:f.root})
  assert.deepEqual(list.records[0].workerExecutionTiming,d.record.workerExecutionTiming)
  const current=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(current.workerExecutionTiming.status,'started');assert.equal(current.currentMetrics.availability,'unavailable')
  assert.equal(current.actualOptimizerSteps,null)
})

test('missing/invalid observation never erases the immutable terminal and event chain',async t=>{
  const f=observationFixture(t)
  fs.appendFileSync(path.join(f.root,f.terminal.trainingObservation.path),' ')
  const d=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(d.dataStatus,'partial');assert.equal(d.reasonCode,'history_sha_mismatch')
  assert.equal(d.record.terminalStatus,'experiment_completed_not_formal_qualified')
  assert.equal(d.record.events.length,1);assert(d.record.artifacts.some(a=>a.role==='terminal'))
})

for(const measurements of [{},{loss:null},{authorization:'fixture-private-token'}]) test('empty or sensitive metric is a coverage gap, never connected or exposed '+JSON.stringify(measurements),async t=>{
  const f=observationFixture(t,{measurements})
  const d=await readTrainingRun(f.runId,{root:f.root})
  assert.equal(d.dataStatus,'partial');assert.equal(d.record.metrics.length,0)
  assert(!JSON.stringify(d).includes('fixture-private-token'))
  assert.equal(d.record.workerExecutionTiming.availability,'available')
})

test('public numeric metrics retain actual region absence, booleans and zeros, rejecting arbitrary text and nonfinite values',()=>{
  const values={loss:0,finite:true,regions:{tree:{pixels:0,rgbMae:null,naReason:'empty_region'}}}
  assert.deepEqual(publicMeasurements(values),values)
  assert.throws(()=>publicMeasurements({loss:NaN}),/metric_value_invalid/)
  assert.throws(()=>publicMeasurements({label:'private-token'}),/metric_value_invalid/)
})

test('work observation preserves planned missing-artifact and secondary-error coverage independently from success',t=>{
  const f=observationFixture(t,{partial:true})
  const read=(logical,sha256)=>{const bytes=fs.readFileSync(path.join(f.root,logical));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);return {value:JSON.parse(bytes),bytes,logicalPath:logical,sha256}}
  const w=readTrainingWorkObservation({terminal:f.terminal,registry:f.registry,read})
  assert.equal(w.completed,true);assert.equal(w.gap,'training_observation_incomplete')
})
