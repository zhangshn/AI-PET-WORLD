import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  launchAutonomousClosedLoopBackground,
  launchProjectCommandBackground,
} from "../lib/ai-painter-autonomous-background-launcher-v1.mjs";
import { materializeAutonomousClosedLoopPackage } from
  "../lib/ai-painter-autonomous-package-materializer-v1.mjs";

const recordedAtUtc = "2026-09-01T03:00:00.000Z";
const results = [];
const cleanupRoots = [];

try {
  await test("generic command recovers post-spawn crash by exact nonce without respawn", async () => {
    const root = makeRoot("generic-recovery");
    write(root, "scripts/fixture-runner.mjs", "// fixture runner\n");
    let spawnCount = 0;
    assert.throws(() => launchProjectCommandBackground({
      root,
      launchIdentity: "generic-recovery-fixture",
      runnerPath: "scripts/fixture-runner.mjs",
      runnerArgs: ["--fixture", "one"],
      recordedAtUtc,
      processLauncher: ({ attempt }) => {
        spawnCount += 1;
        assert.equal(attempt.processMarker.startsWith("--title=ai-painter-launch-"), true);
        return fakeProcess(51001);
      },
      _testHooks: {
        afterProcessSpawnBeforeReceipt() { throw simulatedCrash("generic-post-spawn"); },
      },
    }), /generic-post-spawn/u);
    const recovered = launchProjectCommandBackground({
      root,
      launchIdentity: "generic-recovery-fixture",
      runnerPath: "scripts/fixture-runner.mjs",
      runnerArgs: ["--fixture", "one"],
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99901);
      },
      attemptProbe: ({ attempt }) => exactObservation(attempt, 51001),
    });
    const replayed = launchProjectCommandBackground({
      root,
      launchIdentity: "generic-recovery-fixture",
      runnerPath: "scripts/fixture-runner.mjs",
      runnerArgs: ["--fixture", "one"],
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99902);
      },
    });
    assert.equal(spawnCount, 1);
    assert.equal(recovered.processId, 51001);
    assert.equal(recovered.recoveredAfterInterruptedSpawn, true);
    assert.equal(replayed.commandIdentitySha256, recovered.commandIdentitySha256);
    assert.equal(replayed.repeatedSpawnAllowed, false);
  });

  await test("generic command fails closed when prepared nonce has no unique active process", async () => {
    const root = makeRoot("generic-not-found");
    write(root, "scripts/fixture-runner.mjs", "// fixture runner\n");
    let spawnCount = 0;
    assert.throws(() => launchProjectCommandBackground({
      root,
      launchIdentity: "generic-not-found-fixture",
      runnerPath: "scripts/fixture-runner.mjs",
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(51002);
      },
      _testHooks: {
        afterProcessSpawnBeforeReceipt() { throw simulatedCrash("generic-not-found-crash"); },
      },
    }), /generic-not-found-crash/u);
    assert.throws(() => launchProjectCommandBackground({
      root,
      launchIdentity: "generic-not-found-fixture",
      runnerPath: "scripts/fixture-runner.mjs",
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99903);
      },
      attemptProbe: () => ({ status: "not_found", matches: [] }),
    }), /repeat spawn is forbidden/u);
    assert.equal(spawnCount, 1);
  });

  await test("legacy autonomous current entry recovers exact post-spawn identity without relaunch", async () => {
    const fixture = buildAutonomousFixture("autonomous-recovery");
    let spawnCount = 0;
    await assert.rejects(launchAutonomousClosedLoopBackground({
      root: fixture.root,
      packagePath: fixture.packagePath,
      packageSha256: fixture.packageSha256,
      recordedAtUtc,
      processLauncher: ({ attempt }) => {
        spawnCount += 1;
        assert.equal(attempt.processMarker.startsWith("--title=ai-painter-launch-"), true);
        return fakeProcess(51003);
      },
      _testHooks: {
        afterProcessSpawnBeforeReceipt() { throw simulatedCrash("autonomous-post-spawn"); },
      },
    }), /autonomous-post-spawn/u);
    const recovered = await launchAutonomousClosedLoopBackground({
      root: fixture.root,
      packagePath: fixture.packagePath,
      packageSha256: fixture.packageSha256,
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99904);
      },
      attemptProbe: ({ attempt }) => exactObservation(attempt, 51003),
    });
    const replayed = await launchAutonomousClosedLoopBackground({
      root: fixture.root,
      packagePath: fixture.packagePath,
      packageSha256: fixture.packageSha256,
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99905);
      },
    });
    assert.equal(spawnCount, 1);
    assert.equal(recovered.processId, 51003);
    assert.equal(recovered.recoveredAfterInterruptedSpawn, true);
    assert.equal(replayed.commandIdentitySha256, recovered.commandIdentitySha256);
    assert.equal(replayed.repeatedSpawnAllowed, false);
  });

  await test("legacy autonomous current entry never respawns an unclaimed prepared nonce", async () => {
    const fixture = buildAutonomousFixture("autonomous-not-found");
    let spawnCount = 0;
    await assert.rejects(launchAutonomousClosedLoopBackground({
      root: fixture.root,
      packagePath: fixture.packagePath,
      packageSha256: fixture.packageSha256,
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(51004);
      },
      _testHooks: {
        afterProcessSpawnBeforeReceipt() { throw simulatedCrash("autonomous-not-found-crash"); },
      },
    }), /autonomous-not-found-crash/u);
    await assert.rejects(launchAutonomousClosedLoopBackground({
      root: fixture.root,
      packagePath: fixture.packagePath,
      packageSha256: fixture.packageSha256,
      recordedAtUtc,
      processLauncher: () => {
        spawnCount += 1;
        return fakeProcess(99906);
      },
      attemptProbe: () => ({ status: "not_found", matches: [] }),
    }), /repeat spawn is forbidden/u);
    assert.equal(spawnCount, 1);
  });

  process.stdout.write(`${JSON.stringify({
    status: "passed",
    testCount: results.length,
    results,
    processSpawnedByTest: false,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`);
} finally {
  for (const root of cleanupRoots) {
    const resolved = path.resolve(root);
    assert.equal(resolved.startsWith(path.resolve(os.tmpdir())), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

async function test(name, body) {
  await body();
  results.push({ name, status: "passed" });
}

function buildAutonomousFixture(suffix) {
  const root = makeRoot(suffix);
  for (const relative of [
    "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
    "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "scripts/lib/ai-painter-local-autonomy-governance-v3.mjs",
    "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json",
    "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json",
  ]) write(root, relative, fs.readFileSync(path.resolve(relative)));
  write(root, "fixtures/input.json", "{\"fixture\":true}\n");
  write(root, "fixtures/adapters.mjs", [
    "preflight", "execute", "validate", "review", "adjudicate", "finalize",
  ].map((phase) => `export async function ${phase}() { return { status: \"passed\" }; }`)
    .join("\n") + "\n");
  const materialized = materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: `${suffix}-package`,
    capabilityVersion: `${suffix}-capability-v1`,
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: 0,
    outputRoot: `.runtime/ai-painter/fixture-outputs/${suffix}`,
    programFiles: { adapters: "fixtures/adapters.mjs" },
    inputEvidencePaths: ["fixtures/input.json"],
    phaseAdapters: Object.fromEntries([
      "preflight", "execute", "validate", "review", "adjudicate", "finalize",
    ].map((phase) => [phase, {
      path: "fixtures/adapters.mjs", exportName: phase,
    }])),
  }, { root, recordedAtUtc });
  return { root, ...materialized };
}

function makeRoot(suffix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-painter-exact-spawn-${suffix}-`));
  cleanupRoots.push(root);
  return root;
}

function exactObservation(attempt, processId) {
  return {
    status: "matched",
    matches: [{
      ...fakeProcess(processId),
      commandIdentitySha256: attempt.commandIdentitySha256,
    }],
  };
}

function fakeProcess(processId) {
  const processCreationDateUtc = "2026-09-01T03:00:01.000Z";
  return {
    processId,
    processStartIdentity: `${processId}:${processCreationDateUtc}`,
    processIdentitySource: "fixture_nonce_commandline_start_identity_v1",
    processCreationDateUtc,
    launchMethod: "fixture_exactly_once_process_launcher",
    windowsHidden: true,
    stdoutPath: null,
    stderrPath: null,
    consoleLogsCaptured: false,
  };
}

function simulatedCrash(message) {
  const error = new Error(message);
  error.code = "AI_PAINTER_TEST_CRASH";
  return error;
}

function write(root, relative, value) {
  const absolute = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value, { flag: "wx" });
}
