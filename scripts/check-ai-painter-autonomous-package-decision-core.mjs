import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CAPABILITY_RELEASE_SCHEMA,
  MACHINE_RELEASE_ADJUDICATION_SCHEMA,
  RELEASE_ORCHESTRATOR_IDENTITY,
  REQUIRED_BINDING_ROLES,
  RUNTIME_AUTONOMY_CONTRACT_ID,
  RUNTIME_AUTONOMY_POLICY_PATH,
  TRUSTED_RELEASE_REGISTRY_PATH,
  TRUSTED_RELEASE_REGISTRY_SCHEMA,
  adjudicateBoundedDecision,
  applyRuntimeStateTransition,
  classifyActionAuthority,
  createPolicyBoundaryReport,
  deriveRuntimeCapabilityTicket,
  loadAndValidateReleasedCapabilityBinding,
  sha256Of,
  validateReleasedCapabilityBinding,
  validateRuntimeAutonomyPolicy,
  validateRuntimeCapabilityTicketIntegrity,
} from "./lib/ai-painter-autonomous-package-decision-core-v3.mjs";

const ROOT = process.cwd();
const policySource = JSON.parse(fs.readFileSync(path.join(ROOT, RUNTIME_AUTONOMY_POLICY_PATH), "utf8"));
let positive = 0;
let negative = 0;
const temporaryRoots = [];

