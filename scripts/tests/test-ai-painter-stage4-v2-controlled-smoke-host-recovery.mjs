import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  advanceCurrentExecutionRegistry,
  initializeCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";
import {
  validateImmutableCurrentRegistryEvidence,
} from "../lib/ai-painter-immutable-current-registry-evidence-v1.mjs";
import {
  recoverInterruptedSmokeToMaterialized,
} from "../run-ai-painter-stage4-v2-controlled-smoke.mjs";

const CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const root = fs.mkdtempSync(path.join(os.tmpdir(),
  "stage4-v2-smoke-host-recovery-"));

try {
  const packageId = "stage4-v2-host-recovery-fixture-package";
  const runId = "stage4-v2-host-recovery-fixture-run";
  const baseline = materializeBaseline();
  const initial = await initializeCurrentExecutionRegistry({
    projectRoot: root,
    currentTaskCapsulePath: baseline.capsule.path,
    currentTaskTerminalPath: baseline.terminal.path,
    currentCandidatePath: baseline.candidate.path,
    latestTrainingTerminalPath: baseline.trainingTerminal.path,
    archivedEvidenceNamespaces: [".runtime/fixture/archived"],
  });

  const smokeRoot = `.runtime/fixture/${packageId}`;
  const packageManifest = writeJson(`${smokeRoot}/smoke-package-manifest.json`, {
    schemaVersion: "fixture-smoke-package-manifest-v1",
    packageId,
    runId,
  });
  const sourceTerminal = writeJson(`${smokeRoot}/materialization-terminal.json`, {
    schemaVersion:
      "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_package_materialized",
    packageId,
    runId,
    packageManifest,
  });
  const sourceEvidence = writeJson(`${smokeRoot}/source-evidence.json`, {
    schemaVersion: "fixture-smoke-source-evidence-v1",
    status: "verified",
  });
  const sourceCapsule = writeJson(`${smokeRoot}/task-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    integrity: { status: "verified" },
    evidence: [{
      kind: "fixture_smoke_source",
      ...sourceEvidence,
      sha256Verified: true,
    }],
  });
  const program = bindPath(writeText(`${smokeRoot}/runner.mjs`,
    "export const smokeHostRecoveryFixture = true;\n"));
  const processStartIdentity = currentProcessStartIdentity();
  const lock = writeJson(`${smokeRoot}/active-execution-attempt-1-lock.json`, {
    schemaVersion: "ai-painter-current-active-execution-lock-v1",
    capabilityVersion: CAPABILITY,
    packageId,
    runId,
    processId: process.pid,
    processStartIdentity,
  });
  const heartbeat = writeJson(`${smokeRoot}/active-execution-attempt-1-heartbeat-executing.json`, {
    schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
    capabilityVersion: CAPABILITY,
    packageId,
    runId,
    executionState: "executing",
    processId: process.pid,
    processStartIdentity,
    heartbeatAtUtc: new Date().toISOString(),
    ttlSeconds: 60,
  });
  const activeExecution = {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion: CAPABILITY,
    packageId,
    runId,
    executionState: "executing",
    processId: process.pid,
    processStartIdentity,
    programLineage: { runner: slimBinding(program) },
    lock: slimBinding(lock),
    heartbeat: { path: heartbeat.path, ttlSeconds: 60 },
  };
  const active = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: CAPABILITY,
    packageId,
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    taskGoal: "Exercise immutable host-recovery evidence.",
    priority: 1,
    queueStatus: "running",
    nextMachineAction: null,
    queuedAtUtc: new Date().toISOString(),
    runId,
    lifecycleStage: "readonly_gpu_qualified",
    executionState: "executing",
    activity: "fixture_smoke_executing",
    taskCapsulePath: sourceCapsule.path,
    terminalEvidencePath: sourceTerminal.path,
    activeExecution,
    expectedPreviousRegistryRevision: initial.registry.registryRevision,
    expectedPreviousRegistrySha256: initial.registrySha256,
    _testHooks: {
      currentProcessIdentity: "fixture-smoke-host-recovery-writer",
    },
  });
  const activeRegistryRevision = active.registry.registryRevision;
  const heartbeatPath = absolute(heartbeat.path);
  const expiredHeartbeat = JSON.parse(fs.readFileSync(heartbeatPath, "utf8"));
  expiredHeartbeat.heartbeatAtUtc = "2000-01-01T00:00:00.000Z";
  fs.writeFileSync(heartbeatPath,
    `${JSON.stringify(expiredHeartbeat, null, 2)}\n`);
  const stale = await readCurrentExecutionRegistry(root);
  assert.equal(stale.ok, false);
  assert.equal(stale.errorCode, "registry_active_execution_heartbeat_expired");

  const recovered = await recoverInterruptedSmokeToMaterialized({
    root,
    packageManifestBinding: packageManifest,
    now: () => new Date("2026-09-01T05:00:00.000Z"),
    _testHooks: {
      currentProcessIdentity: "fixture-smoke-host-recovery-writer",
      probeActiveExecutionProcess: () => ({ status: "dead", identity: null }),
    },
    externalDependencyCommitter: (input) => ({
      eventCommit: { event: input.eventInput },
      dependencyManifest: null,
    }),
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.registry.packageId, packageId);
  assert.equal(recovered.registry.runId, runId);
  assert.equal(recovered.registry.executionState, "package_materialized");
  assert.equal(recovered.registry.activeExecution, null);
  assert.ok(recovered.registry.registryRevision > activeRegistryRevision);

  const recoveryTerminalPath = findSingle(
    absolute(smokeRoot), "host-interruption-recoveries", "terminal.json");
  const recoveryTerminal = JSON.parse(fs.readFileSync(recoveryTerminalPath, "utf8"));
  assert.equal(Object.hasOwn(recoveryTerminal.staleRegistry, "path"), false,
    "host recovery persisted mutable current.json evidence");
  const immutable = validateImmutableCurrentRegistryEvidence({
    projectRoot: root,
    transaction: recoveryTerminal.staleRegistry.transaction,
    snapshot: recoveryTerminal.staleRegistry.snapshot,
  });
  assert.equal(immutable.snapshotValue.registryRevision,
    activeRegistryRevision,
  "host recovery stale snapshot did not preserve the recovered revision");
  for (const binding of [
    recoveryTerminal.staleRegistry.transaction,
    recoveryTerminal.staleRegistry.snapshot,
    recoveryTerminal.staleLock,
    recoveryTerminal.staleHeartbeat,
    recoveryTerminal.resumeTaskCapsule,
    recoveryTerminal.resumeTerminalEvidence,
  ]) verifyBinding(binding);

  const snapshotPath = absolute(recoveryTerminal.staleRegistry.snapshot.path);
  const originalSnapshot = fs.readFileSync(snapshotPath);
  try {
    fs.appendFileSync(snapshotPath, " \n", "utf8");
    assert.throws(() => validateImmutableCurrentRegistryEvidence({
      projectRoot: root,
      transaction: recoveryTerminal.staleRegistry.transaction,
      snapshot: recoveryTerminal.staleRegistry.snapshot,
    }), /SHA-256 mismatch/u,
    "host recovery accepted a tampered immutable staged snapshot");
  } finally {
    fs.writeFileSync(snapshotPath, originalSnapshot);
  }

  process.stdout.write(
    "Stage4 V2 Smoke host recovery: real expired registry recovery + cross-revision immutable binding + tamper fail-close passed.\n",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function materializeBaseline() {
  const candidate = writeJson(".runtime/fixture/baseline/bounded-candidate.json", {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: { candidateKind: "fixture_host_recovery_baseline" },
  });
  const terminal = writeJson(".runtime/fixture/baseline/phase-terminal.json", {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed",
    status: "bounded_candidate_planning_completed",
    planningRunId: "fixture-host-recovery-baseline",
    nextAction: "fixture-host-recovery-baseline-action",
    candidate,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  });
  const capsule = writeJson(".runtime/fixture/baseline/local-task-capsule.json", {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    latestTerminal: terminal,
  });
  const formalRoot = ".runtime/fixture/baseline/latest-training";
  const trainingTerminal = writeJson(`${formalRoot}/phase-terminal.json`, {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "completed",
    status: "post_decode_object_rgb_stage0_real_visual_failure",
    runId: "fixture-host-recovery-baseline-training",
  });
  writeJson(`${formalRoot}/execution-state.json`, {
    status: "completed",
    phase: "machine_review_completed",
  });
  writeJson(`${formalRoot}/machine-review.json`, {
    previewCount: 6,
    previewPassCount: 0,
    previewFailCount: 6,
  });
  writeJson(`${formalRoot}/training-output/progress.json`, {
    phase: "training_completed",
    epoch: 40,
    epochTarget: 40,
  });
  return { candidate, terminal, capsule, trainingTerminal };
}

function currentProcessStartIdentity() {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference='Stop'",
      `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${process.pid}\" -ErrorAction Stop`,
      "if ($null -eq $p) { exit 3 }",
      "$p.CreationDate.ToUniversalTime().ToString('o')",
    ].join("; ");
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command", script,
    ], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
    assert.equal(result.status, 0, String(result.stderr));
    return `${process.pid}:${String(result.stdout).replace(/^\uFEFF/u, "").trim()}`;
  }
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 0, String(result.stderr));
  return `${process.pid}:${String(result.stdout).trim()}`;
}

function findSingle(base, directoryName, fileName) {
  const directory = path.join(base, directoryName);
  const matches = fs.readdirSync(directory, { recursive: true })
    .filter((entry) => path.basename(String(entry)) === fileName)
    .map((entry) => path.join(directory, String(entry)));
  assert.equal(matches.length, 1,
    `expected one ${fileName}, found ${matches.length}`);
  return matches[0];
}

function writeJson(relative, value) {
  return bindPath(writeText(relative, `${JSON.stringify(value, null, 2)}\n`));
}

function writeText(relative, value) {
  const target = absolute(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value, "utf8");
  return target;
}

function bindPath(file) {
  return {
    path: path.relative(root, file).replaceAll("\\", "/"),
    sha256: sha256(file),
    byteSize: fs.statSync(file).size,
  };
}

function verifyBinding(binding) {
  const target = absolute(binding.path);
  assert.equal(sha256(target), binding.sha256,
    `binding changed: ${binding.path}`);
}

function slimBinding(binding) {
  return { path: binding.path, sha256: binding.sha256 };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function absolute(relative) {
  return path.isAbsolute(relative)
    ? relative
    : path.join(root, ...relative.split("/"));
}
