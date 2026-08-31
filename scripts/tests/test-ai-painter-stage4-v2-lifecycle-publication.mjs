import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  persistStage4V2LifecyclePublication,
} from "../lib/ai-painter-stage4-v2-lifecycle-publication-v1.mjs";

const CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(),
  "stage4-v2-lifecycle-publication-"));
const results = [];

try {
  const success = buildFixture({
    root: fixtureRoot,
    capabilityVersion: CAPABILITY,
    targetState: "controlled_smoke_completed",
    status: "passed",
    sequence: 4,
    terminalName: "success-terminal.json",
  });
  let injected = false;
  assert.throws(() => persistStage4V2LifecyclePublication({
    projectRoot: fixtureRoot,
    capabilityVersion: CAPABILITY,
    expectedState: "controlled_smoke_completed",
    expectedEvidenceStatus: "passed",
    sourceTerminalBinding: success.terminalBinding,
    lifecycleResult: success.state,
    receiptPath: success.receiptPath,
    _testHooks: {
      afterLifecyclePublicationReceiptPersisted() {
        injected = true;
        throw new Error("injected_after_lifecycle_publication_receipt");
      },
    },
  }), /injected_after_lifecycle_publication_receipt/u);
  assert.equal(injected, true);
  const recovered = persistStage4V2LifecyclePublication({
    projectRoot: fixtureRoot,
    capabilityVersion: CAPABILITY,
    expectedState: "controlled_smoke_completed",
    expectedEvidenceStatus: "passed",
    sourceTerminalBinding: success.terminalBinding,
    lifecycleResult: success.state,
    receiptPath: success.receiptPath,
  });
  assert.equal(recovered.receipt.lifecycleState, "controlled_smoke_completed");
  assert.deepEqual(recovered.receipt.lifecycleStateSnapshot, success.state);
  assert.equal(recovered.evidenceBinding.sha256, success.state.latestEvidence.sha256);
  assert.equal(recovered.lifecycleTerminalBinding, null);
  results.push("crash_after_receipt_recovers_exact_success_publication");

  const rejectedCapability = `${CAPABILITY}_rejected_fixture`;
  const rejected = buildFixture({
    root: fixtureRoot,
    capabilityVersion: rejectedCapability,
    targetState: "rejected",
    status: "failed",
    sequence: 5,
    terminalName: "failure-adjudication-terminal.json",
    terminalLifecycle: true,
  });
  const rejectedPublication = persistStage4V2LifecyclePublication({
    projectRoot: fixtureRoot,
    capabilityVersion: rejectedCapability,
    expectedState: "rejected",
    expectedEvidenceStatus: "failed",
    sourceTerminalBinding: rejected.terminalBinding,
    lifecycleResult: rejected.state,
    receiptPath: rejected.receiptPath,
    requireLifecycleTerminal: true,
  });
  assert.equal(rejectedPublication.receipt.lifecycleState, "rejected");
  assert.ok(rejectedPublication.lifecycleTerminalBinding);
  assert.equal(rejectedPublication.receipt.immutableLifecycleTerminal.sha256,
    rejectedPublication.lifecycleTerminalBinding.sha256);
  results.push("rejected_publication_binds_immutable_lifecycle_terminal");

  const mismatchCapability = `${CAPABILITY}_mismatch_fixture`;
  const mismatch = buildFixture({
    root: fixtureRoot,
    capabilityVersion: mismatchCapability,
    targetState: "controlled_smoke_completed",
    status: "passed",
    sequence: 4,
    terminalName: "mismatch-terminal.json",
  });
  const otherTerminalPath = path.join(fixtureRoot, "other-terminal.json");
  fs.writeFileSync(otherTerminalPath, "{\"terminal\":\"other\"}\n", "utf8");
  assert.throws(() => persistStage4V2LifecyclePublication({
    projectRoot: fixtureRoot,
    capabilityVersion: mismatchCapability,
    expectedState: "controlled_smoke_completed",
    expectedEvidenceStatus: "passed",
    sourceTerminalBinding: bind(fixtureRoot, otherTerminalPath),
    lifecycleResult: mismatch.state,
    receiptPath: mismatch.receiptPath,
  }), /must bind the exact source terminal only/u);
  results.push("mismatched_terminal_binding_fails_closed");

  const staleResult = structuredClone(mismatch.state);
  staleResult.sequence += 1;
  assert.throws(() => persistStage4V2LifecyclePublication({
    projectRoot: fixtureRoot,
    capabilityVersion: mismatchCapability,
    expectedState: "controlled_smoke_completed",
    expectedEvidenceStatus: "passed",
    sourceTerminalBinding: mismatch.terminalBinding,
    lifecycleResult: staleResult,
    receiptPath: mismatch.receiptPath,
  }), /differs from the canonical state file/u);
  results.push("noncanonical_lifecycle_result_fails_closed");
} finally {
  const resolved = path.resolve(fixtureRoot);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert.ok(relative.startsWith("stage4-v2-lifecycle-publication-")
    && !relative.includes(".."));
  fs.rmSync(resolved, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  testCount: results.length,
  results,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

function buildFixture({
  root, capabilityVersion, targetState, status, sequence, terminalName,
  terminalLifecycle = false,
}) {
  const terminalPath = path.join(root, terminalName);
  fs.writeFileSync(terminalPath,
    `${JSON.stringify({ terminal: terminalName, targetState })}\n`, "utf8");
  const terminalBinding = bind(root, terminalPath);
  const lifecycleRoot = path.join(root, ".runtime", "ai-painter",
    "capability-lifecycle", capabilityVersion);
  const evidenceDirectory = path.join(lifecycleRoot, "evidence");
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const evidenceRelative = `evidence/${String(sequence).padStart(3, "0")}-${targetState}.json`;
  const evidencePath = path.join(lifecycleRoot, ...evidenceRelative.split("/"));
  const recordedAtUtc = "2026-09-01T00:00:00.000Z";
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion,
    targetState,
    status,
    bindings: [terminalBinding],
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  }, null, 2)}\n`, "utf8");
  const state = {
    schemaVersion: "ai-painter-capability-lifecycle-state-v1",
    capabilityVersion,
    state: targetState,
    sequence,
    latestEvidence: {
      path: evidenceRelative,
      sha256: sha256File(evidencePath),
    },
    releaseIdentity: null,
    ownerResponseRequired: false,
    updatedAtUtc: recordedAtUtc,
  };
  fs.writeFileSync(path.join(lifecycleRoot, "state.json"),
    `${JSON.stringify(state, null, 2)}\n`, "utf8");
  if (terminalLifecycle) {
    fs.writeFileSync(path.join(lifecycleRoot, "phase-terminal.json"),
      `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
  return {
    state,
    terminalBinding,
    receiptPath: path.join(root, `${capabilityVersion}-publication.json`),
  };
}

function bind(root, file) {
  return {
    path: path.relative(root, file).split(path.sep).join("/"),
    sha256: sha256File(file),
    byteSize: fs.statSync(file).size,
  };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
