import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {observationFixture} from './helpers/training-observation-fixture.mjs'
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs'
import {trainingTime} from './helpers/training-time-cpu.mjs'

const source=fs.readFileSync(new URL('../../src/app/ai-console/ai-console-training-summary-model.ts',import.meta.url),'utf8')
const model={}
new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
  name=>{assert.equal(name,'./ai-console-training-time');return trainingTime},model)

for(const phase of ['loading','zero_update_gpu','training','checkpoint']) test('current observation distinguishes '+phase+' from real updates',async t=>{
  const f=observationFixture(t),p=f.active(),now=Date.now()
  p.phase=phase
  p.optimizerSteps={generator:0,discriminator:0}
  f.own('progress.json',p)
  let presentation=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  assert.equal(presentation.currentMetrics.availability,'available')
  assert.equal(presentation.currentMetrics.phase,phase==='checkpoint'?'validating':'preparing')
  const current={connection:'ready',errorCode:null,snapshot:{ok:true,dataStatus:'connected',integrityStatus:'verified',
    observedAtUtc:new Date(now).toISOString(),activeExecution:f.registry.activeExecution,
    currentProjectTask:{runId:f.runId,packageId:f.runId,capabilityVersion:f.runId,taskKind:'bounded_train_only_learning_capacity_experiment'},
    trainingPresentation:presentation}}
  const live={connection:'failed',snapshot:null}
  const mapped=model.mapTrainingSummary(current,live,now)
  assert.equal(mapped.training,false)
  if(phase!=='checkpoint') {
    assert.match(mapped.status,/加载／零更新检查/)
    assert.equal(mapped.optimizerStep,0);assert.equal(mapped.discriminatorOptimizerSteps,0)
    assert.equal(mapped.lastKnownGeneratorSteps,null)
    assert.doesNotMatch(mapped.reason,/已停止/)
  }
  if(phase==='training') {
    p.optimizerSteps={generator:1,discriminator:1};f.own('progress.json',p)
    presentation=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
    current.snapshot.trainingPresentation=presentation
    assert.equal(model.mapTrainingSummary(current,live,now).training,true)
  }
  p.processStartIdentity='different-process';f.own('progress.json',p)
  presentation=await readBoundTrainingPresentation(f.root,f.registry,f.capsule,f.terminal)
  current.snapshot.trainingPresentation=presentation
  assert.equal(model.mapTrainingSummary(current,live,now).training,false)
  assert.equal(presentation.currentMetrics.availability,'unavailable')
})
