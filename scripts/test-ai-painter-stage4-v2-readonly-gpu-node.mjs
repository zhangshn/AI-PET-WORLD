import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  buildStage4V2PreReleaseQualificationTicket,
  closeStage4V2UnconsumedQualificationTicket,
  consumeStage4V2QualificationTicket,
  ensureStage4V2MachineTicketIssuer,
  initializeStage4V2QualificationReplayLedger,
  projectLogicalPath,
  recoverStage4V2QualificationTicketConsumption,
  registerStage4V2QualificationTicket,
  validateStage4V2PreReleaseQualificationTicket,
  writeExclusiveJson,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";
import {
  reconcileStage4V2ReadonlyGpuQualifiedLifecycle,
  STAGE4_V2_LIFECYCLE_STATE_PATH,
  verifyStage4V2ReadonlyGpuQualifiedLifecycle,
} from "./lib/ai-painter-stage4-v2-qualification-lifecycle-v1.mjs";
import {
  persistStage4V2QualificationMaterializationFailureClosed,
} from "./plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  classifyGpuProcesses,
  parseNvidiaComputeProcesses,
  parseNvidiaPmonProcesses,
  runStage4V2ReadonlyGpuQualification,
  runNonBlockingChildProcess,
  startActiveExecutionHeartbeat,
  stopActiveExecutionHeartbeat,
  validatePythonQualificationEvidence,
} from "./run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-stage4-v2-node-"));
try {
  testSignedTicketAndReplayLedger(tempRoot);
  testRecoverableTicketConsumption(tempRoot);
  testClosedUnconsumedTicket(tempRoot);
  await testPlannerRegisteredTicketFailureClosure(tempRoot);
  await testStaleCurrentDispatchesRecoveryWithoutGpu(tempRoot);
  await testNonBlockingHeartbeat(tempRoot);
  await testBoundedChildFailureModes(tempRoot);
  testPythonEvidenceBoundary(tempRoot);
  testQualificationLifecycleFirstCrashRecovery(tempRoot);
  testWddmProcessClassification();
  testDeclaredRuntimeJunctionBoundary();
  process.stdout.write(`${JSON.stringify({
    status: "passed",
    testCount: 29,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

async function testStaleCurrentDispatchesRecoveryWithoutGpu(root) {
  let recoveryCalled = false;
  let gpuCalled = false;
  const result = await runStage4V2ReadonlyGpuQualification({
    projectRoot: root,
    currentRegistryReader: async () => ({
      ok: false,
      errorCode: "registry_active_execution_heartbeat_expired",
    }),
    interruptedRecoveryHandler: async (input) => {
      recoveryCalled = true;
      assert.equal(input.root, path.resolve(root));
      return {
        executionState: "failed_closed",
        status: "host_interruption_recovered_without_gpu_replay",
        recoveredWithoutGpuReplay: true,
      };
    },
    qualificationInvoker: async () => {
      gpuCalled = true;
      throw new Error("GPU must not be invoked during stale recovery dispatch");
    },
  });
  assert.equal(recoveryCalled, true);
  assert.equal(gpuCalled, false);
  assert.equal(result.recoveredWithoutGpuReplay, true);
}

async function testPlannerRegisteredTicketFailureClosure(root) {
  const fixture = createRecoverableTicketFixture(root, "planner-failure");
  const packageDirectory = path.posix.dirname(fixture.ticketBinding.path);
  const result = await persistStage4V2QualificationMaterializationFailureClosed({
    root,
    identity: {
      packageId: fixture.ticket.packageId,
      runId: fixture.ticket.runId,
    },
    packageDirectory,
    outputDirectory: fixture.ticket.outputDirectory,
    preflightDirectory: ".runtime/ai-painter/v2-recovery-planner-failure-preflight",
    ticket: fixture.ticket,
    ticketBinding: fixture.ticketBinding,
    packagePayloadBinding: fixture.packagePayloadBinding,
    ticketRegistered: true,
    previousRegistry: {
      registry: {
        registryRevision: 17,
        taskId: "plan_stage4_v2_readonly_gpu_qualification",
        runId: "previous-cpu-contract-run",
      },
      registrySha256: "1".repeat(64),
    },
    error: new Error("injected_after_ticket_registered"),
    nowUtc: "2026-08-31T01:10:00.000Z",
    appendProgramEvent: false,
    packageDirectoryCreated: true,
  });
  assert.ok(result.failureReport.sha256.match(/^[a-f0-9]{64}$/u));
  assert.ok(result.failureTerminal.sha256.match(/^[a-f0-9]{64}$/u));
  assert.ok(result.failureCapsule.sha256.match(/^[a-f0-9]{64}$/u));
  assert.ok(result.ticketClosure.sha256.match(/^[a-f0-9]{64}$/u));
  const terminal = JSON.parse(fs.readFileSync(path.join(root, result.failureTerminal.path), "utf8"));
  assert.equal(terminal.executionState, "failed_closed");
  assert.equal(terminal.previousRegistryRetained, true);
  assert.equal(terminal.gpuStarted, false);
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ...fixture,
    consumedAtUtc: "2026-08-31T01:11:00.000Z",
  }), /closed unconsumed/u);
}

function testRecoverableTicketConsumption(root) {
  const afterPrepare = createRecoverableTicketFixture(root, "after-prepare");
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ...afterPrepare,
    consumedAtUtc: "2026-08-31T01:01:00.000Z",
    _testHooks: {
      afterConsumptionPrepareCommit: () => { throw new Error("injected_after_prepare_commit"); },
    },
  }), /injected_after_prepare_commit/u);
  assert.equal(fs.existsSync(path.join(root, afterPrepare.consumptionPath)), false);
  const recoveredPrepare = recoverStage4V2QualificationTicketConsumption({
    projectRoot: root,
    ...afterPrepare,
    nowUtc: "2026-08-31T01:02:00.000Z",
  });
  assert.equal(recoveredPrepare.recoveryStatus, "prepared_consumption_committed");
  const recoveredAgain = recoverStage4V2QualificationTicketConsumption({
    projectRoot: root,
    ...afterPrepare,
    nowUtc: "2026-08-31T01:03:00.000Z",
  });
  assert.equal(recoveredAgain.recoveryStatus, "already_committed_verified");
  assert.equal(recoveredAgain.consumptionBinding.sha256, recoveredPrepare.consumptionBinding.sha256);

  const afterEvidence = createRecoverableTicketFixture(root, "after-evidence");
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ...afterEvidence,
    consumedAtUtc: "2026-08-31T01:04:00.000Z",
    _testHooks: {
      afterConsumptionEvidencePersisted: () => { throw new Error("injected_after_evidence_persisted"); },
    },
  }), /injected_after_evidence_persisted/u);
  assert.equal(fs.existsSync(path.join(root, afterEvidence.consumptionPath)), true);
  const recoveredEvidence = recoverStage4V2QualificationTicketConsumption({
    projectRoot: root,
    ...afterEvidence,
    nowUtc: "2026-08-31T01:05:00.000Z",
  });
  assert.equal(recoveredEvidence.recoveryStatus, "prepared_consumption_committed");

  const conflicting = createRecoverableTicketFixture(root, "conflict");
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ...conflicting,
    consumedAtUtc: "2026-08-31T01:06:00.000Z",
    _testHooks: {
      afterConsumptionPrepareCommit: () => { throw new Error("injected_conflict_prepare"); },
    },
  }), /injected_conflict_prepare/u);
  const conflictAbsolute = path.join(root, conflicting.consumptionPath);
  fs.mkdirSync(path.dirname(conflictAbsolute), { recursive: true });
  fs.writeFileSync(conflictAbsolute, "{\"tampered\":true}\n", "utf8");
  assert.throws(() => recoverStage4V2QualificationTicketConsumption({
    projectRoot: root,
    ...conflicting,
    nowUtc: "2026-08-31T01:07:00.000Z",
  }), /conflicts|SHA-256/u);
}

function testClosedUnconsumedTicket(root) {
  const fixture = createRecoverableTicketFixture(root, "closed");
  const closurePath = ".runtime/ai-painter/v2-node-closed/closure.json";
  const closed = closeStage4V2UnconsumedQualificationTicket({
    projectRoot: root,
    ticket: fixture.ticket,
    ticketBinding: fixture.ticketBinding,
    packagePayloadBinding: fixture.packagePayloadBinding,
    closurePath,
    reasonCode: "materialization_failed_closed",
    error: "injected planner failure",
    closedAtUtc: "2026-08-31T01:08:00.000Z",
  });
  assert.equal(closed.closure.status, "closed_unconsumed");
  const closedAgain = closeStage4V2UnconsumedQualificationTicket({
    projectRoot: root,
    ticket: fixture.ticket,
    ticketBinding: fixture.ticketBinding,
    packagePayloadBinding: fixture.packagePayloadBinding,
    closurePath,
    reasonCode: "materialization_failed_closed",
    error: "injected planner failure",
    closedAtUtc: "2026-08-31T01:08:00.000Z",
  });
  assert.equal(closedAgain.closureBinding.sha256, closed.closureBinding.sha256);
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ...fixture,
    consumedAtUtc: "2026-08-31T01:09:00.000Z",
  }), /closed unconsumed/u);
}

function createRecoverableTicketFixture(root, suffix) {
  const protector = {
    scheme: "test_machine_key_protector_v1",
    protect: (bytes) => Buffer.concat([Buffer.from("test:"), Buffer.from(bytes)]),
    unprotect: (bytes) => Buffer.from(bytes).subarray(5),
  };
  const issuer = ensureStage4V2MachineTicketIssuer({ projectRoot: root, keyProtector: protector });
  const evidencePath = writeFixture(root, `data/recovery-${suffix}-evidence.json`, { status: "verified", suffix });
  const programPath = writeFixture(root, `scripts/recovery-${suffix}-program.mjs`, { source: suffix });
  const packageId = `v2-recovery-${suffix}-package`;
  const runId = `v2-recovery-${suffix}-run`;
  const inputEvidence = [bindProjectFile(root, projectLogicalPath(root, evidencePath))];
  const programLineage = { runner: bindProjectFile(root, projectLogicalPath(root, programPath)) };
  const packagePayload = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-payload-v1",
    packageId,
    runId,
    outputDirectory: `.runtime/ai-painter/v2-recovery-${suffix}-output`,
    ledgerPath: `.runtime/ai-painter/v2-recovery-${suffix}-ledger.sqlite`,
    ticketIssuer: issuer.issuerBinding,
    inputEvidence,
    programLineage,
  };
  const payloadPath = path.join(root, `.runtime/ai-painter/v2-recovery-${suffix}-package/payload.json`);
  writeExclusiveJson(payloadPath, packagePayload);
  const packagePayloadBinding = bindProjectFile(root, projectLogicalPath(root, payloadPath));
  const ticket = buildStage4V2PreReleaseQualificationTicket({
    packageId,
    runId,
    packagePayload,
    packagePayloadBinding,
    issuer: issuer.issuer,
    privateKey: issuer.privateKey,
    inputEvidence,
    programLineage,
    outputDirectory: packagePayload.outputDirectory,
    ledgerPath: packagePayload.ledgerPath,
    issuedAtUtc: "2026-08-31T01:00:00.000Z",
    expiresAtUtc: "2026-09-01T01:00:00.000Z",
    nonce: `v2-recovery-${suffix}-nonce`,
  });
  const ticketPath = path.join(root, `.runtime/ai-painter/v2-recovery-${suffix}-package/ticket.json`);
  writeExclusiveJson(ticketPath, ticket);
  const ticketBinding = bindProjectFile(root, projectLogicalPath(root, ticketPath));
  initializeStage4V2QualificationReplayLedger({ projectRoot: root, ledgerPath: packagePayload.ledgerPath });
  registerStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding,
  });
  return {
    ticket,
    packagePayload,
    ticketBinding,
    packagePayloadBinding,
    consumptionPath: `.runtime/ai-painter/v2-recovery-${suffix}-package/consumption.json`,
  };
}

function testSignedTicketAndReplayLedger(root) {
  const evidencePath = writeFixture(root, "data/evidence.json", { status: "verified" });
  const programPath = writeFixture(root, "scripts/program.mjs", { source: "fixture" });
  const issuer = ensureStage4V2MachineTicketIssuer({
    projectRoot: root,
    keyProtector: {
      scheme: "test_machine_key_protector_v1",
      protect: (bytes) => Buffer.concat([Buffer.from("test:"), Buffer.from(bytes)]),
      unprotect: (bytes) => Buffer.from(bytes).subarray(5),
    },
  });
  const packageId = "v2-node-test-package";
  const runId = "v2-node-test-run";
  const inputEvidence = [bindProjectFile(root, projectLogicalPath(root, evidencePath))];
  const programLineage = { runner: bindProjectFile(root, projectLogicalPath(root, programPath)) };
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-payload-v1",
    packageId,
    runId,
    outputDirectory: ".runtime/ai-painter/v2-node-test-output",
    ledgerPath: ".runtime/ai-painter/v2-node-test-ledger.sqlite",
    ticketIssuer: issuer.issuerBinding,
    inputEvidence,
    programLineage,
  };
  const payloadPath = path.join(root, ".runtime/ai-painter/v2-node-test-package/payload.json");
  writeExclusiveJson(payloadPath, payload);
  const payloadBinding = bindProjectFile(root, projectLogicalPath(root, payloadPath));
  const ticket = buildStage4V2PreReleaseQualificationTicket({
    packageId,
    runId,
    packagePayload: payload,
    packagePayloadBinding: payloadBinding,
    issuer: issuer.issuer,
    privateKey: issuer.privateKey,
    inputEvidence,
    programLineage,
    outputDirectory: payload.outputDirectory,
    ledgerPath: payload.ledgerPath,
    issuedAtUtc: "2026-08-31T00:00:00.000Z",
    expiresAtUtc: "2026-09-01T00:00:00.000Z",
    nonce: "v2-node-test-nonce",
  });
  const ticketPath = path.join(root, ".runtime/ai-painter/v2-node-test-package/ticket.json");
  writeExclusiveJson(ticketPath, ticket);
  const ticketBinding = bindProjectFile(root, projectLogicalPath(root, ticketPath));
  validateStage4V2PreReleaseQualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload: payload,
    verifyEvidence: true,
    nowUtc: "2026-08-31T00:30:00.000Z",
  });
  initializeStage4V2QualificationReplayLedger({ projectRoot: root, ledgerPath: payload.ledgerPath });
  registerStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
  });
  const exactRegistrationRecovery = registerStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
  });
  assert.equal(exactRegistrationRecovery.registrationStatus,
    "registered_exact_unconsumed_recovery");
  const consumed = consumeStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload: payload,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
    consumptionPath: ".runtime/ai-painter/v2-node-test-package/consumption.json",
    consumedAtUtc: "2026-08-31T00:31:00.000Z",
  });
  assert.equal(consumed.consumption.status, "consumed_once");
  assert.throws(() => consumeStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload: payload,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
    consumptionPath: ".runtime/ai-painter/v2-node-test-package/replay.json",
    consumedAtUtc: "2026-08-31T00:32:00.000Z",
  }), /replay|consumed_once/u);
  assert.throws(() => registerStage4V2QualificationTicket({
    projectRoot: root,
    ticket,
    ticketBinding,
    packagePayloadBinding: payloadBinding,
  }), /consumed|re-registration/u);
  assert.throws(() => validateStage4V2PreReleaseQualificationTicket({
    projectRoot: root,
    ticket: { ...ticket, runId: "tampered-run" },
    packagePayload: payload,
    verifyEvidence: true,
    nowUtc: "2026-08-31T00:33:00.000Z",
  }), /SHA-256|signature|runId/u);
  fs.writeFileSync(evidencePath, '{"status":"tampered"}\n', "utf8");
  assert.throws(() => validateStage4V2PreReleaseQualificationTicket({
    projectRoot: root,
    ticket,
    packagePayload: payload,
    verifyEvidence: true,
    nowUtc: "2026-08-31T00:34:00.000Z",
  }), /SHA-256/u);
}

async function testNonBlockingHeartbeat(root) {
  const heartbeatPath = path.join(root, ".runtime/ai-painter/heartbeat-test/heartbeat.json");
  fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
  const context = {
    paths: { activeExecutionHeartbeat: heartbeatPath },
    packagePayload: { packageId: "heartbeat-package", runId: "heartbeat-run" },
    activeLease: { processStartIdentity: `${process.pid}:test` },
    heartbeatTimer: null,
    heartbeatError: null,
  };
  let tick = 0;
  context.heartbeatTimer = startActiveExecutionHeartbeat({
    context,
    intervalMs: 20,
    now: () => new Date(Date.UTC(2026, 7, 31, 0, 0, 0, tick++)),
  });
  const observed = new Set();
  const observer = setInterval(() => {
    try { observed.add(JSON.parse(fs.readFileSync(heartbeatPath, "utf8")).heartbeatAtUtc); } catch {}
  }, 13);
  const child = await runNonBlockingChildProcess({
    command: process.execPath,
    args: ["-e", "setTimeout(() => process.stdout.write('done'), 180)"],
    cwd: root,
    timeoutMs: 2_000,
    maxOutputBytes: 1024,
  });
  clearInterval(observer);
  stopActiveExecutionHeartbeat(context);
  assert.equal(child.status, 0);
  assert.equal(child.stdout, "done");
  assert.equal(context.heartbeatError, null);
  assert.ok(observed.size >= 3, `heartbeat did not refresh while child was active (${observed.size})`);
}

async function testBoundedChildFailureModes(root) {
  const timedOut = await runNonBlockingChildProcess({
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: root,
    timeoutMs: 50,
    maxOutputBytes: 1024,
  });
  assert.match(timedOut.error?.message ?? "", /timed out/u);
  const overflow = await runNonBlockingChildProcess({
    command: process.execPath,
    args: ["-e", "process.stdout.write('x'.repeat(4096))"],
    cwd: root,
    timeoutMs: 2_000,
    maxOutputBytes: 128,
  });
  assert.match(overflow.error?.message ?? "", /exceeded limit/u);
}

function testPythonEvidenceBoundary(root) {
  const prefix = ".runtime/ai-painter/evidence-test";
  const outputRoot = path.join(root, prefix, "output");
  fs.mkdirSync(outputRoot, { recursive: true });
  const evidenceInputs = buildDetailedQualificationEvidenceInputs(root, prefix);
  const datasetPath = evidenceInputs.datasetPath;
  const signedTicketPath = writeFixture(root, `${prefix}/ticket.json`, { status: "issued" });
  const consumptionPath = writeFixture(root, `${prefix}/consumption.json`, { status: "consumed_once" });
  const activeConfig = {
    ticket: {
      ticketId: "ticket-fixture",
      ticketPath: projectLogicalPath(root, signedTicketPath),
      ticketSha256: bindProjectFile(root, projectLogicalPath(root, signedTicketPath)).sha256,
      consumptionPath: projectLogicalPath(root, consumptionPath),
      consumptionSha256: bindProjectFile(root, projectLogicalPath(root, consumptionPath)).sha256,
    },
  };
  const activePath = writeFixture(root, `${prefix}/active-config.json`, activeConfig);
  const activeBinding = bindProjectFile(root, projectLogicalPath(root, activePath));
  const stateHash = "a".repeat(64);
  const diagnosticPath = writeFixture(root, `${prefix}/output/gpu-diagnostic.json`,
    buildDetailedQualificationDiagnostic(evidenceInputs));
  const telemetryPath = writeFixture(root, `${prefix}/output/cuda-telemetry.json`,
    buildDetailedQualificationCudaTelemetry());
  const statePath = writeFixture(root, `${prefix}/output/state-integrity.json`, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-state-integrity-v1",
    status: "verified_unchanged",
    autoencoder: { checkpointState: stateHash, loaded: stateHash, beforeQualification: stateHash, afterQualification: stateHash },
    denoiser: { fixedInitialization: stateHash, beforeQualification: stateHash, afterQualification: stateHash },
    autoencoderUnchanged: true,
    denoiserUnchanged: true,
    autoencoderTraining: false,
    autoencoderRequiresGradParameterCount: 0,
    allParameterGradFieldsRemainNone: true,
  });
  const originalState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  writeFixture(root, `${prefix}/output/qualification-result.json`, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-qualification-v1",
    status: "stage4_v2_readonly_gpu_qualification_passed",
    executionState: "completed",
    packageId: "evidence-package",
    runId: "evidence-run",
    architectureId: STAGE4_V2_CAPABILITY,
    activeConfig: pickBinding(activeBinding),
    ticket: {
      ticketId: "ticket-fixture",
      ticket: pickBinding(bindProjectFile(root, projectLogicalPath(root, signedTicketPath))),
      consumption: pickBinding(bindProjectFile(root, projectLogicalPath(root, consumptionPath))),
      status: "consumed_once",
    },
    gpuDiagnostic: pickBinding(bindProjectFile(root, projectLogicalPath(root, diagnosticPath))),
    cudaTelemetry: pickBinding(bindProjectFile(root, projectLogicalPath(root, telemetryPath))),
    stateIntegrity: pickBinding(bindProjectFile(root, projectLogicalPath(root, statePath))),
    ownerAuthorizationRequired: false,
    automaticSmokeStarted: false,
  });
  const payload = {
    packageId: "evidence-package",
    runId: "evidence-run",
    bindings: {
      datasetRelease: bindProjectFile(root, projectLogicalPath(root, datasetPath)),
      conditionContract: evidenceInputs.conditionContract,
    },
    fixedInputs: evidenceInputs.fixedInputs,
  };
  const verified = validatePythonQualificationEvidence({ root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot });
  assert.equal(verified.qualificationResult.path, `${prefix}/output/qualification-result.json`);
  const originalDiagnostic = JSON.parse(fs.readFileSync(diagnosticPath, "utf8"));
  const originalTelemetry = JSON.parse(fs.readFileSync(telemetryPath, "utf8"));
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath, resultField: "gpuDiagnostic",
    mutate(value) { value.all210ParametersReached = false; },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /reachability summary is forged or stale/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath,
    resultField: "gpuDiagnostic", value: originalDiagnostic,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath, resultField: "gpuDiagnostic",
    mutate(value) {
      value.samples[1].parameterGradients.parameters[0].parameterName =
        "cross_sample_identity_forged";
      value.samples[1].parameterGradients.nonzeroParameterNames[0] =
        "cross_sample_identity_forged";
    },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /private responsibility is forged|name\/shape\/private-responsibility changed/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath,
    resultField: "gpuDiagnostic", value: originalDiagnostic,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: telemetryPath, resultField: "cudaTelemetry",
    mutate(value) { value.peakGpuMemoryBytes += 1; },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /peakGpuMemoryBytes is forged or stale/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: telemetryPath,
    resultField: "cudaTelemetry", value: originalTelemetry,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath, resultField: "gpuDiagnostic",
    mutate(value) { delete value.sourceBindings.validationAssets; },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /source-binding identity changed/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath,
    resultField: "gpuDiagnostic", value: originalDiagnostic,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath, resultField: "gpuDiagnostic",
    mutate(value) { value.samples[0].typedResize.discreteMode = "bilinear"; },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /bilinear|typed-resize|Expected values to be strictly equal/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath,
    resultField: "gpuDiagnostic", value: originalDiagnostic,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath, resultField: "gpuDiagnostic",
    mutate(value) {
      value.samples[1].forwardEvidence.responsibilities.reverse();
    },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /forward responsibility order changed/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: diagnosticPath,
    resultField: "gpuDiagnostic", value: originalDiagnostic,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: telemetryPath, resultField: "cudaTelemetry",
    mutate(value) {
      value.phases[2].recordedAtUtc = "2025-01-01T00:00:00.000Z";
    },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /non-monotonic/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: telemetryPath,
    resultField: "cudaTelemetry", value: originalTelemetry,
  });
  mutateEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: statePath, resultField: "stateIntegrity",
    mutate(value) { delete value.autoencoder.loaded; },
  });
  assert.throws(() => validatePythonQualificationEvidence({
    root, packagePayload: payload, activeConfigBinding: activeBinding, outputRoot,
  }), /hash boundary keys changed/u);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath: statePath,
    resultField: "stateIntegrity", value: originalState,
  });
}

function buildDetailedQualificationEvidenceInputs(root, prefix) {
  const responsibilities = [
    "terrain_path_ground", "terrain_water", "terrain_shoreline",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
  ];
  const channelOrder = [
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
    "walkable", "collision", "object_footprints", "object_tree", "object_rock",
    "object_vegetation", "focal_area", "object_instance", "coordinate_x",
    "coordinate_y", "signed_distance_path", "signed_distance_water",
    "signed_distance_shoreline", "signed_distance_object_ground",
    "signed_distance_boundary", "moisture_proximity",
  ];
  const conditionContractPath = writeFixture(root, "data/condition-contract.json", {
    schemaVersion: "ai-painter-complete-map-condition-contract-v1",
    tensorContract: { channelCount: 23, channelOrder },
  });
  const sourceManifestPath = writeFixture(root, "data/source-manifest.json", {
    schemaVersion: "fixture-source-manifest-v1",
  });
  const sourceIndexPath = writeFixture(root, "data/source-index.json", {
    schemaVersion: "ai-assisted-cold-start-dataset-source-index-v1",
  });
  const trainSampleId = "fixture-first-formal-train-record";
  const validationSampleId = "fixture-fixed-validation-sample-194";
  const trainAssets = buildDetailedAssetBindings(root, prefix, "train", channelOrder);
  const validationAssets = buildDetailedAssetBindings(root, prefix, "validation", channelOrder);
  const dataset = {
    schemaVersion: "ai-painter-stage4-v2-dataset-release-contract-v1",
    datasetReleaseIdentity: "dataset-release-fixture",
    sourcePackage: {
      manifest: bindProjectFile(root, projectLogicalPath(root, sourceManifestPath)),
      sourceIndex: bindProjectFile(root, projectLogicalPath(root, sourceIndexPath)),
    },
    samples: [
      {
        sampleId: trainSampleId,
        split: "train",
        image: trainAssets.image,
        conditionPack: trainAssets.conditionPack,
        contribution: trainAssets.contribution,
      },
      {
        sampleId: validationSampleId,
        split: "validation",
        image: validationAssets.image,
        conditionPack: validationAssets.conditionPack,
        contribution: validationAssets.contribution,
      },
    ],
  };
  const datasetPath = writeFixture(root, "data/dataset-release.json", dataset);
  return {
    datasetPath,
    dataset,
    conditionContract: bindProjectFile(root,
      projectLogicalPath(root, conditionContractPath)),
    sourceManifest: dataset.sourcePackage.manifest,
    sourceIndex: dataset.sourcePackage.sourceIndex,
    trainAssets,
    validationAssets,
    fixedInputs: {
      seed: 20263722,
      resolution: { width: 256, height: 192 },
      diffusionTimestep: 500,
      firstTrainSampleId: trainSampleId,
      fixedValidationSampleId: validationSampleId,
      conditionChannels: 23,
      latentChannels: 12,
      responsibilities,
    },
  };
}

function buildDetailedAssetBindings(root, prefix, role, channelOrder) {
  const image = writeFixture(root, `${prefix}/assets/${role}/image.json`, { role });
  const contribution = writeFixture(root,
    `${prefix}/assets/${role}/contribution.json`, { role });
  const channels = channelOrder.map((id, index) => {
    const channel = writeFixture(root,
      `${prefix}/assets/${role}/channels/${String(index).padStart(2, "0")}-${id}.json`,
      { id, index, role });
    return { id, ...bindProjectFile(root, projectLogicalPath(root, channel)) };
  });
  const conditionPack = writeFixture(root,
    `${prefix}/assets/${role}/condition-pack.json`, {
      schemaVersion: "fixture-condition-pack-v1",
      channels,
    });
  return {
    image: bindProjectFile(root, projectLogicalPath(root, image)),
    conditionPack: bindProjectFile(root, projectLogicalPath(root, conditionPack)),
    contribution: bindProjectFile(root, projectLogicalPath(root, contribution)),
    channels,
  };
}

function buildDetailedQualificationDiagnostic(inputs) {
  const { fixedInputs } = inputs;
  const parameterDefinitions = [];
  for (let index = 0; index < 98; index += 1) {
    parameterDefinitions.push({
      parameterName: `shared_substrate.${String(index).padStart(3, "0")}.weight`,
      privateResponsibility: null,
    });
  }
  for (const identity of fixedInputs.responsibilities) {
    for (let index = 0; index < 12; index += 1) parameterDefinitions.push({
      parameterName: `responsibility_paths.${identity}.${String(index).padStart(2, "0")}.weight`,
      privateResponsibility: identity,
    });
    for (let index = 0; index < 4; index += 1) parameterDefinitions.push({
      parameterName: `rgb_responsibility_heads.${identity}.${String(index).padStart(2, "0")}.weight`,
      privateResponsibility: identity,
    });
  }
  assert.equal(parameterDefinitions.length, 210);
  const shapes = parameterDefinitions.map((_, index) => (
    index === 0 ? [4_743_546] : [1]
  ));
  const trainOccupancy = Object.fromEntries(fixedInputs.responsibilities.map(
    (identity) => [identity, !["terrain_water", "terrain_shoreline"].includes(identity)],
  ));
  const validationOccupancy = Object.fromEntries(fixedInputs.responsibilities.map(
    (identity) => [identity, true],
  ));
  const samples = [
    buildDetailedSampleGradientEvidence({
      role: "first_formal_train_record",
      sampleId: fixedInputs.firstTrainSampleId,
      split: "train",
      requireAll: false,
      occupancy: trainOccupancy,
      parameterDefinitions,
      shapes,
      fixedInputs,
    }),
    buildDetailedSampleGradientEvidence({
      role: "fixed_validation_sample_194",
      sampleId: fixedInputs.fixedValidationSampleId,
      split: "validation",
      requireAll: true,
      occupancy: validationOccupancy,
      parameterDefinitions,
      shapes,
      fixedInputs,
    }),
  ];
  return {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-diagnostic-v1",
    status: "passed",
    packageId: "evidence-package",
    runId: "evidence-run",
    architectureId: STAGE4_V2_CAPABILITY,
    datasetReleaseIdentity: "dataset-release-fixture",
    seed: fixedInputs.seed,
    resolution: fixedInputs.resolution,
    latentShape: [1, 12, 48, 64],
    conditionShape: [1, 23, 192, 256],
    diffusionTimestep: fixedInputs.diffusionTimestep,
    formalObjective: "formal_v6_composite_exact_reuse_v1",
    parameterInventory: {
      parameterTensorCount: 210,
      parameterScalarCount: 4_743_755,
      sharedParameterTensorCount: 98,
      responsibilityNamespaces: Object.fromEntries(
        fixedInputs.responsibilities.map((identity) => [identity, {
          responsibilityPathTensorCount: 12,
          rgbHeadTensorCount: 4,
        }]),
      ),
      autoencoderParameterTensorCount: 64,
      autoencoderParameterScalarCount: 2_527_887,
      optimizerParameterIdentityExact: true,
      autoencoderExcluded: true,
      privateParameterNamespacesPairwiseDisjoint: true,
    },
    samples,
    all210ParametersReached: true,
    sample194All210ParametersReached: true,
    sourceBindings: {
      datasetRelease: bindProjectFile(rootForBinding(inputs),
        projectLogicalPath(rootForBinding(inputs), inputs.datasetPath)),
      sourceManifest: inputs.sourceManifest,
      sourceIndex: inputs.sourceIndex,
      trainAssets: inputs.trainAssets,
      validationAssets: inputs.validationAssets,
    },
    safety: {
      autoencoderCheckpointRead: true,
      autoencoderFrozen: true,
      denoiserCheckpointRead: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightsModified: false,
      checkpointWritten: false,
      smokeStarted: false,
      trainingStarted: false,
    },
  };
}

function rootForBinding(inputs) {
  const absolute = path.resolve(inputs.datasetPath);
  const suffix = path.join("data", "dataset-release.json");
  assert.equal(absolute.endsWith(suffix), true);
  return absolute.slice(0, -suffix.length).replace(/[\\/]$/u, "");
}

function buildDetailedSampleGradientEvidence({
  role, sampleId, split, requireAll, occupancy, parameterDefinitions, shapes,
  fixedInputs,
}) {
  const parameters = parameterDefinitions.map((definition, index) => {
    const required = requireAll || definition.privateResponsibility === null
      || occupancy[definition.privateResponsibility];
    return {
      ...definition,
      shape: shapes[index],
      requiredForSample: required,
      gradientPresent: required,
      finite: true,
      nonzero: required,
      ...(required ? { maximumAbsoluteGradient: 0.001 + index / 1_000_000 } : {}),
    };
  });
  const nonzeroParameterNames = parameters.filter((row) => row.nonzero)
    .map((row) => row.parameterName);
  const permittedAbsentOrZeroParameterNames = parameters
    .filter((row) => !row.nonzero && !row.requiredForSample)
    .map((row) => row.parameterName);
  const tensorGradient = (channels, height, width) => ({
    shape: [1, channels, height, width],
    finite: true,
    nonzero: true,
    allChannelsNonzero: true,
    perChannelMaximumAbsoluteGradient: Array.from(
      { length: channels }, (_, index) => 0.001 + index / 100_000,
    ),
  });
  return {
    role,
    sampleId,
    split,
    timestep: fixedInputs.diffusionTimestep,
    formalObjective: "formal_v6_composite_exact_reuse_v1",
    compositeLoss: 1.25,
    responsibilityOccupancy: occupancy,
    parameterGradients: {
      parameterTensorCount: 210,
      nonzeroParameterTensorCount: nonzeroParameterNames.length,
      nonzeroParameterNames,
      permittedAbsentOrZeroParameterNames,
      allRequiredParametersFiniteNonzero: true,
      parameters,
    },
    noisyLatentGradient: tensorGradient(12, 48, 64),
    conditionGradient: tensorGradient(23, 192, 256),
    typedResize: {
      status: "exact_reference_match",
      shape: [1, 23, 48, 64],
      discreteMode: "nearest",
      continuousMode: "bilinear_align_corners_false",
      maximumAbsoluteDifference: 0,
    },
    forwardEvidence: {
      velocityShape: [1, 12, 48, 64],
      conditionProbeShape: [1, 23, 48, 64],
      rgbShape: [1, 3, 192, 256],
      responsibilities: fixedInputs.responsibilities.map((identity) => ({
        identity,
        preservedMaskNonzero: occupancy[identity],
        transportWeightsShape: [1, 9, 48, 64],
        transportWeightSumTolerance: 0.000004,
      })),
      rgbMasksExact: true,
      rgbGatingExact: true,
      outsideResponsibilityUnionEqualsBaseRgb: true,
    },
    allParameterGradFieldsRemainNone: true,
  };
}

function buildDetailedQualificationCudaTelemetry() {
  const names = [
    "model_loaded", "formal_train_latent_normalization",
    "first_formal_train_record", "fixed_validation_sample_194",
  ];
  const phases = names.map((phase, index) => ({
    phase,
    recordedAtUtc: new Date(Date.parse("2026-09-01T05:00:00.000Z") + index * 1000)
      .toISOString(),
    durationSeconds: index + 0.25,
    allocatedBytes: 50 + index * 50,
    reservedBytes: 64 + index * 64,
    peakAllocatedBytes: 100 + index * 100,
    peakReservedBytes: 128 + index * 128,
    driverFreeBytes: 8_000_000 - index * 1000,
    driverTotalBytes: 16_000_000,
  }));
  return {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-cuda-telemetry-v1",
    status: "measured",
    deviceIndex: 0,
    deviceName: "fixture-cuda-device",
    deviceCapability: [12, 0],
    torchVersion: "fixture-torch",
    cudaRuntimeVersion: "fixture-cuda",
    pythonVersion: "fixture-python",
    measuredResolution: { width: 256, height: 192 },
    driverFreeBytesBefore: 8_100_000,
    driverTotalBytesBefore: 16_000_000,
    driverFreeBytesAfter: 7_900_000,
    driverTotalBytesAfter: 16_000_000,
    phases,
    peakGpuMemoryBytes: 400,
    peakReservedBytes: 512,
    durationSeconds: 10,
    preflightMemoryUsedAsDiagnosticPeak: false,
    native1024x768PeakClaimed: false,
  };
}

function mutateEvidenceAndRefreshResult({
  root, outputRoot, evidencePath, resultField, mutate,
}) {
  const value = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  mutate(value);
  replaceEvidenceAndRefreshResult({
    root, outputRoot, evidencePath, resultField, value,
  });
}

function replaceEvidenceAndRefreshResult({
  root, outputRoot, evidencePath, resultField, value,
}) {
  fs.writeFileSync(evidencePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  const resultPath = path.join(outputRoot, "qualification-result.json");
  const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  result[resultField] = pickBinding(bindProjectFile(root,
    projectLogicalPath(root, evidencePath)));
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function testDeclaredRuntimeJunctionBoundary() {
  const projectRoot = path.resolve(process.cwd());
  const registryPath = ".runtime/ai-painter/current-execution-registry/current.json";
  if (fs.existsSync(path.join(projectRoot, registryPath))) {
    assert.match(bindProjectFile(projectRoot, registryPath).sha256, /^[a-f0-9]{64}$/u);
  }
}

function testQualificationLifecycleFirstCrashRecovery(root) {
  const projectRoot = path.join(root, "qualification-lifecycle-first-project");
  fs.mkdirSync(projectRoot, { recursive: false });
  const terminalPath = writeFixture(projectRoot, ".runtime/ai-painter/qualification/phase-terminal.json", {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_readonly_gpu_qualification_passed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: "stage4-v2-readonly-gpu-package-lifecycle-first",
    runId: "stage4-v2-readonly-gpu-lifecycle-first",
    ownerAuthorizationRequired: false,
  });
  const terminalBinding = bindProjectFile(projectRoot, projectLogicalPath(projectRoot, terminalPath));
  const lifecycleStateAbsolute = path.join(projectRoot, ...STAGE4_V2_LIFECYCLE_STATE_PATH.split("/"));
  fs.mkdirSync(path.dirname(lifecycleStateAbsolute), { recursive: true });
  fs.writeFileSync(lifecycleStateAbsolute, `${JSON.stringify({
    schemaVersion: "ai-painter-capability-lifecycle-state-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    changeClass: "model_family",
    state: "cpu_contract_verified",
    sequence: 3,
    latestEvidence: { path: "evidence/003-cpu_contract_verified.json", sha256: "1".repeat(64) },
    releaseIdentity: null,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    updatedAtUtc: "2026-09-01T04:00:00.000Z",
  }, null, 2)}\n`, { flag: "wx" });
  let advanceCount = 0;
  const lifecycleAdvancer = ({ evidence, recordedAtUtc }) => {
    advanceCount += 1;
    const evidencePath = writeFixture(
      projectRoot,
      `${path.posix.dirname(STAGE4_V2_LIFECYCLE_STATE_PATH)}/evidence/004-readonly_gpu_qualified.json`,
      { ...evidence, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc },
    );
    const evidenceBinding = bindProjectFile(projectRoot, projectLogicalPath(projectRoot, evidencePath));
    fs.writeFileSync(lifecycleStateAbsolute, `${JSON.stringify({
      schemaVersion: "ai-painter-capability-lifecycle-state-v1",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      changeClass: "model_family",
      state: "readonly_gpu_qualified",
      sequence: 4,
      latestEvidence: { path: "evidence/004-readonly_gpu_qualified.json", sha256: evidenceBinding.sha256 },
      releaseIdentity: null,
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      updatedAtUtc: recordedAtUtc,
    }, null, 2)}\n`, "utf8");
  };
  const committed = reconcileStage4V2ReadonlyGpuQualifiedLifecycle({
    projectRoot,
    qualificationTerminalBinding: terminalBinding,
    recordedAtUtc: "2026-09-01T04:01:00.000Z",
    lifecycleAdvancer,
  });
  assert.equal(advanceCount, 1);
  assert.equal(committed.state.state, "readonly_gpu_qualified");
  assert.deepEqual(committed.evidence.bindings, [terminalBinding]);

  const recovered = reconcileStage4V2ReadonlyGpuQualifiedLifecycle({
    projectRoot,
    qualificationTerminalBinding: terminalBinding,
    recordedAtUtc: "2026-09-01T04:02:00.000Z",
    lifecycleAdvancer: () => { throw new Error("committed lifecycle must not be advanced twice"); },
  });
  assert.equal(advanceCount, 1, "crash-window recovery repeated the canonical lifecycle transition");
  assert.equal(recovered.evidenceBinding.sha256, committed.evidenceBinding.sha256);

  const otherTerminalPath = writeFixture(projectRoot, ".runtime/ai-painter/qualification/other-terminal.json", {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_readonly_gpu_qualification_passed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId: "stage4-v2-readonly-gpu-package-other",
    runId: "stage4-v2-readonly-gpu-other",
    ownerAuthorizationRequired: false,
  });
  const otherTerminalBinding = bindProjectFile(projectRoot, projectLogicalPath(projectRoot, otherTerminalPath));
  assert.throws(() => verifyStage4V2ReadonlyGpuQualifiedLifecycle({
    projectRoot,
    qualificationTerminalBinding: otherTerminalBinding,
  }), /does not uniquely bind this qualification terminal/u);
}

function testWddmProcessClassification() {
  const graphics = classifyGpuProcesses({
    computeRows: parseNvidiaComputeProcesses("42, [Insufficient Permissions], 721 MiB\n"),
    pmonRows: parseNvidiaPmonProcesses("0 42 G 0 0 chrome.exe\n"),
    wmiRows: { 42: { processId: 42, name: "chrome.exe", executablePath: "C:\\Program Files\\Chrome\\chrome.exe", commandLine: "chrome.exe" } },
  });
  assert.deepEqual(graphics.blockers, []);
  assert.equal(graphics.rows[0].classification, "idle_wddm_graphics");
  const compute = classifyGpuProcesses({
    computeRows: parseNvidiaComputeProcesses("43, python.exe, 2048 MiB\n"),
    pmonRows: parseNvidiaPmonProcesses("0 43 C 15 20 python.exe\n"),
    wmiRows: {},
  });
  assert.ok(compute.blockers.includes("conflicting_gpu_compute_process_detected"));
  assert.ok(compute.blockers.includes("gpu_process_sm_utilization_above_idle_limit"));
}

function writeFixture(root, logicalPath, value) {
  const absolute = path.join(root, ...logicalPath.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", encoding: "utf8" });
  return absolute;
}

function pickBinding(binding) {
  return { path: binding.path, sha256: binding.sha256 };
}
