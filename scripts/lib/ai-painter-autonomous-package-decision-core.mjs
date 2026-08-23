import { createHash } from "node:crypto";

export const RUNTIME_AUTONOMY_CONTRACT_ID = "ai-painter-capability-runtime-autonomy-contract-v2";

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

function invariant(condition, message) { if (!condition) throw new Error(message); }

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }

export function sha256Of(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value), "utf8").digest("hex");
}

function validateSha256(value, field) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value), `${field} must be a lowercase SHA-256`);
}

function validateSafeId(value, field) {
  invariant(typeof value === "string" && SAFE_ID_PATTERN.test(value), `${field} is invalid`);
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
    invariant(typeof evidence.path === "string" && evidence.path.length > 0, "evidence path is required");
    invariant(!evidence.path.includes("..") && !/^[a-zA-Z]:[\\/]/.test(evidence.path), "evidence path must be project-relative without parent traversal");
    validateSha256(evidence.sha256, "evidence sha256");
    const identity = `${evidence.path}\u0000${evidence.sha256}`;
    invariant(!identities.has(identity), "duplicate evidence identity");
    identities.add(identity);
  }
}

export function validateRuntimeAutonomyPolicy(policy) {
  invariant(policy?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "unexpected policy contractId");
  invariant(policy?.status === "active_released_capability_runtime_policy", "runtime policy is not active");
  invariant(policy?.authorityBoundary?.rootAuthority === "released_capability_identity", "released capability authority is required");
  invariant(policy?.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCandidateOwnerReviewRequired === false, "per-candidate Owner review must be false");
  invariant(policy?.authorityBoundary?.mayEscalateReleasedCapabilityPrivilege === false, "capability privilege escalation must be forbidden");
  invariant(policy?.authorityBoundary?.codexIsRequiredAtRuntime === false, "Codex must not be a runtime dependency");
  invariant(policy?.decisionRules?.engine === "deterministic_frozen_rule_engine", "decision engine must be deterministic");
  invariant(policy?.decisionRules?.freeFormModelDecisionAllowed === false, "free-form model decisions must be forbidden");
  for (const action of ["formal_inference.start", "runtime_frame.create", "world.enter"]) {
    invariant(policy.internalActionClasses?.includes(action), `${action} must be an internal released-capability action`);
    invariant(!policy.capabilityChangeRequiredActionClasses?.includes(action), `${action} must not require a per-task capability change`);
  }
  return true;
}

export function validateReleasedCapabilityBinding(release, policySha256) {
  invariant(release && typeof release === "object", "capability release is required");
  validateSafeId(release.capabilityReleaseIdentity, "capabilityReleaseIdentity");
  validateSha256(release.capabilityReleaseSha256, "capabilityReleaseSha256");
  invariant(release.capabilityReleaseVerified === true, "capability release must be verified");
  invariant(release.runtimeAutonomyPolicy?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "capability release lacks runtime policy binding");
  invariant(release.runtimeAutonomyPolicy?.contractSha256 === policySha256, "runtime policy SHA mismatch");
  invariant(Array.isArray(release.runtimeAutonomyPolicy?.allowedInternalActions), "allowedInternalActions is required");
  invariant(Number.isInteger(release.runtimeAutonomyPolicy?.maxInfrastructureRecoveryAttempts), "recovery attempt limit is required");
  invariant(release.runtimeAutonomyPolicy.maxInfrastructureRecoveryAttempts >= 0, "recovery attempt limit must be non-negative");
  validateProgramLineage(release.programLineage);
  invariant(typeof release.outputRoot === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(release.outputRoot), "outputRoot must be a project runtime namespace");
  invariant(!release.outputRoot.includes("..") && !release.outputRoot.includes("\\"), "outputRoot must be normalized");
  return true;
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
  capabilityRelease, policySha256, action, currentState, targetState, inputEvidence,
  programLineage, outputNamespace, attemptNumber = 1, context = {}, issuedAt,
}) {
  validateReleasedCapabilityBinding(capabilityRelease, policySha256);
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
    capabilityReleaseSha256: capabilityRelease.capabilityReleaseSha256,
    policyContractId: RUNTIME_AUTONOMY_CONTRACT_ID,
    policyContractSha256: policySha256,
    action, currentState, targetState,
    inputEvidence: canonicalize(inputEvidence),
    programLineage: canonicalize(programLineage),
    outputNamespace, attemptNumber, issuedAt,
    noPrivilegeEscalation: true,
    singleUse: true,
    status: "issued_not_consumed",
  };
  return { ...ticketBody, ticketSha256: sha256Of(ticketBody) };
}

export function applyRuntimeStateTransition(ticket, executionState) {
  invariant(ticket?.status === "issued_not_consumed", "ticket is not consumable");
  invariant(executionState?.capabilityReleaseIdentity === ticket.capabilityReleaseIdentity, "ticket capability release mismatch");
  invariant(executionState?.currentState === ticket.currentState, "ticket current state mismatch");
  invariant(executionState?.consumedTicketIds instanceof Set, "executionState consumedTicketIds must be a Set");
  invariant(!executionState.consumedTicketIds.has(ticket.ticketId), "ticket replay rejected");
  executionState.consumedTicketIds.add(ticket.ticketId);
  executionState.currentState = ticket.targetState;
  ticket.status = "consumed_once";
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
