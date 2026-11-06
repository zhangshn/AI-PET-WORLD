import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { spawn } from 'node:child_process'
import { createEvolutionInputReader, buildNaturalWorldEvolutionDiagnosticInput, EVOLUTION_STORE } from './natural-world-evolution-input.mjs'
import { baselineCanonical, baselineDigest, baselineSha256, BASELINE_IDENTITY } from './natural-world-baseline-proof.mjs'
import { loadNaturalWorldBaselineRuntime } from './natural-world-baseline-ts-loader.mjs'

export const CANDIDATE_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
export const CANDIDATE_EVIDENCE = '.runtime/ai-painter/controller-repair-reviews/world-evolution-candidate-155-20261029'
export const CANDIDATE_CONTRACT_SHA = '3c6d5bf1963c5c1aad795b72b4b7af0a20aa6f5c1afb30f3c6a552a921a26b1e'
export const CANDIDATE_WIRE_SHA = 'd78eb34bbddd792a949831111cd815b92dca63031e510fdbcd5006ea8ce7d771'
export const CANDIDATE_WORKER = Object.freeze({ path: 'ml/ai-painter/scripts/world_environment_forward.py', sha256: 'b0679c451182d0da42bf462fd838e3cdc0b45fe824c1cb47cb0a08ab684c7f09' })
const contexts = new WeakMap(), executions = new WeakMap()
const need = (ok, why) => { if (!ok) throw new Error('evolution_candidate_' + why) }
const equal = (a, b) => baselineCanonical(a) === baselineCanonical(b)
const clone = value => JSON.parse(JSON.stringify(value))
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
function owned(context) { const c = contexts.get(context); need(c, 'reader_owned_context_required'); return c }
function exact(value, fields, why) { need(value && !Array.isArray(value) && typeof value === 'object' && equal(Object.keys(value).sort(), [...fields].sort()), why) }

/** Detect duplicate decoded keys before JSON.parse can silently overwrite them. */
export function parseCandidateOutput(bytes) {
  need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65536, 'output_byte_limit')
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('evolution_candidate_output_utf8') }
  let i = 0
  const ws = () => { while (/\s/.test(text[i] ?? '') && i < text.length) i++ }
  const string = () => {
    const start = i++; let escaped = false
    while (i < text.length) { const c = text[i++]; if (!escaped && c === '"') return JSON.parse(text.slice(start, i)); if (!escaped && c === '\\') escaped = true; else escaped = false }
    throw new Error('evolution_candidate_output_json')
  }
  const value = depth => {
    need(depth <= 32, 'output_depth'); ws()
    if (text[i] === '{') {
      i++; ws(); const keys = new Set()
      if (text[i] === '}') { i++; return }
      while (i < text.length) { ws(); need(text[i] === '"', 'output_json'); const k = string(); need(!keys.has(k), 'output_duplicate_key'); keys.add(k); ws(); need(text[i++] === ':', 'output_json'); value(depth + 1); ws(); const c = text[i++]; if (c === '}') return; need(c === ',', 'output_json') }
    } else if (text[i] === '[') {
      i++; ws(); if (text[i] === ']') { i++; return }
      while (i < text.length) { value(depth + 1); ws(); const c = text[i++]; if (c === ']') return; need(c === ',', 'output_json') }
    } else if (text[i] === '"') { string(); return }
    else { const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i)); need(m, 'output_json'); i += m[0].length; return }
    throw new Error('evolution_candidate_output_json')
  }
  value(0); ws(); need(i === text.length, 'output_json_trailing')
  const parsed = JSON.parse(text); baselineCanonical(parsed); return parsed
}

async function checkFacade(diagnostic) {
  const runtime = await loadNaturalWorldBaselineRuntime(CANDIDATE_ROOT)
  const restored = await runtime.facade.readNaturalWorldRuntimeSaveRecord({ ownerId: BASELINE_IDENTITY.ownerId,
    worldId: BASELINE_IDENTITY.worldId, expectedPlayerId: BASELINE_IDENTITY.playerId,
    expectedTick: 0, expectedStateVersion: 0, expectedFileSha256: diagnostic.worldBinding.storeRef.sha256 })
  need(restored.status === 'found' && restored.fileSha256 === diagnostic.worldBinding.storeRef.sha256 &&
    restored.record.recordContentSha256 === diagnostic.worldBinding.recordHash, 'original_facade_rejected')
  return { status: restored.status, fileSha256: restored.fileSha256, recordSha256: restored.record.recordContentSha256 }
}

