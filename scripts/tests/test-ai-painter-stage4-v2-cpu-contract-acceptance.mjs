import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CpuAcceptanceError,
  executeStage4V2CpuContractAcceptanceChecks,
  resolveStage4V2CpuAcceptanceAuthorization,
} from "../run-ai-painter-stage4-v2-cpu-contract-acceptance.mjs";

// Isolated CPU fixtures only: never invoke the production acceptance workflow,
// load model weights, or publish qualification/registry records.
const architecture = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const contractPath = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
const safety = {
  gpuAllowed: false, optimizerAllowed: false, backwardAllowed: false,
  checkpointWeightsReadAllowed: false, weightMutationAllowed: false,
  trainingAllowed: false, checkpointFileHashVerificationAllowed: true,
};

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "cpu-acceptance-unit-"));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith("cpu-acceptance-unit-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const write = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const bytes = Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
    fs.writeFileSync(file, bytes);
    return { path: relative, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  };
  const checker = "scripts/check-fixture-core.mjs";
  write(checker, `import assert from 'node:assert/strict';
    assert.equal(process.env.CUDA_VISIBLE_DEVICES, '-1');
    assert.equal(process.env.NVIDIA_VISIBLE_DEVICES, 'none');
    assert.equal(process.env.AI_PAINTER_CPU_ONLY, '1');
    assert.equal(process.env.AI_PAINTER_ALLOW_GPU, '0');
    console.log('isolated CPU fixture checked');`);
  const prerequisite = write("data/prerequisite.json", { fixtureOnly: true });
  const contract = {
    schemaVersion: "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2",
    architectureId: architecture, status: "cpu_supported_inactive",
    activationGates: { training: false, runtime: false },
    prerequisiteBindings: [{ id: "fixture_prerequisite", required: true,
      executionClass: "cpu_readonly", ...prerequisite,
      checkerCommand: { command: "node", args: [checker] }, safety: { ...safety } }],
  };
  const binding = write(contractPath, contract);
  const classification = write("data/classification.json", { successorContract: binding });
  const terminal = write("data/terminal.json", {
    schemaVersion: "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1",
    successorCapabilityVersion: architecture, capabilityChangeClassification: classification,
  });
  const current = { ok: true, registry: {
    capabilityVersion: architecture,
    taskId: "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract",
    nextMachineAction: "run:ai-painter-stage4-v2-cpu-contract-acceptance",
    taskKind: "cpu_contract_verification", lifecycleStage: "change_candidate",
    executionState: "package_materialized", activeExecution: null, terminalEvidence: terminal,
  }, taskCapsule: { evidence: [terminal, binding] } };
  const outputDirectory = path.join(root, "check-output");
  fs.mkdirSync(outputDirectory);
  const state = { contract: {}, programLineage: {}, checks: [] };
  return { root, write, checker, prerequisite, contract, binding, current, state, outputDirectory,
    authorize: (options = {}) => resolveStage4V2CpuAcceptanceAuthorization(root, options, async () => current),
    check: (expectedContractSha256 = binding.sha256) => executeStage4V2CpuContractAcceptanceChecks({
      root, contractPath, coreCheckerPath: checker, expectedContractSha256,
      outputDirectory, timeoutMs: 5000, state,
    }),
  };
}

const errorCode = code => error => error instanceof CpuAcceptanceError && error.code === code;

test("accepts an inactive registered CPU task with matching on-disk evidence", async t => {
  const f = fixture(t);
  const result = await f.authorize();
  assert.deepEqual(result.successorContract, f.binding);
  assert.deepEqual(result.sourceAdjudication.terminal, f.current.registry.terminalEvidence);
  assert.deepEqual(fs.readdirSync(f.outputDirectory), []);
});

