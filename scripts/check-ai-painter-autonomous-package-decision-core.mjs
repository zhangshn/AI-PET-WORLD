import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adjudicateBoundedDecision,
  applyRuntimeStateTransition,
  classifyActionAuthority,
  deriveRuntimeCapabilityTicket,
  sha256Of,
  validateReleasedCapabilityBinding,
  validateRuntimeAutonomyPolicy,
} from "./lib/ai-painter-autonomous-package-decision-core.mjs";

const contractPath = new URL("../data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json", import.meta.url);
const contractText = await readFile(contractPath, "utf8");
const contract = JSON.parse(contractText);
const contractSha256 = sha256Of(contractText);
const digest = (label) => sha256Of(label);
const evidence = [{ path: ".runtime/ai-painter/test/evidence.json", sha256: digest("evidence") }];
const programLineage = { runner: digest("runner"), checker: digest("checker") };
const capabilityRelease = {
  capabilityReleaseIdentity: "ai-painter-capability-release-fixture-001",
  capabilityReleaseSha256: digest("capability-release"),
  capabilityReleaseVerified: true,
  runtimeAutonomyPolicy: {
    contractId: contract.contractId,
    contractSha256,
    allowedInternalActions: [...contract.internalActionClasses],
    maxInfrastructureRecoveryAttempts: 2,
  },
  programLineage,
  outputRoot: ".runtime/ai-painter/capability-runtime-executions/ai-painter-capability-release-fixture-001",
};

let positive = 0;
let negative = 0;
const pass = (fn) => { fn(); positive += 1; };
const reject = (fn, pattern) => { assert.throws(fn, pattern); negative += 1; };

pass(() => assert.equal(validateRuntimeAutonomyPolicy(contract), true));
pass(() => assert.equal(validateReleasedCapabilityBinding(capabilityRelease, contractSha256), true));
for (const action of ["formal_inference.start", "review.machine", "runtime_frame.create", "world.enter"]) {
  pass(() => assert.equal(classifyActionAuthority(action), "released_capability_internal_action"));
}
for (const action of ["training.start_or_retry", "model.change", "review_threshold.change", "runtime_interface.change"]) {
  pass(() => assert.equal(classifyActionAuthority(action), "capability_change_required"));
}
pass(() => assert.equal(classifyActionAuthority("unknown.free.action"), "denied_unknown_action"));

const preflightTicket = deriveRuntimeCapabilityTicket({
  capabilityRelease,
  policySha256: contractSha256,
  action: "preflight.verify",
  currentState: "capability_release_bound",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${capabilityRelease.outputRoot}/preflight-001`,
  issuedAt: "2026-08-24T06:30:01+08:00",
});
pass(() => assert.equal(preflightTicket.noPrivilegeEscalation, true));
pass(() => assert.equal(preflightTicket.singleUse, true));

const state = {
  capabilityReleaseIdentity: capabilityRelease.capabilityReleaseIdentity,
  currentState: "capability_release_bound",
  consumedTicketIds: new Set(),
};
pass(() => assert.equal(applyRuntimeStateTransition(preflightTicket, state).resultingState, "preflight"));
reject(() => applyRuntimeStateTransition(preflightTicket, state), /not consumable|current state mismatch|replay/);

const inferenceTicket = deriveRuntimeCapabilityTicket({
  capabilityRelease,
  policySha256: contractSha256,
  action: "formal_inference.start",
  currentState: "preflight",
  targetState: "generating",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${capabilityRelease.outputRoot}/candidate-001`,
  issuedAt: "2026-08-24T06:30:02+08:00",
});
pass(() => assert.equal(inferenceTicket.action, "formal_inference.start"));

const runtimeFrameTicket = deriveRuntimeCapabilityTicket({
  capabilityRelease,
  policySha256: contractSha256,
  action: "runtime_frame.create",
  currentState: "adjudicating",
  targetState: "publishing",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${capabilityRelease.outputRoot}/candidate-001/runtime-frame`,
  issuedAt: "2026-08-24T06:30:03+08:00",
});
pass(() => assert.equal(runtimeFrameTicket.action, "runtime_frame.create"));

const decision = adjudicateBoundedDecision({
  decisionSetId: "runtime_candidate_review_v2",
  ruleVersion: "frozen_rules_v2",
  optionIds: ["publish", "fail_closed", "owner_required"],
  matchedOptionIds: ["publish"],
  evidenceReferences: evidence,
  evidenceComplete: true,
});
pass(() => assert.equal(decision.matchedOption, "publish"));
pass(() => assert.equal(adjudicateBoundedDecision({
  decisionSetId: "runtime_candidate_review_v2",
  ruleVersion: "frozen_rules_v2",
  optionIds: ["a", "b"],
  matchedOptionIds: ["a", "b"],
  evidenceReferences: evidence,
  evidenceComplete: true,
}).status, "waiting_owner_decision"));

reject(() => deriveRuntimeCapabilityTicket({
  capabilityRelease,
  policySha256: contractSha256,
  action: "model.change",
  currentState: "preflight",
  targetState: "generating",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${capabilityRelease.outputRoot}/forbidden-model-change`,
  issuedAt: "2026-08-24T06:30:04+08:00",
}), /requires capability change|forbidden/);

reject(() => validateReleasedCapabilityBinding({
  ...capabilityRelease,
  capabilityReleaseVerified: false,
}, contractSha256), /must be verified/);

reject(() => validateRuntimeAutonomyPolicy({
  ...contract,
  authorityBoundary: { ...contract.authorityBoundary, perTaskOwnerAuthorizationRequired: true },
}), /per-task Owner authorization/);

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_capability_runtime_autonomy_check_passed",
  contractId: contract.contractId,
  positive,
  negative,
  perTaskOwnerAuthorizationRequired: contract.authorityBoundary.perTaskOwnerAuthorizationRequired,
  runtimeActionsInternal: ["formal_inference.start", "runtime_frame.create", "world.enter"],
}, null, 2));
