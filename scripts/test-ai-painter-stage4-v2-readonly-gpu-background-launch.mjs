import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION,
  STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT,
  STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION,
  launchStage4V2ReadonlyGpuQualificationBackground,
  superviseStage4V2ReadonlyGpuQualificationHandoff,
  validateStage4V2BackgroundLaunchIntent,
} from "./launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs";
import {
  MATERIALIZED_RUN_ACTION,
  MATERIALIZED_RUN_TASK,
} from "./plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  projectLogicalPath,
  readJsonObject,
  resolveProjectPath,
  sha256File,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";
import {
  buildStage4V2QualificationProgramGraph,
} from "./lib/ai-painter-program-graph-manifest-v1.mjs";

const fixedNow = new Date("2026-09-01T02:00:00.000Z");
const results = [];

await test("background launch binds exact package/run/output and child process identity", async () => {
  const fixture = buildFixture("identity-bound");
  let invocation = null;
  const launched = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async (input) => {
      invocation = input;
      return {
        processId: 43127,
        processStartIdentity: "43127:2026-09-01T02:00:01.000Z",
        processIdentitySource: "windows_cim_win32_process_creation_date_v1",
        processCreationDateUtc: "2026-09-01T02:00:01.000Z",
        launchMethod: "injected_windows_start_process_hidden_cim_identity",
        windowsHidden: true,
        stdoutPath: `${input.launchDirectory}/stdout.log`,
        stderrPath: `${input.launchDirectory}/stderr.log`,
      };
    },
    now: () => fixedNow,
  });
  assert.equal(launched.status, "background_child_started_identity_bound");
  assert.equal(launched.packageId, fixture.packageId);
  assert.equal(launched.runId, fixture.runId);
  assert.equal(launched.processId, 43127);
  assert.equal(launched.processStartIdentity, "43127:2026-09-01T02:00:01.000Z");
  assert.equal(launched.detachedFromCodex, true);
  assert.equal(launched.gpuStartedByLauncher, false);
  assert.equal(launched.trainingStarted, false);
  assert.equal(invocation.runnerPath, "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs");
  assert.deepEqual(invocation.runnerArgs.slice(0, 4), [
    "--package", fixture.manifestBinding.path,
    "--package-sha256", fixture.manifestBinding.sha256,
  ]);
  assert.deepEqual(invocation.runnerArgs.slice(4, 6), ["--launch-intent", launched.launchIntent.path]);
  assert.equal(invocation.runnerArgs[6], "--launch-intent-sha256");
  assert.equal(invocation.runnerArgs[7], launched.launchIntent.sha256);

  const receipt = readJsonObject(resolveProjectPath(fixture.root, launched.launchReceipt.path));
  assert.equal(receipt.launchAction, STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ACTION);
  assert.equal(receipt.childRunAction, STAGE4_V2_QUALIFICATION_CHILD_RUN_ACTION);
  assert.equal(receipt.outputDirectory, fixture.outputDirectory);
  assert.equal(receipt.processId, 43127);
  assert.equal(receipt.windowsHidden, true);
  assert.equal(receipt.detachedFromCodex, true);
  assert.equal(receipt.launcherReturnedWithoutWaiting, true);
  assert.equal(receipt.launcherWillNotTerminateChild, true);

  validateStage4V2BackgroundLaunchIntent({
    projectRoot: fixture.root,
    launchIntentBinding: launched.launchIntent,
    packageManifestBinding: fixture.manifestBinding,
    packagePayloadBinding: fixture.manifest.packagePayload,
    signedTicketBinding: fixture.manifest.preReleaseQualificationTicket,
    packagePayload: fixture.payload,
  });
});

await test("same immutable package receipt is idempotent and never spawns twice", async () => {
  const fixture = buildFixture("no-repeat");
  let spawnCount = 0;
  const options = {
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => {
      spawnCount += 1;
      return fakeSpawnResult(44001);
    },
    now: () => fixedNow,
  };
  const first = await launchStage4V2ReadonlyGpuQualificationBackground(options);
  const second = await launchStage4V2ReadonlyGpuQualificationBackground(options);
  assert.equal(spawnCount, 1, "repeat launch reached the process spawner");
  assert.equal(second.launchReceipt.sha256, first.launchReceipt.sha256);
  assert.equal(second.processStartIdentity, first.processStartIdentity);
  assert.equal(second.recoveredWithoutDuplicateSpawn, true);
});