/** No caller data, paths or loader injection. Trust is held only in this module's WeakMap. */
export async function prepareCandidateContext() {
  need(arguments.length === 0, 'no_caller_configuration')
  const deadlineAt = performance.now() + 120000
  const io = createEvolutionInputReader(CANDIDATE_ROOT)
  const bound = (ref, maximum = 8 * 1024 * 1024) => { const b = io.read(ref.path, maximum); need(baselineSha256(b) === ref.sha256, 'binding_changed_' + ref.path); return b }
  const probe = JSON.parse(bound({ path: CANDIDATE_EVIDENCE + '/probe-contract.json', sha256: CANDIDATE_CONTRACT_SHA }, 65536))
  const wire = JSON.parse(bound({ path: CANDIDATE_EVIDENCE + '/wire-contract.json', sha256: CANDIDATE_WIRE_SHA }, 65536))
  for (const ref of [...wire.producerCodeBindings, ...wire.archiveBindings, ...probe.modelCodeBindings,
    probe.checkpoint, probe.worldStore, probe.baselineSelection, probe.acceptanceModelIdentity, CANDIDATE_WORKER]) bound(ref)
  const diagnostic = buildNaturalWorldEvolutionDiagnosticInput({ read: io.read })
  const facade = await checkFacade(diagnostic)
  const w = diagnostic.worldBinding
  const input = { schemaVersion: wire.input.schemaVersion, taskId: probe.taskId, contractSha256: CANDIDATE_CONTRACT_SHA,
    worldBinding: { identity: w.identity, before: { tick: w.tick, stateVersion: w.stateVersion, eventCursor: w.eventCursor,
      fileSha256: w.storeRef.sha256, factsSha256: w.factsHash, stateSha256: w.stateHash, recordSha256: w.recordHash } },
    features: diagnostic.modelFeatures, historyOrigin: 'external_archival_context', productionReady: false }
  const inputBytes = Buffer.from(baselineCanonical(input) + '\n')
  need(inputBytes.length <= probe.limits.workerInputBytes, 'input_byte_limit')
  // Own-code bytes are captured before any child runs and checked again at completion.
  for (const p of ['scripts/lib/natural-world-evolution-candidate.mjs', 'scripts/run-natural-world-evolution-candidate.mjs']) io.read(p, 1024 * 1024)
  const refs = io.coverage().refs
  const context = Object.freeze({ type: 'reader-owned-world-evolution-probe-context-v1' })
  contexts.set(context, { probe, wire, diagnostic, facade, input: freeze(input), inputBytes,
    refs, initialReadCoverage: io.coverage(), used: false, deadlineAt })
  return context
}

export function candidateInputBytes(context) { return Buffer.from(owned(context).inputBytes) }
export function candidateContextEvidence(context) {
  const c = owned(context)
  return clone({ input: c.input, diagnostic: c.diagnostic, originalFacadeRead: c.facade,
    initialReadCoverage: c.initialReadCoverage, codeBindings: c.refs.filter(r => /\.(mjs|ts|py)$/.test(r.path)),
    workerCodeBindings: [CANDIDATE_WORKER, ...c.probe.modelCodeBindings] })
}

export async function recheckCandidateContext(context) {
  const c = owned(context), io = createEvolutionInputReader(CANDIDATE_ROOT)
  need(performance.now() < c.deadlineAt, 'total_timeout')
  for (const ref of c.refs) need(baselineSha256(io.read(ref.path, Math.max(ref.bytes, 1))) === ref.sha256, 'live_binding_changed_' + ref.path)
  const facade = await checkFacade(c.diagnostic)
  // Fresh reader after facade: never report the cached initial bytes as a final live read.
  const live = createEvolutionInputReader(CANDIDATE_ROOT).read(EVOLUTION_STORE, 4 * 1024 * 1024)
  need(baselineSha256(live) === c.input.worldBinding.before.fileSha256, 'live_world_changed')
  need(performance.now() < c.deadlineAt, 'total_timeout')
  return { readCoverage: io.coverage(), originalFacadeRead: facade, liveWorldSha256: baselineSha256(live) }
}

