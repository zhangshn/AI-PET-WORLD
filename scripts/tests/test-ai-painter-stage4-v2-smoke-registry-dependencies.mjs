import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildStage4V2ExternalRegistryDependencyManifest,
  EXTERNAL_REGISTRY_DEPENDENCY_SCHEMA,
} from "../lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";

const projectRoot = process.cwd();
const runnerPath = path.join(projectRoot,
  "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs");
const adjudicatorPath = path.join(projectRoot,
  "scripts/adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs");
const runnerSource = fs.readFileSync(runnerPath, "utf8");
const adjudicatorSource = fs.readFileSync(adjudicatorPath, "utf8");

assert.doesNotMatch(runnerSource,
  /ai-painter-current-execution-dependency-input-v1/u);
assert.doesNotMatch(adjudicatorSource,
  /ai-painter-current-execution-dependency-input-v1/u);
const directRunnerDependencyCommits =
  (runnerSource.match(/commitStage4V2ExternalRegistryDependencies\(\{/gu) ?? []).length;
const injectedRunnerDependencyCommits =
  (runnerSource.match(/externalDependencyCommitter\(\{/gu) ?? []).length;
const injectedRunnerDefaults =
  (runnerSource.match(/externalDependencyCommitter\s*=\s*commitStage4V2ExternalRegistryDependencies/gu) ?? []).length;
assert.equal(directRunnerDependencyCommits, 1,
  "Smoke terminal publication must directly use the external dependency transaction");
assert.equal(injectedRunnerDependencyCommits, 2,
  "Smoke host-recovery and restore must use their injected external dependency transaction");
assert.equal(injectedRunnerDefaults, 2,
  "Smoke host-recovery and restore dependency injection must default to the formal committer");
assert.equal(directRunnerDependencyCommits + injectedRunnerDependencyCommits, 3,
  "Smoke run/recovery/restore must each use the external dependency transaction");
assert.equal((adjudicatorSource.match(/commitStage4V2ExternalRegistryDependencies\(\{/gu) ?? []).length, 1,
  "Smoke failure adjudicator must use the external dependency transaction");
assert.match(runnerSource, /controlled_smoke_lifecycle_publication_state/u,
  "Smoke success registry publication must bind the canonical lifecycle state receipt");
assert.match(runnerSource, /controlled_smoke_lifecycle_evidence/u,
  "Smoke success registry publication must bind immutable lifecycle evidence");
assert.match(adjudicatorSource, /controlled_smoke_rejected_lifecycle_publication_state/u,
  "Smoke rejection registry publication must bind the canonical lifecycle state receipt");
assert.match(adjudicatorSource, /controlled_smoke_rejected_lifecycle_evidence/u,
  "Smoke rejection registry publication must bind immutable lifecycle evidence");
assert.match(adjudicatorSource, /controlled_smoke_rejected_lifecycle_terminal/u,
  "Smoke rejection registry publication must bind the immutable lifecycle terminal");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(),
  "stage4-v2-smoke-registry-dependencies-"));
try {
  const evidencePath = path.join(fixtureRoot, "evidence.json");
  fs.writeFileSync(evidencePath, "{\"fixture\":true}\n", "utf8");
  const binding = {
    role: "fixture_evidence",
    path: "evidence.json",
    sha256: sha256File(evidencePath),
    byteSize: fs.statSync(evidencePath).size,
  };
  for (const operation of ["terminal", "host-recovery", "restore", "failure-adjudication"]) {
    const eventId = `stage4-v2-smoke-${operation}-fixture`;
    const journalPath = path.join(fixtureRoot, `${operation}-journal.json`);
    fs.writeFileSync(journalPath, `${JSON.stringify({
      schemaVersion: `stage4-v2-${operation}-journal-v1`,
      state: "event_committed",
      operationId: eventId,
      capabilityVersion: "stage4-v2-fixture-capability",
      packageId: "stage4-v2-fixture-package",
      runId: "stage4-v2-fixture-run",
      bindings: [binding],
      programEventId: eventId,
      ownerAuthorizationRequired: false,
      recordedAtUtc: "2026-09-01T00:00:00.000Z",
    }, null, 2)}\n`, "utf8");
    const eventCommit = fakeEventCommit(eventId);
    const manifest = buildStage4V2ExternalRegistryDependencyManifest({
      projectRoot: fixtureRoot,
      journalPath,
      eventCommit,
      bindings: [binding],
    });
    assert.equal(manifest.schemaVersion, EXTERNAL_REGISTRY_DEPENDENCY_SCHEMA);
    assert.equal(manifest.mode, "external");
    assert.equal(manifest.outerJournal.requiredState, "event_committed");
    assert.deepEqual(manifest.bindings, [binding]);
    assert.equal(manifest.programEvent.eventId, eventId);
    assert.equal(manifest.programEvent.event.id, eventId);
    assert.equal(manifest.catalogArtifacts.length, 2);
  }
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.ok(path.relative(path.resolve(os.tmpdir()), resolved)
    .startsWith("stage4-v2-smoke-registry-dependencies-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  smokeRegistryCommitCount: 4,
  dependencySchema: EXTERNAL_REGISTRY_DEPENDENCY_SCHEMA,
  retiredDependencyInputRejectedByRegistryRegression: true,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function fakeEventCommit(eventId) {
  return {
    event: { id: eventId, status: "success" },
    ledger: { path: ".runtime/fixture/events.jsonl", sha256: "1".repeat(64) },
    latest: { path: ".runtime/fixture/latest.json", sha256: "2".repeat(64) },
    catalog: {
      ledgerArtifact: { path: ".runtime/fixture/events.jsonl", sha256: "1".repeat(64) },
      latestArtifact: { path: ".runtime/fixture/latest.json", sha256: "2".repeat(64) },
    },
  };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
