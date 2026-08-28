import {
  createHash,
  createPublicKey,
  randomBytes,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const RUNTIME_AUTONOMY_CONTRACT_ID = "ai-painter-capability-runtime-autonomy-contract-v3";
export const TRUSTED_RELEASE_REGISTRY_SCHEMA = "ai-painter-capability-release-registry-v2";
export const TRUSTED_RELEASE_REGISTRY_PATH = "data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json";
export const RUNTIME_AUTONOMY_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v3.json";
export const CAPABILITY_RELEASE_SCHEMA = "ai-painter-capability-release-v2";
export const MACHINE_RELEASE_ADJUDICATION_SCHEMA = "ai-painter-machine-capability-release-adjudication-v1";
export const RELEASE_ORCHESTRATOR_IDENTITY = "local_ai_capability_release_orchestrator";
export const DEFAULT_TICKET_LEDGER_PATH = ".runtime/ai-painter/capability-runtime-ticket-ledger.sqlite";
export const REQUIRED_BINDING_ROLES = Object.freeze([
  "datasetRelease", "modelArtifact", "reviewContract", "runtimeInterfaceContract", "conditionContract",
]);

export const EXECUTION_STATES = Object.freeze([
  "package_materialized", "preflight", "executing", "validating", "reviewing",
  "adjudicating", "finalizing", "completed", "failed_closed", "blocked_policy_boundary",
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  package_materialized: Object.freeze(["preflight", "failed_closed", "blocked_policy_boundary"]),
  preflight: Object.freeze(["preflight", "executing", "failed_closed", "blocked_policy_boundary"]),
  executing: Object.freeze(["executing", "validating", "failed_closed", "blocked_policy_boundary"]),
  validating: Object.freeze(["validating", "reviewing", "failed_closed", "blocked_policy_boundary"]),
  reviewing: Object.freeze(["reviewing", "adjudicating", "failed_closed", "blocked_policy_boundary"]),
  adjudicating: Object.freeze(["adjudicating", "finalizing", "failed_closed", "blocked_policy_boundary"]),
  finalizing: Object.freeze(["finalizing", "completed", "failed_closed", "blocked_policy_boundary"]),
});

export const INTERNAL_ACTION_TARGETS = Object.freeze({
  "preflight.verify": Object.freeze(["package_materialized:preflight"]),
  "formal_inference.start": Object.freeze(["preflight:executing"]),
  "execution.observe": Object.freeze(["executing:executing"]),
  "validation.fixed_evidence": Object.freeze(["executing:validating", "validating:validating"]),
  "review.machine": Object.freeze(["validating:reviewing", "reviewing:reviewing"]),
  "adjudication.deterministic": Object.freeze(["reviewing:adjudicating", "adjudicating:adjudicating"]),
  "runtime_frame.create": Object.freeze(["adjudicating:finalizing"]),
  "world.enter": Object.freeze(["finalizing:completed"]),
  "terminal.complete": Object.freeze(["finalizing:completed"]),
  "terminal.fail_closed": Object.freeze([
    "package_materialized:failed_closed", "preflight:failed_closed", "executing:failed_closed",
    "validating:failed_closed", "reviewing:failed_closed", "adjudicating:failed_closed",
    "finalizing:failed_closed",
  ]),
  "policy_boundary.report": Object.freeze([
    "package_materialized:blocked_policy_boundary", "preflight:blocked_policy_boundary",
    "executing:blocked_policy_boundary", "validating:blocked_policy_boundary",
    "reviewing:blocked_policy_boundary", "adjudicating:blocked_policy_boundary",
    "finalizing:blocked_policy_boundary",
  ]),
  "governance.sync": Object.freeze([
    "preflight:preflight", "executing:executing", "validating:validating",
    "reviewing:reviewing", "adjudicating:adjudicating", "finalizing:finalizing",
  ]),
  "infrastructure.recover_bounded": Object.freeze(["preflight:preflight"]),
});

export const LOCAL_CAPABILITY_LIFECYCLE_ACTIONS = Object.freeze(new Set([
  "training.start_or_retry", "optimizer.create", "weights.modify", "checkpoint.select_or_promote",
  "model.implement_bounded_change", "loss.implement_bounded_change", "data_release.materialize",
  "review_contract.change_candidate", "program_lineage.change_candidate", "model_family.change_candidate",
  "capability_release.adjudicate", "capability_release.rollback",
]));

export const POLICY_BOUNDARY_CLASSES = Object.freeze(new Set([
  "long_term_business_goal_change", "worldfacts_authority_change", "source_license_or_legal_boundary",
  "safety_limit_change", "audit_truthfulness_conflict", "unregistered_external_cost",
  "irreversible_destructive_action",
]));

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/;
const SAFE_RUNTIME_NAMESPACE_PATTERN = /^\.runtime\/ai-painter\/[a-zA-Z0-9._/-]+$/;
const ACTIVE_POLICY_STATUSES = new Set(["policy_active_no_capability_release", "policy_active_with_capability_release"]);
const ACTIVE_REGISTRY_STATUSES = new Set(["active_no_capability_release", "active_with_capability_release"]);

function invariant(condition, message) { if (!condition) throw new Error(message); }

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }

export function sha256Of(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalJson(value), "utf8");
  return createHash("sha256").update(input).digest("hex");
}

function validateSha256(value, field) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value), `${field} must be a lowercase SHA-256`);
}

function validateSafeId(value, field) {
  invariant(typeof value === "string" && SAFE_ID_PATTERN.test(value), `${field} is invalid`);
}

function validateProjectRelativePath(relativePath, field) {
  invariant(typeof relativePath === "string" && relativePath.length > 0, `${field} is required`);
  invariant(!path.isAbsolute(relativePath) && !/^[a-zA-Z]:[\\/]/.test(relativePath), `${field} must be project-relative`);
  invariant(!relativePath.includes("\\") && !relativePath.split("/").includes(".."), `${field} must be normalized without traversal`);
  invariant(path.posix.normalize(relativePath) === relativePath, `${field} must be a normalized logical path`);
}

function resolveInsideProject(projectRoot, relativePath, field) {
  validateProjectRelativePath(relativePath, field);
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  invariant(resolved.startsWith(`${root}${path.sep}`), `${field} escapes project root`);
  return resolved;
}

function resolveImmutableProjectFile(projectRoot, relativePath, field) {
  const resolved = resolveInsideProject(projectRoot, relativePath, field);
  invariant(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `${field} does not identify an existing file`);
  const physicalRoot = fs.realpathSync(path.resolve(projectRoot));
  const physicalFile = fs.realpathSync(resolved);
  invariant(physicalFile.startsWith(`${physicalRoot}${path.sep}`), `${field} resolves outside project root`);
  return resolved;
}

function readImmutableFile(projectRoot, relativePath, field, expectedSha256 = null) {
  const absolutePath = resolveImmutableProjectFile(projectRoot, relativePath, field);
  const bytes = fs.readFileSync(absolutePath);
  const sha256 = sha256Of(bytes);
  if (expectedSha256 !== null) {
    validateSha256(expectedSha256, `${field} SHA-256`);
    invariant(sha256 === expectedSha256, `${field} SHA-256 mismatch`);
  }
  return { relativePath, absolutePath, bytes, sha256 };
}

function readImmutableJson(projectRoot, relativePath, field, expectedSha256 = null) {
  const evidence = readImmutableFile(projectRoot, relativePath, field, expectedSha256);
  let value;
  try { value = JSON.parse(evidence.bytes.toString("utf8")); }
  catch { throw new Error(`${field} is not valid JSON`); }
  invariant(value && typeof value === "object" && !Array.isArray(value), `${field} must be a JSON object`);
  return { ...evidence, value };
}

function validateProgramLineage(lineage) {
  invariant(lineage && typeof lineage === "object" && !Array.isArray(lineage), "programLineage must be an object");
  invariant(Object.keys(lineage).length > 0, "programLineage must not be empty");
  for (const [role, digest] of Object.entries(lineage)) {
    validateSafeId(role, "programLineage role");
    validateSha256(digest, `programLineage.${role}`);
  }
}