try {
  pass(() => validateRuntimeAutonomyPolicy(policySource));
  pass(() => assert.equal(policySource.status, "policy_active_no_capability_release"));
  pass(() => assert.equal(policySource.authorityBoundary.ownerInNormalStateMachine, false));
  pass(() => assert.equal(classifyActionAuthority("formal_inference.start"), "released_capability_internal_action"));
  pass(() => assert.equal(classifyActionAuthority("training.start_or_retry"), "local_capability_lifecycle_action"));
  pass(() => assert.equal(classifyActionAuthority("model.implement_bounded_change"), "local_capability_lifecycle_action"));
  pass(() => assert.equal(classifyActionAuthority("long_term_business_goal_change"), "blocked_policy_boundary"));
  pass(() => assert.equal(classifyActionAuthority("unknown.action"), "denied_unknown_action"));

  const fixture = createReleaseFixture();
  const verified = loadAndValidateReleasedCapabilityBinding(fixture.options);
  pass(() => assert.equal(verified.verificationStatus, "verified_from_machine_adjudication_and_trusted_registry"));
  pass(() => assert.equal(verified.release.capabilityReleaseIdentity, fixture.releaseIdentity));
  pass(() => assert.deepEqual(Object.keys(verified.verifiedBindings).sort(), [...REQUIRED_BINDING_ROLES].sort()));
  pass(() => assert.equal(validateReleasedCapabilityBinding(fixture.options).capabilityReleaseSha256, verified.capabilityReleaseSha256));

  const ticket = deriveRuntimeCapabilityTicket({
    ...fixture.options,
    action: "formal_inference.start",
    currentState: "preflight",
    targetState: "executing",
    inputEvidence: [{ path: fixture.bindingPaths.datasetRelease, sha256: fixture.bindingHashes.datasetRelease }],
    programLineage: fixture.programLineage,
    outputNamespace: `${fixture.outputRoot}/execution-001`,
    issuedAt: "2026-08-24T07:10:00+08:00",
    expiresAt: "2026-08-24T08:10:00+08:00",
    nonce: "ticket-nonce-001",
    signingPrivateKey: fixture.privateKey,
  });
  pass(() => validateRuntimeCapabilityTicketIntegrity(ticket, {
    publicKey: verified.ticketIssuer.publicKey,
    issuerIdentity: fixture.issuerIdentity,
    issuerKeyId: fixture.issuerKeyId,
  }));
  pass(() => assert.equal(ticket.capabilityReleaseSha256, verified.capabilityReleaseSha256));
  pass(() => assert.equal(ticket.issuerIdentity, fixture.issuerIdentity));

  const executionState = { capabilityReleaseIdentity: fixture.releaseIdentity, currentState: "preflight" };
  const ledgerPath = ".runtime/ai-painter/test-ticket-ledger.sqlite";
  const consumption = applyRuntimeStateTransition(ticket, executionState, {
    projectRoot: fixture.projectRoot,
    ticketLedgerPath: ledgerPath,
    consumedAt: "2026-08-24T07:11:00+08:00",
  });
  pass(() => assert.equal(consumption.status, "consumed_once_persisted"));
  pass(() => assert.equal(executionState.currentState, "executing"));
  reject(() => applyRuntimeStateTransition(ticket, {
    capabilityReleaseIdentity: fixture.releaseIdentity,
    currentState: "preflight",
  }, {
    projectRoot: fixture.projectRoot,
    ticketLedgerPath: ledgerPath,
    consumedAt: "2026-08-24T07:12:00+08:00",
  }), "ticket replay after process-state reset must be rejected");

  reject(() => validateRuntimeCapabilityTicketIntegrity({ ...ticket, targetState: "reviewing" }, {
    publicKey: verified.ticketIssuer.publicKey,
    issuerIdentity: fixture.issuerIdentity,
    issuerKeyId: fixture.issuerKeyId,
  }), "mutated ticket body must be rejected");
  reject(() => validateRuntimeCapabilityTicketIntegrity({ ...ticket, machineSignature: Buffer.from("forged").toString("base64url") }, {
    publicKey: verified.ticketIssuer.publicKey,
    issuerIdentity: fixture.issuerIdentity,
    issuerKeyId: fixture.issuerKeyId,
  }), "forged machine signature must be rejected");
  reject(() => validateReleasedCapabilityBinding({
    capabilityReleaseIdentity: "self-reported-release",
    capabilityReleaseSha256: digest("release"),
    capabilityReleaseVerified: true,
  }), "caller supplied verification boolean must never establish trust");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ untrusted: true }).options), "unregistered release must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ machineAdjudicationStatus: "rejected" }).options), "rejected machine release adjudication must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ wrongWriter: true }).options), "untrusted release writer must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ badBoundArtifactHash: true }).options), "bound artifact SHA mismatch must be rejected");
  reject(() => loadAndValidateReleasedCapabilityBinding(createReleaseFixture({ duplicateRegistryRecord: true }).options), "duplicate trusted release record must be rejected");
  reject(() => deriveRuntimeCapabilityTicket({
    ...fixture.options,
    action: "training.start_or_retry",
    currentState: "preflight",
    targetState: "executing",
    inputEvidence: [{ path: fixture.bindingPaths.datasetRelease, sha256: fixture.bindingHashes.datasetRelease }],
    programLineage: fixture.programLineage,
    outputNamespace: `${fixture.outputRoot}/execution-002`,
    issuedAt: "2026-08-24T07:10:00+08:00",
    expiresAt: "2026-08-24T08:10:00+08:00",
    nonce: "ticket-nonce-002",
    signingPrivateKey: fixture.privateKey,
  }), "capability lifecycle action must not receive a released-runtime ticket");

  const bounded = adjudicateBoundedDecision({
    decisionSetId: "runtime-review-v1",
    ruleVersion: "rules-v1",
    optionIds: ["publish", "fail_closed"],
    matchedOptionIds: ["publish"],
    evidenceReferences: [{ path: fixture.bindingPaths.reviewContract, sha256: fixture.bindingHashes.reviewContract }],
    evidenceComplete: true,
  });
  pass(() => assert.equal(bounded.status, "uniquely_adjudicated"));
  pass(() => assert.equal(bounded.ownerResponseRequired, false));
  const ambiguous = adjudicateBoundedDecision({
    decisionSetId: "runtime-review-v1",
    ruleVersion: "rules-v1",
    optionIds: ["publish", "fail_closed"],
    matchedOptionIds: ["publish", "fail_closed"],
    evidenceReferences: [{ path: fixture.bindingPaths.reviewContract, sha256: fixture.bindingHashes.reviewContract }],
    evidenceComplete: true,
  });
  pass(() => assert.equal(ambiguous.status, "blocked_policy_boundary"));
  pass(() => assert.equal(ambiguous.failureCode, "evidence_ambiguous"));
  pass(() => assert.equal(ambiguous.ownerResponseRequired, false));

  const boundary = createPolicyBoundaryReport({
    reportId: "policy-boundary-001",
    boundaryClass: "long_term_business_goal_change",
    evidenceReferences: [{ path: fixture.bindingPaths.reviewContract, sha256: fixture.bindingHashes.reviewContract }],
    detectedAt: "2026-08-24T07:15:00+08:00",
  });
  pass(() => assert.equal(boundary.status, "blocked_policy_boundary"));
  pass(() => assert.equal(boundary.ownerAuthorizationRequested, false));

  console.log(JSON.stringify({
    ok: true,
    status: "ai_painter_local_autonomy_core_v3_passed",
    positiveChecks: positive,
    negativeChecks: negative,
    ownerInNormalStateMachine: false,
    machineReleaseAdjudicationVerified: true,
    internalTicketMachineSignatureVerified: true,
    persistentReplayProtectionVerified: true,
    ambiguousEvidenceWaitsForOwner: false,
    historicalOwnerContractsExecutable: false,
  }, null, 2));
} finally {
  for (const temporaryRoot of temporaryRoots) fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function createReleaseFixture({
  untrusted = false,
  machineAdjudicationStatus = "released",
  wrongWriter = false,
  badBoundArtifactHash = false,
  duplicateRegistryRecord = false,
} = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-release-v3-fixture-"));
  temporaryRoots.push(projectRoot);
  const releaseIdentity = `capability-release-${path.basename(projectRoot).toLowerCase()}`;
  const capabilityReleasePath = `data/ai-painter/capability-releases/${releaseIdentity}/release.json`;
  const adjudicationPath = `data/ai-painter/capability-releases/${releaseIdentity}/machine-release-adjudication.json`;
  const issuerPublicKeyPath = `data/ai-painter/capability-releases/${releaseIdentity}/ticket-issuer-public-key.pem`;
  const outputRoot = `.runtime/ai-painter/capability-runtime-executions/${releaseIdentity}`;
  const policySha256 = writeJson(projectRoot, RUNTIME_AUTONOMY_POLICY_PATH, policySource);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyBytes = Buffer.from(publicKey.export({ type: "spki", format: "pem" }));
  const publicKeySha256 = writeBytes(projectRoot, issuerPublicKeyPath, publicKeyBytes);
  const issuerIdentity = "local-ai-runtime-ticket-issuer";
  const issuerKeyId = "local-ai-runtime-ticket-key-v1";

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
  const programLineage = { runtime: digest("runtime-program-lineage") };
  const machineAdjudication = {
    schemaVersion: MACHINE_RELEASE_ADJUDICATION_SCHEMA,
    adjudicationId: `machine-adjudication-${releaseIdentity}`,
    status: machineAdjudicationStatus,
    writerIdentity: wrongWriter ? "untrusted-writer" : RELEASE_ORCHESTRATOR_IDENTITY,
    capabilityReleaseIdentity: releaseIdentity,
    bindingSetSha256,
    policyContractSha256: policySha256,
    programLineageSha256: sha256Of(programLineage),
    evidence: [{ path: bindingPaths.reviewContract, sha256: bindingHashes.reviewContract }],
  };
  const machineAdjudicationSha256 = writeJson(projectRoot, adjudicationPath, machineAdjudication);
  const release = {
    schemaVersion: CAPABILITY_RELEASE_SCHEMA,
    capabilityReleaseIdentity: releaseIdentity,
    status: "released",
    modelCapabilityVersion: "ai-painter-model-capability-fixture-v1",
    runtimeAutonomyPolicy: {
      contractId: RUNTIME_AUTONOMY_CONTRACT_ID,
      path: RUNTIME_AUTONOMY_POLICY_PATH,
      sha256: policySha256,
      allowedInternalActions: policySource.releasedCapabilityInternalActions,
      maxInfrastructureRecoveryAttempts: 2,
    },
    bindings,
    machineReleaseAdjudication: { path: adjudicationPath, sha256: machineAdjudicationSha256 },
    ticketIssuer: {
      identity: issuerIdentity,
      keyId: issuerKeyId,
      publicKeyPath: issuerPublicKeyPath,
      publicKeySha256,
    },
    programLineage,
    outputRoot,
  };
  const releaseSha256 = writeJson(projectRoot, capabilityReleasePath, release);
  const record = {
    capabilityReleaseIdentity: releaseIdentity,
    status: "released_trusted",
    registryRevision: 1,
    releasePath: capabilityReleasePath,
    releaseSha256,
    policyContractSha256: policySha256,
    bindingSetSha256,
    machineReleaseAdjudicationPath: adjudicationPath,
    machineReleaseAdjudicationSha256: machineAdjudicationSha256,
    ticketIssuerIdentity: issuerIdentity,
    ticketIssuerKeyId: issuerKeyId,
    ticketIssuerPublicKeySha256: publicKeySha256,
  };
  const releaseRecords = untrusted ? [] : duplicateRegistryRecord ? [record, { ...record }] : [record];
  writeJson(projectRoot, TRUSTED_RELEASE_REGISTRY_PATH, {
    schemaVersion: TRUSTED_RELEASE_REGISTRY_SCHEMA,
    contractId: TRUSTED_RELEASE_REGISTRY_SCHEMA,
    status: releaseRecords.length ? "active_with_capability_release" : "active_no_capability_release",
    registryRevision: releaseRecords.length ? 1 : 0,
    releaseRoot: "data/ai-painter/capability-releases",
    uniqueWriter: {
      identity: RELEASE_ORCHESTRATOR_IDENTITY,
      compareAndSwapRevisionRequired: true,
      sqliteTransactionRequired: true,
      atomicFileReplaceRequired: true,
    },
    trustBoundary: {
      callerSuppliedVerificationFlagsAccepted: false,
      ownerDecisionAcceptedAsReleaseAuthority: false,
    },
    releaseRecords,
  });
  return {
    projectRoot, releaseIdentity, outputRoot, programLineage, bindingPaths, bindingHashes,
    privateKey, issuerIdentity, issuerKeyId,
    options: { projectRoot, capabilityReleasePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH },
  };
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
