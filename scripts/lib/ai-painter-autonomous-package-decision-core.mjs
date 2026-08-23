import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RUNTIME_AUTONOMY_CONTRACT_ID = "ai-painter-capability-runtime-autonomy-contract-v2";
export const TRUSTED_RELEASE_REGISTRY_SCHEMA = "ai-painter-capability-release-registry-v1";
export const TRUSTED_RELEASE_REGISTRY_PATH = "data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json";
export const RUNTIME_AUTONOMY_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json";
export const CAPABILITY_RELEASE_SCHEMA = "ai-painter-capability-release-v1";
export const OWNER_RELEASE_DECISION_SCHEMA = "ai-painter-capability-release-owner-decision-v1";
export const REQUIRED_BINDING_ROLES = Object.freeze([
  "datasetRelease", "modelArtifact", "reviewContract", "runtimeInterfaceContract", "conditionContract",
]);

export const RUNTIME_STATES = Object.freeze([
  "capability_release_bound", "preflight", "generating", "validating", "reviewing",
  "adjudicating", "publishing", "completed", "failed_closed", "waiting_owner_decision",
  "waiting_capability_change",
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  capability_release_bound: Object.freeze(["preflight", "failed_closed", "waiting_capability_change"]),
  preflight: Object.freeze(["preflight", "generating", "failed_closed", "waiting_owner_decision", "waiting_capability_change"]),
  generating: Object.freeze(["generating", "validating", "failed_closed"]),
  validating: Object.freeze(["validating", "reviewing", "failed_closed"]),
  reviewing: Object.freeze(["reviewing", "adjudicating", "failed_closed"]),
  adjudicating: Object.freeze(["adjudicating", "publishing", "failed_closed", "waiting_owner_decision"]),
  publishing: Object.freeze(["publishing", "completed", "failed_closed"]),
});

export const INTERNAL_ACTION_TARGETS = Object.freeze({
  "preflight.verify": Object.freeze(["capability_release_bound:preflight"]),
  "formal_inference.start": Object.freeze(["preflight:generating"]),
  "execution.observe": Object.freeze(["generating:generating"]),
  "validation.fixed_evidence": Object.freeze(["generating:validating", "validating:validating"]),
  "review.machine": Object.freeze(["validating:reviewing", "reviewing:reviewing"]),
  "adjudication.deterministic": Object.freeze(["reviewing:adjudicating", "adjudicating:adjudicating"]),
  "runtime_frame.create": Object.freeze(["adjudicating:publishing"]),
  "world.enter": Object.freeze(["publishing:completed"]),
  "terminal.complete": Object.freeze(["publishing:completed"]),
  "terminal.fail_closed": Object.freeze([
    "capability_release_bound:failed_closed", "preflight:failed_closed", "generating:failed_closed",
    "validating:failed_closed", "reviewing:failed_closed", "adjudicating:failed_closed",
    "publishing:failed_closed",
  ]),
  "governance.sync": Object.freeze([
    "preflight:preflight", "generating:generating", "validating:validating",
    "reviewing:reviewing", "adjudicating:adjudicating", "publishing:publishing",
  ]),
  "infrastructure.recover_bounded": Object.freeze(["preflight:preflight"]),
  "owner.wait": Object.freeze(["preflight:waiting_owner_decision", "adjudicating:waiting_owner_decision"]),
  "capability_change.wait": Object.freeze([
    "capability_release_bound:waiting_capability_change", "preflight:waiting_capability_change",
  ]),
});