await test("explicit manifest SHA mismatch fails before process creation", async () => {
  const fixture = buildFixture("manifest-sha-fail");
  let spawnCount = 0;
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      packageManifestPath: fixture.manifestBinding.path,
      packageManifestSha256: "0".repeat(64),
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: async () => {
        spawnCount += 1;
        return fakeSpawnResult(44002);
      },
      now: () => fixedNow,
    }),
    /manifest SHA-256 mismatch/u,
  );
  assert.equal(spawnCount, 0);
});

await test("missing process start identity fails closed and is not retried", async () => {
  const fixture = buildFixture("identity-fail");
  let spawnCount = 0;
  const options = {
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => {
      spawnCount += 1;
      return {
        processId: 44003,
        processStartIdentity: null,
        launchMethod: "injected_invalid",
        windowsHidden: true,
      };
    },
    now: () => fixedNow,
  };
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground(options),
    /process start identity is missing/u,
  );
  const failurePath = path.join(
    fixture.root,
    STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT,
    fixture.packageId,
    "launch-failure.json",
  );
  const failure = readJsonObject(failurePath);
  assert.equal(failure.status, "background_launch_failed_closed");
  assert.equal(failure.processMayHaveStarted, true);
  assert.equal(failure.automaticRetryAllowed, false);
  assert.equal(failure.gpuStartedByLauncher, false);
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground(options),
    /failed-closed/u,
  );
  assert.equal(spawnCount, 1);
});

await test("program graph dependency replacement fails before process creation", async () => {
  const fixture = buildFixture("program-graph-dependency-tamper");
  fs.appendFileSync(path.join(
    fixture.root,
    "scripts/lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs",
  ), "// tampered after qualification materialization\n", "utf8");
  let spawnCount = 0;
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: async () => {
        spawnCount += 1;
        return fakeSpawnResult(44004);
      },
      now: () => fixedNow,
    }),
    /program graph manifest differs|SHA-256/u,
  );
  assert.equal(spawnCount, 0,
    "program graph replacement reached qualification process creation");
});

await test("crash after intent resumes exactly one pre-start launch", async () => {
  const fixture = buildFixture("recover-after-intent");
  let spawnCount = 0;
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: async () => {
        spawnCount += 1;
        return fakeSpawnResult(45001);
      },
      _testHooks: {
        onLaunchPoint(point) {
          if (point === "afterLaunchIntentPersisted") throw simulatedCrash("after-intent");
        },
      },
      now: () => fixedNow,
    }),
    /after-intent/u,
  );
  assert.equal(spawnCount, 0);
  const recovered = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => {
      spawnCount += 1;
      return fakeSpawnResult(45001);
    },
    now: () => fixedNow,
  });
  assert.equal(spawnCount, 1);
  assert.equal(recovered.recoveredWithoutDuplicateSpawn, true);
  assert.equal(recovered.processId, 45001);
});

await test("crash after spawn recovers active child identity and only supplements receipt", async () => {
  const fixture = buildFixture("recover-after-spawn");
  let spawnCount = 0;
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: async () => {
        spawnCount += 1;
        return fakeSpawnResult(45002);
      },
      _testHooks: {
        onLaunchPoint(point) {
          if (point === "afterChildSpawnBeforeReceipt") throw simulatedCrash("after-spawn");
        },
      },
      now: () => fixedNow,
    }),
    /after-spawn/u,
  );
  assert.equal(spawnCount, 1);
  const activeCurrent = {
    ...fixture.current,
    registry: {
      ...fixture.current.registry,
      executionState: "executing",
      nextMachineAction: null,
      activeExecution: {
        packageId: fixture.packageId,
        runId: fixture.runId,
        processId: 45002,
        processStartIdentity: "45002:2026-09-01T02:00:01.000Z",
      },
    },
  };
  const recovered = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => activeCurrent,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => {
      spawnCount += 1;
      return fakeSpawnResult(99999);
    },
    processIdentityProbe: async ({ expectedProcessStartIdentity }) => ({
      status: "active",
      processStartIdentity: expectedProcessStartIdentity,
    }),
    now: () => fixedNow,
  });
  assert.equal(spawnCount, 1, "active child recovery spawned a duplicate process");
  assert.equal(recovered.processId, 45002);
  assert.equal(recovered.recoveredWithoutDuplicateSpawn, true);
  const receipt = readJsonObject(resolveProjectPath(fixture.root, recovered.launchReceipt.path));
  assert.equal(receipt.recoveredReceipt, true);
});

