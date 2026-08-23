import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CAPABILITY_RELEASE_SCHEMA,
  OWNER_RELEASE_DECISION_SCHEMA,
  REQUIRED_BINDING_ROLES,
  RUNTIME_AUTONOMY_POLICY_PATH,
  RUNTIME_AUTONOMY_CONTRACT_ID,
  TRUSTED_RELEASE_REGISTRY_PATH,
  TRUSTED_RELEASE_REGISTRY_SCHEMA,
  adjudicateBoundedDecision,
  applyRuntimeStateTransition,
  classifyActionAuthority,
  deriveRuntimeCapabilityTicket,
  loadAndValidateReleasedCapabilityBinding,
  sha256Of,
  validateReleasedCapabilityBinding,
  validateRuntimeAutonomyPolicy,
  validateRuntimeCapabilityTicketIntegrity,
} from "./lib/ai-painter-autonomous-package-decision-core.mjs";

const ROOT = process.cwd();
const policySource = JSON.parse(fs.readFileSync(path.join(ROOT, "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json"), "utf8"));
let positive = 0;
let negative = 0;
const temporaryRoots = [];

try {
  pass(() => validateRuntimeAutonomyPolicy(policySource));
  pass(() => assert.equal(policySource.status, "policy_active_no_capability_release"));
  pass(() => assert.equal(classifyActionAuthority("formal_inference.start"), "released_capability_internal_action"));
  pass(() => assert.equal(classifyActionAuthority("runtime_frame.create"), "released_capability_internal_action"));
  pass(() => assert.equal(classifyActionAuthority("world.enter"), "released_capability_internal_action"));
  pass(() => assert.equal(classifyActionAuthority("model.change"), "capability_change_required"));
  pass(() => assert.equal(classifyActionAuthority("formal_inference.start", { dataChanged: true }), "capability_change_required"));
  pass(() => assert.equal(classifyActionAuthority("unknown.action"), "denied_unknown_action"));

  const fixture = createReleaseFixture();
  const verified = loadAndValidateReleasedCapabilityBinding(fixture.options);
  pass(() => assert.equal(verified.verificationStatus, "verified_from_immutable_release_and_trusted_registry"));
  pass(() => assert.equal(verified.release.capabilityReleaseIdentity, fixture.releaseIdentity));
  pass(() => assert.deepEqual(Object.keys(verified.verifiedBindings).sort(), [...REQUIRED_BINDING_ROLES].sort()));
  pass(() => assert.equal(validateReleasedCapabilityBinding(fixture.options).capabilityReleaseSha256, verified.capabilityReleaseSha256));

  const ticket = deriveRuntimeCapabilityTicket({
    ...fixture.options,
    action: "formal_inference.start",
    currentState: "preflight",
    targetState: "generating",
    inputEvidence: [{ path: fixture.bindingPaths.datasetRelease, sha256: fixture.bindingHashes.datasetRelease }],
    programLineage: fixture.programLineage,
    outputNamespace: `${fixture.outputRoot}/execution-001`,
    issuedAt: "2026-08-24T07:10:00+08:00",
  });
  pass(() => validateRuntimeCapabilityTicketIntegrity(ticket));
  pass(() => assert.equal(ticket.capabilityReleaseSha256, verified.capabilityReleaseSha256));
  pass(() => assert.equal(ticket.trustedReleaseRegistrySha256, verified.trustedReleaseRegistrySha256));

  const executionState = {
    capabilityReleaseIdentity: fixture.releaseIdentity,
    currentState: "preflight",
    consumedTicketIds: new Set(),
  };
  const consumption = applyRuntimeStateTransition(ticket, executionState, { projectRoot: fixture.projectRoot });
  pass(() => assert.equal(consumption.status, "consumed_once"));
  pass(() => assert.equal(executionState.currentState, "generating"));
  reject(() => applyRuntimeStateTransition(ticket, executionState, { projectRoot: fixture.projectRoot }), "ticket replay must be rejected");
  reject(() => applyRuntimeStateTransition({ ...ticket, targetState: "reviewing" }, freshState(fixture), { projectRoot: fixture.projectRoot }), "mutated ticket body must be rejected");
  reject(() => applyRuntimeStateTransition({ ...ticket, ticketSha256: digest("forged-ticket") }, freshState(fixture), { projectRoot: fixture.projectRoot }), "forged ticket SHA must be rejected");

  reject(() => validateReleasedCapabilityBinding({
    capabilityReleaseIdentity: "self-reported-release",
    capabilityReleaseSha256: digest("release"),
    capabilityReleaseVerified: true,
  }), "caller supplied verification boolean must never establish trust");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ untrusted: true }).options), "unregistered release must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ ownerDecisionStatus: "rejected" }).options), "rejected Owner release decision must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ badBoundArtifactHash: true }).options), "bound artifact SHA mismatch must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ duplicateRegistryRecord: true }).options), "duplicate trusted release record must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding({ ...fixture.options, trustedReleaseRegistryPath: "data/ai-painter/system-governance/untrusted-registry.json" }), "alternate release registry path must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ untrustedPolicyPath: true }).options), "alternate runtime policy path must be rejected");
  reject(() => deriveRuntimeCapabilityTicket({
    ...fixture.options,
    action: "model.change",
    currentState: "preflight",
    targetState: "generating",
    inputEvidence: [{ path: fixture.bindingPaths.datasetRelease, sha256: fixture.bindingHashes.datasetRelease }],
    programLineage: fixture.programLineage,
    outputNamespace: `${fixture.outputRoot}/execution-002`,
    issuedAt: "2026-08-24T07:11:00+08:00",
  }), "capability change action must not receive a runtime ticket");

  const bounded = adjudicateBoundedDecision({
    decisionSetId: "runtime-review-v1",
    ruleVersion: "rules-v1",
    optionIds: ["publish", "fail_closed"],
    matchedOptionIds: ["publish"],
    evidenceReferences: [{ path: fixture.bindingPaths.reviewContract, sha256: fixture.bindingHashes.reviewContract }],
    evidenceComplete: true,
  });
  pass(() => assert.equal(bounded.status, "uniquely_adjudicated"));
  pass(() => assert.equal(bounded.matchedOption, "publish"));
  const ambiguous = adjudicateBoundedDecision({
    decisionSetId: "runtime-review-v1",
    ruleVersion: "rules-v1",
    optionIds: ["publish", "fail_closed"],
    matchedOptionIds: ["publish", "fail_closed"],
    evidenceReferences: [{ path: fixture.bindingPaths.reviewContract, sha256: fixture.bindingHashes.reviewContract }],
    evidenceComplete: true,
  });
  pass(() => assert.equal(ambiguous.status, "waiting_owner_decision"));

  console.log(JSON.stringify({
    ok: true,
    status: "ai_painter_capability_release_file_and_ticket_integrity_checks_passed",
    positiveChecks: positive,
    negativeChecks: negative,
    callerVerificationBooleanTrusted: false,
    immutableReleaseFileVerified: true,
    trustedRegistryVerified: true,
    ownerReleaseDecisionVerified: true,
    boundArtifactRolesVerified: REQUIRED_BINDING_ROLES,
    ticketSha256RecomputedAtConsumption: true,
  }, null, 2));
} finally {
  for (const temporaryRoot of temporaryRoots) fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function createReleaseFixture({ untrusted = false, ownerDecisionStatus = "approved", badBoundArtifactHash = false, duplicateRegistryRecord = false, untrustedPolicyPath = false } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-release-fixture-"));
  temporaryRoots.push(projectRoot);
  const releaseIdentity = `capability-release-${path.basename(projectRoot).toLowerCase()}`;
  const policyPath = untrustedPolicyPath ? "data/ai-painter/system-governance/untrusted-runtime-policy.json" : RUNTIME_AUTONOMY_POLICY_PATH;
  const trustedReleaseRegistryPath = TRUSTED_RELEASE_REGISTRY_PATH;
  const capabilityReleasePath = `data/ai-painter/capability-releases/${releaseIdentity}/release.json`;
  const ownerDecisionPath = `data/ai-painter/capability-releases/${releaseIdentity}/owner-decision.json`;
  const outputRoot = `.runtime/ai-painter/capability-runtime-executions/${releaseIdentity}`;
  const policySha256 = writeJson(projectRoot, policyPath, policySource);

  const bindingPaths = Object.fromEntries(REQUIRED_BINDING_ROLES.map((role) => [role, `data/ai-painter/capability-releases/${releaseIdentity}/bindings/${role}.bin`]));
  const bindingHashes = {};
  const bindings = {};
  for (const role of REQUIRED_BINDING_ROLES) {
    const bytes = Buffer.from(`immutable-${role}-fixture`, "utf8");
    writeBytes(projectRoot, bindingPaths[role], bytes);
    bindingHashes[role] = sha256Of(bytes);
    bindings[role] = {
      identity: `${role.toLowerCase()}-fixture-v1`,
      path: bindingPaths[role],
      sha256: badBoundArtifactHash && role === "modelArtifact" ? digest("wrong-model-artifact") : bindingHashes[role],
    };
  }
  const bindingSetSha256 = sha256Of(bindings);
  const ownerDecision = {
    schemaVersion: OWNER_RELEASE_DECISION_SCHEMA,
    decisionId: `owner-decision-${releaseIdentity}`,
    status: ownerDecisionStatus,
    capabilityReleaseIdentity: releaseIdentity,
    approvedBindingSetSha256: bindingSetSha256,
    approvedPolicyContractSha256: policySha256,
  };
  const ownerDecisionSha256 = writeJson(projectRoot, ownerDecisionPath, ownerDecision);
  const programLineage = { runtime: digest("runtime-program-lineage") };
  const release = {
    schemaVersion: CAPABILITY_RELEASE_SCHEMA,
    capabilityReleaseIdentity: releaseIdentity,
    status: "released",
    modelCapabilityVersion: "ai-painter-model-capability-fixture-v1",
    runtimeAutonomyPolicy: {
      contractId: RUNTIME_AUTONOMY_CONTRACT_ID,
      path: policyPath,
      sha256: policySha256,
      allowedInternalActions: policySource.internalActionClasses,
      maxInfrastructureRecoveryAttempts: 2,
    },
    bindings,
    ownerReleaseDecision: { path: ownerDecisionPath, sha256: ownerDecisionSha256 },
    programLineage,
    outputRoot,
  };
  const releaseSha256 = writeJson(projectRoot, capabilityReleasePath, release);
  const record = {
    capabilityReleaseIdentity: releaseIdentity,
    status: "released_trusted",
    releasePath: capabilityReleasePath,
    releaseSha256,
    policyContractSha256: policySha256,
    bindingSetSha256,
    ownerReleaseDecisionPath: ownerDecisionPath,
    ownerReleaseDecisionSha256: ownerDecisionSha256,
  };
  const releaseRecords = untrusted ? [] : duplicateRegistryRecord ? [record, { ...record }] : [record];
  writeJson(projectRoot, trustedReleaseRegistryPath, {
    schemaVersion: TRUSTED_RELEASE_REGISTRY_SCHEMA,
    contractId: TRUSTED_RELEASE_REGISTRY_SCHEMA,
    status: releaseRecords.length ? "active_with_capability_release" : "active_no_capability_release",
    releaseRoot: "data/ai-painter/capability-releases",
    trustBoundary: {
      callerSuppliedVerificationFlagsAccepted: false,
    },
    releaseRecords,
  });
  return {
    projectRoot, releaseIdentity, outputRoot, programLineage, bindingPaths, bindingHashes,
    options: { projectRoot, capabilityReleasePath, trustedReleaseRegistryPath },
  };
}

function freshState(fixture) {
  return { capabilityReleaseIdentity: fixture.releaseIdentity, currentState: "preflight", consumedTicketIds: new Set() };
}

function writeJson(projectRoot, relativePath, value) {
  return writeBytes(projectRoot, relativePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

function writeBytes(projectRoot, relativePath, bytes) {
  const absolutePath = path.join(projectRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, bytes, { flag: "wx" });
  return sha256Of(bytes);
}

function digest(value) { return sha256Of(value); }
function pass(fn) { fn(); positive += 1; }
function reject(fn, message) { assert.throws(fn, undefined, message); negative += 1; }
