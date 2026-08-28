import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adjudicateStage4BoundedCandidate, buildStage4CapabilityCandidate, materializeStage4BoundedCandidate } from "./lib/ai-painter-stage4-bounded-candidate-planner-v1.mjs";

const evidence = () => ({
  original64: { schemaVersion: "stage4-original-64-contract-correction-terminal-v1", status: "stage4_original_64_contract_satisfied_sufficiency_undefined_closed", selectedDecision: "original_64_contract_did_not_define_stage4_sufficiency", original64ContractSatisfied: true, dataDefectProven: false },
  autoencoder: { schemaVersion: "stage4-frozen-autoencoder-semantic-retention-terminal-v1", status: "stage4_frozen_autoencoder_semantic_retention_sufficient_closed", selectedDecision: "frozen_autoencoder_semantic_retention_sufficient", autoencoderStateUnchanged: true },
  conditionFusion: { schemaVersion: "stage4-condition-fusion-stage0-final-route-terminal-v1", status: "condition_fusion_multisample_semantic_capacity_insufficient_confirmed", selectedCause: "C" },
  capacity: { schemaVersion: "stage4-capacity-route-exit-project-route-decision-terminal-v1", status: "capacity_structure_route_exited_project_level_owner_decision_required" },
  threeComponent: { schemaVersion: "stage4-three-component-smoke-failure-boundary-terminal-v2", executionState: "completed", status: "three_component_smoke_failure_boundary_adjudicated", selectedCause: "A", gpuStarted: false, trainingStarted: false },
});
const expectFailure = (action) => { try { action(); return false; } catch { return true; } };
const clone = (value) => structuredClone(value);
const positive = [
  ["five_exact_terminals_select_model_family", () => adjudicateStage4BoundedCandidate(evidence()).selectedOption === "bounded_new_model_family_design_candidate"],
  ["minimum_change_axis_is_model_family", () => adjudicateStage4BoundedCandidate(evidence()).changeClass === "model_family"],
  ["next_action_is_cpu_isolated_design", () => adjudicateStage4BoundedCandidate(evidence()).nextLifecycleAction === "local_ai_execute_isolated_model_family_design"],
  ["candidate_has_no_human_gate", () => { const c = buildStage4CapabilityCandidate({ capabilityVersion: "stage4-bounded-test-candidate", sourceEvidence: [{ role: "x", path: "x", sha256: "a".repeat(64) }], adjudication: adjudicateStage4BoundedCandidate(evidence()) }); return c.ownerAuthorizationRequired === false && c.ownerInLifecycle === false; }],
  ["candidate_is_cpu_design_only", () => { const c = buildStage4CapabilityCandidate({ capabilityVersion: "stage4-bounded-test-candidate", sourceEvidence: [], adjudication: adjudicateStage4BoundedCandidate(evidence()) }); return c.scope.phase === "cpu_design_only" && Object.entries(c.scope).filter(([key]) => key.endsWith("Allowed")).every(([, value]) => value === false); }],
  ["business_and_data_boundary_frozen", () => { const c = buildStage4CapabilityCandidate({ capabilityVersion: "stage4-bounded-test-candidate", sourceEvidence: [], adjudication: adjudicateStage4BoundedCandidate(evidence()) }); return c.frozenBusinessAndDataBoundary.approvedSampleCount === 64 && c.frozenBusinessAndDataBoundary.conditionChannelCount === 23 && c.frozenBusinessAndDataBoundary.machineReviewThresholdsUnchanged; }],
];
const negative = [
  ["missing_autoencoder_evidence_rejected", () => { const v = evidence(); delete v.autoencoder; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["proven_data_defect_rejected", () => { const v = evidence(); v.original64.dataDefectProven = true; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["autoencoder_gap_rejected", () => { const v = evidence(); v.autoencoder.selectedDecision = "frozen_autoencoder_semantic_retention_gap_confirmed"; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["condition_route_not_exited_rejected", () => { const v = evidence(); v.conditionFusion.status = "running"; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["capacity_route_not_exited_rejected", () => { const v = evidence(); v.capacity.status = "running"; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["three_component_non_A_rejected", () => { const v = evidence(); v.threeComponent.selectedCause = "B"; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["causal_gpu_start_rejected", () => { const v = evidence(); v.threeComponent.gpuStarted = true; return expectFailure(() => adjudicateStage4BoundedCandidate(v)); }],
  ["free_architecture_field_rejected", () => expectFailure(() => buildStage4CapabilityCandidate({ capabilityVersion: "bad", sourceEvidence: [], adjudication: adjudicateStage4BoundedCandidate(evidence()) }))],
];

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-stage4-candidate-"));
fs.mkdirSync(path.join(root, "data/ai-painter/system-governance"), { recursive: true });
fs.copyFileSync(path.resolve("data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json"), path.join(root, "data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json"));
const bindings = [];
for (const [role, body] of Object.entries(evidence())) { const relative = `fixtures/${role}.json`; const absolute = path.join(root, relative); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, `${JSON.stringify(body, null, 2)}\n`); bindings.push({ role, path: relative, sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") }); }
const wrongHashRejected = expectFailure(() => materializeStage4BoundedCandidate({ root, capabilityVersion: "stage4-wrong-hash-candidate", sourceEvidence: bindings.map((item, index) => index === 0 ? { ...item, sha256: "0".repeat(64) } : item) }));
negative.push(["wrong_sha256_rejected", () => wrongHashRejected]);

const evaluate = ([name, test]) => { try { return { name, passed: test() === true }; } catch (error) { return { name, passed: false, error: String(error?.message ?? error) }; } };
const positiveResults = positive.map(evaluate);
const negativeResults = negative.map(evaluate);
const all = [...positiveResults, ...negativeResults];
const report = { schemaVersion: "stage4-bounded-candidate-planner-cpu-report-v1", status: all.every((item) => item.passed) ? "passed" : "failed_closed", positiveResults, negativeResults, positivePassed: positiveResults.filter((item) => item.passed).length, positiveTotal: positiveResults.length, negativePassed: negativeResults.filter((item) => item.passed).length, negativeTotal: negativeResults.length, ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: new Date().toISOString() };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.status === "passed" ? 0 : 1);