await test("post-spawn pre-process-record crash claims the exact child nonce without respawn", async () => {
  const fixture = buildFixture("recover-child-exact-spawn");
  let spawnCount = 0;
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: async () => {
        spawnCount += 1;
        return fakeSpawnResult(45012);
      },
      _testHooks: {
        onLaunchPoint(point) {
          if (point === "afterChildSpawnBeforeProcessRecord") {
            throw simulatedCrash("post-spawn-pre-process-record");
          }
        },
      },
      now: () => fixedNow,
    }),
    /post-spawn-pre-process-record/u,
  );
  assert.equal(spawnCount, 1);

  const recovered = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => {
      spawnCount += 1;
      return fakeSpawnResult(99991);
    },
    launchAttemptProbe: async ({ attempt }) => ({
      status: "matched",
      matches: [{
        ...fakeSpawnResult(45012),
        commandIdentitySha256: attempt.commandIdentitySha256,
      }],
    }),
    now: () => fixedNow,
  });
  assert.equal(spawnCount, 1, "child recovery spawned a second process");
  assert.equal(recovered.processId, 45012);
  assert.equal(recovered.recoveredWithoutDuplicateSpawn, true);
  const processRecord = readJsonObject(path.join(
    fixture.root,
    STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT,
    fixture.packageId,
    "child-process-identity.json",
  ));
  assert.equal(processRecord.recoveredAttempt, true);
  assert.match(processRecord.commandIdentitySha256, /^[a-f0-9]{64}$/u);
});

await test("handoff supervisor post-spawn crash claims its exact nonce without a second supervisor", async () => {
  const fixture = buildFixture("recover-supervisor-exact-spawn");
  let childSpawnCount = 0;
  let supervisorSpawnCount = 0;
  const childSpawner = async () => {
    childSpawnCount += 1;
    return fakeSpawnResult(45013);
  };
  await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: childSpawner,
    now: () => fixedNow,
  });
  await assert.rejects(
    launchStage4V2ReadonlyGpuQualificationBackground({
      projectRoot: fixture.root,
      currentRegistryReader: async () => fixture.current,
      ticketValidator: () => ({ status: "verified_for_test" }),
      backgroundSpawner: childSpawner,
      handoffSupervisorSpawner: async () => {
        supervisorSpawnCount += 1;
        return fakeSpawnResult(45014);
      },
      _testHooks: {
        onLaunchPoint(point) {
          if (point === "afterHandoffSupervisorSpawnBeforeProcessRecord") {
            throw simulatedCrash("post-supervisor-spawn-pre-process-record");
          }
        },
      },
      now: () => fixedNow,
    }),
    /post-supervisor-spawn-pre-process-record/u,
  );
  assert.equal(childSpawnCount, 1);
  assert.equal(supervisorSpawnCount, 1);

  const recovered = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: childSpawner,
    handoffSupervisorSpawner: async () => {
      supervisorSpawnCount += 1;
      return fakeSpawnResult(99992);
    },
    launchAttemptProbe: async ({ attempt }) => ({
      status: "matched",
      matches: [{
        ...fakeSpawnResult(45014),
        commandIdentitySha256: attempt.commandIdentitySha256,
      }],
    }),
    now: () => fixedNow,
  });
  assert.equal(childSpawnCount, 1, "qualification child was relaunched");
  assert.equal(supervisorSpawnCount, 1, "handoff supervisor was launched twice");
  assert.equal(recovered.handoffSupervisionStarted, true);
  const processRecord = readJsonObject(path.join(
    fixture.root,
    STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT,
    fixture.packageId,
    "handoff-supervisor-process.json",
  ));
  assert.equal(processRecord.recoveredSpawnWithoutDuplicate, true);
  assert.match(processRecord.commandIdentitySha256, /^[a-f0-9]{64}$/u);
});

