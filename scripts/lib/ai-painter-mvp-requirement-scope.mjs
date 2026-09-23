// Requirement applicability only. Never a data grant, training adapter or release.
import assert from 'node:assert/strict';

export const SCOPE_SCHEMA = 'ai-painter-natural-world-requirement-scope-v1';
export const DATA_POLICY_VERSION = 'AI-PAINTER-DATA-PROVENANCE-1.7';
const SCOPE_KEYS = ['schemaVersion', 'worldCount', 'regionCount', 'batchGeneration',
  'buildings', 'personality', 'claimsFullHistoryNovelty'];
const DEFERRED_CODE = 'full_history_non_exact_novelty_qualification_missing';
const DETAIL_KEYS = ['exactDeclaredGeometryMatches', 'exactMatchIsNotAutomaticRejection',
  'thumbnailRankingIsNotSemanticQualification'];

export function classifyMvpRequirements({ scope, blockers }) {
  assert.ok(Array.isArray(blockers), 'explicit_blockers_required');
  assert.ok(blockers.every(b => b && typeof b.code === 'string' && b.code.length
    && typeof b.scope === 'string' && b.scope.length), 'invalid_blocker');
  const retained = structuredClone(blockers);
  const base = {
    policyVersion: DATA_POLICY_VERSION, policySection: '9.1',
    requirementIds: ['MAP-023', 'MAP-024'],
    trainingAllowed: false, gpuAllowed: false, dataQualified: false,
    capabilityReleased: false, nextMachineAction: null,
    originalVerdictUnchanged: true, productionScopeRegistered: false,
    requiresNewDataCapabilityExecutionBindings: true,
    restoreBefore: ['multi_region_expansion', 'batch_world_generation', 'full_history_novelty_claim'],
  };
  let valid = false;
  try {
    assert.deepEqual(Object.keys(scope ?? {}).sort(), [...SCOPE_KEYS].sort());
    assert.equal(scope.schemaVersion, SCOPE_SCHEMA);
    for (const key of ['worldCount', 'regionCount'])
      assert.ok(Number.isSafeInteger(scope[key]) && scope[key] > 0);
    for (const key of SCOPE_KEYS.slice(3)) assert.equal(typeof scope[key], 'boolean');
    valid = true;
  } catch { /* Missing/unknown scope retains every requirement. */ }
  if (!valid) return { ...base, status: 'unknown_scope_blocked', scope: null,
    activeBlockers: retained, deferredRequirements: [], scopeError: 'invalid_or_missing_scope' };

  const single = scope.worldCount === 1 && scope.regionCount === 1
    && !scope.batchGeneration && !scope.buildings && !scope.personality && !scope.claimsFullHistoryNovelty;
  if (!single) return { ...base, status: 'full_requirements_restored', scope: structuredClone(scope),
    activeBlockers: retained, deferredRequirements: [] };

  const activeBlockers = [], deferredRequirements = [];
  for (const b of retained) {
    // Strict legacy shape: unknown fields or mixed purposes remain blocking.
    // In particular, missing historical geometry may also hide source leakage.
    const pureNovelty = b.code === DEFERRED_CODE && b.scope === 'novelty'
      && JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['code', 'details', 'scope'])
      && b.details && JSON.stringify(Object.keys(b.details).sort()) === JSON.stringify([...DETAIL_KEYS].sort())
      && Number.isSafeInteger(b.details.exactDeclaredGeometryMatches) && b.details.exactDeclaredGeometryMatches >= 0
      && b.details.exactMatchIsNotAutomaticRejection === true
      && b.details.thumbnailRankingIsNotSemanticQualification === true;
    if (pureNovelty) deferredRequirements.push({ status: 'deferred_out_of_current_mvp_scope',
      requirementIds: ['MAP-023', 'MAP-024'], originalFinding: b, passed: false });
    else activeBlockers.push(b);
  }
  return { ...base, status: 'scoped_assessment_not_training_qualified', scope: structuredClone(scope),
    activeBlockers, deferredRequirements };
}
