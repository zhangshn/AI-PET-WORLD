import { createHash } from "node:crypto";

export const AUTONOMOUS_PACKAGE_DECISION_CONTRACT_ID =
  "ai-painter-autonomous-package-decision-contract-v1";

export const AUTONOMOUS_PACKAGE_STATES = Object.freeze([
  "parent_authorized_pending",
  "preflight",
  "executing",
  "validating",
  "reviewing",
  "adjudicating",
  "finalizing",
  "completed",
  "failed_closed",
  "waiting_owner_decision",
]);

export const TERMINAL_STATES = Object.freeze([
  "completed",
  "failed_closed",
  "waiting_owner_decision",
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  parent_authorized_pending: Object.freeze(["preflight", "failed_closed"]),
  preflight: Object.freeze(["preflight", "executing", "failed_closed", "waiting_owner_decision"]),
  executing: Object.freeze(["executing", "validating", "failed_closed", "waiting_owner_decision"]),
  validating: Object.freeze(["validating", "reviewing", "failed_closed", "waiting_owner_decision"]),
  reviewing: Object.freeze(["reviewing", "adjudicating", "failed_closed", "waiting_owner_decision"]),
  adjudicating: Object.freeze(["adjudicating", "finalizing", "failed_closed", "waiting_owner_decision"]),
  finalizing: Object.freeze(["finalizing", "completed", "failed_closed"]),
});

export const INTERNAL_ACTION_TARGETS = Object.freeze({
  "preflight.verify": Object.freeze(["parent_authorized_pending:preflight"]),
  "execution.observe": Object.freeze(["executing:executing"]),
  "validation.fixed_evidence": Object.freeze(["executing:validating", "validating:validating"]),
  "review.machine": Object.freeze(["validating:reviewing", "reviewing:reviewing"]),
  "adjudication.deterministic": Object.freeze(["reviewing:adjudicating", "adjudicating:adjudicating"]),
  "finalization.write": Object.freeze(["adjudicating:finalizing", "finalizing:finalizing"]),
  "terminal.complete": Object.freeze(["finalizing:completed"]),
  "terminal.fail_closed": Object.freeze([
    "parent_authorized_pending:failed_closed",
    "preflight:failed_closed",
    "executing:failed_closed",
    "validating:failed_closed",
    "reviewing:failed_closed",
    "adjudicating:failed_closed",
    "finalizing:failed_closed",
  ]),
  "governance.sync": Object.freeze([
    "preflight:preflight",
    "executing:executing",
    "validating:validating",
    "reviewing:reviewing",
    "adjudicating:adjudicating",
    "finalizing:finalizing",
  ]),
  "infrastructure.recover_pre_risk": Object.freeze(["preflight:preflight"]),
  "owner.wait": Object.freeze([
    "preflight:waiting_owner_decision",
    "executing:waiting_owner_decision",
    "validating:waiting_owner_decision",
    "reviewing:waiting_owner_decision",
    "adjudicating:waiting_owner_decision",
  ]),
});

export const OWNER_ONLY_ACTIONS = Object.freeze(new Set([
  "gpu.start_unlisted",
  "training.start_unlisted",
  "training.retry_after_risk_boundary",
  "optimizer.create_unlisted",
  "weights.modify_unlisted",
  "checkpoint.read_or_initialize_unlisted",
  "checkpoint.promote",
  "model.change",
  "loss.change",
  "data.change",
  "split.change",
  "review_threshold.change",
  "checkpoint_selection.change",
  "program_lineage.change",
  "model_family.create",
  "business_route.change",
  "evidence_source.change",
  "formal_inference.start",
  "runtime_frame.create",
  "world.enter",
]));

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/;
const SAFE_RUNTIME_NAMESPACE_PATTERN = /^\.runtime\/ai-painter\/[a-zA-Z0-9._/-]+$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Of(value) {
  return createHash("sha256").update(
    typeof value === "string" ? value : canonicalJson(value),
    "utf8",
  ).digest("hex");
}

function validateSha256(value, field) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value), `${field} must be a lowercase SHA-256`);
}

function validateSafeId(value, field) {
  invariant(typeof value === "string" && SAFE_ID_PATTERN.test(value), `${field} is invalid`);
}

