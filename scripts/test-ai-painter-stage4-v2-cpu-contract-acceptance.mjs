import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CpuAcceptanceError, executeStage4V2CpuContractAcceptanceChecks, resolveStage4V2CpuAcceptanceAuthorization, runStage4V2CpuContractAcceptance } from "./run-ai-painter-stage4-v2-cpu-contract-acceptance.mjs";

const ARCHITECTURE_ID = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const SAFETY = Object.freeze({ gpuAllowed: false, optimizerAllowed: false, backwardAllowed: false, checkpointWeightsReadAllowed: false, checkpointFileHashVerificationAllowed: true, weightMutationAllowed: false, trainingAllowed: false });

test("CPU checks accept only a SHA-bound inactive V2 contract", () => {
  withFixture(({ root, contractPath, coreCheckerPath, outputDirectory }) => {
    const state = makeState(root, contractPath);
    executeStage4V2CpuContractAcceptanceChecks({ root, contractPath, coreCheckerPath, expectedContractSha256: sha(root, contractPath), outputDirectory, timeoutMs: 10_000, state });
    assert.equal(state.architectureId, ARCHITECTURE_ID);
    assert.equal(state.checks.length, 2);
    assert.equal(state.checks.every((check) => check.passed), true);
  });
});

test("CPU checks reject a changed parent contract before any checker runs", () => {
  withFixture(({ root, contractPath, coreCheckerPath, outputDirectory }) => {
    const state = makeState(root, contractPath);
    assert.throws(() => executeStage4V2CpuContractAcceptanceChecks({ root, contractPath, coreCheckerPath, expectedContractSha256: "0".repeat(64), outputDirectory, timeoutMs: 10_000, state }), (error) => error instanceof CpuAcceptanceError && error.code === "parent_contract_sha256_mismatch");
    assert.equal(state.checks.length, 0);
  });
});

test("CPU checks reject checkpoint paths", () => {
  withFixture(({ root, contractPath, coreCheckerPath, outputDirectory }) => {
    const contract = json(root, contractPath);
    contract.prerequisiteBindings.dataset.path = "data/fake-checkpoint.pt";
    contract.prerequisiteBindings.dataset.sha256 = "0".repeat(64);
    writeJson(root, contractPath, contract);
    assert.throws(() => executeStage4V2CpuContractAcceptanceChecks({ root, contractPath, coreCheckerPath, expectedContractSha256: sha(root, contractPath), outputDirectory, timeoutMs: 10_000, state: makeState(root, contractPath) }), /dataset_checkpoint_path_forbidden/u);
  });
});

test("CPU checks permit only checkpoint metadata hashing and reject weight reads", () => {
  withFixture(({ root, contractPath, coreCheckerPath, outputDirectory }) => {
    const contract = json(root, contractPath);
    contract.prerequisiteBindings.dataset.safety.checkpointWeightsReadAllowed = true;
    writeJson(root, contractPath, contract);
    assert.throws(() => executeStage4V2CpuContractAcceptanceChecks({ root, contractPath, coreCheckerPath, expectedContractSha256: sha(root, contractPath), outputDirectory, timeoutMs: 10_000, state: makeState(root, contractPath) }), /dataset_checkpointWeightsReadAllowed_must_be_false/u);
    contract.prerequisiteBindings.dataset.safety.checkpointWeightsReadAllowed = false;
    contract.prerequisiteBindings.dataset.safety.checkpointFileHashVerificationAllowed = false;
    writeJson(root, contractPath, contract);
    const secondOutputDirectory = path.join(outputDirectory, "second");
    fs.mkdirSync(secondOutputDirectory, { recursive: true });
    assert.throws(() => executeStage4V2CpuContractAcceptanceChecks({ root, contractPath, coreCheckerPath, expectedContractSha256: sha(root, contractPath), outputDirectory: secondOutputDirectory, timeoutMs: 10_000, state: makeState(root, contractPath) }), /dataset_checkpointFileHashVerificationAllowed_must_be_true/u);
  });
});

