import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";

const root = process.cwd();
const staticOnly = process.argv.slice(2).includes("--static-only");
const registryPath = "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json";
const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const retiredBinding = registry.retiredEntrypointIndex;
assert.equal(typeof retiredBinding?.path, "string", "retired entrypoint index path is missing");
assert.match(retiredBinding.sha256 ?? "", /^[a-f0-9]{64}$/u, "retired entrypoint index SHA-256 is invalid");
const retiredIndexAbsolute = path.resolve(root, retiredBinding.path);
assert.ok(retiredIndexAbsolute.startsWith(`${path.resolve(root)}${path.sep}`));
assert.ok(fs.existsSync(retiredIndexAbsolute), `retired entrypoint index is missing: ${retiredBinding.path}`);
assert.equal(sha256File(retiredIndexAbsolute), retiredBinding.sha256, "retired entrypoint index SHA-256 mismatch");
const retiredIndex = JSON.parse(fs.readFileSync(retiredIndexAbsolute, "utf8"));

assert.equal(registry.schemaVersion, "ai-painter-current-entrypoint-registry-v1");
assert.equal(registry.status, "active");
assert.equal(registry.normalAuthority, "local_ai_pet_world_program");
assert.equal(registry.ownerInNormalStateMachine, false);
assert.equal(registry.historicalIsolation.autonomousResolverMayInvokeUnregisteredEntrypoint, false);
assert.equal(registry.historicalIsolation.autonomousResolverMayInvokeRetiredEntrypoint, false);
assert.equal(retiredBinding.schemaVersion, retiredIndex.schemaVersion);
assert.equal(retiredBinding.dispatchable, false);
assert.equal(retiredIndex.status, "active_read_only_audit_index");
assert.equal(retiredIndex.dispatchable, false);
assert.equal(retiredIndex.resolverMaySchedule, false);

const seen = new Set();
const seenFiles = new Set();
const results = [];
const enforcementFiles = new Set(registry.tokenEnforcementFiles ?? []);
for (const entry of registry.currentEntrypoints) {
  assert.ok(!seen.has(entry.packageScript), `duplicate current package script: ${entry.packageScript}`);
  seen.add(entry.packageScript);
  assert.ok(!seenFiles.has(entry.entryFile), `duplicate current entry file: ${entry.entryFile}`);
  seenFiles.add(entry.entryFile);
  const command = packageJson.scripts?.[entry.packageScript];
  assert.equal(command, `node ${entry.entryFile}`, `current package entry mismatch: ${entry.packageScript}`);
  const absolute = path.resolve(root, entry.entryFile);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  assert.ok(fs.existsSync(absolute), `current entry file missing: ${entry.entryFile}`);
  const graph = collectImportGraph(absolute);
  for (const file of graph) {
    const source = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(root, file).replaceAll("\\", "/");
    if (enforcementFiles.has(relativeFile) || entry.role.endsWith("_regression")) continue;
    for (const token of registry.forbiddenCurrentSourceTokens) {
      assert.ok(!source.includes(token), `current entry graph contains forbidden token ${token}: ${path.relative(root, file)}`);
    }
  }
  results.push({ packageScript: entry.packageScript, entryFile: entry.entryFile, entrySha256: sha256File(absolute), graphFileCount: graph.size });
}
assert.ok(
  seen.has("launch:ai-painter-stage4-v2-readonly-gpu-qualification-background"),
  "Stage4 V2 readonly-GPU qualification must resolve through the detached background launcher",
);
assert.equal(
  seen.has("run:ai-painter-stage4-v2-readonly-gpu-qualification"),
  false,
  "Stage4 V2 readonly-GPU child runner must not be a directly schedulable current entrypoint",
);
assert.equal(
  packageJson.scripts?.["run:ai-painter-stage4-v2-readonly-gpu-qualification"],
  "node scripts/run-ai-painter-stage4-v2-readonly-gpu-qualification.mjs",
  "Stage4 V2 readonly-GPU internal child runner package command is missing",
);
assert.ok(
  seen.has("launch:ai-painter-stage4-v2-controlled-smoke-background"),
  "Stage4 V2 controlled Smoke must resolve through the detached supervised background launcher",
);
assert.equal(
  seen.has("run:ai-painter-stage4-v2-controlled-smoke"),
  false,
  "Stage4 V2 controlled Smoke child runner must not be a directly schedulable current entrypoint",
);
assert.equal(
  packageJson.scripts?.["run:ai-painter-stage4-v2-controlled-smoke"],
  "node scripts/run-ai-painter-stage4-v2-controlled-smoke.mjs",
  "Stage4 V2 controlled Smoke internal child runner package command is missing",
);
for (const action of [
  "plan:ai-painter-stage4-v2-controlled-smoke",
  "adjudicate:ai-painter-stage4-v2-controlled-smoke-failure-boundary",
  "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
]) assert.ok(seen.has(action), `Stage4 V2 autonomous successor is not registered: ${action}`);

