import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adjudicateBoundedDecision,
  applyAutonomousStateTransition,
  classifyActionAuthority,
  deriveInternalCapabilityTicket,
  sha256Of,
  validateAutonomousPackagePolicy,
  validateParentPackageBinding,
} from "./lib/ai-painter-autonomous-package-decision-core.mjs";

const contractPath = new URL("../data/ai-painter/system-governance/ai-painter-autonomous-package-decision-contract-v1.json", import.meta.url);
const contractText = await readFile(contractPath, "utf8");
const contract = JSON.parse(contractText);
const contractSha256 = sha256Of(contractText);
const digest = (label) => sha256Of(label);
const evidence = [{ path: ".runtime/ai-painter/test/evidence.json", sha256: digest("evidence") }];
const programLineage = { runner: digest("runner"), checker: digest("checker") };
const parentPackage = {
  packageId: "owner-package-cpu-fixture-001",
  packageSha256: digest("parent-package"),
  ownerAuthorizationVerified: true,
  autonomousDecisionPolicy: {
    contractId: contract.contractId,
    contractSha256,
    allowedInternalActions: [...contract.internalActionClasses],
    maxInfrastructureRecoveryAttempts: 2,
  },
  programLineage,
  outputRoot: ".runtime/ai-painter/autonomous-package-executions/owner-package-cpu-fixture-001",
};

let positive = 0;
let negative = 0;
const pass = (fn) => { fn(); positive += 1; };
const reject = (fn, pattern) => {
  assert.throws(fn, pattern);
  negative += 1;
};

pass(() => assert.equal(validateAutonomousPackagePolicy(contract), true));
pass(() => assert.equal(validateParentPackageBinding(parentPackage, contractSha256), true));
pass(() => assert.equal(classifyActionAuthority("review.machine"), "internal_capability_allowed"));
pass(() => assert.equal(classifyActionAuthority("training.retry_after_risk_boundary"), "owner_required"));
pass(() => assert.equal(classifyActionAuthority("unknown.free.action"), "denied_unknown_action"));

const preflightTicket = deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "preflight.verify",
  currentState: "parent_authorized_pending",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/preflight-001`,
  issuedAt: "2026-08-24T04:40:01+08:00",
});
pass(() => assert.equal(preflightTicket.noPrivilegeEscalation, true));
pass(() => assert.equal(preflightTicket.singleUse, true));

const state = {
  packageId: parentPackage.packageId,
  currentState: "parent_authorized_pending",
  consumedTicketIds: new Set(),
};
pass(() => assert.equal(applyAutonomousStateTransition(preflightTicket, state).resultingState, "preflight"));
reject(() => applyAutonomousStateTransition(preflightTicket, state), /not consumable|current state mismatch|replay/);

const recoveryTicket = deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "infrastructure.recover_pre_risk",
  currentState: "preflight",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/recovery-001`,
  attemptNumber: 2,
  context: { gpuStarted: false, optimizerCreated: false, weightsModified: false, trainingStarted: false },
  issuedAt: "2026-08-24T04:40:02+08:00",
});
pass(() => assert.equal(recoveryTicket.attemptNumber, 2));

const decision = adjudicateBoundedDecision({
  decisionSetId: "stage4_failure_boundary_v1",
  ruleVersion: "frozen_rules_v1",
  optionIds: ["wiring_defect", "visual_failure", "owner_required"],
  matchedOptionIds: ["visual_failure"],
  evidenceReferences: evidence,
  evidenceComplete: true,
});
pass(() => assert.equal(decision.matchedOption, "visual_failure"));
pass(() => assert.deepEqual(decision.rejectedOptions, ["wiring_defect", "owner_required"]));
pass(() => assert.equal(adjudicateBoundedDecision({
  decisionSetId: "stage4_failure_boundary_v1",
  ruleVersion: "frozen_rules_v1",
  optionIds: ["a", "b"],
  matchedOptionIds: ["a", "b"],
  evidenceReferences: evidence,
  evidenceComplete: true,
}).status, "waiting_owner_decision"));
pass(() => assert.equal(adjudicateBoundedDecision({
  decisionSetId: "stage4_failure_boundary_v1",
  ruleVersion: "frozen_rules_v1",
  optionIds: ["a", "b"],
  matchedOptionIds: ["a"],
  evidenceReferences: evidence,
  evidenceComplete: false,
}).reason, "evidence_incomplete"));

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "training.retry_after_risk_boundary",
  currentState: "preflight",
  targetState: "executing",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/forbidden-training`,
  issuedAt: "2026-08-24T04:40:03+08:00",
}), /requires Owner|forbidden/);

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "infrastructure.recover_pre_risk",
  currentState: "preflight",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/risk-crossed`,
  context: { trainingStarted: true },
  issuedAt: "2026-08-24T04:40:04+08:00",
}), /requires Owner|forbidden/);

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "infrastructure.recover_pre_risk",
  currentState: "preflight",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/too-many-attempts`,
  attemptNumber: 3,
  issuedAt: "2026-08-24T04:40:05+08:00",
}), /attempt limit exceeded/);

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "review.machine",
  currentState: "preflight",
  targetState: "reviewing",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: `${parentPackage.outputRoot}/state-jump`,
  issuedAt: "2026-08-24T04:40:06+08:00",
}), /cannot perform requested transition/);

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "preflight.verify",
  currentState: "parent_authorized_pending",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage: { ...programLineage, runner: digest("changed-runner") },
  outputNamespace: `${parentPackage.outputRoot}/lineage-change`,
  issuedAt: "2026-08-24T04:40:07+08:00",
}), /program lineage differs/);

reject(() => validateParentPackageBinding({
  ...parentPackage,
  autonomousDecisionPolicy: undefined,
}, contractSha256), /lacks autonomous policy binding/);

reject(() => deriveInternalCapabilityTicket({
  parentPackage,
  policySha256: contractSha256,
  action: "preflight.verify",
  currentState: "parent_authorized_pending",
  targetState: "preflight",
  inputEvidence: evidence,
  programLineage,
  outputNamespace: ".runtime/ai-painter/other-package/output",
  issuedAt: "2026-08-24T04:40:08+08:00",
}), /outside parent outputRoot/);

reject(() => adjudicateBoundedDecision({
  decisionSetId: "stage4_failure_boundary_v1",
  ruleVersion: "frozen_rules_v1",
  optionIds: ["a", "b"],
  matchedOptionIds: ["free_form_c"],
  evidenceReferences: evidence,
  evidenceComplete: true,
}), /outside bounded decision set/);

assert.equal(contract.activationGates.trainingNow, false);
assert.equal(contract.activationGates.gpuNow, false);
assert.equal(contract.activationGates.backwardNow, false);
console.log(`AI Painter autonomous package decision CPU checks passed: positive=${positive}, negative=${negative}, status=${contract.status}`);
