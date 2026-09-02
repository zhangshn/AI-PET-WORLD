import assert from "node:assert/strict";

import {
  validateFailureAdjudicationIntent,
} from "../adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs";

const expected = {
  packageId: "stage4-v2-smoke-package-test",
  runId: "stage4-v2-smoke-run-test",
  sourceTerminal: {
    path: ".runtime/ai-painter/test/source-terminal.json",
    sha256: "a".repeat(64),
  },
};
const valid = {
  schemaVersion: "ai-painter-stage4-v2-controlled-smoke-failure-adjudication-intent-v1",
  status: "prepared",
  capabilityVersion: "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2",
  ...expected,
  recordedAtUtc: "2026-09-01T01:02:03.004Z",
};

assert.equal(validateFailureAdjudicationIntent(valid, expected), true);

const tamperedCases = [
  { ...valid, schemaVersion: "legacy-intent-v0" },
  { ...valid, status: "consumed" },
  { ...valid, capabilityVersion: "another-capability" },
  { ...valid, packageId: "another-package" },
  { ...valid, runId: "another-run" },
  { ...valid, sourceTerminal: { ...valid.sourceTerminal, sha256: "b".repeat(64) } },
  { ...valid, recordedAtUtc: "2026-09-01 01:02:03" },
  { ...valid, unexpectedAuthority: true },
];

for (const candidate of tamperedCases) {
  assert.throws(() => validateFailureAdjudicationIntent(candidate, expected));
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  positiveCases: 1,
  negativeCases: tamperedCases.length,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);