function validateEvidence(inputEvidence) {
  invariant(Array.isArray(inputEvidence) && inputEvidence.length > 0, "inputEvidence must be non-empty");
  const identities = new Set();
  for (const evidence of inputEvidence) {
    invariant(evidence && typeof evidence === "object", "evidence entry must be an object");
    validateProjectRelativePath(evidence.path, "evidence path");
    validateSha256(evidence.sha256, "evidence sha256");
    const identity = `${evidence.path}\u0000${evidence.sha256}`;
    invariant(!identities.has(identity), "duplicate evidence identity");
    identities.add(identity);
  }
}

export function validateRuntimeAutonomyPolicy(policy) {
  invariant(policy?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "unexpected policy contractId");
  invariant(ACTIVE_POLICY_STATUSES.has(policy?.status), "runtime policy is not active");
  invariant(policy?.authorityBoundary?.rootAuthority === "released_capability_identity", "released capability authority is required");
  invariant(policy?.authorityBoundary?.normalOperationAuthority === "local_ai_pet_world_program", "local AI must own normal operation");
  invariant(policy?.authorityBoundary?.ownerInNormalStateMachine === false, "Owner must not be in the normal state machine");
  invariant(policy?.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perStageOwnerAuthorizationRequired === false, "per-stage Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCapabilityVersionOwnerAuthorizationRequired === false, "per-version Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCandidateOwnerReviewRequired === false, "per-candidate Owner review must be false");
  invariant(policy?.authorityBoundary?.codexIsRequiredAtRuntime === false, "Codex must not be a runtime dependency");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistrySchemaVersion === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "trusted release registry path mismatch");
  invariant(policy?.capabilityReleaseVerification?.releaseSchemaVersion === CAPABILITY_RELEASE_SCHEMA, "capability release schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.machineReleaseAdjudicationSchemaVersion === MACHINE_RELEASE_ADJUDICATION_SCHEMA, "machine release adjudication schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.callerSuppliedVerifiedBooleanTrusted === false, "caller verification flags must not be trusted");
  invariant(policy?.capabilityReleaseVerification?.machineSignatureRequiredForInternalTicket === true, "machine ticket signature is required");
  invariant(policy?.capabilityReleaseVerification?.persistentReplayLedgerRequired === true, "persistent replay ledger is required");
  invariant(canonicalJson(policy?.capabilityReleaseVerification?.requiredBindingRoles) === canonicalJson(REQUIRED_BINDING_ROLES), "required release binding roles mismatch");
  invariant(policy?.decisionRules?.ambiguousTargetState === "blocked_policy_boundary", "ambiguous evidence must stop at policy boundary");
  invariant(policy?.decisionRules?.ownerResponseWaitAllowed === false, "Owner response waits must be forbidden");
  for (const forbidden of ["waiting_owner_decision", "waiting_capability_change", "owner.wait"]) {
    invariant(!policy.executionStates?.includes(forbidden), `forbidden Owner wait state present: ${forbidden}`);
    invariant(!policy.releasedCapabilityInternalActions?.includes(forbidden), `forbidden Owner wait action present: ${forbidden}`);
  }
  return true;
}

