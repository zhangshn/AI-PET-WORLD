import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  launchAutonomousClosedLoopBackground,
  launchProjectCommandBackground,
  prepareBoundedBackgroundObservation,
  BACKGROUND_LOG_LIMITS,
  validateBoundedBackgroundObservation,
} from "../lib/ai-painter-autonomous-background-launcher-v1.mjs";
import { prepareExactlyOnceBackgroundSpawn, exactSpawnNodeArguments } from "../lib/ai-painter-exactly-once-background-spawn-v1.mjs";
import crypto from "node:crypto";
import { materializeAutonomousClosedLoopPackage } from
  "../lib/ai-painter-autonomous-package-materializer-v1.mjs";

const recordedAtUtc = "2026-09-01T03:00:00.000Z";
const results = [];
const cleanupRoots = [];
const retainedComponentRoot = process.env.AI_PAINTER_BACKGROUND_COMPONENT_ROOT;
if (retainedComponentRoot) {
  assert.ok(path.isAbsolute(retainedComponentRoot) && !fs.existsSync(retainedComponentRoot), 'fresh absolute component evidence root required');
  fs.mkdirSync(retainedComponentRoot);
}

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

  const observationModes=['normal','early-failure','bounded-logs','source-drift','split-secret',
    'late-secret','late-split-secret','late-secret-error','secret-rotation','late-unicode-secret','late-spaced-secret','late-partial-error','argv-drift',
    'tracking-entry-budget','tracking-byte-budget','late-bounded-logs','late-error-recovery-handler'];
  for (const mode of observationModes) {
    await test(`foreground observation component: ${mode}; no background/native/GPU launch`, async () => {
      const root = makeRoot('observation-' + mode), runnerPath = 'scripts/foreground-fixture.mjs';
      const sources = {
        normal: "process.stdout.write('fixture stdout\\n');process.stderr.write('fixture stderr\\n');",
        'early-failure': "throw Object.assign(Error('private bootstrap fixture failure'),{code:'FIXTURE_BOOTSTRAP_FAILURE'});",
        'bounded-logs': "process.stdout.write('a'.repeat(400000));process.stderr.write('b'.repeat(400000));",
        'source-drift': "throw Error('changed runner must never execute');",
        'split-secret': "const key=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;process.stdout.write(key.slice(0,19));process.stdout.write(key.slice(19));process.stderr.write(key);",
        'late-secret': "import fs from 'node:fs';process.stdout.write('before-load|');process.stderr.write('before-load|');const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write(key);process.stderr.write(key);",
        'late-split-secret': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;const bytes=Buffer.from(key);for(let i=0;i<bytes.length;i++){process.stdout.write(bytes.subarray(i,i+1));process.stderr.write(bytes.subarray(i,i+1));}",
        'late-secret-error': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write(key);process.stderr.write(key);throw Object.assign(Error('late adopted value: '+key),{code:key});",
        'secret-rotation': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write(key);const next=key+'-next';process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=next;for(let i=0;i<next.length;i++)process.stdout.write(next[i]);delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;process.stderr.write(key+'|'+next);",
        'late-unicode-secret': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;for(const byte of Buffer.from(key)){process.stdout.write(Buffer.from([byte]));process.stderr.write(Buffer.from([byte]));}",
        'late-spaced-secret': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET='  '+key+'  ';process.stdout.write(key);process.stderr.write(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET);",
        'late-partial-error': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write(key.slice(0,19));throw Object.assign(Error('partial output failure: '+key),{code:key});",
        'argv-drift': "throw Error('changed argv must never execute');",
        'tracking-entry-budget': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');for(let i=0;i<17;i++){const next=key+'-'+i;process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=next;process.stdout.write(next);}process.stdout.write('RUNNER_MUST_NOT_RESUME');",
        'tracking-byte-budget': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write(key);process.stdout.write('RUNNER_MUST_NOT_RESUME');",
        'late-bounded-logs': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.stdout.write((key+'|').repeat(10000));process.stderr.write((key+'|').repeat(10000));",
        'late-error-recovery-handler': "import fs from 'node:fs';const key=fs.readFileSync('fixtures/private-operator-value.txt','utf8');process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=key;process.on('uncaughtException',()=>process.stdout.write('RUNNER_MUST_NOT_RESUME'));throw Object.assign(Error('recovery forbidden: '+key),{code:key});",
      };
      const fixtureValue=mode==='tracking-byte-budget'?'虚构部署文本'.repeat(4000):mode==='late-unicode-secret'?'虚构部署文本'.repeat(4):'fictitious-component-operator-value-000000000000000000';
      write(root,'fixtures/private-operator-value.txt',fixtureValue);
      write(root, runnerPath, sources[mode]);
      const launchIdentity = 'foreground-observation-' + mode;
      const launchRoot = path.join(root, '.runtime/ai-painter/autonomous-background-launches', launchIdentity);
      fs.mkdirSync(launchRoot, {recursive: true});
      const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const attempt = prepareExactlyOnceBackgroundSpawn({projectRoot: root, attemptPath: path.join(launchRoot, 'spawn-attempt.json'), launchIdentity, runnerPath,
        runnerSha256: digest(path.join(root, runnerPath)), runnerArgs: [], recordedAtUtc});
      const prepared = prepareBoundedBackgroundObservation({root, launchRoot, absoluteRunner: path.join(root, runnerPath), attempt});
      assert.equal(prepared.observation.cleanupAuthority, false);
      validateBoundedBackgroundObservation({root,attempt,observation:prepared.observation});
      assert.throws(()=>validateBoundedBackgroundObservation({root,attempt,observation:{...prepared.observation,physicalCommandIdentitySha256:'a'.repeat(64)}}),/physical command/u);
      assert.throws(() => prepareBoundedBackgroundObservation({root, launchRoot, absoluteRunner: path.join(root, runnerPath), attempt}), /EEXIST/u);
      if (mode === 'source-drift') fs.appendFileSync(path.join(root, runnerPath), '\n// deliberate component drift');
      const environment={...process.env,UV_THREADPOOL_SIZE:'1'};delete environment.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
      if(mode==='split-secret')environment.AI_PET_WORLD_OPERATOR_SESSION_SECRET=fixtureValue;
      const child = spawnSync(process.execPath, ['--import', pathToFileURL(prepared.bootstrapPath).href, ...exactSpawnNodeArguments(attempt, path.join(root, runnerPath)),...(mode==='argv-drift'?['--unexpected-fixture-argument']:[])],
        {cwd: root, windowsHide: true, encoding: 'utf8', timeout: 15000, env:environment, maxBuffer: 65536});
      assert.equal(child.error, undefined, String(child.error));
      const rawTerminal=fs.readFileSync(path.join(launchRoot,'background-process-terminal.json'),'utf8');
      for(const text of [child.stdout??'',child.stderr??'',rawTerminal,...['stdout','stderr'].map(channel=>fs.readFileSync(path.join(launchRoot,channel+'.log'),'utf8'))]){
        assert.ok(!text.includes(fixtureValue),'fictitious operator value leaked in observation');
        if(mode==='late-partial-error')assert.ok(!text.includes(fixtureValue.slice(0,19)),'partial fictitious value leaked in observation');
        if(mode.startsWith('tracking-')||mode==='late-error-recovery-handler')assert.ok(!text.includes('RUNNER_MUST_NOT_RESUME'),'failed log capture resumed runner');
      }
      const terminal = JSON.parse(fs.readFileSync(path.join(launchRoot, 'background-process-terminal.json'), 'utf8'));
      assert.equal(terminal.nonce, attempt.nonce); assert.equal(terminal.runnerSha256, attempt.runnerSha256);
      assert.equal(terminal.commandIdentitySha256, attempt.commandIdentitySha256); assert.equal(terminal.lifecycleCompletionProved, false);
      assert.equal(terminal.cleanupConfirmed, false); assert.equal(terminal.checkpointSaved, false);
      for (const channel of ['stdout', 'stderr']) assert.ok(fs.statSync(path.join(launchRoot, channel + '.log')).size <= BACKGROUND_LOG_LIMITS[channel + 'Bytes']);
      assert.ok(terminal.writtenBytes.stdout + terminal.writtenBytes.stderr <= BACKGROUND_LOG_LIMITS.totalBytes);
      if (['normal','bounded-logs','split-secret','late-secret','late-split-secret','secret-rotation','late-unicode-secret','late-spaced-secret','late-bounded-logs'].includes(mode)) {
        assert.equal(child.status, 0); assert.equal(terminal.preloadReady, true); assert.equal(terminal.error, null);
        assert.match(terminal.processStartIdentity, new RegExp('^' + terminal.processId + ':'));
        assert.equal(terminal.logsTruncated, mode === 'bounded-logs');
        if(mode==='split-secret')for(const channel of ['stdout','stderr'])assert.equal(fs.readFileSync(path.join(launchRoot,channel+'.log'),'utf8'),'[redacted]');
        if(['late-split-secret','late-unicode-secret','late-spaced-secret'].includes(mode))for(const channel of ['stdout','stderr'])assert.ok(fs.readFileSync(path.join(launchRoot,channel+'.log'),'utf8')==='[redacted]','redacted component output mismatch');
        if(mode==='late-secret')for(const channel of ['stdout','stderr'])assert.ok(fs.readFileSync(path.join(launchRoot,channel+'.log'),'utf8')==='before-load|[redacted]','before/after adoption output mismatch');
        if(mode==='secret-rotation'){assert.ok(fs.readFileSync(path.join(launchRoot,'stdout.log'),'utf8')==='[redacted][redacted]','overlapping rotated value mismatch');assert.ok(fs.readFileSync(path.join(launchRoot,'stderr.log'),'utf8')==='[redacted]|[redacted]','previous value lost after deletion');}
        if(mode==='late-bounded-logs'){assert.ok(terminal.attemptedBytes.stdout>BACKGROUND_LOG_LIMITS.stdoutBytes);assert.ok(terminal.attemptedBytes.stderr>BACKGROUND_LOG_LIMITS.stderrBytes);}
      } else {
        assert.notEqual(child.status, 0); assert.equal(terminal.status, 'background_runner_failed_closed');
        const expected=mode.startsWith('tracking-')?/log redaction limit/:mode==='early-failure'?/private bootstrap fixture failure/:mode==='source-drift'?/runner SHA changed/:mode==='argv-drift'?/argv or working directory/:/\[redacted\]/;
        assert.match(terminal.error.message,expected);
        assert.equal(terminal.preloadReady,['early-failure','late-secret-error','late-partial-error','tracking-entry-budget','tracking-byte-budget','late-error-recovery-handler'].includes(mode));
        if(!mode.startsWith('tracking-'))assert.match(fs.readFileSync(path.join(launchRoot,'stderr.log'),'utf8'),expected);
        if(['late-secret-error','late-partial-error','late-error-recovery-handler'].includes(mode)){assert.equal(child.status,1);assert.equal(terminal.error.code,'[redacted]');assert.equal(child.stderr,'','native fatal printer must not bypass redaction');}
        if(mode.startsWith('tracking-')){assert.equal(child.status,1);assert.equal(terminal.error.code,'LOG_REDACTION_LIMIT');assert.equal(child.stderr,'','budget error bypassed bounded capture');}
      }
      write(root, 'component-result.json', JSON.stringify({mode, status: 'passed', foregroundChildExit: child.status, injectedLauncher: false, nativeJobStarted: false, terminal, observation: prepared.observation}, null, 2));
    });
  }

  process.stdout.write(`${JSON.stringify({
    status: "passed",
    testCount: results.length,
    results,
    foregroundObservationProcesses: observationModes.length,
    backgroundProcessSpawnedByTest: false,
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
  if (retainedComponentRoot) {
    const root = path.join(retainedComponentRoot, suffix); fs.mkdirSync(root); return root;
  }
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