await test("post-registry pre-continuation crash dispatches the exact successor once without qualification relaunch", async () => {
  const fixture = await buildHandoffFixture("post-registry-handoff");
  let continuationDispatchCount = 0;
  const base = {
    projectRoot: fixture.root,
    packageManifestBinding: fixture.manifestBinding,
    launchIntentBinding: fixture.launchIntentBinding,
    childProcessRecordBinding: fixture.childProcessRecordBinding,
    currentRegistryReader: async () => fixture.successorCurrent,
    processIdentityProbe: async () => ({ status: "dead", processStartIdentity: null }),
    continuationInvoker: async ({ qualificationResult }) => {
      continuationDispatchCount += 1;
      assert.equal(qualificationResult.terminal.sha256, fixture.terminalBinding.sha256);
      return { status: "controlled_smoke_background_started", result: fixture.terminalBinding };
    },
    wait: async () => {},
    now: () => fixedNow,
  };
  await assert.rejects(
    superviseStage4V2ReadonlyGpuQualificationHandoff({
      ...base,
      _testHooks: {
        onLaunchPoint(point) {
          if (point === "afterSuccessorRegistryBeforeContinuation") {
            throw simulatedCrash("post-registry-pre-continuation");
          }
        },
      },
    }),
    /post-registry-pre-continuation/u,
  );
  assert.equal(continuationDispatchCount, 0);
  const recovered = await superviseStage4V2ReadonlyGpuQualificationHandoff(base);
  const replayed = await superviseStage4V2ReadonlyGpuQualificationHandoff(base);
  assert.equal(continuationDispatchCount, 1);
  assert.equal(recovered.continuationDispatchCount, 1);
  assert.equal(recovered.qualificationRelaunchCount, 0);
  assert.equal(replayed.recoveredCommittedResult, true);
});

await test("handoff supervisor waits for the exact active child then dispatches once after confirmed death", async () => {
  const fixture = await buildHandoffFixture("active-then-dead-handoff");
  let probeCount = 0;
  let waitCount = 0;
  let continuationDispatchCount = 0;
  const result = await superviseStage4V2ReadonlyGpuQualificationHandoff({
    projectRoot: fixture.root,
    packageManifestBinding: fixture.manifestBinding,
    launchIntentBinding: fixture.launchIntentBinding,
    childProcessRecordBinding: fixture.childProcessRecordBinding,
    currentRegistryReader: async () => fixture.successorCurrent,
    processIdentityProbe: async () => {
      probeCount += 1;
      return probeCount === 1
        ? { status: "active", processStartIdentity: fixture.childProcess.processStartIdentity }
        : { status: "dead", processStartIdentity: null };
    },
    continuationInvoker: async () => {
      continuationDispatchCount += 1;
      return { status: "controlled_smoke_background_started", result: fixture.terminalBinding };
    },
    wait: async () => { waitCount += 1; },
    now: () => fixedNow,
  });
  assert.equal(waitCount, 1);
  assert.equal(continuationDispatchCount, 1);
  assert.equal(result.qualificationRelaunchCount, 0);
});

await test("handoff supervisor rejects a mismatched successor registry without dispatch or qualification relaunch", async () => {
  const fixture = await buildHandoffFixture("wrong-successor-handoff");
  let continuationDispatchCount = 0;
  await assert.rejects(
    superviseStage4V2ReadonlyGpuQualificationHandoff({
      projectRoot: fixture.root,
      packageManifestBinding: fixture.manifestBinding,
      launchIntentBinding: fixture.launchIntentBinding,
      childProcessRecordBinding: fixture.childProcessRecordBinding,
      currentRegistryReader: async () => ({
        ...fixture.successorCurrent,
        registry: {
          ...fixture.successorCurrent.registry,
          nextMachineAction: "plan:untrusted-successor",
        },
      }),
      processIdentityProbe: async () => ({ status: "dead", processStartIdentity: null }),
      continuationInvoker: async () => { continuationDispatchCount += 1; },
      wait: async () => {},
      now: () => fixedNow,
    }),
    /Expected values to be strictly equal/u,
  );
  assert.equal(continuationDispatchCount, 0);
});

