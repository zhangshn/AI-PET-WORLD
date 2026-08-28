import assert from "node:assert/strict";
import { adjudicatePostCarrierBoundedCandidate } from "./lib/ai-painter-stage4-post-carrier-bounded-recalculation-v1.mjs";

const priorEvidence = () => ({
  original64: { schemaVersion: "stage4-original-64-contract-correction-terminal-v1", status: "stage4_original_64_contract_satisfied_sufficiency_undefined_closed", selectedDecision: "original_64_contract_did_not_define_stage4_sufficiency", original64ContractSatisfied: true, dataDefectProven: false },
  autoencoder: { schemaVersion: "stage4-frozen-autoencoder-semantic-retention-terminal-v1", status: "stage4_frozen_autoencoder_semantic_retention_sufficient_closed", selectedDecision: "frozen_autoencoder_semantic_retention_sufficient", autoencoderStateUnchanged: true },
  conditionFusion: { schemaVersion: "stage4-condition-fusion-stage0-final-route-terminal-v1", status: "condition_fusion_multisample_semantic_capacity_insufficient_confirmed", selectedCause: "C" },
  capacity: { schemaVersion: "stage4-capacity-route-exit-project-route-decision-terminal-v1", status: "capacity_structure_route_exited_project_level_owner_decision_required" },
  threeComponent: { schemaVersion: "stage4-three-component-smoke-failure-boundary-terminal-v2", executionState: "completed", status: "three_component_smoke_failure_boundary_adjudicated", selectedCause: "A", gpuStarted: false, trainingStarted: false },
});
const carrierTerminal = () => ({ schemaVersion: "stage4-authoritative-semantic-carrier-stage0-failure-adjudication-terminal-v1", executionState: "completed", status: "stage0_real_visual_failure_adjudicated_closed", capabilityVersion: "stage4-test-carrier", classification: "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed", ownerAuthorizationRequired: false });
const carrierDecision = () => ({ schemaVersion: "stage4-authoritative-semantic-carrier-stage0-failure-decision-v1", status: "unique_decision_formed", classification: "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed", currentCandidateRejected: true, automaticRetryStarted: false });
const lifecycleState = () => ({ schemaVersion: "ai-painter-capability-lifecycle-state-v1", capabilityVersion: "stage4-test-carrier", state: "rejected", ownerAuthorizationRequired: false, ownerResponseRequired: false });
const uniqueDerivationRules = () => ({ schemaVersion: "stage4-controlled-structure-unique-derivation-rules-v1", status: "cpu_verified_inactive_materializable", conditionFusionOnly: { freeParameterCount: 0 }, capacityOnly: { freeParameterCount: 0 }, freeParameterCount: 0 });
const input = () => ({ priorEvidence: priorEvidence(), carrierTerminal: carrierTerminal(), carrierDecision: carrierDecision(), lifecycleState: lifecycleState(), uniqueDerivationRules: uniqueDerivationRules() });
const fails = (mutate) => { const value = input(); mutate(value); try { adjudicatePostCarrierBoundedCandidate(value); return false; } catch { return true; } };

const result = adjudicatePostCarrierBoundedCandidate(input());
const positive = [
  result.selectedOutcome === "no_unique_bounded_candidate_remaining",
  result.status === "failed_closed_candidate_space_exhausted",
  result.exhaustedRoutes.length === 4,
  result.ownerAuthorizationRequired === false,
  result.ownerResponseRequired === false,
  result.gpuAllowed === false,
  result.trainingAllowed === false,
];
const negative = [
  fails((v) => { v.carrierTerminal.classification = "different"; }),
  fails((v) => { v.carrierDecision.currentCandidateRejected = false; }),
  fails((v) => { v.carrierDecision.automaticRetryStarted = true; }),
  fails((v) => { v.lifecycleState.state = "released"; }),
  fails((v) => { v.lifecycleState.capabilityVersion = "other"; }),
  fails((v) => { v.lifecycleState.ownerResponseRequired = true; }),
  fails((v) => { v.uniqueDerivationRules.freeParameterCount = 1; }),
  fails((v) => { delete v.priorEvidence.autoencoder; }),
];
assert.ok(positive.every(Boolean), "positive post-carrier recalculation regression failed");
assert.ok(negative.every(Boolean), "negative post-carrier recalculation regression failed");
process.stdout.write(`${JSON.stringify({ status: "passed", positivePassed: positive.length, positiveTotal: positive.length, negativePassed: negative.length, negativeTotal: negative.length }, null, 2)}\n`);