/** Pure output validation is NOT proof of process execution; tests may use synthetic bytes. */
export function validateCandidateOutput(context, bytes) {
  const c = owned(context), o = parseCandidateOutput(bytes), p = c.probe, input = c.input
  exact(o, c.wire.output.exactFields, 'output_fields')
  need(o.schemaVersion === c.wire.output.schemaVersion && o.taskId === p.taskId && o.contractSha256 === CANDIDATE_CONTRACT_SHA, 'output_identity')
  need(o.inputBytesSha256 === baselineSha256(c.inputBytes) && o.inputContentSha256 === input.features.inputContentSha256 &&
    o.featureValueSha256 === baselineDigest(input.features.values) && o.worldBindingSha256 === baselineDigest(input.worldBinding), 'output_input_binding')
  need(o.checkpointSha256 === p.checkpoint.sha256 && equal(o.codeBindings, [CANDIDATE_WORKER, ...p.modelCodeBindings]), 'output_model_binding')
  need(equal(o.fieldOrder, p.features.fieldOrder) && equal(o.units, p.features.units), 'output_field_order_or_units')
  exact(o.forecastInterval, c.wire.output.forecastIntervalExactFields, 'output_interval_fields')
  need(equal(o.forecastInterval, p.features.forecastInterval), 'output_interval')
  need(o.modelExecuted === true && o.productionReady === false && o.trainingUpdates === 0 && o.worldWrites === 0, 'output_scope')
  need(Array.isArray(o.values) && o.values.length === 4 && o.values.every((value, i) => {
    const g = p.guards[p.features.fieldOrder[i]]
    return typeof value === 'number' && Number.isFinite(value) && value >= g.minimum && value <= g.maximum
  }), 'raw_values_outside_guards')
  const start = Date.parse(o.startedAtUtc), end = Date.parse(o.finishedAtUtc)
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}(?:Z|\+00:00)$/
  need(utc.test(o.startedAtUtc) && utc.test(o.finishedAtUtc) && Number.isFinite(start) && Number.isFinite(end) && end >= start &&
    Number.isFinite(o.elapsedSeconds) && o.elapsedSeconds >= 0 && o.elapsedSeconds <= p.limits.workerWallSeconds && end - start <= 30000, 'output_timing')
  return freeze({ output: o, outputSha256: baselineSha256(bytes), validationOnly: true,
    processExecutionVerified: false, productionReady: false })
}