process.stdout.write(`${JSON.stringify({
  status: "passed",
  testCount: results.length,
  results,
  backgroundProcessStarted: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

async function test(name, body) {
  await body();
  results.push({ name, status: "passed" });
}

function buildFixture(suffix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-painter-v2-launch-${suffix}-`));
  writeText(root, "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs", "// fixture launcher\n");
  writeText(root, "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs", "// fixture runner\n");
  writeProgramGraphFixtureFiles(root);
  fs.mkdirSync(path.join(root, ".runtime", "ai-painter"), { recursive: true });

  const packageId = `stage4-v2-readonly-gpu-package-${suffix}`;
  const runId = `stage4-v2-readonly-gpu-${suffix}`;
  const packageDirectory = `.runtime/ai-painter/stage4-v2-readonly-gpu-qualification-packages/${packageId}`;
  const outputDirectory = `.runtime/ai-painter/stage4-v2-readonly-gpu-qualifications/${runId}`;
  const preflightDirectory = `.runtime/ai-painter/stage4-v2-readonly-gpu-preflights/${runId}`;
  const payloadPath = `${packageDirectory}/package-payload.json`;
  const ticketPath = `${packageDirectory}/pre-release-qualification-ticket.json`;
  const manifestPath = `${packageDirectory}/package-manifest.json`;
  const terminalPath = `${packageDirectory}/materialization-terminal.json`;
  const programGraphPath = `${packageDirectory}/program-graph-manifest.json`;
  const launcher = bindProjectFile(root, "scripts/launch-ai-painter-stage4-v2-readonly-gpu-qualification-background.mjs");
  const runner = bindProjectFile(root, "scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs");
  const programLineage = { backgroundLauncher: launcher, nodeRunner: runner };
  const programGraph = buildStage4V2QualificationProgramGraph({
    projectRoot: root,
    programLineage,
  });
  writeJson(root, programGraphPath, programGraph);
  const programGraphBinding = bindProjectFile(root, programGraphPath);
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-payload-v1",
    status: "materialized_not_executed",
    packageId,
    runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    executionClass: "readonly_gpu_qualification",
    outputDirectory,
    preflightDirectory,
    programLineage,
    programGraphManifest: programGraphBinding,
    failurePolicy: { automaticRetryAllowed: false, ownerAuthorizationRequired: false },
    executionBoundary: { trainingAllowed: false, smokeAllowed: false, stage0Allowed: false },
  };
  writeJson(root, payloadPath, payload);
  const payloadBinding = bindProjectFile(root, payloadPath);
  writeJson(root, ticketPath, { schemaVersion: "fixture-ticket", packageId, runId });
  const ticketBinding = bindProjectFile(root, ticketPath);
  const manifest = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-package-manifest-v1",
    status: "materialized_not_executed",
    packageId,
    runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packagePayload: payloadBinding,
    programGraphManifest: programGraphBinding,
    preReleaseQualificationTicket: ticketBinding,
    outputDirectory,
    outputDirectoryCreated: false,
    preflightDirectory,
    preflightDirectoryCreated: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  };
  writeJson(root, manifestPath, manifest);
  const manifestBinding = bindProjectFile(root, manifestPath);
  const terminal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-materialization-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_readonly_gpu_qualification_package_materialized",
    packageId,
    runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    manifest: manifestBinding,
    packagePayload: payloadBinding,
    preReleaseQualificationTicket: ticketBinding,
    outputDirectory,
    outputDirectoryCreated: false,
    ticketStatus: "issued_not_consumed_persisted",
    nextMachineAction: MATERIALIZED_RUN_ACTION,
    ownerAuthorizationRequired: false,
  };
  writeJson(root, terminalPath, terminal);
  const terminalBinding = bindProjectFile(root, terminalPath);
  const current = {
    ok: true,
    registrySha256: "a".repeat(64),
    registry: {
      schemaVersion: "ai-painter-current-execution-registry-v1",
      registryRevision: 100,
      eventSequence: 100,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId,
      runId,
      taskId: MATERIALIZED_RUN_TASK,
      taskKind: "readonly_gpu_qualification",
      lifecycleStage: "cpu_contract_verified",
      executionState: "package_materialized",
      nextMachineAction: MATERIALIZED_RUN_ACTION,
      activeExecution: null,
      terminalEvidence: terminalBinding,
    },
    currentTaskTerminal: terminal,
  };
  return {
    root,
    packageId,
    runId,
    outputDirectory,
    payload,
    manifest,
    manifestBinding,
    current,
  };
}

