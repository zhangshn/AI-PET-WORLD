import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REQUIRED_BINDING_ROLES,
  RUNTIME_AUTONOMY_POLICY_PATH,
  TRUSTED_RELEASE_REGISTRY_PATH,
  sha256Of,
} from "./lib/ai-painter-autonomous-package-decision-core-v3.mjs";
import { CAPABILITY_LIFECYCLE_CONTRACT_PATH, advanceCapabilityLifecycle, createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs";
import { RELEASE_LEDGER_PATH, publishMachineAdjudicatedCapability } from "./lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";

const projectRoot = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-machine-release-"));
let positive = 0;
let negative = 0;
try {
  copy(CAPABILITY_LIFECYCLE_CONTRACT_PATH);
  copy(RUNTIME_AUTONOMY_POLICY_PATH);
  copy(TRUSTED_RELEASE_REGISTRY_PATH);
  const source = write("fixtures/source.json", Buffer.from("{\"source\":true}\n"));
  const capabilityVersion = "machine-release-fixture-capability-v1";
  createCapabilityCandidate({ schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion, changeClass: "model_family", ownerAuthorizationRequired: false, ownerInLifecycle: false, sourceEvidence: [source] }, { root: fixtureRoot });
  for (const targetState of ["isolated_implementation", "cpu_contract_verified", "controlled_smoke_completed", "formal_stage_validation_completed", "independent_regression_completed", "machine_release_adjudicated"]) {
    advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion, targetState, evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState, status: "passed", bindings: [source] } });
  }
  const bindings = {};
  for (const role of REQUIRED_BINDING_ROLES) bindings[role] = { identity: `${role.toLowerCase()}-fixture-v1`, ...write(`fixtures/${role}.bin`, Buffer.from(`fixture-${role}`)) };
  const { publicKey } = generateKeyPairSync("ed25519");
  const publicKeyBinding = write("fixtures/runtime-ticket-public.pem", Buffer.from(publicKey.export({ type: "spki", format: "pem" })));
  const draft = {
    schemaVersion: "ai-painter-capability-release-draft-v1",
    capabilityReleaseIdentity: "machine-release-fixture-release-v1",
    modelCapabilityVersion: capabilityVersion,
    ownerAuthorizationRequired: false, ownerDecisionUsed: false,
    lifecycleRoot: `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`,
    bindings, releaseEvidence: [source],
    ticketIssuer: { identity: "local-ai-runtime-ticket-issuer", keyId: "local-ai-runtime-ticket-key-v1", publicKeyPath: publicKeyBinding.path, publicKeySha256: publicKeyBinding.sha256 },
    programLineage: { releaseOrchestrator: sha256Of("release-orchestrator-fixture") },
    outputRoot: ".runtime/ai-painter/capability-runtime-executions/machine-release-fixture-release-v1",
    maxInfrastructureRecoveryAttempts: 2,
  };
  const released = publishMachineAdjudicatedCapability(draft, { root: fixtureRoot, expectedRegistryRevision: 0, recordedAtUtc: "2026-08-24T02:00:00.000Z" });
  assert.equal(released.status, "released");
  assert.equal(released.lifecycleState, "released");
  assert.equal(released.ownerAuthorizationRequired, false); positive += 1;
  const registry = JSON.parse(fs.readFileSync(path.join(fixtureRoot, TRUSTED_RELEASE_REGISTRY_PATH), "utf8"));
  assert.equal(registry.status, "active_with_capability_release");
  assert.equal(registry.registryRevision, 1);
  assert.equal(registry.releaseRecords.length, 1);
  assert.equal(registry.trustBoundary.ownerDecisionAcceptedAsReleaseAuthority, false); positive += 1;
  const release = JSON.parse(fs.readFileSync(path.join(fixtureRoot, released.releasePath), "utf8"));
  assert.equal(release.createdBy, "local_ai_capability_release_orchestrator");
  assert.equal(release.ownerDecisionUsed, false); positive += 1;
  assert.throws(() => publishMachineAdjudicatedCapability(draft, { root: fixtureRoot, expectedRegistryRevision: 0 }), /revision conflict|already exists/); negative += 1;
  assert.throws(() => publishMachineAdjudicatedCapability({ ...draft, capabilityReleaseIdentity: "machine-release-owner-invalid", ownerDecisionUsed: true }, { root: fixtureRoot, expectedRegistryRevision: 1 }), /cannot use Owner authority/); negative += 1;
  const ledgerGapCapabilityVersion = "machine-release-ledger-gap-capability-v1";
  createCapabilityCandidate({ schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion: ledgerGapCapabilityVersion, changeClass: "model_family", ownerAuthorizationRequired: false, ownerInLifecycle: false, sourceEvidence: [source] }, { root: fixtureRoot });
  for (const targetState of ["isolated_implementation", "cpu_contract_verified", "controlled_smoke_completed", "formal_stage_validation_completed", "independent_regression_completed", "machine_release_adjudicated"]) {
    advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: ledgerGapCapabilityVersion, targetState, evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: ledgerGapCapabilityVersion, targetState, status: "passed", bindings: [source] } });
  }
  fs.rmSync(path.join(fixtureRoot, RELEASE_LEDGER_PATH));
  const ledgerGapDraft = structuredClone(draft);
  ledgerGapDraft.capabilityReleaseIdentity = "machine-release-ledger-gap";
  ledgerGapDraft.modelCapabilityVersion = ledgerGapCapabilityVersion;
  ledgerGapDraft.lifecycleRoot = `.runtime/ai-painter/capability-lifecycle/${ledgerGapCapabilityVersion}`;
  assert.throws(() => publishMachineAdjudicatedCapability(ledgerGapDraft, { root: fixtureRoot, expectedRegistryRevision: 1 }), /missing prior registry revisions/); negative += 1;
  const badCapabilityVersion = "machine-release-bad-binding-capability-v1";
  createCapabilityCandidate({ schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion: badCapabilityVersion, changeClass: "model_family", ownerAuthorizationRequired: false, ownerInLifecycle: false, sourceEvidence: [source] }, { root: fixtureRoot });
  for (const targetState of ["isolated_implementation", "cpu_contract_verified", "controlled_smoke_completed", "formal_stage_validation_completed", "independent_regression_completed", "machine_release_adjudicated"]) {
    advanceCapabilityLifecycle({ root: fixtureRoot, capabilityVersion: badCapabilityVersion, targetState, evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: badCapabilityVersion, targetState, status: "passed", bindings: [source] } });
  }
  const badDraft = structuredClone(draft); badDraft.capabilityReleaseIdentity = "machine-release-bad-binding"; badDraft.modelCapabilityVersion = badCapabilityVersion; badDraft.lifecycleRoot = `.runtime/ai-painter/capability-lifecycle/${badCapabilityVersion}`; badDraft.bindings.modelArtifact.sha256 = "0".repeat(64);
  assert.throws(() => publishMachineAdjudicatedCapability(badDraft, { root: fixtureRoot, expectedRegistryRevision: 1 }), /SHA-256 mismatch/); negative += 1;
  process.stdout.write(`${JSON.stringify({ status: "passed", positive, negative, machineSingleWriterVerified: true, registryCasVerified: true, trustedReleaseRevalidated: true, ownerReleaseDecisionUsed: false }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(fixtureRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function copy(relative) { write(relative, fs.readFileSync(path.join(projectRoot, relative))); }
function write(relative, bytes) { const absolute = path.join(fixtureRoot, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, bytes, { flag: "wx" }); return { path: relative.replaceAll("\\", "/"), sha256: sha256Of(bytes) }; }
