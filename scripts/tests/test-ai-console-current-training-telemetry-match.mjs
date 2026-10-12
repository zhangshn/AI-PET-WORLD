import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

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
const currentTrainingSource = readFileSync(
  new URL('../../src/server/ai-painter-current-training.ts', import.meta.url),
  'utf8',
)
const currentTrainingCompiled = ts.transpileModule(currentTrainingSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText
const currentTrainingModule = { exports: {} }
const currentTrainingRequire = id => {
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