function writeProgramGraphFixtureFiles(root) {
  writeText(root, "scripts/lib/ai-painter-python-import-ast-v1.py",
    fs.readFileSync(path.join(process.cwd(), "scripts", "lib",
      "ai-painter-python-import-ast-v1.py"), "utf8"));
  writeText(root,
    "scripts/lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs",
    "export async function dispatch(url) { return import(url.href); }\n");
  writeText(root,
    "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "export async function dispatch(url) { return import(url); }\n");
  writeText(root,
    "scripts/launch-ai-painter-stage4-v2-controlled-smoke-background.mjs",
    "export async function launch() { return import('./run-ai-painter-stage4-v2-controlled-smoke.mjs'); }\n");
  writeText(root,
    "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs",
    "export async function run(ok) { return ok ? import('./plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs') : import('./adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs'); }\n");
  for (const logicalPath of [
    "scripts/plan-ai-painter-stage4-v2-controlled-smoke.mjs",
    "scripts/plan-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs",
    "scripts/adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary.mjs",
    "scripts/adjudicate-ai-painter-stage4-v2-readonly-gpu-qualification-failure.mjs",
    "scripts/lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs",
  ]) writeText(root, logicalPath, `fixture:${logicalPath}\n`);
}

function fakeSpawnResult(processId) {
  return {
    processId,
    processStartIdentity: `${processId}:2026-09-01T02:00:01.000Z`,
    processIdentitySource: "windows_cim_win32_process_creation_date_v1",
    processCreationDateUtc: "2026-09-01T02:00:01.000Z",
    launchMethod: "injected_windows_start_process_hidden_cim_identity",
    windowsHidden: true,
    stdoutPath: "fixture/stdout.log",
    stderrPath: "fixture/stderr.log",
  };
}

async function buildHandoffFixture(suffix) {
  const fixture = buildFixture(suffix);
  const launched = await launchStage4V2ReadonlyGpuQualificationBackground({
    projectRoot: fixture.root,
    currentRegistryReader: async () => fixture.current,
    ticketValidator: () => ({ status: "verified_for_test" }),
    backgroundSpawner: async () => fakeSpawnResult(47000 + suffix.length),
    now: () => fixedNow,
  });
  const launchRoot = `${STAGE4_V2_QUALIFICATION_BACKGROUND_LAUNCH_ROOT}/${fixture.packageId}`;
  const childProcessRecordBinding = bindProjectFile(fixture.root,
    `${launchRoot}/child-process-identity.json`);
  const childProcess = readJsonObject(resolveProjectPath(
    fixture.root, childProcessRecordBinding.path, { mustExist: true, kind: "file" },
  ));
  const terminalPath = `${fixture.outputDirectory}/phase-terminal.json`;
  writeJson(fixture.root, terminalPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_readonly_gpu_qualification_passed",
    packageId: fixture.packageId,
    runId: fixture.runId,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    nextMachineAction: "plan:ai-painter-stage4-v2-controlled-smoke",
    ownerAuthorizationRequired: false,
    trainingStarted: false,
  });
  const terminalBinding = bindProjectFile(fixture.root, terminalPath);
  return {
    ...fixture,
    launchIntentBinding: launched.launchIntent,
    childProcessRecordBinding,
    childProcess,
    terminalBinding,
    successorCurrent: {
      ok: true,
      registrySha256: "b".repeat(64),
      registry: {
        ...fixture.current.registry,
        registryRevision: fixture.current.registry.registryRevision + 1,
        taskId: "materialize_stage4_v2_controlled_smoke_contract",
        taskKind: "controlled_smoke_planning",
        lifecycleStage: "readonly_gpu_qualified",
        executionState: "package_materialized",
        nextMachineAction: "plan:ai-painter-stage4-v2-controlled-smoke",
        activeExecution: null,
        terminalEvidence: terminalBinding,
      },
      currentTaskTerminal: readJsonObject(resolveProjectPath(fixture.root, terminalPath)),
    },
  };
}

function simulatedCrash(message) {
  const error = new Error(message);
  error.code = "AI_PAINTER_TEST_CRASH";
  return error;
}

function writeJson(root, logicalPath, value) {
  writeText(root, logicalPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, logicalPath, value) {
  const absolute = path.join(root, ...logicalPath.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value, { flag: "wx" });
  return { path: projectLogicalPath(root, absolute), sha256: sha256File(absolute) };
}