test("runner rejects direct manual invocation without a verified current registry", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-cpu-unbound-"));
  try {
    await assert.rejects(runStage4V2CpuContractAcceptance({ root, runId: "stage4-v2-cpu-acceptance-unbound" }), /current_registry_not_verified/u);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("authorization is derived from the adjudication terminal and rejects a replaced successor contract", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-cpu-bound-"));
  try {
    const contractPath = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
    const classificationPath = ".runtime/adjudication/classification.json";
    const terminalPath = ".runtime/adjudication/phase-terminal.json";
    writeJson(root, contractPath, { schemaVersion: "fixture-successor-contract" });
    const contractBinding = binding(root, contractPath);
    writeJson(root, classificationPath, { successorContract: contractBinding });
    const classificationBinding = binding(root, classificationPath);
    writeJson(root, terminalPath, { schemaVersion: "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1", successorCapabilityVersion: ARCHITECTURE_ID, capabilityChangeClassification: classificationBinding });
    const terminalBinding = binding(root, terminalPath);
    const current = { ok: true, registrySha256: "a".repeat(64), registry: { capabilityVersion: ARCHITECTURE_ID, taskId: "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract", nextMachineAction: "run:ai-painter-stage4-v2-cpu-contract-acceptance", taskKind: "cpu_contract_verification", lifecycleStage: "change_candidate", executionState: "package_materialized", activeExecution: null, terminalEvidence: terminalBinding }, taskCapsule: { evidence: [{ ...terminalBinding, sha256Verified: true }, { ...contractBinding, sha256Verified: true }] } };
    const resolved = await resolveStage4V2CpuAcceptanceAuthorization(root, {}, async () => current);
    assert.deepEqual(resolved.successorContract, contractBinding);
    writeJson(root, contractPath, { schemaVersion: "replaced" });
    await assert.rejects(resolveStage4V2CpuAcceptanceAuthorization(root, {}, async () => current), /source_adjudication_successor_contract_sha256_mismatch/u);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-cpu-acceptance-"));
  try {
    const contractPath = "data/stage4-v2-contract.json";
    const prerequisitePath = "data/dataset-release.json";
    const coreCheckerPath = "scripts/check-stage4-v2-core.mjs";
    const prerequisiteCheckerPath = "scripts/check-stage4-v2-dataset.mjs";
    const outputDirectory = path.join(root, ".runtime", "cpu-check");
    fs.mkdirSync(outputDirectory, { recursive: true });
    writeText(root, coreCheckerPath, "process.stdout.write('core passed\\n');\n");
    writeText(root, prerequisiteCheckerPath, "process.stdout.write('dataset passed\\n');\n");
    writeJson(root, prerequisitePath, { schemaVersion: "fixture-dataset-release-v1", status: "released" });
    writeJson(root, contractPath, {
      schemaVersion: "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2", architectureId: ARCHITECTURE_ID, status: "cpu_supported_inactive",
      activationGates: { configurationActiveNow: false, gpuNow: false, optimizerNow: false, backwardNow: false, weightModificationNow: false, trainingNow: false, formalInferenceNow: false, runtimeFrameNow: false, worldEntryNow: false },
      prerequisiteBindings: { dataset: { id: "dataset", required: true, executionClass: "cpu_readonly", path: prerequisitePath, sha256: sha(root, prerequisitePath), checkerCommand: { command: "node", args: [prerequisiteCheckerPath] }, safety: SAFETY } },
    });
    callback({ root, contractPath, coreCheckerPath, outputDirectory });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function makeState(root, contractPath) { return { contract: { path: contractPath, expectedSha256: sha(root, contractPath), actualSha256: null }, programLineage: {}, prerequisiteBindings: [], checks: [] }; }
function writeJson(root, relative, value) { writeText(root, relative, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(root, relative, value) { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value, "utf8"); }
function json(root, relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
function sha(root, relative) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex"); }
function binding(root, relative) { const target = path.join(root, relative); return { path: relative, sha256: crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") }; }
