import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { baselineSha256 } from './lib/natural-world-baseline-proof.mjs'
import { CANDIDATE_ROOT, CANDIDATE_EVIDENCE, prepareCandidateContext, candidateInputBytes,
  candidateContextEvidence, recheckCandidateContext, executeCandidateWorker,
  candidateProcessEvidence, buildExecutedCandidate } from './lib/natural-world-evolution-candidate.mjs'

// This entry has one fixed real model, one fixed output attempt and no retry/overwrite.
async function main() {
  const started = performance.now(), startedAtUtc = new Date().toISOString()
  if (process.argv.length !== 2 || fs.realpathSync(process.cwd()) !== CANDIDATE_ROOT) throw new Error('candidate_fixed_entry_usage')
  const runtime = fs.realpathSync(path.join(CANDIDATE_ROOT, '.runtime'))
  let directory = runtime
  for (const part of CANDIDATE_EVIDENCE.split('/').slice(1)) {
    directory = path.join(directory, part)
    if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) throw new Error('candidate_output_parent_link')
  }
  const outputDirectory = path.join(directory, 'actual-run-v1')
  fs.mkdirSync(outputDirectory) // An earlier attempt, including failure, is never overwritten.
  let writtenBytes = 0, execution = null, context = null, processEvidence = null
  const deadline = () => { if (performance.now() - started > 120000) throw new Error('candidate_total_timeout') }
  const write = (name, bytes) => {
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(JSON.stringify(bytes, null, 2) + '\n')
    if (writtenBytes + bytes.length > 8388608) throw new Error('candidate_artifact_budget')
    if (fs.realpathSync(path.join(CANDIDATE_ROOT, '.runtime')) !== runtime || fs.realpathSync(outputDirectory) !== outputDirectory || fs.lstatSync(outputDirectory).isSymbolicLink()) throw new Error('candidate_output_changed')
    const filename = path.join(outputDirectory, name), fd = fs.openSync(filename, 'wx')
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    writtenBytes += bytes.length
    if (!fs.readFileSync(filename).equals(bytes)) throw new Error('candidate_output_readback')
    return { path: CANDIDATE_EVIDENCE + '/actual-run-v1/' + name, sha256: baselineSha256(bytes), bytes: bytes.length }
  }
  const refs = []
  try {
    context = await prepareCandidateContext(); deadline()
    refs.push(write('input.json', candidateInputBytes(context)))
    refs.push(write('input-evidence.json', candidateContextEvidence(context)))
    refs.push(write('preflight.json', await recheckCandidateContext(context))); deadline()
    execution = await executeCandidateWorker(context)
    processEvidence = candidateProcessEvidence(execution)
    refs.push(write('worker-stdout.bin', processEvidence.stdout))
    refs.push(write('worker-stderr.bin', processEvidence.stderr))
    refs.push(write('process-receipt.json', processEvidence.receipt)); deadline()
    // On failed model output we still inspect protected bytes before reporting rejection.
    refs.push(write('postflight.json', await recheckCandidateContext(context))); deadline()
    const candidate = buildExecutedCandidate(context, execution)
    refs.push(write('candidate.json', candidate)); deadline()
    const result = { schemaVersion: 'natural-world-evolution-candidate-run-v1', taskId: 'WORLD-EVOLUTION-CANDIDATE-155',
      status: 'candidate_validated_production_blocked', startedAtUtc, finishedAtUtc: new Date().toISOString(),
      elapsedMs: performance.now() - started, refs, modelExecuted: true, modelForwardRuns: 1,
      productionReady: false, stateCommitted: false, tickAdvanced: false, worldWrites: 0, registryWrites: 0,
      blockers: candidate.readiness.blockers, artifactBytesBeforeResult: writtenBytes,
      evidenceMeaning: 'actual_archival_training_period_forward_and_candidate_handoff_only_not_world_evolution_or_new_generalization' }
    const resultRef = write('result.json', result)
    console.log(JSON.stringify({ status: result.status, resultRef, modelExecuted: true, productionReady: false, worldWrites: 0 }))
  } catch (error) {
    const failure = { schemaVersion: 'natural-world-evolution-candidate-failure-v1', taskId: 'WORLD-EVOLUTION-CANDIDATE-155',
      status: 'rejected', startedAtUtc, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - started,
      error: String(error.message).slice(0, 4000), refs, processReceipt: processEvidence?.receipt ?? null,
      modelExecutionStatus: processEvidence?.receipt?.pid ? 'attempted_outcome_unverified' : execution ? 'unknown' : 'not_started',
      modelExecuted: processEvidence?.receipt?.pid ? null : execution ? null : false,
      modelForwardRuns: processEvidence?.receipt?.pid ? null : execution ? null : 0,
      productionReady: false, stateCommitted: false, tickAdvanced: false, worldWrites: 0, registryWrites: 0 }
    const failureRef = write('failure.json', failure)
    console.error(JSON.stringify({ status: 'rejected', error: failure.error, failureRef, productionReady: false })); process.exitCode = 1
  }
}

main().catch(error => { console.error(JSON.stringify({ status: 'entry_rejected', error: error.message,
  productionReady: false, stateCommitted: false, tickAdvanced: false })); process.exitCode = 1 })