export const CAPABILITY_CHANGE_ACTIONS = Object.freeze(new Set([
  "training.start_or_retry", "optimizer.create", "weights.modify",
  "checkpoint.read_initialize_or_promote", "model.change", "loss.change",
  "data_or_split.change", "review_threshold.change", "checkpoint_selection.change",
  "program_lineage.change", "model_family.create", "business_route.change",
  "evidence_source.change", "condition_contract.change", "runtime_interface.change",
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

function resolveImmutableProjectFile(projectRoot, relativePath, field) {
  validateProjectRelativePath(relativePath, field);
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  invariant(resolved.startsWith(`${root}${path.sep}`), `${field} escapes project root`);
  invariant(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `${field} does not identify an existing file`);
  const physicalRoot = fs.realpathSync(root);
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
  invariant(policy?.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCandidateOwnerReviewRequired === false, "per-candidate Owner review must be false");
  invariant(policy?.authorityBoundary?.mayEscalateReleasedCapabilityPrivilege === false, "capability privilege escalation must be forbidden");
  invariant(policy?.authorityBoundary?.codexIsRequiredAtRuntime === false, "Codex must not be a runtime dependency");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistrySchemaVersion === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "trusted release registry path mismatch");
  invariant(policy?.capabilityReleaseVerification?.releaseSchemaVersion === CAPABILITY_RELEASE_SCHEMA, "capability release schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.callerSuppliedVerifiedBooleanTrusted === false, "caller verification flags must not be trusted");
  invariant(policy?.capabilityReleaseVerification?.ticketSha256RecomputedAtConsumption === true, "ticket integrity recheck is required");
  invariant(canonicalJson(policy?.capabilityReleaseVerification?.requiredBindingRoles) === canonicalJson(REQUIRED_BINDING_ROLES), "required release binding roles mismatch");
  invariant(policy?.decisionRules?.engine === "deterministic_frozen_rule_engine", "decision engine must be deterministic");
  invariant(policy?.decisionRules?.freeFormModelDecisionAllowed === false, "free-form model decisions must be forbidden");
  for (const action of ["formal_inference.start", "runtime_frame.create", "world.enter"]) {
    invariant(policy.internalActionClasses?.includes(action), `${action} must be an internal released-capability action`);
    invariant(!policy.capabilityChangeRequiredActionClasses?.includes(action), `${action} must not require a per-task capability change`);
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
  invariant(registry.trustBoundary?.callerSuppliedVerificationFlagsAccepted === false, "trusted registry accepts caller verification flags");
  invariant(Array.isArray(registry.releaseRecords), "trusted release records are required");
  validateProjectRelativePath(capabilityReleasePath, "capabilityReleasePath");
  invariant(capabilityReleasePath.startsWith(`${registry.releaseRoot}/`), "capability release is outside the trusted release root");

  const matchingRecords = registry.releaseRecords.filter((entry) => entry?.releasePath === capabilityReleasePath);
  invariant(matchingRecords.length === 1, "capability release must have exactly one trusted registry record");
  const registryRecord = matchingRecords[0];
  validateSafeId(registryRecord.capabilityReleaseIdentity, "trusted capabilityReleaseIdentity");
  invariant(registryRecord.status === "released_trusted", "capability release is not trusted and released");

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
  invariant(policyBinding.allowedInternalActions.every((action) => policyEvidence.value.internalActionClasses.includes(action)), "release contains an action outside runtime policy");
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

  const decisionBinding = release.ownerReleaseDecision;
  invariant(decisionBinding && typeof decisionBinding === "object", "Owner release decision binding is required");
  invariant(decisionBinding.path === registryRecord.ownerReleaseDecisionPath, "Owner release decision path differs from trusted registry");
  invariant(decisionBinding.sha256 === registryRecord.ownerReleaseDecisionSha256, "Owner release decision SHA differs from trusted registry");
  const decisionEvidence = readImmutableJson(projectRoot, decisionBinding.path, "Owner release decision", decisionBinding.sha256);
  const decision = decisionEvidence.value;
  invariant(decision.schemaVersion === OWNER_RELEASE_DECISION_SCHEMA, "Owner release decision schema mismatch");
  invariant(decision.status === "approved", "Owner release decision is not approved");
  invariant(decision.capabilityReleaseIdentity === release.capabilityReleaseIdentity, "Owner decision release identity mismatch");
  invariant(decision.approvedBindingSetSha256 === bindingSetSha256, "Owner decision did not approve the bound artifact set");
  invariant(decision.approvedPolicyContractSha256 === policyEvidence.sha256, "Owner decision did not approve the runtime policy");

  validateProgramLineage(release.programLineage);
  invariant(typeof release.outputRoot === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(release.outputRoot), "outputRoot must be a project runtime namespace");
  invariant(!release.outputRoot.includes("..") && !release.outputRoot.includes("\\"), "outputRoot must be normalized");

  return deepFreeze({
    verificationStatus: "verified_from_immutable_release_and_trusted_registry",
    capabilityReleasePath,
    capabilityReleaseSha256: releaseEvidence.sha256,
    trustedReleaseRegistryPath,
    trustedReleaseRegistrySha256: registryEvidence.sha256,
    policyPath: policyBinding.path,
    policySha256: policyEvidence.sha256,
    release,
    verifiedBindings,
    ownerReleaseDecisionPath: decisionBinding.path,
    ownerReleaseDecisionSha256: decisionEvidence.sha256,
  });
}

export function validateReleasedCapabilityBinding(options) {
  return loadAndValidateReleasedCapabilityBinding(options);
}

export function classifyActionAuthority(action, context = {}) {
  if (CAPABILITY_CHANGE_ACTIONS.has(action)) return "capability_change_required";
  if (!(action in INTERNAL_ACTION_TARGETS)) return "denied_unknown_action";
  if (context.modelChanged || context.lossChanged || context.dataChanged || context.splitChanged ||
      context.reviewThresholdChanged || context.conditionContractChanged || context.runtimeInterfaceChanged ||
      context.programLineageChanged) return "capability_change_required";
  return "released_capability_internal_action";
}

export function deriveRuntimeCapabilityTicket({
  projectRoot, capabilityReleasePath, trustedReleaseRegistryPath, action, currentState, targetState,
  inputEvidence, programLineage, outputNamespace, attemptNumber = 1, context = {}, issuedAt,
}) {
  const verified = loadAndValidateReleasedCapabilityBinding({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath });
  const capabilityRelease = verified.release;
  invariant(classifyActionAuthority(action, context) === "released_capability_internal_action", `action ${action} requires capability change or is forbidden`);
  invariant(capabilityRelease.runtimeAutonomyPolicy.allowedInternalActions.includes(action), `action ${action} is outside released capability scope`);
  invariant(RUNTIME_STATES.includes(currentState) && RUNTIME_STATES.includes(targetState), "unknown runtime state");
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

  const ticketBody = {
    schemaVersion: "ai-painter-runtime-capability-ticket-v2",
    ticketId: `rct-${sha256Of({ release: capabilityRelease.capabilityReleaseIdentity, action, currentState, targetState, inputEvidence, attemptNumber, outputNamespace }).slice(0, 24)}`,
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
    outputNamespace, attemptNumber, issuedAt,
    noPrivilegeEscalation: true,
    singleUse: true,
    status: "issued_not_consumed",
  };
  return deepFreeze({ ...ticketBody, ticketSha256: sha256Of(ticketBody) });
}

export function validateRuntimeCapabilityTicketIntegrity(ticket) {
  invariant(ticket && typeof ticket === "object" && !Array.isArray(ticket), "ticket is required");
  validateSha256(ticket.ticketSha256, "ticketSha256");
  const { ticketSha256, ...ticketBody } = ticket;
  invariant(sha256Of(ticketBody) === ticketSha256, "ticket SHA-256 mismatch");
  invariant(ticket.status === "issued_not_consumed", "ticket is not consumable");
  invariant(ticket.singleUse === true && ticket.noPrivilegeEscalation === true, "ticket safety flags are invalid");
  return true;
}

export function applyRuntimeStateTransition(ticket, executionState, { projectRoot } = {}) {
  validateRuntimeCapabilityTicketIntegrity(ticket);
  const verified = loadAndValidateReleasedCapabilityBinding({
    projectRoot,
    capabilityReleasePath: ticket.capabilityReleasePath,
    trustedReleaseRegistryPath: ticket.trustedReleaseRegistryPath,
  });
  invariant(verified.capabilityReleaseSha256 === ticket.capabilityReleaseSha256, "ticket release SHA no longer matches trusted release");
  invariant(verified.trustedReleaseRegistrySha256 === ticket.trustedReleaseRegistrySha256, "ticket registry SHA no longer matches trusted registry");
  invariant(verified.policySha256 === ticket.policyContractSha256, "ticket policy SHA no longer matches trusted policy");
  invariant(executionState?.capabilityReleaseIdentity === ticket.capabilityReleaseIdentity, "ticket capability release mismatch");
  invariant(executionState?.currentState === ticket.currentState, "ticket current state mismatch");
  invariant(executionState?.consumedTicketIds instanceof Set, "executionState consumedTicketIds must be a Set");
  invariant(!executionState.consumedTicketIds.has(ticket.ticketId), "ticket replay rejected");
  executionState.consumedTicketIds.add(ticket.ticketId);
  executionState.currentState = ticket.targetState;
  return Object.freeze({
    schemaVersion: "ai-painter-runtime-capability-consumption-v2",
    ticketId: ticket.ticketId,
    ticketSha256: ticket.ticketSha256,
    capabilityReleaseIdentity: ticket.capabilityReleaseIdentity,
    fromState: ticket.currentState,
    toState: ticket.targetState,
    status: "consumed_once",
    resultingState: executionState.currentState,
  });
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
      decisionSetId, ruleVersion, status: "waiting_owner_decision", matchedOption: null,
      rejectedOptions: [], reason: evidenceComplete !== true ? "evidence_incomplete" : "decision_not_unique",
      evidenceReferences: canonicalize(evidenceReferences),
    });
  }
  const matchedOption = uniqueMatches[0];
  return Object.freeze({
    decisionSetId, ruleVersion, status: "uniquely_adjudicated", matchedOption,
    rejectedOptions: optionIds.filter((id) => id !== matchedOption),
    reason: "exactly_one_frozen_rule_option_matched",
    evidenceReferences: canonicalize(evidenceReferences),
  });
}
