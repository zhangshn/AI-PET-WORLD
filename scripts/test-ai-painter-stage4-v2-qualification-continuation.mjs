import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  QUALIFICATION_FAILURE_ACTION,
  QUALIFICATION_SUCCESS_LAUNCH_ACTION,
  QUALIFICATION_SUCCESS_PLAN_ACTION,
  continueStage4V2AfterReadonlyGpuQualification,
} from "./lib/ai-painter-stage4-v2-qualification-continuation-v1.mjs";
import {
  STAGE4_V2_CAPABILITY,
  bindProjectFile,
  projectLogicalPath,
  resolveProjectPath,
} from "./lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";
import {
  prepareExactlyOnceBackgroundSpawn,
} from "./lib/ai-painter-exactly-once-background-spawn-v1.mjs";

const tests = [];
const fixedNow = () => new Date("2026-09-01T03:00:00.000Z");

await test("passed qualification plans Smoke then starts its detached background launcher", async () => {
  const fixture = buildFixture("success", "completed", "stage4_v2_readonly_gpu_qualification_passed");
  const smokePackageId = "stage4-v2-controlled-smoke-package-success";
  const smokeRunId = "stage4-v2-controlled-smoke-success";
  const snapshots = [
    currentSnapshot({
      packageId: fixture.packageId,
      runId: fixture.runId,
      taskId: "materialize_stage4_v2_controlled_smoke_contract",
      taskKind: "controlled_smoke_planning",
      nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
      executionState: "package_materialized",
      revision: 201,
    }),
    currentSnapshot({
      packageId: smokePackageId,
      runId: smokeRunId,
      taskId: "execute_stage4_v2_controlled_smoke",
      taskKind: "controlled_smoke",
      nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
      executionState: "package_materialized",
      revision: 202,
    }),
  ];
  const actions = [];
  const result = await continueStage4V2AfterReadonlyGpuQualification({
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => snapshots.shift(),
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      actions.push(action);
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        return { status: "stage4_v2_controlled_smoke_materialized", packageId: smokePackageId, runId: smokeRunId };
      }
      return {
        status: "background_child_started_identity_bound",
        packageId: smokePackageId,
        runId: smokeRunId,
        detachedFromCodex: true,
      };
    },
    now: fixedNow,
  });
  assert.deepEqual(actions, [QUALIFICATION_SUCCESS_PLAN_ACTION, QUALIFICATION_SUCCESS_LAUNCH_ACTION]);
  assert.equal(result.status, "controlled_smoke_background_started");
  assert.equal(result.smokePackageId, smokePackageId);
  assert.equal(result.smokeRunId, smokeRunId);
  assert.equal(result.detachedFromCodex, true);
  assert.equal(result.ownerAuthorizationRequired, false);
  assert.equal(result.automaticGpuReplayAllowed, false);
  assert.equal(fs.existsSync(resolveProjectPath(fixture.root, result.result.path)), true);
});

await test("failed qualification invokes only the read-only failure adjudicator", async () => {
  const fixture = buildFixture("failure", "failed_closed", "stage4_v2_readonly_gpu_qualification_failed_closed");
  const snapshots = [
    currentSnapshot({
      packageId: fixture.packageId,
      runId: fixture.runId,
      taskId: "adjudicate_stage4_v2_readonly_gpu_qualification_failure",
      taskKind: "cpu_readonly_adjudication",
      nextMachineAction: QUALIFICATION_FAILURE_ACTION,
      executionState: "package_materialized",
      revision: 301,
    }),
    currentSnapshot({
      packageId: fixture.packageId,
      runId: fixture.runId,
      taskId: "stage4_v2_failure_boundary_recorded",
      taskKind: "cpu_readonly_adjudication_terminal",
      nextMachineAction: null,
      executionState: "failed_closed",
      revision: 302,
    }),
  ];
  const actions = [];
  const result = await continueStage4V2AfterReadonlyGpuQualification({
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => snapshots.shift(),
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      actions.push(action);
      return { status: "failure_boundary_adjudicated", executionState: "completed" };
    },
    now: fixedNow,
  });
  assert.deepEqual(actions, [QUALIFICATION_FAILURE_ACTION]);
  assert.equal(result.status, "qualification_failure_adjudicated_locally");
  assert.equal(result.resultingNextMachineAction, null);
  assert.equal(result.automaticGpuReplayAllowed, false);
});