/** One fixed child maximum per reader-owned context. No fake executable/path option. */
export async function executeCandidateWorker(context) {
  const c = owned(context); need(!c.used, 'worker_already_attempted'); c.used = true
  await recheckCandidateContext(context)
  const executable = path.join(CANDIDATE_ROOT, 'ml/ai-painter/.venv/Scripts/python.exe')
  need(fs.statSync(executable).isFile(), 'python_missing')
  const startedAtUtc = new Date().toISOString(), mono = performance.now()
  const result = await new Promise(resolve => {
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), failure = null, closed = false
    let stdoutComplete = true, stderrComplete = true
    const child = spawn(executable, ['-X', 'utf8', '-B', CANDIDATE_WORKER.path], { cwd: CANDIDATE_ROOT, windowsHide: true,
      env: { ...process.env, CUDA_VISIBLE_DEVICES: '', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2',
        NUMEXPR_NUM_THREADS: '2', PYTHONHASHSEED: '0', PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
    const stop = reason => { failure ??= reason; if (!closed) child.kill() }
    const timer = setTimeout(() => stop('worker_timeout'), Math.max(1, Math.min(30000, c.deadlineAt - performance.now())))
    const collect = (name, chunk) => {
      const previous = name === 'stdout' ? stdout : stderr
      const combined = Buffer.concat([previous, chunk.subarray(0, Math.max(0, 65536 - previous.length))])
      if (name === 'stdout') stdout = combined; else stderr = combined
      if (previous.length + chunk.length > 65536) {
        if (name === 'stdout') stdoutComplete = false; else stderrComplete = false
        stop(name + '_byte_limit')
      }
    }
    child.stdout.on('data', b => collect('stdout', b)); child.stderr.on('data', b => collect('stderr', b))
    child.on('error', e => { failure ??= 'spawn_error:' + e.message })
    child.stdin.on('error', e => { failure ??= 'stdin_error:' + e.message })
    child.on('close', (exitCode, signal) => {
      closed = true; clearTimeout(timer)
      const receipt = { executionKind: 'actual_child_process', executable, arguments: ['-X', 'utf8', '-B', CANDIDATE_WORKER.path],
        pid: child.pid ?? null, startedAtUtc, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - mono,
        exitCode, signal, failure, inputBytes: c.inputBytes.length, inputSha256: baselineSha256(c.inputBytes),
        stdoutBytes: stdout.length, stdoutSha256: baselineSha256(stdout), stderrBytes: stderr.length, stderrSha256: baselineSha256(stderr),
        stdoutComplete, stderrComplete,
        modelExecutionStatus: child.pid ? 'attempted_outcome_unverified' : 'not_started', cpuThreads: 2, gpuAllowed: false }
      resolve({ stdout, stderr, receipt })
    })
    child.stdin.end(c.inputBytes)
  })
  const token = Object.freeze({ type: 'actual-worker-process-receipt-v1' })
  executions.set(token, { context, ...result })
  return token
}

export function candidateProcessEvidence(execution) {
  const e = executions.get(execution); need(e, 'owned_process_required')
  return { stdout: Buffer.from(e.stdout), stderr: Buffer.from(e.stderr), receipt: clone(e.receipt) }
}

/** A receipt shape check alone never registers a process in the private execution map. */
export function validateCandidateProcessReceipt(receipt) {
  need(receipt?.executionKind === 'actual_child_process' && receipt.exitCode === 0 && receipt.signal === null &&
    receipt.failure === null && Number.isSafeInteger(receipt.pid) && receipt.pid > 0 &&
    receipt.stdoutComplete === true && receipt.stderrComplete === true &&
    Number.isFinite(receipt.elapsedMs) && receipt.elapsedMs >= 0 && receipt.elapsedMs <= 30000,
  'worker_process_failed')
}

export function buildExecutedCandidate(context, execution) {
  const c = owned(context), e = executions.get(execution)
  need(e && e.context === context, 'owned_process_required')
  validateCandidateProcessReceipt(e.receipt)
  const validated = validateCandidateOutput(context, e.stdout), o = validated.output
  need(Date.parse(o.startedAtUtc) >= Date.parse(e.receipt.startedAtUtc) - 1000 &&
    Date.parse(o.finishedAtUtc) <= Date.parse(e.receipt.finishedAtUtc) + 1000, 'worker_time_outside_process')
  return freeze({ schemaVersion: 'natural-world-evolution-candidate-probe-v1', taskId: c.probe.taskId,
    contractSha256: CANDIDATE_CONTRACT_SHA, identity: c.input.worldBinding.identity, before: c.input.worldBinding.before,
    worldBindingMeaning: 'identity_and_freshness_metadata_not_model_features', historyOrigin: 'external_archival_context',
    forecastInterval: o.forecastInterval, forecastIntervalMeaning: 'external_archival_training_period_probe_not_world_logical_time',
    changes: o.fieldOrder.map((fieldId, i) => ({ fieldId, kind: 'proposed_set', value: o.values[i], unit: o.units[i] })),
    valueTreatment: 'raw_no_clipping', guardPurpose: 'empirical_diagnostic_only_not_physical_limits',
    model: { checkpoint: c.probe.checkpoint, inputBytesSha256: o.inputBytesSha256, outputBytesSha256: validated.outputSha256,
      featureValueSha256: o.featureValueSha256, modelExecuted: true, forwardRuns: 1, trainingUpdates: 0, codeBindings: o.codeBindings },
    worldClock: c.diagnostic.worldClock, worldHistory: c.diagnostic.worldHistory,
    readiness: { productionReady: false, stateCommitted: false, tickAdvanced: false, capabilityPublished: false,
      worldEntryEligible: false, mvpQualified: false, initializationRequired: true,
      blockers: [...c.diagnostic.readiness.blockers, 'world_evolution_capability_unpublished',
        'production_consumer_does_not_support_probe_schema', 'archival_training_period_not_independent_generalization'] } })
}
