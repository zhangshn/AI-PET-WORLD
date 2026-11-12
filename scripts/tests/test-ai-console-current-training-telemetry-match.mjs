import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { selectLiveActivityState } from '../../src/server/ai-painter-live-activity-projection.mjs'

const source = readFileSync(new URL('../../src/server/ai-console/active-run-telemetry-match.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { matchesCurrentTrainingTelemetry } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`)
const valid = { registryVerified: true, activeRunId: 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898', activeProcessId: 17704, telemetryStatus: 'connected', reportedRunId: 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898', reportedProcessId: 17704 }

test('only verified active Run, process and fresh telemetry match', () => {
  assert.equal(matchesCurrentTrainingTelemetry(valid), true)
  for (const changed of [
    { registryVerified: false },
    { telemetryStatus: 'unknown_or_stale' },
    { reportedRunId: 'previous-run' },
    { activeRunId: null },
    { activeProcessId: 9000 },
    { reportedProcessId: null },
  ]) assert.equal(matchesCurrentTrainingTelemetry({ ...valid, ...changed }), false)
})

const require = createRequire(import.meta.url)
function loadProjectionModule(name, resolve = require, environment = {}) {
  const content = readFileSync(new URL(`../../src/server/${name}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const loadedModule = { exports: {} }
  new Function('require', 'module', 'exports', 'process', 'Date', compiled)(resolve, loadedModule, loadedModule.exports, environment.process ?? process, environment.Date ?? Date)
  return loadedModule.exports
}
const realProjection = loadProjectionModule('ai-painter-training-progress-projection')
const {createTrainingStageHistoryReader} = loadProjectionModule('ai-painter-training-stage-history', id => {
  if(id==='node:path')return path
  if(id==='@/server/ai-painter-training-progress-projection')return realProjection
  throw Error(`unexpected stage history dependency: ${id}`)
})

function stageHistoryFixture(role='active') {
  const relativeRoot='.runtime/private-stage-history',runId='fixture-run',packageId='fixture-package'
  const source={absoluteRoot:path.resolve('private-stage-fixture'),relativeRoot,runId,packageId,artifactDirectory:null,role}
  const outputRoot=relativeRoot+'/'+runId,records=new Map(),directories=new Map(),reads=[]
  const progress={schemaVersion:'ai-painter-stage4-mvp256-dry-v24-progress-v1',runId,packageId,actualEpoch:0,completedEpochs:0,
    optimizerStepsGenerator:0,optimizerStepsDiscriminator:0,updatedAtUtc:'2026-11-11T00:00:00Z',executionState:'executing'}
  const registry={ok:true,registry:{activeExecution:{runId,packageId,lock:{path:outputRoot+'/execution-lock.json'}}}}
  if(role==='active')records.set(outputRoot+'/progress.json',progress)
  const reader=createTrainingStageHistoryReader({
    discoverCurrentTrainingSources:async()=>[source],expectedSplits:{train:48,validation:8,challenge:4,regression:4},
    listDirectory:async absolute=>{
      reads.push(['directory',absolute])
      const names=directories.get(absolute)
      if(!names)throw Error('private directory absent')
      return names.map(name=>({name,isFile:()=>true}))
    },
    readJson:async file=>{reads.push(['json',file]);return records.get(file)??null},
    sha256:async file=>{reads.push(['sha',file]);return 'a'.repeat(64)},
  })
  return {reader,source,outputRoot,records,directories,reads,progress,registry}
}

test('stage history preserves verified active zero counters and rejects another run or package',async()=>{
  const f=stageHistoryFixture()
  const [active]=await f.reader(f.registry)
  assert.equal(active.runId,f.source.runId)
  assert.equal(active.status,'running')
  assert.equal(active.epochCount,0)
  assert.equal(active.bestEpoch,null)
  assert.equal(active.durationSeconds,null)
  f.progress.executionState='checkpoint_selected_review_pending'
  assert.equal((await f.reader(f.registry))[0].verdict,'pending_validation')
  f.progress.runId='other-run'
  assert.deepEqual(await f.reader(f.registry),[])
  f.progress.runId=f.source.runId;f.progress.packageId='other-package'
  assert.deepEqual(await f.reader(f.registry),[])
})

test('stage history retains rejected terminal and preview identities without promoting preview success',async()=>{
  const f=stageHistoryFixture('latest');f.source.artifactDirectory='training-output'
  const output=f.outputRoot+'/training-output'
  f.records.set(output+'/manifest.json',{status:'training_completed_pending_automatic_machine_review',metrics:[{epoch:2}]})
  f.records.set(f.outputRoot+'/phase-terminal.json',{executionState:'completed',status:'machine_review_failed',recordedAtUtc:'2026-11-11T00:00:00Z'})
  f.records.set(f.outputRoot+'/machine-review.json',{status:'machine_reviews_passed',reviews:[{epoch:2,passed:true},{epoch:1,passed:false,issueCodes:['object_shape']}]})
  f.directories.set(path.join(f.source.absoluteRoot,f.source.runId,'training-output','fixed-epoch-previews'),['epoch-2.png','ignore.txt','epoch-1.webp'])
  const [stage]=await f.reader(f.registry)
  assert.equal(stage.verdict,'failed')
  assert.deepEqual(stage.blockers,['machine_review_failed'])
  assert.deepEqual(stage.previews.map(row=>row.epoch),[1,2])
  assert.equal(stage.previews[0].imagePath,output+'/fixed-epoch-previews/epoch-1.webp')
  assert.equal(stage.previews[0].imageSha256,'a'.repeat(64))
  assert.deepEqual(stage.previews[0].machineReviewIssueCodes,['object_shape'])
  assert.equal(stage.previews[1].machineReviewPassed,true)
})

test('stage history retains separate failure evidence and unavailable preview fallback',async()=>{
  const f=stageHistoryFixture('latest')
  f.directories.set(path.join(f.source.absoluteRoot,'failures'),['failure.json','latest.json','ignore.txt'])
  f.records.set(f.source.relativeRoot+'/failures/failure.json',{runId:'previous-failed-run',status:'failed',error:'private failure'})
  const rows=await f.reader(f.registry)
  assert.equal(rows.length,1)
  assert.equal(rows[0].kind,'failure')
  assert.equal(rows[0].runId,'previous-failed-run')
  assert.equal(rows[0].durationSeconds,null)
  assert.deepEqual(rows[0].previews,[])
  assert(!f.reads.some(([,file])=>file.endsWith('/failures/latest.json')))
  f.directories.clear()
  assert.deepEqual(await f.reader(f.registry),[])
})
const fixedNow = Date.parse('2026-11-11T00:00:00Z')
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])) }
  static now() { return fixedNow }
}
const sharedTime = loadProjectionModule('../shared/ai-console/ai-console-training-time',require,{Date:FixedDate})
const activityProjection = loadProjectionModule('ai-painter-training-activity-projection', id => {
  if (id === '@/shared/ai-console/ai-console-training-time') return sharedTime
  if (id === '@/server/ai-painter-training-progress-projection') return realProjection
  if (id === '@/server/ai-painter-live-activity-projection.mjs') return { selectLiveActivityState }
  throw Error(`unexpected projection dependency: ${id}`)
}, { Date: FixedDate, process: { kill(pid, signal) { assert.equal(signal, 0); if (pid !== 7) throw Error('process absent') } } })

function activityInput() {
  return { activeRunId: null, control: { status: 'idle', finishedAt: null }, runtimeStatus: { heartbeat: null, stale: false, staleAfterMs: 60000 }, stages: [], epochTarget: null, localProcesses: [], projectRelativePath: value => value }
}

test('observation ages preserve zero and past values without presenting future time as fresh',()=>{
  for(const [timestamp,expected] of [[null,null],['bad',null],[new Date(fixedNow+1).toISOString(),null],[new Date(fixedNow).toISOString(),0],[new Date(fixedNow-1234).toISOString(),1234]]){
    assert.equal(sharedTime.ageMilliseconds(timestamp),expected)
    const input=activityInput()
    input.runtimeStatus.heartbeat={status:'training',timestampUtc:timestamp}
    const current=activityProjection.projectCurrentExecutionActivity(input)
    assert.equal(current.heartbeatAgeSeconds,expected===null?null:expected/1000)
    const formal=activityProjection.projectPostDecodeFormalExecutionActivity({activity:current,execution:{runId:'private',state:{status:'completed'},terminal:{status:'direct_clean_latent_stage0_completed',recordedAtUtc:timestamp}},stages:[]})
    assert.equal(formal.heartbeatAgeSeconds,expected===null?null:expected/1000)
  }
})
function formalActivity(progress = null, phase = 'training', terminal = null,
  activity = activityProjection.projectCurrentExecutionActivity(activityInput())) {
  return activityProjection.projectPostDecodeFormalExecutionActivity({ activity, execution: { runId: 'private-formal-run', state: { status: 'running', phase }, terminal, progress }, stages: [] })
}

test('missing formal observations do not fabricate resolution, epochs, steps or 100 percent', () => {
  for (const progress of [null, {}, { liveProgress: {} }]) {
    const result = formalActivity(progress)
    assert.equal(result.lifecycle, 'stalled')
    for (const field of ['resolution', 'epoch', 'epochTarget', 'batch', 'batchTarget', 'optimizerStep', 'optimizerStepTarget', 'percentage']) assert.equal(result.progress[field], null, field)
    assert.equal(result.progressUnavailableReason, 'progress_observation_incomplete')
    assert(result.detailZh.includes('未记录'))
    assert(!result.detailZh.includes('40 Epoch'))
  }
})

test('observed zero and partial formal progress remain observations', () => {
  const liveProgress = { epoch: 0, epochTarget: 12, batch: 0, batchTarget: 9, optimizerStep: 0, optimizerStepTarget: 108, percentage: 0 }
  const result = formalActivity({ liveProgress })
  for (const [field, value] of Object.entries(liveProgress)) assert.equal(result.progress[field], value)
  assert.equal(result.progressUnavailableReason, null)
  const partial = formalActivity({ liveProgress: { optimizerStep: 3 } })
  assert.equal(partial.progress.optimizerStep, 3)
  assert.equal(partial.progress.optimizerStepTarget, null)
  assert.equal(partial.progress.percentage, null)
})

test('terminal verdict does not invent missing progress or review sample counts', () => {
  const completed = formalActivity(null, 'terminal', { status: 'direct_clean_latent_stage0_completed' })
  assert.equal(completed.lifecycle, 'completed')
  assert.equal(completed.progress.percentage, null)
  const reviewing = formalActivity(null, 'automatic_machine_review', null, liveActivity('private-formal-run', 'reviewing'))
  assert(reviewing.taskLabelZh.includes('未记录/未记录'))
  const failed = formalActivity(null, 'terminal', { status: 'direct_clean_latent_stage0_real_visual_failure' })
  assert.equal(failed.lifecycle, 'failed')
  assert(failed.detailZh.includes('未记录/未记录'))
})

test('stale heartbeat remains stalled and historical stages remain inactive', () => {
  const input = activityInput()
  input.runtimeStatus = { ...input.runtimeStatus, stale: true, heartbeat: { status: 'training', controllerPid: 7, childPid: 7, timestampUtc: '2026-11-10T00:00:00Z' } }
  input.stages = [{ runId: 'historical-run', status: 'completed', epochCount: 40, metrics: [], previews: [] }]
  const result = activityProjection.projectCurrentExecutionActivity(input)
  assert.equal(result.lifecycle, 'stalled')
  assert.equal(result.localAiProcessActive, false)
  assert.equal(result.progress.runId, null)
  assert.equal(result.progress.percentage, null)
  assert.equal(result.sourcePath, null)
})

test('formal projection ignores absent and unrecognized execution states', () => {
  const activity = activityProjection.projectCurrentExecutionActivity(activityInput())
  for (const execution of [null, { runId: 'private', state: { status: 'unrecognized' }, terminal: null }]) assert.equal(activityProjection.projectPostDecodeFormalExecutionActivity({ activity, execution, stages: [] }), activity)
})

test('formal state alone cannot revive a stopped or stale execution', () => {
  const result = formalActivity()
  assert.equal(result.lifecycle, 'stalled')
  assert.equal(result.stalled, true)
  assert.equal(result.localAiProcessActive, false)
  assert.equal(result.source, 'formal_stage0_state_without_live_execution')
  assert.equal(result.progress.etaSeconds, null)
})

test('same-run terminal evidence takes precedence over an old running state', () => {
  for (const [suffix, expected] of [['completed', 'completed'], ['real_visual_failure', 'failed']]) {
    const result = formalActivity(null, 'training', { status: `direct_clean_latent_stage0_${suffix}` })
    assert.equal(result.lifecycle, expected)
    assert.equal(result.localAiProcessActive, false)
    assert.equal(result.stalled, false)
    assert.equal(result.source, 'formal_stage0_phase_terminal')
  }
})

function liveActivity(runId = 'private-formal-run', status = 'training') {
  const input = activityInput()
  input.activeRunId = runId
  input.runtimeStatus = { ...input.runtimeStatus, heartbeat: { status, controllerPid: 7, childPid: 7, timestampUtc: '2026-11-11T00:00:00Z', activeTaskId: runId } }
  input.stages = [{ status: 'running', runId, epochCount: 2, metrics: [], previews: [], liveProgress: { epoch: 2, epochTarget: 10, percentage: 20 } }]
  return activityProjection.projectCurrentExecutionActivity(input)
}

test('current progress excludes other Run data even when an unrelated process is alive', () => {
  const input = activityInput()
  input.activeRunId = 'current-run'
  input.runtimeStatus.heartbeat = { status: 'training', childPid: 7, controllerPid: 7, activeTaskId: 'current-run', timestampUtc: '2026-11-11T00:00:00Z' }
  input.stages = [{ status: 'running', runId: 'old-run', epochCount: 3, metrics: [], previews: [], liveProgress: { epoch: 3, localTrainingTokenCount: 999 } }]
  for (const runId of ['current-run', null]) {
    const result = activityProjection.projectCurrentExecutionActivity({ ...input, activeRunId: runId })
    for (const field of ['runId', 'epoch', 'epochTarget', 'percentage', 'trainCompositeLoss', 'latestPreviewPath']) assert.equal(result.progress[field], null, field)
    assert.equal(result.accounting.localModel.total, null)
  }
})

test('missing target epochs cannot be inferred from completed epochs as 100 percent', () => {
  const input = activityInput()
  input.activeRunId = 'current-run'
  input.runtimeStatus.heartbeat = { status: 'training', childPid: 7, controllerPid: 7, activeTaskId: 'current-run', timestampUtc: '2026-11-11T00:00:00Z' }
  input.stages = [{ status: 'running', runId: 'current-run', epochCount: 3, metrics: [], previews: [], liveProgress: { epoch: 3 } }]
  const result = activityProjection.projectCurrentExecutionActivity(input)
  assert.equal(result.progress.epoch, 3)
  assert.equal(result.progress.epochTarget, null)
  assert.equal(result.progress.percentage, null)
  const known = activityProjection.projectCurrentExecutionActivity({ ...input, epochTarget: 12 })
  assert.equal(known.progress.percentage, 25)
})

const statusIdentity = { modelId: 'private-model', datasetPackageId: 'private-data', checkpointSha256: null, trainingChainId: null }
function formalStatusRows(activity, phase = 'training', changes = {}) {
  return activityProjection.projectFormalTrainingStatusEvidence({ runId: 'private-formal-run', state: { status: 'running', phase }, terminal: null, ...changes }, activity, statusIdentity)
}

test('formal dashboard status requires matching live activity and never supplies fixed budgets', () => {
  const inactive = activityProjection.projectCurrentExecutionActivity(activityInput())
  for (const activity of [inactive, liveActivity('other-run'), { ...liveActivity(), stalled: true }]) {
    assert.equal(formalStatusRows(activity).filter(row => row.valid).length, 0)
  }
  const running = formalStatusRows(liveActivity()).filter(row => row.valid)
  assert.equal(running.length, 1)
  assert.equal(running[0].code, 'formal_stage0_running')
  assert(running[0].summary.includes('2/10'))
  const reviewing = formalStatusRows(liveActivity('private-formal-run', 'reviewing'), 'automatic_machine_review').filter(row => row.valid)
  assert.equal(reviewing.length, 1)
  assert(reviewing[0].summary.includes('未记录/未记录'))
  for (const row of [...running, ...reviewing]) assert.doesNotMatch(row.summary, /40 Epoch|六个|六节点/)
})

test('terminal dashboard evidence suppresses stale running state and preserves real zero review counts', () => {
  for (const [suffix, code] of [['completed', 'formal_stage0_completed'], ['real_visual_failure', 'formal_stage0_real_visual_failure']]) {
    const rows = formalStatusRows(liveActivity(), 'training', { terminal: { status: `direct_clean_latent_stage0_${suffix}` } }).filter(row => row.valid)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].code, code)
    assert.doesNotMatch(rows[0].summary, /六节点/)
    if (suffix === 'real_visual_failure') assert(rows[0].summary.includes('未记录/未记录'))
  }
  const rows = formalStatusRows(liveActivity(), 'training', { terminal: { status: 'direct_clean_latent_stage0_real_visual_failure' }, review: { previewPassCount: 0, previewCount: 12 } })
  assert(rows.find(row => row.valid).summary.includes('0/12'))
})

test('matching observed training and review retain their actual live state', () => {
  for (const [status, phase, expected] of [['training', 'training', 'running'], ['reviewing', 'automatic_machine_review', 'reviewing']]) {
    const activity = liveActivity('private-formal-run', status)
    const result = activityProjection.projectPostDecodeFormalExecutionActivity({ activity, execution: { runId: 'private-formal-run', state: { status: 'running', phase }, progress: { liveProgress: { percentage: 20 } } }, stages: [] })
    assert.equal(result.lifecycle, expected)
    assert.equal(result.stalled, false)
    assert.equal(result.progress.percentage, 20)
    assert.equal(result.process.childPid, 7)
    assert.equal(result.localAiProcessActive, activity.localAiProcessActive)
  }
})

test('a different active Run is not replaced by the latest formal training record', () => {
  const activity = liveActivity('other-active-run')
  for (const terminal of [null, { status: 'direct_clean_latent_stage0_completed' }]) {
    const result = activityProjection.projectPostDecodeFormalExecutionActivity({ activity, execution: { runId: 'private-formal-run', state: { status: 'running', phase: 'training' }, terminal }, stages: [] })
    assert.equal(result, activity)
    assert.equal(result.taskId, 'other-active-run')
  }
})

test('formal records do not inherit another Run process, batch timing or token counts', () => {
  const activity = liveActivity('other-run')
  activity.lifecycle = 'completed'
  activity.progress.lastBatchDurationSeconds = 7
  activity.progress.samplesInBatch = 8
  activity.accounting.localModel = { available: true, unit: 'latent_spatial_token', total: 900, source: 'other-ledger' }
  const result = activityProjection.projectPostDecodeFormalExecutionActivity({ activity, execution: { runId: 'private-formal-run', state: { status: 'completed' }, terminal: { status: 'direct_clean_latent_stage0_completed' } }, stages: [] })
  assert.equal(result.lifecycle, 'completed')
  assert.equal(result.process.childPid, null)
  assert.equal(result.accounting.localModel.total, null)
  assert.equal(result.progress.lastBatchDurationSeconds, null)
  assert.equal(result.progress.samplesInBatch, null)
})
const currentTrainingSource = readFileSync(
  new URL('../../src/server/ai-painter-current-training.ts', import.meta.url),
  'utf8',
)

test('invalid current registry bypasses historical status selection even without model identity', () => {
  const ast = ts.createSourceFile('current-training.ts', currentTrainingSource, ts.ScriptTarget.Latest, true)
  const snapshot = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildSnapshot')
  const selected = snapshot.body.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ['registryFailureStatus', 'projectedStatus'].includes(declaration.name.getText(ast))))
  assert.equal(selected.length, 2)
  const body = ts.transpileModule(selected.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const project = new Function('currentRegistry', 'activeTaskIdentity', 'selectAuthoritativeTrainingEvidence', `${body}\nreturn projectedStatus;`)
  for (const identity of [statusIdentity, { modelId: null, datasetPackageId: null, checkpointSha256: null, trainingChainId: null }]) {
    const status = project({ ok: false }, identity, () => assert.fail('invalid registry must not select historical evidence'))
    assert.equal(status.code, 'current_registry_unknown_or_stale')
    assert.equal(status.source, 'current_execution_registry')
    assert.equal(status.occurredAtUtc, null)
    assert.deepEqual(status.taskIdentity, identity)
    assert(status.summary.includes('不使用历史训练状态替代'))
  }
})
test('current dashboard has no private historical task discovery fallback', () => {
  const ast = ts.createSourceFile('current-training.ts', currentTrainingSource, ts.ScriptTarget.Latest, true)
  const retiredNames = new Set(['readCurrentR5Stage4TaskCapsule', 'readCurrentAutonomousStage4TaskCapsule', 'readLatestPostDecodeFormalExecution'])
  const snapshot = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildSnapshot')
  assert(snapshot?.body)
  const calls = []
  function visit(node) {
    if (ts.isIdentifier(node)) assert.equal(retiredNames.has(node.text), false, node.text)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.push(node.expression.text)
    ts.forEachChild(node, visit)
  }
  visit(snapshot.body)
  assert(calls.includes('readCurrentExecutionRegistry'))
  for (const node of ast.statements) if (ts.isFunctionDeclaration(node)) assert.equal(retiredNames.has(node.name?.text), false)
})
const currentTrainingCompiled = ts.transpileModule(currentTrainingSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText
const currentTrainingModule = { exports: {} }
const currentTrainingRequire = id => {
  if (id === '@/server/ai-painter-training-progress-projection') return realProjection
  if (id.startsWith('@/server/')) return new Proxy({}, { get: () => () => null })
  return require(id)
}
new Function('require', 'module', 'exports', currentTrainingCompiled)(
  currentTrainingRequire,
  currentTrainingModule,
  currentTrainingModule.exports,
)
const {
  adaptV24TrainingProgress,
  classifyBoundActiveTrainingProgress,
} = currentTrainingModule.exports

test('dashboard public progress exports are the actual pure projection implementation', () => {
  assert.equal(adaptV24TrainingProgress, realProjection.adaptV24TrainingProgress)
  assert.equal(classifyBoundActiveTrainingProgress, realProjection.classifyBoundActiveTrainingProgress)
  const content = readFileSync(new URL('../../src/server/ai-painter-training-progress-projection.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('projection.ts', content, ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isImportDeclaration(node)) assert.equal(node.importClause?.isTypeOnly, true, 'pure evidence projection must not load IO')
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword)
      if (ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
})

function hardwareWithResponses(responses, osStub = null) {
  const calls = []
  const loaded = loadProjectionModule('ai-painter-training-hardware', id => {
    if (id === '@/server/ai-painter-training-progress-projection') return realProjection
    if (id === 'node:os' && osStub) return osStub
    if (id === 'node:child_process') return { execFile(command, args, options, callback) {
      calls.push({ command, args, options })
      const response = responses.shift()
      assert.notEqual(response, undefined, 'unplanned process invocation')
      queueMicrotask(() => response instanceof Error ? callback(response) : callback(null, { stdout: response }))
    } }
    return require(id)
  })
  return { ...loaded, calls }
}

test('hardware observer reads GPU values through bounded hidden commands', async () => {
  const reader = hardwareWithResponses(['Test GPU, 24000, 3200, 20, 42, 1.2\n', '111\n222\n'])
  assert.deepEqual(await reader.readGpu(), { available: true, name: 'Test GPU', memoryTotalMiB: 24000, memoryUsedMiB: 3200, utilizationPercent: 20, temperatureCelsius: 42, driver: '1.2', activeComputeProcessCount: 2, observationIssues: [] })
  assert.equal(reader.calls.length, 2)
  for (const call of reader.calls) {
    assert.equal(call.command, 'nvidia-smi')
    assert.equal(call.options.windowsHide, true)
    assert.equal(call.options.timeout, 5000)
  }
})

test('GPU detail observation shares process counts and preserves unavailable memory', async () => {
  const reader=hardwareWithResponses(['Test GPU, 24000, 3200, 20, 42, 1.2','7, path,with,commas.exe, N/A\n7, path,with,commas.exe, N/A\n8, other.exe, 0'])
  const result=await reader.readGpu({includeProcessDetails:true})
  assert.equal(result.activeComputeProcessCount,2)
  assert.deepEqual(result.computeProcesses,[{pid:7,processName:'path,with,commas.exe',usedMemoryMiB:null},{pid:8,processName:'other.exe',usedMemoryMiB:0}])
  assert.equal(reader.calls.length,2)
  assert.equal(reader.calls[1].args[0],'--query-compute-apps=pid,process_name,used_memory')
})

test('GPU detail observation rejects invalid/conflicting rows and retains empty versus failed queries', async () => {
  for(const rows of ['0, bad.exe, 1','7, , 1','7','7, a.exe, 1\n7, b.exe, 1','7, a.exe, 1\n7, a.exe, 2']){
    const result=await hardwareWithResponses(['Test GPU, 10, 1, 2, 3, 4',rows]).readGpu({includeProcessDetails:true})
    assert.equal(result.computeProcesses,null);assert.equal(result.activeComputeProcessCount,null)
    assert.deepEqual(result.observationIssues,['gpu_process_observation_invalid'])
  }
  const empty=await hardwareWithResponses(['Test GPU, 10, 1, 2, 3, 4','']).readGpu({includeProcessDetails:true})
  assert.deepEqual(empty.computeProcesses,[]);assert.equal(empty.activeComputeProcessCount,0)
  const failed=await hardwareWithResponses(['Test GPU, 10, 1, 2, 3, 4',Error('private')]).readGpu({includeProcessDetails:true})
  assert.equal(failed.computeProcesses,null);assert.equal(failed.activeComputeProcessCount,null)
  const unavailable=await hardwareWithResponses([Error('private')]).readGpu({includeProcessDetails:true})
  assert.equal(unavailable.computeProcesses,null)
})

test('hardware observer retains GPU unavailability and handles process enumeration failure', async () => {
  const unavailable = hardwareWithResponses([Error('not installed')])
  const failed = await unavailable.readGpu()
  assert.equal(failed.available, false)
  for (const field of ['memoryTotalMiB', 'memoryUsedMiB', 'utilizationPercent', 'temperatureCelsius', 'activeComputeProcessCount']) assert.equal(failed[field], null)
  assert.deepEqual(failed.observationIssues, ['gpu_query_failed'])
  assert.equal(unavailable.calls.length, 1)
  const partial = hardwareWithResponses(['Test GPU, 24000, 3200, 20, 42, 1.2', Error('process query unavailable')])
  const result = await partial.readGpu()
  assert.equal(result.available, true)
  assert.equal(result.activeComputeProcessCount, null)
  assert.deepEqual(result.observationIssues, ['gpu_process_query_failed'])
})

test('GPU observations preserve real zero and distinguish unsupported metrics and processes', async () => {
  const zero = await hardwareWithResponses(['Test GPU, 24000, 0, 0, 0, 1.2', '']).readGpu()
  for (const field of ['memoryUsedMiB', 'utilizationPercent', 'temperatureCelsius', 'activeComputeProcessCount']) assert.equal(zero[field], 0)
  assert.deepEqual(zero.observationIssues, [])
  const unsupported = await hardwareWithResponses(['Test GPU, N/A, , 101, N/A, 1.2', '[Not Supported]']).readGpu()
  assert.equal(unsupported.available, true)
  for (const field of ['memoryTotalMiB', 'memoryUsedMiB', 'utilizationPercent', 'temperatureCelsius', 'activeComputeProcessCount']) assert.equal(unsupported[field], null)
  assert.equal(unsupported.observationIssues.length, 5)
})

test('GPU observer rejects ambiguous adapter output without inventing an aggregate', async () => {
  for (const [output, reason] of [['', 'gpu_observation_empty'], ['invalid', 'gpu_observation_invalid'], ['GPU A, 10, 1, 2, 3, 4\nGPU B, 20, 2, 3, 4, 5', 'gpu_multiple_rows_unsupported']]) {
    const reader = hardwareWithResponses([output])
    const result = await reader.readGpu()
    assert.equal(result.available, false)
    assert.equal(result.activeComputeProcessCount, null)
    assert.deepEqual(result.observationIssues, [reason])
    assert.equal(reader.calls.length, 1)
  }
})

test('GPU process observer counts unique valid processes and rejects malformed IDs', async () => {
  assert.equal((await hardwareWithResponses(['Test GPU, 10, 1, 2, 3, 4', '7\n7\n8']).readGpu()).activeComputeProcessCount, 2)
  for (const pid of ['0', '-1', '7.2', '1e2', '9007199254740992']) {
    const result = await hardwareWithResponses(['Test GPU, 10, 1, 2, 3, 4', pid]).readGpu()
    assert.equal(result.activeComputeProcessCount, null)
    assert.deepEqual(result.observationIssues, ['gpu_process_observation_invalid'])
  }
})

test('hardware observer parses a host snapshot and falls back on invalid output', async () => {
  const reader = hardwareWithResponses([JSON.stringify({ capturedAtUtc: '2026-11-11T00:00:00Z', cpu: { model: 'fixture', physicalCoreCount: 8, logicalProcessorCount: 16 }, memory: { totalMiB: 32000, usedMiB: 8000, availableMiB: 24000 }, disks: [{ name: 'F:', totalGiB: 1000, freeGiB: 500 }], networkAdapters: [], system: { hostname: 'fixture-host' } })])
  const snapshot = await reader.readHardware()
  assert.equal(snapshot.cpu.model, 'fixture')
  assert.equal(snapshot.memory.usedMiB, 8000)
  assert.equal(snapshot.disks[0].name, 'F:')
  assert.equal(snapshot.system.hostname, 'fixture-host')
  assert.equal(snapshot.observationSource, 'windows_cim')
  assert.equal(reader.calls[0].command, 'powershell')
  assert.equal(reader.calls[0].options.windowsHide, true)
  assert.equal(reader.calls[0].options.timeout, 5000)
  assert.equal(reader.calls[0].options.maxBuffer, 1024 * 1024)
  const fallback = await hardwareWithResponses(['invalid json']).readHardware()
  assert.equal(fallback.cpu.loadPercent, null)
  assert.deepEqual(fallback.disks, [])
  assert.equal(typeof fallback.system.hostname, 'string')
  assert.equal(fallback.observationSource, 'node_os_fallback')
  assert.equal(fallback.cpu.physicalCoreCount, null)
  assert.equal(fallback.cpu.maxClockMhz, null)
  assert.equal(fallback.cpu.packageCount, null)
})

test('partial CIM responses preserve missing metrics and observed zero separately', async () => {
  const result = await hardwareWithResponses([JSON.stringify({ cpu: { logicalProcessorCount: 8, loadPercent: 0 }, memory: { availableMiB: 0 }, disks: [{ name: 'Q:', freeGiB: 0 }] })]).readHardware()
  assert.equal(result.cpu.logicalProcessorCount, 8)
  assert.equal(result.cpu.loadPercent, 0)
  assert.equal(result.cpu.physicalCoreCount, null)
  assert.equal(result.cpu.packageCount, null)
  assert.equal(result.memory.availableMiB, 0)
  for (const field of ['totalMiB', 'usedMiB', 'usagePercent']) assert.equal(result.memory[field], null)
  assert.equal(result.disks[0].freeGiB, 0)
  assert.equal(result.disks[0].totalGiB, null)
  assert(result.observationIssues.includes('hardware_physical_core_count_unavailable'))
  assert(result.observationIssues.includes('hardware_memory_total_unavailable'))
})

test('OS fallback reports logical processors without inventing physical topology or maximum speed', async () => {
  const osStub = {
    cpus: () => Array.from({ length: 16 }, () => ({ model: 'Fixture CPU', speed: 2800 })),
    totalmem: () => 16 * 1024 ** 3, freemem: () => 8 * 1024 ** 3,
    type: () => 'Fixture OS', release: () => 'fixture-release', arch: () => 'fixture-arch', hostname: () => 'fixture-host', uptime: () => 123,
  }
  const result = await hardwareWithResponses([Error('fixture query failure')], osStub).readHardware()
  assert.equal(result.cpu.logicalProcessorCount, 16)
  assert.equal(result.cpu.physicalCoreCount, null)
  assert.equal(result.cpu.packageCount, null)
  assert.equal(result.cpu.currentClockMhz, 2800)
  assert.equal(result.cpu.maxClockMhz, null)
  assert.equal(result.memory.usedMiB, 8192)
  assert.equal(result.memory.usagePercent, 50)
  assert.equal(result.system.buildNumber, '--')
  assert.equal(result.observationSource, 'node_os_fallback')
  assert(result.observationIssues.includes('physical_cpu_topology_unavailable'))
})

test('actual PowerShell collector preserves absent CIM values and genuine zero in private providers', { skip: process.platform !== 'win32' }, async () => {
  const reader = hardwareWithResponses(['{}'])
  await reader.readHardware()
  const command = reader.calls[0].args.at(-1)
  const noAdapters = 'function Get-NetAdapter { param([switch]$Physical, [string]$ErrorAction) }\n'
  const empty = 'function Get-CimInstance { param([string]$ClassName, [string]$Filter) }\n'
  const partial = String.raw`
function Get-CimInstance {
  param([string]$ClassName, [string]$Filter)
  switch ($ClassName) {
    'Win32_Processor' { [pscustomobject]@{ Name='Fixture CPU'; NumberOfLogicalProcessors=8; LoadPercentage=0 } }
    'Win32_OperatingSystem' { [pscustomobject]@{ Caption='Fixture OS'; TotalVisibleMemorySize=1024000; FreePhysicalMemory=0 } }
    'Win32_LogicalDisk' { [pscustomobject]@{ DeviceID='Q:'; Size=1073741824; FreeSpace=0 }; [pscustomobject]@{ DeviceID='R:' } }
  }
}
`
  const run = provider => JSON.parse(execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', provider + noAdapters + command], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 }).trim())
  const missing = run(empty)
  assert.equal(missing.cpu.physicalCoreCount, null)
  assert.equal(missing.cpu.packageCount, null)
  assert.equal(missing.memory.totalMiB, null)
  assert.equal(missing.memory.usagePercent, null)
  assert.equal(missing.system.uptimeSeconds, null)
  const observed = run(partial)
  assert.equal(observed.cpu.physicalCoreCount, null)
  assert.equal(observed.cpu.logicalProcessorCount, 8)
  assert.equal(observed.cpu.loadPercent, 0)
  assert.equal(observed.cpu.packageCount, 1)
  assert.equal(observed.memory.availableMiB, 0)
  assert.equal(observed.memory.usagePercent, 100)
  assert.equal(observed.disks[0].freeGiB, 0)
  assert.equal(observed.disks[0].usagePercent, 100)
  assert.equal(observed.disks[1].totalGiB, null)
  assert.equal(observed.disks[1].usagePercent, null)
})

const activeExecution = {
  schemaVersion: 'ai-painter-current-active-execution-v1',
  runId: 'mvp256-dry-v24-run-a',
  packageId: 'mvp256-dry-v24-package-a',
  executionState: 'executing',
  processId: 22000,
  processStartIdentity: 'process-start-a',
  programLineage: {},
  lock: {
    path: '.runtime/ai-painter/stage4-mvp256-dry-v24-executions/mvp256-dry-v24-run-a/execution-lock.json',
    sha256: 'a'.repeat(64),
  },
  heartbeat: {
    path: '.runtime/ai-painter/stage4-mvp256-dry-v24-executions/mvp256-dry-v24-run-a/heartbeat.json',
    ttlSeconds: 120,
  },
}
const registry = {
  runId: activeExecution.runId,
  packageId: activeExecution.packageId,
  activeExecution,
  latestTrainingTerminal: {
    runId: 'legacy-completed-run',
    path: '.runtime/ai-painter/legacy-completed-run/phase-terminal.json',
    status: 'completed',
  },
}
const progress = {
  schemaVersion: 'ai-painter-stage4-mvp256-dry-v24-progress-v1',
  runId: activeExecution.runId,
  packageId: activeExecution.packageId,
  actualEpoch: 7,
  completedEpochs: 6,
  optimizerStepsGenerator: 336,
  optimizerStepsDiscriminator: 336,
  updatedAtUtc: '2026-09-29T19:40:00.000Z',
  executionState: 'executing',
}
const executionPackage = {
  schemaVersion: 'ai-painter-stage4-mvp256-dry-v24-execution-package-v1',
  runId: activeExecution.runId,
  packageId: activeExecution.packageId,
  trainingPlan: {
    epochs: 48,
    trainRows: 48,
    generatorOptimizerSteps: 2304,
    discriminatorOptimizerSteps: 2304,
  },
}

test('verified active V24 progress binds only to the lock-parent Run', () => {
  const result = classifyBoundActiveTrainingProgress(registry, progress)
  assert.equal(result.status, 'connected')
  assert.deepEqual(result.source, {
    runId: activeExecution.runId,
    packageId: activeExecution.packageId,
    outputRoot: '.runtime/ai-painter/stage4-mvp256-dry-v24-executions/mvp256-dry-v24-run-a',
    progressPath: '.runtime/ai-painter/stage4-mvp256-dry-v24-executions/mvp256-dry-v24-run-a/progress.json',
  })
})

test('idle registry does not promote the latest historical Run to active', () => {
  const result = classifyBoundActiveTrainingProgress(
    { ...registry, activeExecution: null },
    { ...progress, runId: 'legacy-completed-run' },
  )
  assert.equal(result.status, 'idle')
  assert.equal(result.source, null)
})

test('misbound V24 progress is rejected instead of displayed under the active Run', () => {
  for (const changed of [
    { runId: 'another-run' },
    { packageId: 'another-package' },
  ]) {
    const result = classifyBoundActiveTrainingProgress(registry, {
      ...progress,
      ...changed,
    })
    assert.equal(result.status, 'rejected')
    assert.match(result.reason, /identity_mismatch/)
  }
})

test('verified active registry without a persisted progress snapshot is disconnected', () => {
  const result = classifyBoundActiveTrainingProgress(registry, null)
  assert.equal(result.status, 'disconnected')
  assert.equal(result.source?.progressPath.endsWith('/progress.json'), true)
})

test('legacy latest record remains historical and cannot masquerade as active progress', () => {
  const result = classifyBoundActiveTrainingProgress(
    { ...registry, activeExecution: null },
    {
      schemaVersion: 'stage4-direct-clean-latent-stage0-progress-v1',
      runId: 'legacy-completed-run',
      status: 'running',
    },
  )
  assert.equal(result.status, 'idle')
})

test('V24 progress reads dynamic epoch and optimizer targets from its execution package', () => {
  assert.deepEqual(adaptV24TrainingProgress(progress, executionPackage), {
    schemaVersion: progress.schemaVersion,
    recordedAtUtc: progress.updatedAtUtc,
    recordedAtAsiaShanghai: null,
    phase: 'executing',
    epoch: 7,
    epochTarget: 48,
    // This protocol reports epoch/G/D counts, not a current batch ordinal.
    // Absence must remain unknown rather than inventing batch zero.
    batch: null,
    batchTarget: 48,
    optimizerStep: 336,
    optimizerStepTarget: 2304,
    percentage: 14.583333333333334,
    elapsedSeconds: null,
    etaSeconds: null,
    optimizerStepsPerSecond: null,
    batchLoss: null,
    rollingEpochLoss: null,
    lastBatchDurationSeconds: null,
    samplesInBatch: null,
    validationCompositeScore: null,
    checkpointSelectionScore: null,
    localDenoiserSampleForwardPasses: null,
    localTrainingTokenCount: null,
    localTrainingTokenUnit: null,
  })
})