await test("unexpected Smoke successor action fails closed before any Smoke launch", async () => {
  const fixture = buildFixture("wrong-action", "completed", "stage4_v2_readonly_gpu_qualification_passed");
  const snapshots = [
    currentSnapshot({
      packageId: fixture.packageId,
      runId: fixture.runId,
      taskId: "materialize_stage4_v2_controlled_smoke_contract",
      taskKind: "controlled_smoke_planning",
      nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
      executionState: "package_materialized",
      revision: 401,
    }),
    currentSnapshot({
      packageId: "stage4-v2-controlled-smoke-package-wrong",
      runId: "stage4-v2-controlled-smoke-wrong",
      taskId: "execute_stage4_v2_controlled_smoke",
      taskKind: "controlled_smoke",
      nextMachineAction: "run:unregistered-or-foreground-smoke",
      executionState: "package_materialized",
      revision: 402,
    }),
  ];
  const actions = [];
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      projectRoot: fixture.root,
      qualificationResult: fixture.result,
      currentRegistryReader: async () => snapshots.shift(),
      entrypointVerifier: ({ action }) => fakeEntrypoint(action),
      actionInvoker: async ({ action }) => {
        actions.push(action);
        return { status: "planned" };
      },
      now: fixedNow,
    }),
    /detached Smoke launch action/u,
  );
  assert.deepEqual(actions, [QUALIFICATION_SUCCESS_PLAN_ACTION]);
  const failure = JSON.parse(fs.readFileSync(path.join(
    path.dirname(resolveProjectPath(fixture.root, fixture.result.terminal.path)),
    "local-continuation",
    "continuation-failure.json",
  ), "utf8"));
  assert.equal(failure.status, "local_continuation_failed_closed");
  assert.equal(failure.automaticRetryAllowed, false);
  assert.equal(failure.automaticGpuReplayAllowed, false);
});

await test("crash after continuation intent resumes from qualification plan-ready state", async () => {
  const fixture = buildFixture("recover-intent", "completed", "stage4_v2_readonly_gpu_qualification_passed");
  const qualificationCurrent = currentSnapshot({
    packageId: fixture.packageId,
    runId: fixture.runId,
    taskId: "materialize_stage4_v2_controlled_smoke_contract",
    taskKind: "controlled_smoke_planning",
    nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
    executionState: "package_materialized",
    revision: 501,
  });
  const smokeCurrent = currentSnapshot({
    packageId: "stage4-v2-controlled-smoke-package-recover-intent",
    runId: "stage4-v2-controlled-smoke-recover-intent",
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    executionState: "package_materialized",
    revision: 502,
  });
  let current = qualificationCurrent;
  const actions = [];
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      projectRoot: fixture.root,
      qualificationResult: fixture.result,
      currentRegistryReader: async () => current,
      entrypointVerifier: ({ action }) => fakeEntrypoint(action),
      actionInvoker: async () => { throw new Error("action must not run before after-intent crash"); },
      _testHooks: {
        onContinuationPoint(point) {
          if (point === "afterContinuationIntentPersisted") throw simulatedCrash("after-continuation-intent");
        },
      },
      now: fixedNow,
    }),
    /after-continuation-intent/u,
  );
  const recovered = await continueStage4V2AfterReadonlyGpuQualification({
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => current,
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      actions.push(action);
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        current = smokeCurrent;
        return { status: "planned" };
      }
      return {
        status: "background_child_started_identity_bound",
        packageId: smokeCurrent.registry.packageId,
        runId: smokeCurrent.registry.runId,
        detachedFromCodex: true,
      };
    },
    now: fixedNow,
  });
  assert.deepEqual(actions, [QUALIFICATION_SUCCESS_PLAN_ACTION, QUALIFICATION_SUCCESS_LAUNCH_ACTION]);
  assert.equal(recovered.status, "controlled_smoke_background_started");
});

