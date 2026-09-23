// Explicit historical diagnostic -> new scope assessment. No history rescan,
// image decoding, candidate activation, registry write, GPU or training.
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { createReader, sha256 } from './lib/ai-painter-stage4-dataset-audit.mjs';
import { persistAudit } from './audit-ai-painter-stage4-split-release.mjs';
import { classifyMvpRequirements, DATA_POLICY_VERSION } from './lib/ai-painter-mvp-requirement-scope.mjs';

try {
  const { values } = parseArgs({ options: { report: { type: 'string' }, sha256: { type: 'string' },
    scope: { type: 'string' }, write: { type: 'boolean', default: false } } });
  const reader = createReader(process.cwd());
  const reportBinding = { path: values.report, sha256: values.sha256 };
  const source = reader.bound(reportBinding);
  assert.equal(source.schemaVersion, 'ai-painter-split-smoke-foundation-inspection-v1');
  assert.equal(source.status, 'blocked_data_qualification', 'source_is_not_valid_blocked_diagnostic');
  assert.equal(source.trainingAllowed, false);
  assert.equal(source.gpuAllowed, false);
  const proposal = source.preflight?.planCandidate;
  assert.ok(proposal && proposal.dispatchable === false, 'bound_proposal_required');
  const component = reader.bound(proposal.componentContract);
  const dataset = reader.bound(proposal.datasetManifest);
  assert.equal(component.capabilityVersion, proposal.capabilityVersion);
  assert.deepEqual(component.datasetManifest, proposal.datasetManifest);
  assert.equal(dataset.datasetReleaseIdentity, component.datasetReleaseIdentity);
  // Confirm bound snapshot inputs, without replaying the all-history novelty audit.
  assert.ok(Array.isArray(source.inputReceipts) && source.inputReceipts.length > 0);
  for (const r of source.inputReceipts) assert.equal(reader.bytes(r.path, r.sha256).length, r.bytes);
  const registryPath = '.runtime/ai-painter/current-execution-registry/current.json';
  assert.equal(reader.json(registryPath).activeExecution, null, 'active_execution_present');
  const policyPath = 'docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md';
  const policy = reader.bytes(policyPath).toString('utf8');
  assert.ok(policy.includes('文档版本：`' + DATA_POLICY_VERSION + '`'), 'data_policy_version_conflict');
  assert.ok(policy.includes('### 9.1 单世界先行MVP的阶段隔离'), 'scope_policy_missing');
  for (const p of ['scripts/inspect-ai-painter-mvp-requirement-scope.mjs',
    'scripts/lib/ai-painter-mvp-requirement-scope.mjs',
    'scripts/lib/ai-painter-stage4-dataset-audit.mjs',
    'scripts/audit-ai-painter-stage4-split-release.mjs']) reader.bytes(p);
  const assessment = classifyMvpRequirements({ scope: JSON.parse(values.scope), blockers: source.blockers });
  reader.verifyStable();
  const identity = { reportBinding, scope: assessment.scope, policyVersion: DATA_POLICY_VERSION,
    inputReceipts: reader.receipts() };
  const report = { schemaVersion: 'ai-painter-mvp-requirement-scope-assessment-v1',
    assessmentId: 'mvp-scope-' + sha256(Buffer.from(JSON.stringify(identity))),
    checkedAtUtc: new Date().toISOString(), ...assessment, ...identity,
    evidenceScope: 'rehashed_historical_diagnostic_applicability_not_fresh_data_qualification',
    candidate: { component: proposal.componentContract, dataset: proposal.datasetManifest,
      historicalProposalId: proposal.planCandidateId },
    sourceStatus: source.status, historicalFilesModified: false, currentRegistryModified: false };
  const evidence = values.write ? persistAudit(process.cwd(), report) : null;
  console.log(JSON.stringify({ status: report.status, evidence,
    activeBlockers: report.activeBlockers.map(b => b.code),
    deferred: report.deferredRequirements.map(b => ({ code: b.originalFinding.code, status: b.status })),
    trainingAllowed: false, productionScopeRegistered: false }, null, 2));
  process.exitCode = assessment.status === 'unknown_scope_blocked' ? 1 : 2;
} catch (error) {
  console.error(JSON.stringify({ status: 'unknown_or_stale', reason: error.message,
    trainingAllowed: false, gpuAllowed: false, productionScopeRegistered: false }));
  process.exitCode = 1;
}
