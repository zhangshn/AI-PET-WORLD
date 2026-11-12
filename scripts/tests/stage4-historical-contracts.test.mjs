import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {adjudicateStage4BoundedCandidate, buildStage4CapabilityCandidate, materializeStage4BoundedCandidate} from '../lib/ai-painter-stage4-bounded-candidate-planner-v1.mjs';
import {buildAuthoritativeSemanticCarrierInactiveConfig, validateAuthoritativeSemanticCarrierInactiveConfig} from '../lib/ai-painter-stage4-authoritative-semantic-carrier-v1.mjs';

// Compatibility coverage calls the existing libraries, never the retired CLIs.
const evidence = () => ({
  original64: {schemaVersion: 'stage4-original-64-contract-correction-terminal-v1', status: 'stage4_original_64_contract_satisfied_sufficiency_undefined_closed', selectedDecision: 'original_64_contract_did_not_define_stage4_sufficiency', original64ContractSatisfied: true, dataDefectProven: false},
  autoencoder: {schemaVersion: 'stage4-frozen-autoencoder-semantic-retention-terminal-v1', status: 'stage4_frozen_autoencoder_semantic_retention_sufficient_closed', selectedDecision: 'frozen_autoencoder_semantic_retention_sufficient', autoencoderStateUnchanged: true},
  conditionFusion: {schemaVersion: 'stage4-condition-fusion-stage0-final-route-terminal-v1', status: 'condition_fusion_multisample_semantic_capacity_insufficient_confirmed', selectedCause: 'C'},
  capacity: {schemaVersion: 'stage4-capacity-route-exit-project-route-decision-terminal-v1', status: 'capacity_structure_route_exited_project_level_owner_decision_required'},
  threeComponent: {schemaVersion: 'stage4-three-component-smoke-failure-boundary-terminal-v2', executionState: 'completed', status: 'three_component_smoke_failure_boundary_adjudicated', selectedCause: 'A', gpuStarted: false, trainingStarted: false},
});
const candidate = sourceEvidence => buildStage4CapabilityCandidate({capabilityVersion: 'stage4-bounded-test-candidate', sourceEvidence, adjudication: adjudicateStage4BoundedCandidate(evidence())});
function removeFixture(root) {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  assert.match(path.basename(root), /^stage4-historical-contract-/u);
  fs.rmSync(root, {recursive: true});
}