await test("crash after Smoke plan resumes at launch without materializing a second Smoke", async () => {
  const fixture = buildFixture("recover-plan", "completed", "stage4_v2_readonly_gpu_qualification_passed");
  let current = currentSnapshot({
    packageId: fixture.packageId,
    runId: fixture.runId,
    taskId: "materialize_stage4_v2_controlled_smoke_contract",
    taskKind: "controlled_smoke_planning",
    nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
    executionState: "package_materialized",
    revision: 601,
  });
  const smokeCurrent = currentSnapshot({
    packageId: "stage4-v2-controlled-smoke-package-recover-plan",
    runId: "stage4-v2-controlled-smoke-recover-plan",
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    executionState: "package_materialized",
    revision: 602,
  });
  let planCount = 0;
  let launcherCount = 0;
  const common = {
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => current,
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        planCount += 1;
        current = smokeCurrent;
        return { status: "planned" };
      }
      launcherCount += 1;
      return {
        status: "background_child_started_identity_bound",
        packageId: smokeCurrent.registry.packageId,
        runId: smokeCurrent.registry.runId,
        detachedFromCodex: true,
      };
    },
    now: fixedNow,
  };
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      ...common,
      _testHooks: {
        onContinuationPoint(point) {
          if (point === "afterSmokePlanBeforeLaunch") throw simulatedCrash("after-smoke-plan");
        },
      },
    }),
    /after-smoke-plan/u,
  );
  const recovered = await continueStage4V2AfterReadonlyGpuQualification(common);
  assert.equal(planCount, 1, "Smoke planner was repeated after its registry commit");
  assert.equal(launcherCount, 1);
  assert.equal(recovered.status, "controlled_smoke_background_started");
});

await test("crash after Smoke launch reuses launcher receipt and does not start a second child", async () => {
  const fixture = buildFixture("recover-launch", "completed", "stage4_v2_readonly_gpu_qualification_passed");
  let current = currentSnapshot({
    packageId: fixture.packageId,
    runId: fixture.runId,
    taskId: "materialize_stage4_v2_controlled_smoke_contract",
    taskKind: "controlled_smoke_planning",
    nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
    executionState: "package_materialized",
    revision: 701,
  });
  const smokeCurrent = currentSnapshot({
    packageId: "stage4-v2-controlled-smoke-package-recover-launch",
    runId: "stage4-v2-controlled-smoke-recover-launch",
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    executionState: "package_materialized",
    revision: 702,
  });
  let planCount = 0;
  let launcherInvocationCount = 0;
  let physicalChildStartCount = 0;
  let launchReceipt = null;
  const common = {
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => current,
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        planCount += 1;
        current = smokeCurrent;
        return { status: "planned" };
      }
      launcherInvocationCount += 1;
      if (launchReceipt === null) {
        physicalChildStartCount += 1;
        launchReceipt = {
          status: "background_child_started_identity_bound",
          packageId: smokeCurrent.registry.packageId,
          runId: smokeCurrent.registry.runId,
          detachedFromCodex: true,
          launchReceipt: { path: "fixture/launch-receipt.json", sha256: "d".repeat(64) },
        };
      }
      return launchReceipt;
    },
    now: fixedNow,
  };
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      ...common,
      _testHooks: {
        onContinuationPoint(point) {
          if (point === "afterSmokeLaunchBeforeResult") throw simulatedCrash("after-smoke-launch");
        },
      },
    }),
    /after-smoke-launch/u,
  );
  const recovered = await continueStage4V2AfterReadonlyGpuQualification(common);
  assert.equal(planCount, 1);
  assert.equal(launcherInvocationCount, 2, "recovery must verify/reuse the existing launcher receipt");
  assert.equal(physicalChildStartCount, 1, "recovery started a duplicate Smoke child");
  assert.equal(recovered.status, "controlled_smoke_background_started");
});