export function loadAndValidateReleasedCapabilityBinding({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath }) {
  invariant(typeof projectRoot === "string" && projectRoot.length > 0, "projectRoot is required");
  invariant(trustedReleaseRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "untrusted capability release registry path rejected");
  const registryEvidence = readImmutableJson(projectRoot, trustedReleaseRegistryPath, "trusted capability release registry");
  const registry = registryEvidence.value;
  invariant(registry.schemaVersion === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry schema mismatch");
  invariant(registry.contractId === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry contractId mismatch");
  invariant(ACTIVE_REGISTRY_STATUSES.has(registry.status), "trusted release registry is not active");
  invariant(Number.isInteger(registry.registryRevision) && registry.registryRevision >= 0, "registryRevision is invalid");
  invariant(registry.uniqueWriter?.identity === RELEASE_ORCHESTRATOR_IDENTITY, "release registry writer identity mismatch");
  invariant(registry.uniqueWriter?.compareAndSwapRevisionRequired === true, "registry CAS revision is required");
  invariant(registry.uniqueWriter?.sqliteTransactionRequired === true, "registry SQLite transaction is required");
  invariant(registry.trustBoundary?.callerSuppliedVerificationFlagsAccepted === false, "trusted registry accepts caller verification flags");
  invariant(registry.trustBoundary?.ownerDecisionAcceptedAsReleaseAuthority === false, "Owner decision must not be release authority");
  invariant(Array.isArray(registry.releaseRecords), "trusted release records are required");
  validateProjectRelativePath(capabilityReleasePath, "capabilityReleasePath");
  invariant(capabilityReleasePath.startsWith(`${registry.releaseRoot}/`), "capability release is outside the trusted release root");

  const matchingRecords = registry.releaseRecords.filter((entry) => entry?.releasePath === capabilityReleasePath);
  invariant(matchingRecords.length === 1, "capability release must have exactly one trusted registry record");
  const registryRecord = matchingRecords[0];
  validateSafeId(registryRecord.capabilityReleaseIdentity, "trusted capabilityReleaseIdentity");
  invariant(registryRecord.status === "released_trusted", "capability release is not trusted and released");
  invariant(registryRecord.registryRevision <= registry.registryRevision, "release record revision exceeds registry revision");

  const releaseEvidence = readImmutableJson(projectRoot, capabilityReleasePath, "capability release", registryRecord.releaseSha256);
  const release = releaseEvidence.value;
  invariant(release.schemaVersion === CAPABILITY_RELEASE_SCHEMA, "capability release schema mismatch");
  invariant(release.status === "released", "capability release status is not released");
  invariant(release.capabilityReleaseIdentity === registryRecord.capabilityReleaseIdentity, "capability release identity differs from trusted registry");
  validateSafeId(release.modelCapabilityVersion, "modelCapabilityVersion");

  const policyBinding = release.runtimeAutonomyPolicy;
  invariant(policyBinding?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "capability release lacks runtime policy binding");
  invariant(policyBinding?.path === RUNTIME_AUTONOMY_POLICY_PATH, "capability release references an untrusted runtime policy path");
  const policyEvidence = readImmutableJson(projectRoot, policyBinding.path, "runtime autonomy policy", policyBinding.sha256);
  validateRuntimeAutonomyPolicy(policyEvidence.value);
  invariant(policyEvidence.sha256 === registryRecord.policyContractSha256, "trusted registry policy SHA mismatch");
  invariant(Array.isArray(policyBinding.allowedInternalActions), "allowedInternalActions is required");
  invariant(policyBinding.allowedInternalActions.every((action) => policyEvidence.value.releasedCapabilityInternalActions.includes(action)), "release contains an action outside runtime policy");
  invariant(Number.isInteger(policyBinding.maxInfrastructureRecoveryAttempts) && policyBinding.maxInfrastructureRecoveryAttempts >= 0, "recovery attempt limit is invalid");

  invariant(release.bindings && typeof release.bindings === "object" && !Array.isArray(release.bindings), "capability release bindings are required");
  invariant(canonicalJson(Object.keys(release.bindings).sort()) === canonicalJson([...REQUIRED_BINDING_ROLES].sort()), "capability release binding roles mismatch");
  const verifiedBindings = {};
  for (const role of REQUIRED_BINDING_ROLES) {
    const binding = release.bindings[role];
    invariant(binding && typeof binding === "object", `${role} binding is required`);
    validateSafeId(binding.identity, `${role}.identity`);
    const evidence = readImmutableFile(projectRoot, binding.path, `${role} binding`, binding.sha256);
    verifiedBindings[role] = { identity: binding.identity, path: binding.path, sha256: evidence.sha256 };
  }
  const bindingSetSha256 = sha256Of(release.bindings);
  invariant(bindingSetSha256 === registryRecord.bindingSetSha256, "trusted registry binding set SHA mismatch");

  validateProgramLineage(release.programLineage);
  const programLineageSha256 = sha256Of(release.programLineage);
  const adjudicationBinding = release.machineReleaseAdjudication;
  invariant(adjudicationBinding && typeof adjudicationBinding === "object", "machine release adjudication binding is required");
  invariant(adjudicationBinding.path === registryRecord.machineReleaseAdjudicationPath, "machine adjudication path differs from trusted registry");
  invariant(adjudicationBinding.sha256 === registryRecord.machineReleaseAdjudicationSha256, "machine adjudication SHA differs from trusted registry");
  const adjudicationEvidence = readImmutableJson(projectRoot, adjudicationBinding.path, "machine release adjudication", adjudicationBinding.sha256);
  const adjudication = adjudicationEvidence.value;
  invariant(adjudication.schemaVersion === MACHINE_RELEASE_ADJUDICATION_SCHEMA, "machine release adjudication schema mismatch");
  invariant(adjudication.status === "released", "machine release adjudication is not released");
  invariant(adjudication.writerIdentity === RELEASE_ORCHESTRATOR_IDENTITY, "machine release adjudication writer mismatch");
  invariant(adjudication.capabilityReleaseIdentity === release.capabilityReleaseIdentity, "machine adjudication release identity mismatch");
  invariant(adjudication.bindingSetSha256 === bindingSetSha256, "machine adjudication binding set mismatch");
  invariant(adjudication.policyContractSha256 === policyEvidence.sha256, "machine adjudication policy mismatch");
  invariant(adjudication.programLineageSha256 === programLineageSha256, "machine adjudication program lineage mismatch");
  validateEvidence(adjudication.evidence);

  const issuer = release.ticketIssuer;
  invariant(issuer && typeof issuer === "object", "ticket issuer binding is required");
  validateSafeId(issuer.identity, "ticket issuer identity");
  validateSafeId(issuer.keyId, "ticket issuer keyId");
  invariant(issuer.identity === registryRecord.ticketIssuerIdentity, "ticket issuer identity differs from registry");
  invariant(issuer.keyId === registryRecord.ticketIssuerKeyId, "ticket issuer key differs from registry");
  const publicKeyEvidence = readImmutableFile(projectRoot, issuer.publicKeyPath, "ticket issuer public key", issuer.publicKeySha256);
  invariant(publicKeyEvidence.sha256 === registryRecord.ticketIssuerPublicKeySha256, "ticket issuer public key differs from registry");
  const publicKey = createPublicKey(publicKeyEvidence.bytes);

  invariant(typeof release.outputRoot === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(release.outputRoot), "outputRoot must be a project runtime namespace");
  invariant(!release.outputRoot.includes("..") && !release.outputRoot.includes("\\"), "outputRoot must be normalized");

  return deepFreeze({
    verificationStatus: "verified_from_machine_adjudication_and_trusted_registry",
    capabilityReleasePath,
    capabilityReleaseSha256: releaseEvidence.sha256,
    trustedReleaseRegistryPath,
    trustedReleaseRegistrySha256: registryEvidence.sha256,
    policyPath: policyBinding.path,
    policySha256: policyEvidence.sha256,
    release,
    verifiedBindings,
    machineReleaseAdjudicationPath: adjudicationBinding.path,
    machineReleaseAdjudicationSha256: adjudicationEvidence.sha256,
    ticketIssuer: {
      identity: issuer.identity,
      keyId: issuer.keyId,
      publicKeyPath: issuer.publicKeyPath,
      publicKeySha256: publicKeyEvidence.sha256,
      publicKey,
    },
  });
}

export function validateReleasedCapabilityBinding(options) {
  return loadAndValidateReleasedCapabilityBinding(options);
}

export function classifyActionAuthority(action, context = {}) {
  if (POLICY_BOUNDARY_CLASSES.has(action) || context.policyBoundary === true) return "blocked_policy_boundary";
  if (LOCAL_CAPABILITY_LIFECYCLE_ACTIONS.has(action) || context.capabilityImplementationChanged === true) return "local_capability_lifecycle_action";
  if (action in INTERNAL_ACTION_TARGETS) return "released_capability_internal_action";
  return "denied_unknown_action";
}

export function deriveRuntimeCapabilityTicket({
  projectRoot, capabilityReleasePath, trustedReleaseRegistryPath, action, currentState, targetState,
  inputEvidence, programLineage, outputNamespace, attemptNumber = 1, context = {}, issuedAt,
  expiresAt, nonce = randomBytes(16).toString("hex"), signingPrivateKey,
}) {
  const verified = loadAndValidateReleasedCapabilityBinding({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath });
  const capabilityRelease = verified.release;
  invariant(classifyActionAuthority(action, context) === "released_capability_internal_action", `action ${action} is not a released-capability runtime action`);
  invariant(capabilityRelease.runtimeAutonomyPolicy.allowedInternalActions.includes(action), `action ${action} is outside released capability scope`);
  invariant(EXECUTION_STATES.includes(currentState) && EXECUTION_STATES.includes(targetState), "unknown execution state");
  invariant(INTERNAL_ACTION_TARGETS[action].includes(`${currentState}:${targetState}`), `action ${action} cannot perform requested transition`);
  invariant(ALLOWED_TRANSITIONS[currentState]?.includes(targetState), "state transition is not allowed");
  validateEvidence(inputEvidence);
  validateProgramLineage(programLineage);
  invariant(canonicalJson(programLineage) === canonicalJson(capabilityRelease.programLineage), "program lineage differs from capability release");
  invariant(Number.isInteger(attemptNumber) && attemptNumber >= 1, "attemptNumber must be a positive integer");
  if (action === "infrastructure.recover_bounded") {
    invariant(attemptNumber <= capabilityRelease.runtimeAutonomyPolicy.maxInfrastructureRecoveryAttempts, "infrastructure recovery attempt limit exceeded");
  } else invariant(attemptNumber === 1, "non-recovery internal actions are single-attempt");
  invariant(typeof outputNamespace === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(outputNamespace), "outputNamespace must be a project runtime namespace");
  invariant(!outputNamespace.includes("..") && !outputNamespace.includes("\\"), "outputNamespace must be normalized");
  invariant(outputNamespace.startsWith(`${capabilityRelease.outputRoot}/`), "outputNamespace is outside capability release outputRoot");
  invariant(typeof issuedAt === "string" && !Number.isNaN(Date.parse(issuedAt)), "issuedAt must be an ISO timestamp");
  invariant(typeof expiresAt === "string" && !Number.isNaN(Date.parse(expiresAt)), "expiresAt must be an ISO timestamp");
  invariant(Date.parse(expiresAt) > Date.parse(issuedAt), "ticket expiry must be after issue time");
  validateSafeId(nonce, "ticket nonce");
  invariant(signingPrivateKey, "machine signing private key is required");
  const derivedPublicKey = createPublicKey(signingPrivateKey).export({ type: "spki", format: "pem" });
  invariant(sha256Of(Buffer.from(derivedPublicKey)) === verified.ticketIssuer.publicKeySha256, "machine signing key is not the trusted ticket issuer");

  const ticketBody = {
    schemaVersion: "ai-painter-runtime-capability-ticket-v3",
    ticketId: `rct-${sha256Of({ release: capabilityRelease.capabilityReleaseIdentity, action, currentState, targetState, inputEvidence, attemptNumber, outputNamespace, nonce }).slice(0, 32)}`,
    issuerIdentity: verified.ticketIssuer.identity,
    issuerKeyId: verified.ticketIssuer.keyId,
    capabilityReleaseIdentity: capabilityRelease.capabilityReleaseIdentity,
    capabilityReleasePath: verified.capabilityReleasePath,
    capabilityReleaseSha256: verified.capabilityReleaseSha256,
    trustedReleaseRegistryPath: verified.trustedReleaseRegistryPath,
    trustedReleaseRegistrySha256: verified.trustedReleaseRegistrySha256,
    policyContractId: RUNTIME_AUTONOMY_CONTRACT_ID,
    policyContractPath: verified.policyPath,
    policyContractSha256: verified.policySha256,
    action, currentState, targetState,
    inputEvidence: canonicalize(inputEvidence),
    programLineage: canonicalize(programLineage),
    outputNamespace, attemptNumber, nonce, issuedAt, expiresAt,
    noPrivilegeEscalation: true,
    singleUse: true,
    status: "issued_not_consumed",
  };
  const ticketSha256 = sha256Of(ticketBody);
  const signedEnvelope = canonicalJson({ ...ticketBody, ticketSha256 });
  const machineSignature = signBytes(null, Buffer.from(signedEnvelope, "utf8"), signingPrivateKey).toString("base64url");
  return deepFreeze({ ...ticketBody, ticketSha256, machineSignature });
}

export function validateRuntimeCapabilityTicketIntegrity(ticket, { publicKey, issuerIdentity, issuerKeyId } = {}) {
  invariant(ticket && typeof ticket === "object" && !Array.isArray(ticket), "ticket is required");
  invariant(publicKey, "trusted ticket issuer public key is required");
  validateSha256(ticket.ticketSha256, "ticketSha256");
  invariant(ticket.issuerIdentity === issuerIdentity, "ticket issuer identity mismatch");
  invariant(ticket.issuerKeyId === issuerKeyId, "ticket issuer key mismatch");
  invariant(typeof ticket.machineSignature === "string" && ticket.machineSignature.length > 0, "machine signature is required");
  const { ticketSha256, machineSignature, ...ticketBody } = ticket;
  invariant(sha256Of(ticketBody) === ticketSha256, "ticket SHA-256 mismatch");
  const signedEnvelope = canonicalJson({ ...ticketBody, ticketSha256 });
  invariant(verifyBytes(null, Buffer.from(signedEnvelope, "utf8"), publicKey, Buffer.from(machineSignature, "base64url")), "ticket machine signature mismatch");
  invariant(ticket.status === "issued_not_consumed", "ticket is not consumable");
  invariant(ticket.singleUse === true && ticket.noPrivilegeEscalation === true, "ticket safety flags are invalid");
  return true;
}

export function applyRuntimeStateTransition(ticket, executionState, {
  projectRoot,
  ticketLedgerPath = DEFAULT_TICKET_LEDGER_PATH,
  consumedAt = new Date().toISOString(),
} = {}) {
  const verified = loadAndValidateReleasedCapabilityBinding({
    projectRoot,
    capabilityReleasePath: ticket.capabilityReleasePath,
    trustedReleaseRegistryPath: ticket.trustedReleaseRegistryPath,
  });
  validateRuntimeCapabilityTicketIntegrity(ticket, {
    publicKey: verified.ticketIssuer.publicKey,
    issuerIdentity: verified.ticketIssuer.identity,
    issuerKeyId: verified.ticketIssuer.keyId,
  });
  invariant(!Number.isNaN(Date.parse(consumedAt)), "consumedAt must be an ISO timestamp");
  invariant(Date.parse(consumedAt) >= Date.parse(ticket.issuedAt), "ticket cannot be consumed before issue time");
  invariant(Date.parse(consumedAt) <= Date.parse(ticket.expiresAt), "ticket is expired");
  invariant(verified.capabilityReleaseSha256 === ticket.capabilityReleaseSha256, "ticket release SHA no longer matches trusted release");
  invariant(verified.trustedReleaseRegistrySha256 === ticket.trustedReleaseRegistrySha256, "ticket registry SHA no longer matches trusted registry");
  invariant(verified.policySha256 === ticket.policyContractSha256, "ticket policy SHA no longer matches trusted policy");
  invariant(executionState?.capabilityReleaseIdentity === ticket.capabilityReleaseIdentity, "ticket capability release mismatch");
  invariant(executionState?.currentState === ticket.currentState, "ticket current state mismatch");

  const ledgerAbsolutePath = resolveInsideProject(projectRoot, ticketLedgerPath, "ticketLedgerPath");
  invariant(ticketLedgerPath.startsWith(".runtime/ai-painter/"), "ticket ledger must be in the AI Painter runtime namespace");
  fs.mkdirSync(path.dirname(ledgerAbsolutePath), { recursive: true });
  const db = new DatabaseSync(ledgerAbsolutePath);
  try {
    db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS runtime_capability_ticket_consumptions (
        ticket_id TEXT PRIMARY KEY,
        ticket_sha256 TEXT NOT NULL UNIQUE,
        capability_release_identity TEXT NOT NULL,
        action TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        output_namespace TEXT NOT NULL,
        consumed_at_utc TEXT NOT NULL,
        consumption_json TEXT NOT NULL,
        UNIQUE(capability_release_identity, action, output_namespace)
      );
    `);
    const consumption = {
      schemaVersion: "ai-painter-runtime-capability-consumption-v3",
      ticketId: ticket.ticketId,
      ticketSha256: ticket.ticketSha256,
      issuerIdentity: ticket.issuerIdentity,
      issuerKeyId: ticket.issuerKeyId,
      capabilityReleaseIdentity: ticket.capabilityReleaseIdentity,
      action: ticket.action,
      fromState: ticket.currentState,
      toState: ticket.targetState,
      outputNamespace: ticket.outputNamespace,
      status: "consumed_once_persisted",
      consumedAt,
    };
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO runtime_capability_ticket_consumptions(
          ticket_id, ticket_sha256, capability_release_identity, action,
          from_state, to_state, output_namespace, consumed_at_utc, consumption_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticket.ticketId, ticket.ticketSha256, ticket.capabilityReleaseIdentity, ticket.action,
        ticket.currentState, ticket.targetState, ticket.outputNamespace, consumedAt, JSON.stringify(consumption),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`ticket replay or output reuse rejected: ${error.message}`);
    }
    executionState.currentState = ticket.targetState;
    return Object.freeze({ ...consumption, resultingState: executionState.currentState, ticketLedgerPath });
  } finally {
    db.close();
  }
}

export function adjudicateBoundedDecision({ decisionSetId, ruleVersion, optionIds, matchedOptionIds, evidenceReferences, evidenceComplete }) {
  validateSafeId(decisionSetId, "decisionSetId");
  validateSafeId(ruleVersion, "ruleVersion");
  invariant(Array.isArray(optionIds) && optionIds.length >= 2, "at least two bounded options are required");
  invariant(new Set(optionIds).size === optionIds.length, "decision options must be unique");
  invariant(Array.isArray(matchedOptionIds), "matchedOptionIds must be an array");
  validateEvidence(evidenceReferences);
  invariant(matchedOptionIds.every((id) => optionIds.includes(id)), "matched option is outside bounded decision set");
  const uniqueMatches = [...new Set(matchedOptionIds)];
  if (evidenceComplete !== true || uniqueMatches.length !== 1) {
    return Object.freeze({
      decisionSetId,
      ruleVersion,
      status: "blocked_policy_boundary",
      failureCode: evidenceComplete !== true ? "evidence_incomplete" : "evidence_ambiguous",
      matchedOption: null,
      rejectedOptions: [],
      ownerResponseRequired: false,
      evidenceReferences: canonicalize(evidenceReferences),
    });
  }
  const matchedOption = uniqueMatches[0];
  return Object.freeze({
    decisionSetId,
    ruleVersion,
    status: "uniquely_adjudicated",
    matchedOption,
    rejectedOptions: optionIds.filter((id) => id !== matchedOption),
    reason: "exactly_one_frozen_rule_option_matched",
    ownerResponseRequired: false,
    evidenceReferences: canonicalize(evidenceReferences),
  });
}

export function createPolicyBoundaryReport({ reportId, boundaryClass, evidenceReferences, detectedAt, safeAlternative = null }) {
  validateSafeId(reportId, "reportId");
  invariant(POLICY_BOUNDARY_CLASSES.has(boundaryClass), "unknown policy boundary class");
  validateEvidence(evidenceReferences);
  invariant(typeof detectedAt === "string" && !Number.isNaN(Date.parse(detectedAt)), "detectedAt must be an ISO timestamp");
  return deepFreeze({
    schemaVersion: "ai-painter-policy-boundary-report-v1",
    reportId,
    status: "blocked_policy_boundary",
    boundaryClass,
    detectedAt,
    safeAlternative,
    ownerAuthorizationRequested: false,
    ownerResponseRequired: false,
    evidenceReferences: canonicalize(evidenceReferences),
  });
}