test('historical candidate planner preserves prior coverage and rejects capability identity errors', async t => {
  const positive = [
    ['five_exact_terminals_select_model_family', () => assert.equal(adjudicateStage4BoundedCandidate(evidence()).selectedOption, 'bounded_new_model_family_design_candidate')],
    ['minimum_change_axis_is_model_family', () => assert.equal(adjudicateStage4BoundedCandidate(evidence()).changeClass, 'model_family')],
    ['next_action_is_cpu_isolated_design', () => assert.equal(adjudicateStage4BoundedCandidate(evidence()).nextLifecycleAction, 'local_ai_execute_isolated_model_family_design')],
    ['candidate_has_no_human_gate', () => {const c = candidate([{role: 'x', path: 'x', sha256: 'a'.repeat(64)}]); assert.equal(c.ownerAuthorizationRequired, false); assert.equal(c.ownerInLifecycle, false);}],
    ['candidate_is_cpu_design_only', () => {const c = candidate([]); assert.equal(c.scope.phase, 'cpu_design_only'); assert.ok(Object.entries(c.scope).filter(([key]) => key.endsWith('Allowed')).every(([, value]) => value === false));}],
    ['business_and_data_boundary_frozen', () => {const c = candidate([]); assert.equal(c.frozenBusinessAndDataBoundary.approvedSampleCount, 64); assert.equal(c.frozenBusinessAndDataBoundary.conditionChannelCount, 23); assert.equal(c.frozenBusinessAndDataBoundary.machineReviewThresholdsUnchanged, true);}],
    ['caller_design_fields_do_not_change_derived_candidate', () => assert.deepEqual(buildStage4CapabilityCandidate({capabilityVersion: 'stage4-bounded-test-candidate', sourceEvidence: [], adjudication: adjudicateStage4BoundedCandidate(evidence()), modelName: 'untrusted', baseWidth: 128, layerCount: 999, lossWeight: 20, learningRate: 2}), candidate([]))],
  ];
  const mutations = [
    ['missing_autoencoder_evidence_rejected', v => {delete v.autoencoder;}],
    ['proven_data_defect_rejected', v => {v.original64.dataDefectProven = true;}],
    ['autoencoder_gap_rejected', v => {v.autoencoder.selectedDecision = 'frozen_autoencoder_semantic_retention_gap_confirmed';}],
    ['condition_route_not_exited_rejected', v => {v.conditionFusion.status = 'running';}],
    ['capacity_route_not_exited_rejected', v => {v.capacity.status = 'running';}],
    ['three_component_non_A_rejected', v => {v.threeComponent.selectedCause = 'B';}],
    ['causal_gpu_start_rejected', v => {v.threeComponent.gpuStarted = true;}],
  ];
  for (const [name, check] of positive) await t.test(name, check);
  for (const [name, mutate] of mutations) await t.test(name, () => {const value = evidence(); mutate(value); assert.throws(() => adjudicateStage4BoundedCandidate(value));});
  // The old case was named free_architecture_field_rejected, but supplied no
  // architecture field. Its actual rejection is the invalid capability identity.
  await t.test('invalid_capability_version_rejected', () => assert.throws(() => buildStage4CapabilityCandidate({capabilityVersion: 'bad', sourceEvidence: [], adjudication: adjudicateStage4BoundedCandidate(evidence())}), /capabilityVersion is invalid/u));
  await t.test('wrong_sha256_rejected', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage4-historical-contract-'));
    try {
      const policy = 'data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json';
      fs.mkdirSync(path.dirname(path.join(root, policy)), {recursive: true});
      fs.copyFileSync(policy, path.join(root, policy));
      const sourceEvidence = Object.entries(evidence()).map(([role, body], index) => {
        const relative = `fixtures/${role}.json`, absolute = path.join(root, relative), bytes = Buffer.from(JSON.stringify(body));
        fs.mkdirSync(path.dirname(absolute), {recursive: true}); fs.writeFileSync(absolute, bytes);
        return {role, path: relative, sha256: index === 0 ? '0'.repeat(64) : crypto.createHash('sha256').update(bytes).digest('hex')};
      });
      assert.throws(() => materializeStage4BoundedCandidate({root, capabilityVersion: 'stage4-wrong-hash-candidate', sourceEvidence}), /original64 SHA-256 mismatch/u);
      assert.equal(fs.existsSync(path.join(root, '.runtime')), false, 'bad binding must reject before materialization');
    } finally {removeFixture(root);}
  });
  t.diagnostic('historical-planner-cases=' + JSON.stringify({positive: positive.map(([name]) => name), negative: [...mutations.map(([name]) => name), 'invalid_capability_version_rejected', 'wrong_sha256_rejected']}));
});

test('historical semantic carrier preserves the original CPU checker and all activation gates', t => {
  const root = process.cwd(), read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const contract = read('data/ai-painter/system-governance/stage4-authoritative-visual-semantic-carrier-model-family-contract-v1.json');
  assert.equal(contract.status, 'cpu_supported_inactive');
  assert.ok(Object.values(contract.activationGates).every(value => value === false));
  const config = buildAuthoritativeSemanticCarrierInactiveConfig(read('ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json'));
  assert.equal(validateAuthoritativeSemanticCarrierInactiveConfig(config), true);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'stage4-historical-contract-'));
  try {
    const configPath = path.join(fixture, 'inactive-config.json');fs.writeFileSync(configPath, JSON.stringify(config));
    const result = spawnSync(path.join(root, 'ml/ai-painter/.venv/Scripts/python.exe'), [path.join(root, 'ml/ai-painter/scripts/check_stage4_authoritative_semantic_carrier_cpu.py'), configPath], {
      cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
      env: {...process.env, CUDA_VISIBLE_DEVICES: '', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2'},
    });
    assert.equal(result.error, undefined);assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'passed');assert.equal(report.positivePassed, report.positiveTotal);assert.equal(report.negativePassed, report.negativeTotal);
    assert.equal(report.positiveTotal, 12);assert.equal(report.negativeTotal, 6);
    for (const key of ['checkpointWeightsRead', 'gpuStarted', 'optimizerCreated', 'trainingStarted']) assert.equal(report[key], false);
    assert.equal(report.positiveResults.find(item => item.name === 'model_state_unchanged')?.passed, true);
    // autograd.grad is exercised by the frozen checker; this is CPU validation,
    // not optimizer training, and must not be reported as zero model computation.
    t.diagnostic('historical-carrier-report=' + JSON.stringify({...report, inactiveConfigValidated: true, contractValidated: true, ownerAuthorizationRequired: false}));
  } finally {removeFixture(fixture);}
});