await test("post-launch pre-journal crash recovers an exact active Smoke without relaunch", async () => {
  const fixture = buildFixture("recover-active-smoke", "completed",
    "stage4_v2_readonly_gpu_qualification_passed");
  let current = currentSnapshot({
    packageId: fixture.packageId,
    runId: fixture.runId,
    taskId: "materialize_stage4_v2_controlled_smoke_contract",
    taskKind: "controlled_smoke_planning",
    nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
    executionState: "package_materialized",
    revision: 801,
  });
  const smokePackageId = "stage4-v2-controlled-smoke-package-active";
  const smokeRunId = "stage4-v2-controlled-smoke-active";
  const smokeMaterialized = currentSnapshot({
    packageId: smokePackageId,
    runId: smokeRunId,
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    executionState: "package_materialized",
    revision: 802,
  });
  let planCount = 0;
  let launcherCount = 0;
  const common = {
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => current,
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        planCount += 1;
        current = smokeMaterialized;
        return { status: "planned", packageId: smokePackageId, runId: smokeRunId };
      }
      launcherCount += 1;
      const active = buildActiveSmokeFixture({
        root: fixture.root,
        packageId: smokePackageId,
        runId: smokeRunId,
        revision: 803,
      });
      current = active.current;
      return active.launchResult;
    },
    now: fixedNow,
  };
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      ...common,
      _testHooks: {
        onContinuationPoint(point) {
          if (point === "afterSmokeLaunchReturnedBeforeJournal") {
            throw simulatedCrash("after-smoke-launch-return-before-journal");
          }
        },
      },
    }),
    /after-smoke-launch-return-before-journal/u,
  );
  const recovered = await continueStage4V2AfterReadonlyGpuQualification({
    ...common,
    actionInvoker: async () => {
      throw new Error("active Smoke recovery must not invoke planner or launcher");
    },
  });
  assert.equal(planCount, 1);
  assert.equal(launcherCount, 1);
  assert.equal(recovered.status, "controlled_smoke_background_started");
  assert.equal(recovered.smokePackageId, smokePackageId);
  assert.equal(recovered.smokeRunId, smokeRunId);
  assert.equal(recovered.smokeLaunchResult.status,
    "background_process_already_active_identity_bound");
  assert.equal(recovered.smokeLaunchResult.qualificationRelaunchCount, 0);
});

await test("post-launch pre-journal crash recovers an exact completed Smoke without relaunch", async () => {
  await assertCompletedOrAdvancedSmokeRecovery("completed-smoke", false);
});

await test("post-launch pre-journal crash recovers an exact advanced formal successor without relaunch", async () => {
  await assertCompletedOrAdvancedSmokeRecovery("advanced-formal-successor", true);
});

process.stdout.write(`${JSON.stringify({
  status: "passed",
  testCount: tests.length,
  tests,
  realProcessStarted: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2)}\n`);

async function test(name, body) {
  await body();
  tests.push({ name, status: "passed" });
}

function buildFixture(suffix, executionState, status) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-painter-v2-continuation-${suffix}-`));
  fs.mkdirSync(path.join(root, ".runtime", "ai-painter", "qualification", suffix), { recursive: true });
  const terminalAbsolute = path.join(root, ".runtime", "ai-painter", "qualification", suffix, "phase-terminal.json");
  const packageId = `stage4-v2-readonly-gpu-package-${suffix}`;
  const runId = `stage4-v2-readonly-gpu-${suffix}`;
  fs.writeFileSync(terminalAbsolute, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-terminal-v1",
    executionState,
    status,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId,
    runId,
    ownerAuthorizationRequired: false,
  }, null, 2)}\n`, { flag: "wx" });
  const terminal = bindProjectFile(root, projectLogicalPath(root, terminalAbsolute));
  if (executionState === "completed") {
    const lifecycleRoot = path.join(
      root,
      ".runtime",
      "ai-painter",
      "capability-lifecycle",
      STAGE4_V2_CAPABILITY,
    );
    fs.mkdirSync(path.join(lifecycleRoot, "evidence"), { recursive: true });
    const lifecycleEvidenceAbsolute = path.join(lifecycleRoot, "evidence", "004-readonly_gpu_qualified.json");
    fs.writeFileSync(lifecycleEvidenceAbsolute, `${JSON.stringify({
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "readonly_gpu_qualified",
      status: "passed",
      bindings: [terminal],
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
    }, null, 2)}\n`, { flag: "wx" });
    const lifecycleEvidence = bindProjectFile(root, projectLogicalPath(root, lifecycleEvidenceAbsolute));
    fs.writeFileSync(path.join(lifecycleRoot, "state.json"), `${JSON.stringify({
      schemaVersion: "ai-painter-capability-lifecycle-state-v1",
      capabilityVersion: STAGE4_V2_CAPABILITY,
      changeClass: "model_family",
      state: "readonly_gpu_qualified",
      sequence: 4,
      latestEvidence: {
        path: "evidence/004-readonly_gpu_qualified.json",
        sha256: lifecycleEvidence.sha256,
      },
      releaseIdentity: null,
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      updatedAtUtc: fixedNow().toISOString(),
    }, null, 2)}\n`, { flag: "wx" });
  }
  return {
    root,
    packageId,
    runId,
    result: {
      schemaVersion: "ai-painter-stage4-v2-readonly-gpu-execution-result-v1",
      executionState,
      status,
      packageId,
      runId,
      terminal,
      ownerAuthorizationRequired: false,
      trainingStarted: false,
    },
  };
}

