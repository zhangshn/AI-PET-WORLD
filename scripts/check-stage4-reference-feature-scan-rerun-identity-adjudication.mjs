import assert from "node:assert/strict"
import path from "node:path"
import { adjudicateExecutionIdentity, inspectAndAdjudicate } from "./lib/ai-painter-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"

const root = process.cwd()
const runner = path.resolve(root, "ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py")
const base = path.resolve(root, "ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py")
const actual = inspectAndAdjudicate(runner, base)
const positives = []
const negatives = []
const pass = (name, fn) => { fn(); positives.push(name) }
const reject = (name, fn, expected) => { assert.equal(fn(), expected); negatives.push(name) }

pass("current_source_structurally_resolves_C", () => assert.equal(actual.decision.selectedCause, "C"))
pass("same_sample_seed_latent_and_timestep_identity", () => {
  for (const name of ["sampleIdentityMatches", "sampleOrderMappingMatches", "seedMatches", "initialLatentGeneratorIdentityMatches", "timestepSequenceMatches"]) assert.equal(actual.facts.identities[name], true)
})
pass("same_eval_determinism_decode_feature_and_weighting", () => {
  for (const name of ["modelEvalStateMatches", "deterministicSettingsMatch", "autoencoderDecodeMatches", "referenceFeatureExtractionMatches", "classWeightingOrderMatches"]) assert.equal(actual.facts.identities[name], true)
})
pass("scan_is_batch4_all_no_grad", () => assert.deepEqual([actual.facts.scan.batchSize, actual.facts.scan.noGradSteps, actual.facts.scan.autogradTailSteps], [4, 50, 0]))
pass("rerun_is_batch1_five_step_autograd_tail", () => assert.deepEqual([actual.facts.rerun.batchSize, actual.facts.rerun.noGradSteps, actual.facts.rerun.autogradTailSteps], [1, 45, 5]))

const clone = () => structuredClone(actual.facts)
reject("A_when_only_batch_identity_differs", () => { const v = clone(); v.scan.autogradTailSteps = 5; return adjudicateExecutionIdentity(v).selectedCause }, "A")
reject("B_when_only_graph_identity_differs", () => { const v = clone(); v.scan.batchSize = 1; return adjudicateExecutionIdentity(v).selectedCause }, "B")
reject("D_when_seed_identity_differs", () => { const v = clone(); v.identities.seedMatches = false; return adjudicateExecutionIdentity(v).selectedCause }, "D")
reject("D_when_sample_identity_differs", () => { const v = clone(); v.identities.sampleIdentityMatches = false; return adjudicateExecutionIdentity(v).selectedCause }, "D")
reject("D_when_model_mode_differs", () => { const v = clone(); v.identities.modelEvalStateMatches = false; return adjudicateExecutionIdentity(v).selectedCause }, "D")
reject("D_when_timestep_path_differs", () => { const v = clone(); v.identities.timestepSequenceMatches = false; return adjudicateExecutionIdentity(v).selectedCause }, "D")
reject("D_when_decode_path_differs", () => { const v = clone(); v.identities.autoencoderDecodeMatches = false; return adjudicateExecutionIdentity(v).selectedCause }, "D")
reject("E_when_evidence_is_incomplete", () => adjudicateExecutionIdentity({ evidenceComplete: false }).selectedCause, "E")
reject("E_when_no_structural_difference_remains", () => { const v = clone(); v.scan.batchSize = 1; v.scan.autogradTailSteps = 5; return adjudicateExecutionIdentity(v).selectedCause }, "E")

console.log(JSON.stringify({ schemaVersion: "stage4-reference-feature-scan-rerun-identity-adjudication-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, actualDecision: actual.decision }, null, 2))

