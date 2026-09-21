// One reviewed compiler-extraction transition. This is NOT a capability release
// or a Smoke adapter; the legacy reader continues to reject changed byte graphs.
import assert from 'node:assert/strict';
import { createReader, sha256 } from './ai-painter-stage4-dataset-audit.mjs';

const PARENT = {
  path: 'data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json',
  sha256: '9e4eb98a1bdcc4afe03aa7fcecfb8350ddaff8030a62e143c289461d7041eef3',
};
const OLD_COMPILER = {
  path: 'scripts/compile-current-world-visual-conditions.mjs',
  sha256: 'ec3caf37b3169cf50342cccc4ade2b8277903e77dc3a70cee3a60d886e136447',
};
// Exact reviewed bytes, not caller-selected hashes or automatic rebinding.
const REVIEWED_PROGRAMS = {
  conditionCompiler: { path: OLD_COMPILER.path,
    sha256: 'b07188f053f4bfe1c48b702b1ab2dd4ed8c5009275215ec4e16257abd6c38465' },
  conditionRaster: { path: 'scripts/lib/current-world-condition-raster.mjs',
    sha256: '49e06032c80e5b20131213d731e19b2b6d1a86679e7aa421c09f58b760053e3d' },
};
const SELF = 'scripts/lib/ai-painter-stage4-condition-compiler-lineage.mjs';
const READER = 'scripts/lib/ai-painter-stage4-dataset-audit.mjs';
const ordered = v => Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordered(v[k])])) : v;
const digest = v => sha256(Buffer.from(JSON.stringify(ordered(v))));

export function buildConditionCompilerLineageCandidate(root) {
  const reader = createReader(root), parent = reader.bound(PARENT);
  assert.deepEqual(parent.programBindings.conditionCompiler, OLD_COMPILER);
  assert.equal(Object.keys(parent.programBindings).length, 18);
  const unchanged = Object.fromEntries(Object.entries(parent.programBindings).filter(([id]) => id !== 'conditionCompiler'));
  for (const b of [...Object.values(unchanged), ...Object.values(REVIEWED_PROGRAMS)]) reader.bytes(b.path, b.sha256);
  const core = {
    schemaVersion: 'ai-painter-stage4-condition-compiler-lineage-candidate-v1',
    scope: 'condition_compiler_extraction_program_binding_only',
    parentCapability: PARENT,
    replacedHistoricalBinding: OLD_COMPILER,
    historicalSource: { commit: '542c1c05e7ab75123db85b656725ec96ac4eb003', ...OLD_COMPILER },
    effectiveProgramBindings: { ...unchanged, ...REVIEWED_PROGRAMS },
    dependencyEdges: [{ from: 'conditionCompiler', to: 'conditionRaster',
      importedSymbols: ['rasterizePolygons', 'rasterizeFootprints', 'fillBounds'] }],
    evaluatorBindings: [SELF, READER].map(p => ({ path: p, sha256: sha256(reader.bytes(p)) })),
    qualification: { trainingAllowed: false, gpuAllowed: false, capabilityReleased: false,
      smokeAdapterRegistered: false, inheritedParentQualification: false },
    requiredBeforeExecution: ['new_smoke_component_identity_and_adapter', 'independent_cpu_evidence',
      'data_source_and_exposure_qualification', 'foundation_lineage_qualification',
      'current_candidate_gpu_qualification', 'lifecycle_resource_and_recovery_verification'],
  };
  reader.verifyStable();
  return { ...core, candidateId: `stage4-condition-compiler-lineage-v1-${digest(core)}`,
    immutable: true, status: 'inactive_program_binding_candidate_not_execution_qualified' };
}

export function verifyConditionCompilerLineageCandidate(root, binding) {
  const reader = createReader(root), candidate = reader.bound(binding);
  assert.deepEqual(candidate, buildConditionCompilerLineageCandidate(root), 'compiler lineage candidate does not reproduce');
  reader.verifyStable();
  return candidate;
}