function currentSnapshot({
  packageId, runId, taskId, taskKind, nextMachineAction, executionState,
  revision, activeExecution = null, currentTaskTerminal = null,
  terminalEvidence = null,
}) {
  return {
    ok: true,
    registrySha256: String(revision).padStart(64, "0").slice(-64),
    registry: {
      schemaVersion: "ai-painter-current-execution-registry-v1",
      registryRevision: revision,
      eventSequence: revision,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      packageId,
      runId,
      taskId,
      taskKind,
      nextMachineAction,
      executionState,
      activeExecution,
      terminalEvidence,
    },
    currentTaskTerminal,
  };
}

async function assertCompletedOrAdvancedSmokeRecovery(suffix, advanced) {
  const fixture = buildFixture(suffix, "completed",
    "stage4_v2_readonly_gpu_qualification_passed");
  let current = currentSnapshot({
    packageId: fixture.packageId,
    runId: fixture.runId,
    taskId: "materialize_stage4_v2_controlled_smoke_contract",
    taskKind: "controlled_smoke_planning",
    nextMachineAction: QUALIFICATION_SUCCESS_PLAN_ACTION,
    executionState: "package_materialized",
    revision: 900,
  });
  const smokePackageId = `stage4-v2-controlled-smoke-package-${suffix}`;
  const smokeRunId = `stage4-v2-controlled-smoke-${suffix}`;
  const smokeMaterialized = currentSnapshot({
    packageId: smokePackageId,
    runId: smokeRunId,
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: QUALIFICATION_SUCCESS_LAUNCH_ACTION,
    executionState: "package_materialized",
    revision: 901,
  });
  let planCount = 0;
  let launcherCount = 0;
  const common = {
    projectRoot: fixture.root,
    qualificationResult: fixture.result,
    currentRegistryReader: async () => current,
    entrypointVerifier: ({ action }) => fakeEntrypoint(action),
    actionInvoker: async ({ action }) => {
      if (action === QUALIFICATION_SUCCESS_PLAN_ACTION) {
        planCount += 1;
        current = smokeMaterialized;
        return { status: "planned", packageId: smokePackageId, runId: smokeRunId };
      }
      launcherCount += 1;
      const completed = buildCompletedSmokeFixture({
        root: fixture.root,
        packageId: smokePackageId,
        runId: smokeRunId,
        revision: 902,
        advanced,
      });
      current = completed.current;
      return completed.launchResult;
    },
    now: fixedNow,
  };
  await assert.rejects(
    continueStage4V2AfterReadonlyGpuQualification({
      ...common,
      _testHooks: {
        onContinuationPoint(point) {
          if (point === "afterSmokeLaunchReturnedBeforeJournal") {
            throw simulatedCrash(`post-launch-${suffix}`);
          }
        },
      },
    }),
    new RegExp(`post-launch-${suffix}`, "u"),
  );
  const recovered = await continueStage4V2AfterReadonlyGpuQualification({
    ...common,
    actionInvoker: async () => {
      throw new Error("completed Smoke recovery must not invoke planner or launcher");
    },
  });
  assert.equal(planCount, 1);
  assert.equal(launcherCount, 1);
  assert.equal(recovered.status, "controlled_smoke_background_started");
  assert.equal(recovered.smokePackageId, smokePackageId);
  assert.equal(recovered.smokeRunId, smokeRunId);
  assert.equal(recovered.smokeLaunchResult.status,
    "background_process_completed_identity_bound");
  assert.equal(recovered.smokeLaunchResult.qualificationRelaunchCount, 0);
}

