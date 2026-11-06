import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { buildNaturalWorldEvolutionDiagnosticInput, createEvolutionInputReader,
  EVOLUTION_INPUT_LIMITS, EVOLUTION_STORE } from './lib/natural-world-evolution-input.mjs'
import { BASELINE_IDENTITY, baselineDigest, baselineSha256 } from './lib/natural-world-baseline-proof.mjs'
import { loadNaturalWorldBaselineRuntime } from './lib/natural-world-baseline-ts-loader.mjs'

async function main() {
  const started = performance.now()
  const deadline = () => { if (performance.now() - started > EVOLUTION_INPUT_LIMITS.maxElapsedMs) throw new Error('evolution_input_total_timeout') }
  if (process.argv.length !== 2) throw new Error('usage: node scripts/run-natural-world-evolution-input.mjs')
  const root = fs.realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const runtimeRoot = fs.realpathSync(path.join(root, '.runtime'))
  if (fs.realpathSync(process.cwd()) !== root) throw new Error('evolution_input_cwd')
  process.env.OMP_NUM_THREADS = '2'; process.env.MKL_NUM_THREADS = '2'
  const startedAtUtc = new Date().toISOString()
  const io = createEvolutionInputReader(root)
  const result = buildNaturalWorldEvolutionDiagnosticInput({ read: io.read })
  // Reserve two additional full slot reads: the original facade and the final live check.
  if (io.coverage().bytes + 2 * result.worldBinding.storeRef.bytes > EVOLUTION_INPUT_LIMITS.maxReadBytes) {
    throw new Error('evolution_input_total_read_budget')
  }
  const journalPath = EVOLUTION_STORE + '.transaction.json'
  let journalBytes = 0
  if (fs.existsSync(path.join(root, journalPath))) journalBytes = io.read(journalPath, 1024 * 1024).length
  if (io.coverage().bytes + 2 * result.worldBinding.storeRef.bytes + journalBytes > EVOLUTION_INPUT_LIMITS.maxReadBytes) {
    throw new Error('evolution_input_total_read_budget')
  }
  const runtime = await loadNaturalWorldBaselineRuntime(root)
  const restored = await runtime.facade.readNaturalWorldRuntimeSaveRecord({
    ownerId: BASELINE_IDENTITY.ownerId, worldId: BASELINE_IDENTITY.worldId,
    expectedPlayerId: BASELINE_IDENTITY.playerId, expectedTick: 0, expectedStateVersion: 0,
    expectedFileSha256: result.worldBinding.storeRef.sha256 })
  deadline()
  if (restored.status !== 'found' || restored.fileSha256 !== result.worldBinding.storeRef.sha256 ||
    baselineDigest(restored.record) !== baselineDigest(JSON.parse(io.read(EVOLUTION_STORE, 4 * 1024 * 1024)))) {
    throw new Error('evolution_input_original_store_read_rejected')
  }
  // Recheck the live slot, rather than the cached read, before recording read-only success.
  const current = createEvolutionInputReader(root).read(EVOLUTION_STORE, 4 * 1024 * 1024)
  if (baselineSha256(current) !== result.worldBinding.storeRef.sha256) throw new Error('evolution_input_store_changed')
  const codePaths = ['scripts/run-natural-world-evolution-input.mjs', 'scripts/lib/natural-world-evolution-input.mjs',
    'scripts/lib/natural-world-temporal-data.mjs', 'scripts/lib/natural-world-baseline-proof.mjs',
    'scripts/lib/natural-world-baseline-ts-loader.mjs']
  const codeBindings = codePaths.map(p => { const b = io.read(p, 1024 * 1024); return { path: p, sha256: baselineSha256(b), bytes: b.length } })
  const runId = 'input-' + randomUUID()
  const logicalOutput = '.runtime/ai-painter/world-evolution-input-runs/' + runId + '/result.json'
  const reads = io.coverage()
  reads.scope = 'explicit_evidence_reads_plus_conservative_store_and_output_readback_reserves;_node_module_loading_excluded'
  reads.additionalStoreReadBudgetBytes = 2 * result.worldBinding.storeRef.bytes + journalBytes
  reads.outputReadbackReservedBytes = EVOLUTION_INPUT_LIMITS.maxOutputBytes
  reads.totalReadUpperBoundBytes = reads.bytes + reads.additionalStoreReadBudgetBytes + reads.outputReadbackReservedBytes
  if (reads.totalReadUpperBoundBytes > EVOLUTION_INPUT_LIMITS.maxReadBytes) throw new Error('evolution_input_total_read_budget')
  const output = { schemaVersion: 'natural-world-evolution-input-run-v1', runId, startedAtUtc,
    finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - started, result, codeBindings, reads,
    originalStoreRead: { status: restored.status, fileSha256: restored.fileSha256,
      recordHash: restored.record.recordContentSha256 }, limits: EVOLUTION_INPUT_LIMITS,
    calls: { network: 0, gpu: 0, training: 0, modelForward: 0, worldWrites: 0, capabilityWrites: 0 } }
  const bytes = Buffer.from(JSON.stringify(output, null, 2) + '\n')
  if (bytes.length > EVOLUTION_INPUT_LIMITS.maxOutputBytes) throw new Error('evolution_input_run_output_budget')
  deadline()
  if (fs.realpathSync(path.join(root, '.runtime')) !== runtimeRoot) throw new Error('evolution_input_runtime_mount_changed')
  let directory = runtimeRoot
  for (const part of ['ai-painter', 'world-evolution-input-runs']) {
    directory = path.join(directory, part)
    if (!fs.existsSync(directory)) fs.mkdirSync(directory)
    if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) throw new Error('evolution_input_output_link')
  }
  const runRoot = path.join(directory, runId)
  fs.mkdirSync(runRoot)
  const filename = path.join(runRoot, 'result.json')
  const fd = fs.openSync(filename, 'wx')
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  if (!fs.readFileSync(filename).equals(bytes)) throw new Error('evolution_input_output_readback')
  deadline()
  console.log(JSON.stringify({ status: result.status, runId, path: logicalOutput,
    sha256: baselineSha256(bytes), bytes: bytes.length, inputContentSha256: result.modelFeatures.inputContentSha256,
    productionReady: false, modelExecuted: false, worldWrites: 0 }))
}

main().catch(error => { console.error(JSON.stringify({ status: 'failed', error: error.message,
  productionReady: false, modelExecuted: false, worldWrites: 0 })); process.exitCode = 1 })