for (const [label, mutate, code] of [
  ["unverified registry", f => { f.current.ok = false; }, "current_registry_not_verified"],
  ["wrong capability", f => { f.current.registry.capabilityVersion = "other"; }, "current_registry_capability_mismatch"],
  ["wrong task", f => { f.current.registry.taskId = "other"; }, "current_registry_task_not_cpu_contract_acceptance"],
  ["wrong lifecycle", f => { f.current.registry.lifecycleStage = "cpu_contract_verified"; }, "current_registry_lifecycle_mismatch"],
  ["active execution", f => { f.current.registry.activeExecution = { runId: "busy" }; }, "current_registry_not_inactive_ready_state"],
  ["missing capsule binding", f => { f.current.taskCapsule.evidence = []; }, "current_task_capsule_source_binding_missing"],
  ["changed adjudication", f => { fs.appendFileSync(path.join(f.root, "data/terminal.json"), " "); }, "source_adjudication_terminal_sha256_mismatch"],
  ["changed contract", f => { fs.appendFileSync(path.join(f.root, contractPath), " "); }, "source_adjudication_successor_contract_sha256_mismatch"],
]) test(`rejects ${label} before any checker runs`, async t => {
  const f = fixture(t);
  mutate(f);
  await assert.rejects(f.authorize(), errorCode(code));
  assert.deepEqual(fs.readdirSync(f.outputDirectory), []);
});

test("rejects caller replacement of the registered contract path or SHA", async t => {
  const f = fixture(t);
  await assert.rejects(f.authorize({ contractPath: "data/other.json" }), errorCode("manual_contract_path_not_authorized"));
  await assert.rejects(f.authorize({ expectedContractSha256: "0".repeat(64) }), errorCode("manual_contract_sha256_not_authorized"));
});

test("runs both real Node checkers in CPU-only environment and binds their output", t => {
  const f = fixture(t);
  f.check();
  assert.equal(f.state.architectureId, architecture);
  assert.equal(f.state.checks.length, 2);
  for (const result of f.state.checks) {
    assert.equal(result.passed, true);
    assert.equal(result.exitCode, 0);
    const bytes = fs.readFileSync(path.join(f.root, result.stdout.path));
    assert.match(bytes.toString(), /isolated CPU fixture checked/);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), result.stdout.sha256);
  }
});

for (const [label, mutate, code] of [
  ["active parent", c => { c.activationGates.training = true; }, "parent_activation_gate_not_false"],
  ["empty prerequisite set", c => { c.prerequisiteBindings = []; }, "prerequisite_bindings_empty"],
  ["GPU permission", c => { c.prerequisiteBindings[0].safety.gpuAllowed = true; }, "fixture_prerequisite_gpuAllowed_must_be_false"],
  ["training permission", c => { c.prerequisiteBindings[0].safety.trainingAllowed = true; }, "fixture_prerequisite_trainingAllowed_must_be_false"],
  ["changed prerequisite hash", c => { c.prerequisiteBindings[0].sha256 = "0".repeat(64); }, "fixture_prerequisite_contract_sha256_mismatch"],
  ["shell command", c => { c.prerequisiteBindings[0].checkerCommand = "node scripts/check-fixture-core.mjs"; }, "fixture_prerequisite_checker_command_must_be_structured"],
]) test(`rejects ${label} instead of declaring CPU acceptance`, t => {
  const f = fixture(t);
  mutate(f.contract);
  const binding = f.write(contractPath, f.contract);
  assert.throws(() => f.check(binding.sha256), errorCode(code));
  assert.ok(f.state.checks.length <= 1);
});

test("rejects an unexpected parent digest before running a checker", t => {
  const f = fixture(t);
  assert.throws(() => f.check("0".repeat(64)), errorCode("parent_contract_sha256_mismatch"));
  assert.equal(f.state.checks.length, 0);
});

test("records a failed checker and stops before the prerequisite", t => {
  const f = fixture(t);
  f.write(f.checker, "console.error('fixture failure'); process.exitCode = 7;");
  assert.throws(() => f.check(), errorCode("stage4_v2_parent_contract_core_checker_failed"));
  assert.equal(f.state.checks.length, 1);
  assert.equal(f.state.checks[0].passed, false);
  assert.equal(f.state.checks[0].exitCode, 7);
  assert.match(fs.readFileSync(path.join(f.root, f.state.checks[0].stderr.path), "utf8"), /fixture failure/);
});

test("detects checker input mutation even when every child exits successfully", t => {
  const f = fixture(t);
  f.write(f.checker, `import fs from 'node:fs';
    fs.appendFileSync(${JSON.stringify(contractPath)}, ' ');`);
  assert.throws(() => f.check(), errorCode("input_or_program_changed_during_acceptance"));
  assert.equal(f.state.checks.length, 2);
  assert.ok(f.state.checks.every(result => result.passed));
});