function buildActiveSmokeFixture({ root, packageId, runId, revision }) {
  const packageRoot = path.join(root, ".runtime", "ai-painter",
    "autonomous-closed-loop-packages", packageId);
  fs.mkdirSync(packageRoot, { recursive: true });
  const manifestPath = path.join(packageRoot, "package-manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-manifest-v1",
    packageId,
    runId,
  }, null, 2)}\n`, "utf8");
  const manifestBinding = bindProjectFile(root, projectLogicalPath(root, manifestPath));
  const runnerPath = "scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs";
  const runnerSha256 = "e".repeat(64);
  const processId = 48031;
  const launchIdentity = `stage4-v2-smoke-bg-${runId}`;
  const receiptDirectory = path.join(root, ".runtime", "ai-painter",
    "stage4-v2-controlled-smoke-background-launches", launchIdentity);
  fs.mkdirSync(receiptDirectory, { recursive: true });
  const runnerArgs = [
    "--package-manifest", manifestBinding.path,
    "--package-manifest-sha256", manifestBinding.sha256,
    "--launch-intent", `${projectLogicalPath(root, packageRoot)}/background-launch-intent.json`,
    "--launch-intent-sha256", "f".repeat(64),
  ];
  const spawnAttemptPath = path.join(receiptDirectory, "spawn-attempt.json");
  const spawnAttempt = prepareExactlyOnceBackgroundSpawn({
    projectRoot: root,
    attemptPath: spawnAttemptPath,
    launchIdentity,
    runnerPath,
    runnerSha256,
    runnerArgs,
    recordedAtUtc: fixedNow().toISOString(),
    nonceFactory: () => "fixture-nonce-active-smoke",
  });
  const spawnAttemptBinding = bindProjectFile(root,
    projectLogicalPath(root, spawnAttemptPath));
  const receiptPath = path.join(receiptDirectory, "launch-receipt.json");
  fs.writeFileSync(receiptPath, `${JSON.stringify({
    schemaVersion: "ai-painter-local-program-background-command-receipt-v1",
    status: "background_process_started",
    launchIdentity,
    runnerPath,
    runnerSha256,
    runnerArgs,
    processId,
    processStartIdentity: `${processId}:2026-09-01T03:00:01.000Z`,
    processIdentitySource: "fixture_nonce_commandline_start_identity_v1",
    processCreationDateUtc: "2026-09-01T03:00:01.000Z",
    launchMethod: "fixture_hidden_background",
    detachedFromCodex: true,
    spawnAttempt: spawnAttemptBinding,
    commandIdentitySha256: spawnAttempt.commandIdentitySha256,
    repeatedSpawnAllowed: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc: fixedNow().toISOString(),
  }, null, 2)}\n`, "utf8");
  const receiptBinding = bindProjectFile(root, projectLogicalPath(root, receiptPath));
  const launchCommitPath = path.join(packageRoot, "background-launch-commit.json");
  fs.writeFileSync(launchCommitPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-background-launch-commit-v1",
    status: "receipt_committed",
    packageId,
    runId,
    receipt: receiptBinding,
    processId,
    detachedFromCodex: true,
    recordedAtUtc: fixedNow().toISOString(),
  }, null, 2)}\n`, "utf8");
  const activeExecution = {
    schemaVersion: "ai-painter-current-active-execution-v1",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId,
    runId,
    executionState: "running",
    processId,
    processStartIdentity: `${processId}:2026-09-01T03:00:01.000Z`,
    programLineage: {
      outerRunner: { path: runnerPath, sha256: runnerSha256 },
    },
    lock: { path: "fixture/active-lock.json", sha256: "1".repeat(64) },
    heartbeat: { path: "fixture/heartbeat.json", ttlSeconds: 60 },
  };
  const current = currentSnapshot({
    packageId,
    runId,
    taskId: "execute_stage4_v2_controlled_smoke",
    taskKind: "controlled_smoke",
    nextMachineAction: null,
    executionState: "running",
    revision,
    activeExecution,
    currentTaskTerminal: {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-materialization-terminal-v1",
      packageId,
      runId,
      packageManifest: manifestBinding,
    },
  });
  return {
    current,
    launchResult: {
      status: "background_process_started_and_identity_verified",
      packageId,
      runId,
      detachedFromCodex: true,
      launchReceipt: receiptBinding,
    },
  };
}