const retiredSeen = new Set();
const retiredFiles = new Set();
for (const entry of retiredIndex.retiredEntrypoints ?? []) {
  assert.ok(!retiredSeen.has(entry.packageScript), `duplicate retired package script: ${entry.packageScript}`);
  retiredSeen.add(entry.packageScript);
  assert.ok(!retiredFiles.has(entry.entryFile), `duplicate retired entry file: ${entry.entryFile}`);
  retiredFiles.add(entry.entryFile);
  assert.equal(seen.has(entry.packageScript), false, `retired package script remains schedulable: ${entry.packageScript}`);
  assert.equal(seenFiles.has(entry.entryFile), false, `retired entry file remains schedulable: ${entry.entryFile}`);
  assert.equal(entry.retirementDisposition, "read_only_audit_not_dispatchable");
  const command = packageJson.scripts?.[entry.packageScript];
  assert.equal(command, `node ${entry.entryFile}`, `retired package entry mismatch: ${entry.packageScript}`);
  const absolute = path.resolve(root, entry.entryFile);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  assert.ok(fs.existsSync(absolute), `retired entry file missing: ${entry.entryFile}`);
  assert.match(entry.sourceSha256 ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(sha256File(absolute), entry.sourceSha256, `retired source SHA-256 mismatch: ${entry.entryFile}`);
}
assert.ok(retiredSeen.size > 0, "retired entrypoint index must not be empty");

// A live workspace verifies the transaction-bound current registry. A clean
// checkout has no .runtime by design, so the core gate validates the complete
// static successor closure here and pairs it with the isolated atomic-registry
// regression in check-ai-painter-stage4-core.mjs. Historical directories are
// never scanned in either mode.
let currentExecutionSuccessorClosure;
if (staticOnly) {
  const declaredSuccessors = [
    "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
    "launch:ai-painter-stage4-v2-readonly-gpu-qualification-background",
    "adjudicate:ai-painter-stage4-v2-readonly-gpu-qualification-failure",
    "plan:ai-painter-stage4-v2-controlled-smoke",
    "launch:ai-painter-stage4-v2-controlled-smoke-background",
    "adjudicate:ai-painter-stage4-v2-controlled-smoke-failure-boundary",
    "plan:ai-painter-stage4-v2-formal-stage0-to-stage2",
  ];
  for (const action of declaredSuccessors) {
    assertRegisteredCurrentAction(action, "static V2 successor closure");
  }
  assert.equal(
    registry.transitionalHandoff?.currentSchedulerEntrypoint,
    "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
    "static V2 scheduler entrypoint differs",
  );
  currentExecutionSuccessorClosure = {
    mode: "static_contract_plus_isolated_atomic_registry_fixture",
    declaredActions: declaredSuccessors,
    historicalDirectoryScanUsed: false,
  };
} else {
  const currentExecution = await readCurrentExecutionRegistry(root);
  assert.equal(currentExecution.ok, true,
    currentExecution.errorCode ?? "current execution registry is not verified");
  assertRegisteredCurrentAction(
    currentExecution.registry.nextMachineAction,
    "current execution registry nextMachineAction",
  );
  const currentTerminal = currentExecution.currentTaskTerminal;
  assert.equal(
    currentTerminal.status,
    currentExecution.registry.terminalEvidence.status,
    "current V2 terminal status does not match the current registry binding",
  );
  for (const [field, action] of collectDeclaredSuccessorActions(currentTerminal)) {
    assertRegisteredCurrentAction(action, `current V2 terminal ${field}`);
  }
  currentExecutionSuccessorClosure = {
    mode: "live_transaction_verified_registry",
    taskId: currentExecution.registry.taskId,
    nextMachineAction: currentExecution.registry.nextMachineAction,
    terminalStatus: currentTerminal.status,
    terminalDeclaredActions: collectDeclaredSuccessorActions(currentTerminal)
      .map(([field, action]) => ({ field, action })),
    historicalDirectoryScanUsed: false,
  };
}

for (const relativeFile of enforcementFiles) {
  const source = fs.readFileSync(path.join(root, relativeFile), "utf8");
  assert.ok(/owner/i.test(source) && /(forbid|must not|=== false|!== true|reject)/i.test(source), `security enforcement file lacks Owner exclusion checks: ${relativeFile}`);
}

for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (name.startsWith("legacy:")) continue;
  if (/owner-(action|decision|authorization)|owner:(action|decision|authorization)|authorize:ai-painter/i.test(name)) {
    assert.fail(`historical Owner command is exposed without legacy namespace: ${name} -> ${command}`);
  }
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  currentEntrypointCount: results.length,
  retiredEntrypointCount: retiredSeen.size,
  retiredEntrypointIndex: {
    path: retiredBinding.path,
    sha256: retiredBinding.sha256,
    dispatchable: false,
  },
  currentAndRetiredEntrypointsDisjoint: true,
  ownerRuntimeEntrypointCount: 0,
  currentExecutionSuccessorClosure,
  results,
}, null, 2)}\n`);

function assertRegisteredCurrentAction(action, label) {
  if (action === null || action === undefined) return;
  assert.equal(typeof action, "string", `${label} must be a string or null`);
  assert.ok(seen.has(action), `${label} does not resolve to a current registered entrypoint: ${action}`);
  assert.equal(retiredSeen.has(action), false, `${label} resolves to a retired entrypoint: ${action}`);
}

function collectDeclaredSuccessorActions(terminal) {
  if (terminal?.capabilityVersion !== "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2") return [];
  const candidates = [
    ["nextMachineAction", terminal.nextMachineAction],
    ["controlledSmokeRegistration.nextMachineAction", terminal.controlledSmokeRegistration?.nextMachineAction],
  ];
  const unique = new Set();
  return candidates.filter(([, action]) => {
    if (action === null || action === undefined || unique.has(action)) return false;
    unique.add(action);
    return true;
  });
}

function collectImportGraph(start) {
  const visited = new Set();
  const visit = (file) => {
    const resolved = path.resolve(file);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const source = fs.readFileSync(resolved, "utf8");
    const importPattern = /(?:from\s+|import\s*\()?["'](\.\.?\/[^"']+)["']/g;
    for (const match of source.matchAll(importPattern)) {
      let target = path.resolve(path.dirname(resolved), match[1]);
      if (!path.extname(target)) target += ".mjs";
      if (fs.existsSync(target) && target.startsWith(`${path.resolve(root)}${path.sep}`)) visit(target);
    }
  };
  visit(start);
  return visited;
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