function validateProgramLineage(lineage) {
  invariant(lineage && typeof lineage === "object" && !Array.isArray(lineage), "programLineage must be an object");
  const entries = Object.entries(lineage);
  invariant(entries.length > 0, "programLineage must not be empty");
  for (const [role, digest] of entries) {
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

export function validateAutonomousPackagePolicy(policy) {
  invariant(policy && typeof policy === "object", "policy is required");
  invariant(policy.contractId === AUTONOMOUS_PACKAGE_DECISION_CONTRACT_ID, "unexpected policy contractId");
  invariant(policy.status === "cpu_supported_inactive", "policy must remain cpu_supported_inactive");
  invariant(policy.authorityBoundary?.rootAuthority === "project_owner_signed_parent_package", "Owner parent authority is required");
  invariant(policy.authorityBoundary?.internalCapabilityIsOwnerAuthorization === false, "internal capability must not be Owner authorization");
  invariant(policy.authorityBoundary?.mayEscalateParentPrivilege === false, "privilege escalation must be forbidden");
  invariant(policy.authorityBoundary?.historicalPackagesMayBeUpgraded === false, "historical upgrade must be forbidden");
  invariant(policy.decisionRules?.engine === "deterministic_frozen_rule_engine", "decision engine must be deterministic");
  invariant(policy.decisionRules?.freeFormModelDecisionAllowed === false, "free-form model decisions must be forbidden");
  for (const [name, active] of Object.entries(policy.activationGates ?? {})) {
    invariant(active === false, `activation gate ${name} must be false`);
  }
  return true;
}

export function validateParentPackageBinding(parentPackage, policySha256) {
  invariant(parentPackage && typeof parentPackage === "object", "parentPackage is required");
  validateSafeId(parentPackage.packageId, "parentPackage.packageId");
  validateSha256(parentPackage.packageSha256, "parentPackage.packageSha256");
  invariant(parentPackage.ownerAuthorizationVerified === true, "Owner parent authorization must be verified");
  invariant(parentPackage.autonomousDecisionPolicy?.contractId === AUTONOMOUS_PACKAGE_DECISION_CONTRACT_ID, "parent package lacks autonomous policy binding");
  invariant(parentPackage.autonomousDecisionPolicy?.contractSha256 === policySha256, "parent package policy SHA mismatch");
  invariant(Array.isArray(parentPackage.autonomousDecisionPolicy?.allowedInternalActions), "allowedInternalActions is required");
  invariant(Number.isInteger(parentPackage.autonomousDecisionPolicy?.maxInfrastructureRecoveryAttempts), "recovery attempt limit is required");
  invariant(parentPackage.autonomousDecisionPolicy.maxInfrastructureRecoveryAttempts >= 0, "recovery attempt limit must be non-negative");
  validateProgramLineage(parentPackage.programLineage);
  invariant(typeof parentPackage.outputRoot === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(parentPackage.outputRoot), "parent outputRoot must be a project runtime namespace");
  invariant(!parentPackage.outputRoot.includes("..") && !parentPackage.outputRoot.includes("\\"), "parent outputRoot must be normalized");
  return true;
}

export function classifyActionAuthority(action, context = {}) {
  if (OWNER_ONLY_ACTIONS.has(action)) return "owner_required";
  if (!(action in INTERNAL_ACTION_TARGETS)) return "denied_unknown_action";
  if (context.programLineageChanged) return "owner_required";
  if (context.modelChanged || context.lossChanged || context.dataChanged || context.splitChanged || context.reviewThresholdChanged || context.checkpointRuleChanged) {
    return "owner_required";
  }
  if (action === "infrastructure.recover_pre_risk" && (
    context.gpuStarted || context.optimizerCreated || context.weightsModified || context.trainingStarted
  )) return "owner_required";
  return "internal_capability_allowed";
}

export function deriveInternalCapabilityTicket({
  parentPackage,
  policySha256,
  action,
  currentState,
  targetState,
  inputEvidence,
  programLineage,
  outputNamespace,
  attemptNumber = 1,
  context = {},
  issuedAt,
}) {
  validateParentPackageBinding(parentPackage, policySha256);
  invariant(classifyActionAuthority(action, context) === "internal_capability_allowed", `action ${action} requires Owner or is forbidden`);
  invariant(parentPackage.autonomousDecisionPolicy.allowedInternalActions.includes(action), `action ${action} is outside parent scope`);
  invariant(AUTONOMOUS_PACKAGE_STATES.includes(currentState), "unknown current state");
  invariant(AUTONOMOUS_PACKAGE_STATES.includes(targetState), "unknown target state");
  invariant(INTERNAL_ACTION_TARGETS[action].includes(`${currentState}:${targetState}`), `action ${action} cannot perform requested transition`);
  invariant(ALLOWED_TRANSITIONS[currentState]?.includes(targetState), "state transition is not allowed");
  validateEvidence(inputEvidence);
  validateProgramLineage(programLineage);
  invariant(canonicalJson(programLineage) === canonicalJson(parentPackage.programLineage), "program lineage differs from parent package");
  invariant(Number.isInteger(attemptNumber) && attemptNumber >= 1, "attemptNumber must be a positive integer");
  if (action === "infrastructure.recover_pre_risk") {
    invariant(attemptNumber <= parentPackage.autonomousDecisionPolicy.maxInfrastructureRecoveryAttempts, "infrastructure recovery attempt limit exceeded");
  } else {
    invariant(attemptNumber === 1, "non-recovery internal actions are single-attempt");
  }
  invariant(typeof outputNamespace === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(outputNamespace), "outputNamespace must be a project runtime namespace");
  invariant(!outputNamespace.includes("..") && !outputNamespace.includes("\\"), "outputNamespace must be normalized");
  invariant(outputNamespace.startsWith(`${parentPackage.outputRoot}/`), "outputNamespace is outside parent outputRoot");
  invariant(typeof issuedAt === "string" && !Number.isNaN(Date.parse(issuedAt)), "issuedAt must be an ISO timestamp");

  const ticketBody = {
    schemaVersion: "ai-painter-internal-capability-ticket-v1",
    ticketId: `ict-${sha256Of({ parent: parentPackage.packageId, action, currentState, targetState, inputEvidence, attemptNumber, outputNamespace }).slice(0, 24)}`,
    parentPackageId: parentPackage.packageId,
    parentPackageSha256: parentPackage.packageSha256,
    policyContractId: AUTONOMOUS_PACKAGE_DECISION_CONTRACT_ID,
    policyContractSha256: policySha256,
    action,
    currentState,
    targetState,
    inputEvidence: canonicalize(inputEvidence),
    programLineage: canonicalize(programLineage),
    outputNamespace,
    attemptNumber,
    issuedAt,
    noPrivilegeEscalation: true,
    singleUse: true,
    status: "issued_not_consumed",
  };
  return Object.freeze({ ...ticketBody, ticketSha256: sha256Of(ticketBody) });
}

export function consumeInternalCapabilityTicket(ticket, executionState) {
  invariant(ticket?.status === "issued_not_consumed", "ticket is not consumable");
  invariant(executionState?.packageId === ticket.parentPackageId, "ticket package mismatch");
  invariant(executionState?.currentState === ticket.currentState, "ticket current state mismatch");
  invariant(executionState?.consumedTicketIds instanceof Set, "executionState consumedTicketIds must be a Set");
  invariant(!executionState.consumedTicketIds.has(ticket.ticketId), "ticket replay rejected");
  executionState.consumedTicketIds.add(ticket.ticketId);
  return Object.freeze({
    schemaVersion: "ai-painter-internal-capability-consumption-v1",
    ticketId: ticket.ticketId,
    ticketSha256: ticket.ticketSha256,
    parentPackageId: ticket.parentPackageId,
    fromState: ticket.currentState,
    toState: ticket.targetState,
    status: "consumed_once",
  });
}

export function applyAutonomousStateTransition(ticket, executionState) {
  const consumption = consumeInternalCapabilityTicket(ticket, executionState);
  executionState.currentState = ticket.targetState;
  return Object.freeze({ ...consumption, resultingState: executionState.currentState });
}

export function adjudicateBoundedDecision({ decisionSetId, ruleVersion, optionIds, matchedOptionIds, evidenceReferences, evidenceComplete }) {
  validateSafeId(decisionSetId, "decisionSetId");
  validateSafeId(ruleVersion, "ruleVersion");
  invariant(Array.isArray(optionIds) && optionIds.length >= 2, "at least two bounded options are required");
  invariant(new Set(optionIds).size === optionIds.length, "decision options must be unique");
  invariant(Array.isArray(matchedOptionIds), "matchedOptionIds must be an array");
  validateEvidence(evidenceReferences);
  const unknownMatches = matchedOptionIds.filter((id) => !optionIds.includes(id));
  invariant(unknownMatches.length === 0, "matched option is outside bounded decision set");
  const uniqueMatches = [...new Set(matchedOptionIds)];
  if (evidenceComplete !== true || uniqueMatches.length !== 1) {
    return Object.freeze({
      decisionSetId,
      ruleVersion,
      status: "waiting_owner_decision",
      matchedOption: null,
      rejectedOptions: [],
      reason: evidenceComplete !== true ? "evidence_incomplete" : "decision_not_unique",
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
    evidenceReferences: canonicalize(evidenceReferences),
  });
}
