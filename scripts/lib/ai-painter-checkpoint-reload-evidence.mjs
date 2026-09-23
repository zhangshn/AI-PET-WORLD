// Evidence consistency component only: never grants data, GPU, model or release qualification.
import assert from 'node:assert/strict';
import {createReader} from './ai-painter-stage4-dataset-audit.mjs';

const binding = value => {
  assert.deepEqual(Object.keys(value ?? {}).sort(), ['path', 'sha256'], 'exact_binding_required');
  assert.equal(typeof value.path, 'string');
  assert.match(value.sha256, /^[a-f0-9]{64}$/u);
  return value;
};
const same = (a, b, message) => assert.deepEqual(a, b, message);

/** The enclosing trusted execution adapter must independently establish producer
 * identity and qualification. Hashes and recorded PIDs alone cannot establish either.
 * All artifacts use bounded project-local bindings, not caller-supplied pass flags.
 */
export function verifyCheckpointReloadEvidence({root, requestBinding, trainingBinding, reloadBinding}) {
  const reader = createReader(root);
  const request = reader.bound(binding(requestBinding));
  assert.equal(request.schemaVersion, 'ai-painter-checkpoint-reload-request-v1');
  assert.ok(typeof request.runId === 'string' && request.runId.length > 0, 'run_identity_required');
  assert.ok(typeof request.capabilityVersion === 'string' && request.capabilityVersion.length > 0, 'capability_identity_required');
  assert.ok(['cpu_fixture_only', 'candidate_evidence_only'].includes(request.evidenceScope), 'unsupported_scope');
  assert.ok(Array.isArray(request.sampleIds) && request.sampleIds.length > 0 && request.sampleIds.length <= 64, 'samples_required');
  assert.equal(new Set(request.sampleIds).size, request.sampleIds.length, 'duplicate_samples');
  assert.ok(request.sampleIds.every(id => typeof id === 'string' && id.length > 0), 'invalid_sample_identity');
  assert.ok(Number.isSafeInteger(request.optimizerSteps) && request.optimizerSteps > 0, 'step_count_required');
  assert.equal(request.comparison, 'exact_fixed_probe_outputs', 'unsupported_comparison');
  for (const key of ['data', 'trainerProgram', 'reloadProgram']) {
    const b = binding(request[key]); reader.bytes(b.path, b.sha256);
  }
  const training = reader.bound(binding(trainingBinding)), reload = reader.bound(binding(reloadBinding));
  for (const [report, schema] of [[training, 'ai-painter-checkpoint-training-receipt-v1'],
    [reload, 'ai-painter-checkpoint-reload-receipt-v1']]) {
    assert.equal(report.schemaVersion, schema, 'receipt_schema_mismatch');
    for (const key of ['runId', 'capabilityVersion', 'evidenceScope']) same(report[key], request[key], `${key}_mismatch`);
    same(report.request, requestBinding, 'request_identity_mismatch');
    same(report.sampleIds, request.sampleIds, 'probe_sample_identity_mismatch');
    assert.equal(report.device, 'cpu', 'cpu_evidence_required');
    assert.ok(Number.isSafeInteger(report.pid) && report.pid > 0, 'process_record_required');
    assert.ok(Array.isArray(report.outputs) && report.outputs.length === request.sampleIds.length, 'probe_count_mismatch');
    assert.ok(report.outputs.every(v => Number.isFinite(v)), 'nonfinite_probe');
  }
  assert.notEqual(training.pid, reload.pid, 'distinct_recorded_processes_required');
  same(training.program, request.trainerProgram, 'trainer_program_mismatch');
  same(reload.program, request.reloadProgram, 'reload_program_mismatch');
  assert.equal(training.optimizerSteps, request.optimizerSteps, 'optimizer_step_mismatch');
  assert.equal(training.nonTrainOptimizerSteps, 0, 'nontrain_update_recorded');
  assert.equal(reload.optimizerSteps, 0, 'reload_must_not_optimize');
  const checkpoint = binding(training.checkpoint);
  reader.bytes(checkpoint.path, checkpoint.sha256);
  same(reload.loadedCheckpoint, checkpoint, 'loaded_checkpoint_mismatch');
  same(reload.outputs, training.outputs, 'fixed_probe_reproduction_mismatch');
  reader.verifyStable();
  return {schemaVersion:'ai-painter-checkpoint-reload-consistency-v1',
    status:'checkpoint_reload_consistent_not_qualified', runId:request.runId,
    capabilityVersion:request.capabilityVersion, evidenceScope:request.evidenceScope,
    request:requestBinding, training:trainingBinding, reload:reloadBinding, checkpoint,
    probeCount:request.sampleIds.length, recordedProcessesDistinct:true,
    producerProcessIdentityVerified:false, modelSemanticsVerified:false,
    dataQualified:false, gpuQualified:false, trainingAllowed:false, releaseAllowed:false,
    inputReceipts:reader.receipts()};
}
