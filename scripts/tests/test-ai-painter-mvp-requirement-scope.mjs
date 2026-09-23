import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMvpRequirements, SCOPE_SCHEMA } from '../lib/ai-painter-mvp-requirement-scope.mjs';

const scope = { schemaVersion: SCOPE_SCHEMA, worldCount: 1, regionCount: 1,
  batchGeneration: false, buildings: false, personality: false, claimsFullHistoryNovelty: false };
const novelty = { code: 'full_history_non_exact_novelty_qualification_missing', scope: 'novelty',
  details: { exactDeclaredGeometryMatches: 6, exactMatchIsNotAutomaticRejection: true,
    thumbnailRankingIsNotSemanticQualification: true } };
const protectedCodes = [
  'non_train_historical_optimizer_exposure_requires_resolution', 'historical_use_evidence_incomplete',
  'all_run_and_checkpoint_selection_coverage_unqualified', 'historical_structural_references_missing',
  'historical_topology_not_recorded', 'foundation_historical_binding_incomplete',
  'foundation_current_sample_overlap_requires_resolution', 'independent_holdout_qualification_missing',
  'source_license_missing', 'current_dataset_duplicate', 'worldfacts_rgb_conflict',
  'new_capability_gpu_qualification_not_established', 'split_smoke_lifecycle_execution_adapter_unregistered',
  'unrecognized_future_failure',
];
test('only pure all-history novelty deferred; original evidence retained', () => {
  const blockers = [novelty, ...protectedCodes.map(code => ({ code, scope: 'novelty', details: {} }))];
  const before = structuredClone(blockers);
  const result = classifyMvpRequirements({ scope, blockers });
  assert.deepEqual(result.activeBlockers, before.slice(1));
  assert.equal(result.deferredRequirements.length, 1);
  assert.deepEqual(result.deferredRequirements[0].originalFinding, novelty);
  assert.equal(result.deferredRequirements[0].passed, false);
  assert.equal(result.deferredRequirements[0].status, 'deferred_out_of_current_mvp_scope');
  assert.deepEqual(blockers, before);
  result.deferredRequirements[0].originalFinding.details.exactDeclaredGeometryMatches = 99;
  assert.deepEqual(blockers, before);
});
for (const patch of [{ worldCount: 2 }, { regionCount: 2 }, { batchGeneration: true },
  { buildings: true }, { personality: true }, { claimsFullHistoryNovelty: true }])
  test('expanded scope restores full requirements: ' + JSON.stringify(patch), () => {
    const r = classifyMvpRequirements({ scope: { ...scope, ...patch }, blockers: [novelty] });
    assert.equal(r.status, 'full_requirements_restored');
    assert.deepEqual(r.activeBlockers, [novelty]); assert.deepEqual(r.deferredRequirements, []);
  });
for (const value of [null, {}, { ...scope, worldCount: '1' }, { ...scope, regionCount: 0 },
  { ...scope, batchGeneration: 'false' }, { ...scope, permit: true }, { ...scope, schemaVersion: 'future' }])
  test('invalid scope fails closed: ' + JSON.stringify(value), () => {
    const r = classifyMvpRequirements({ scope: value, blockers: [novelty] });
    assert.equal(r.status, 'unknown_scope_blocked'); assert.deepEqual(r.activeBlockers, [novelty]);
    assert.equal(r.deferredRequirements.length, 0);
  });
test('mixed or changed novelty evidence is never silently deferred', () => {
  const blockers = [{ ...novelty, scope: 'historical_use' }, { ...novelty, sourceLeakage: true },
    { ...novelty, details: { ...novelty.details, sourceLeakage: true } },
    { ...novelty, details: null },
    { ...novelty, details: { ...novelty.details, exactDeclaredGeometryMatches: -1 } }];
  const r = classifyMvpRequirements({ scope, blockers });
  assert.deepEqual(r.activeBlockers, blockers); assert.equal(r.deferredRequirements.length, 0);
});
test('even all-deferred or empty diagnostics cannot grant execution or release', () => {
  for (const blockers of [[novelty], []]) {
    const r = classifyMvpRequirements({ scope, blockers });
    for (const key of ['trainingAllowed', 'gpuAllowed', 'dataQualified', 'capabilityReleased', 'productionScopeRegistered'])
      assert.equal(r[key], false);
    assert.equal(r.nextMachineAction, null);
    assert.equal(r.requiresNewDataCapabilityExecutionBindings, true);
  }
});
test('malformed blocker lists rejected', () => {
  for (const blockers of [null, {}, [null], [{ scope: 'novelty' }]])
    assert.throws(() => classifyMvpRequirements({ scope, blockers }));
});