function buildCompletedSmokeFixture({ root, packageId, runId, revision, advanced }) {
  const launched = buildActiveSmokeFixture({ root, packageId, runId, revision });
  const packageRoot = path.join(root, ".runtime", "ai-painter",
    "autonomous-closed-loop-packages", packageId);
  const smokeTerminalPath = path.join(packageRoot, "execution-terminal.json");
  fs.writeFileSync(smokeTerminalPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-terminal-v1",
    executionState: "completed",
    status: "stage4_v2_controlled_smoke_passed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId,
    runId,
    nextMachineAction: "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
    ownerAuthorizationRequired: false,
    recordedAtUtc: fixedNow().toISOString(),
  }, null, 2)}\n`, { flag: "wx" });
  const smokeTerminalBinding = bindProjectFile(root,
    projectLogicalPath(root, smokeTerminalPath));
  if (!advanced) {
    return {
      launchResult: launched.launchResult,
      current: currentSnapshot({
        packageId,
        runId,
        taskId: "materialize_stage4_v2_formal_stage0_to_stage2",
        taskKind: "formal_training_planning",
        nextMachineAction: "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
        executionState: "package_materialized",
        revision,
        currentTaskTerminal: JSON.parse(fs.readFileSync(smokeTerminalPath, "utf8")),
        terminalEvidence: smokeTerminalBinding,
      }),
    };
  }
  const formalRoot = path.join(root, ".runtime", "ai-painter",
    "stage4-v2-formal-stage0-to-stage2", runId);
  fs.mkdirSync(formalRoot, { recursive: true });
  const planPath = path.join(formalRoot, "formal-plan.json");
  fs.writeFileSync(planPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1",
    status: "materialized_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    parentControlledSmokeTerminal: smokeTerminalBinding,
    ownerAuthorizationRequired: false,
  }, null, 2)}\n`, { flag: "wx" });
  const planBinding = bindProjectFile(root, projectLogicalPath(root, planPath));
  const formalTerminalPath = path.join(formalRoot, "terminal.json");
  fs.writeFileSync(formalTerminalPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-terminal-v1",
    executionState: "completed",
    status: "formal_training_closed_loop_plan_materialized_not_executed",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    packageId,
    runId,
    plan: planBinding,
    ownerAuthorizationRequired: false,
  }, null, 2)}\n`, { flag: "wx" });
  const formalTerminal = JSON.parse(fs.readFileSync(formalTerminalPath, "utf8"));
  const formalTerminalBinding = bindProjectFile(root,
    projectLogicalPath(root, formalTerminalPath));
  return {
    launchResult: launched.launchResult,
    current: currentSnapshot({
      packageId,
      runId,
      taskId: "stage4_v2_formal_stage0_to_stage2_plan_completed",
      taskKind: "formal_training_planning",
      nextMachineAction: null,
      executionState: "completed",
      revision,
      currentTaskTerminal: formalTerminal,
      terminalEvidence: formalTerminalBinding,
    }),
  };
}

function fakeEntrypoint(action) {
  return {
    action,
    entryFile: { path: `scripts/${action.replaceAll(":", "-")}.mjs`, sha256: "b".repeat(64) },
    exportName: "injected",
    entrypointRegistry: { path: "data/entrypoints.json", sha256: "c".repeat(64) },
  };
}

function simulatedCrash(message) {
  const error = new Error(message);
  error.code = "AI_PAINTER_TEST_CRASH";
  return error;
}
