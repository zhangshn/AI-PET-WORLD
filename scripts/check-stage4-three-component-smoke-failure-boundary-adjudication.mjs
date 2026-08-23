import fs from "node:fs"
import path from "node:path"
import { adjudicateThreeComponentSmokeFailure } from "./lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs"

function manifest(roleId, outputHash, predecessor = null) {
  return {
    status: "component_smoke_training_completed", roleId, epochCount: 30,
    metrics: Array.from({ length: 30 }, (_, index) => ({ trainingCompositeLoss: 10 - index / 10 })),
    modelStateHashes: { weightsChanged: true }, outputIdentity: { sha256: outputHash }, predecessorConsumption: predecessor,
  }
}
function review() {
  return { reviews: [1, 5, 10, 20, 30].map((epoch) => ({ epoch, professionalAesthetic: { passed: true }, conditionAlignment: { passed: false }, issueCodes: ["condition_terrain_water_spatial_distribution_mismatch", "condition_terrain_path_ground_coverage_mismatch", ...["footprints", "tree", "rock", "vegetation"].map((name) => `condition_object_${name}_reference_semantic_mismatch`)] })) }
}
function fixture() {
  const terrain = manifest("terrain_route_hydrology_spatial_realization", "terrain")
  const object = manifest("per_class_object_semantic_realization", "object", { roleId: terrain.roleId, outputIdentitySha256: "terrain" })
  const final = manifest("global_visual_harmonization_and_native_complete_rgb_decode", "final", { roleId: object.roleId, outputIdentitySha256: "object" })
  return { manifests: [terrain, object, final], review: review() }
}

const positive = [
  ["complete_exact_chain_with_persistent_semantic_failure_selects_A", () => adjudicateThreeComponentSmokeFailure(fixture()).selectedCause === "A"],
  ["explicit_wiring_defect_selects_B", () => adjudicateThreeComponentSmokeFailure({ ...fixture(), directWiringDefectEvidence: true }).selectedCause === "B"],
  ["bound_final_erasure_comparison_selects_C", () => adjudicateThreeComponentSmokeFailure({ ...fixture(), finalErasureComparisonEvidence: true }).selectedCause === "C"],
  ["fixed_parent_namespace_is_created_before_fresh_run_directory", () => { const source = fs.readFileSync(path.resolve(process.cwd(), "scripts/run-stage4-three-component-smoke-failure-boundary-adjudication.mjs"), "utf8"); return source.indexOf("fs.mkdirSync(path.dirname(output), { recursive: true })") < source.indexOf("fs.mkdirSync(output, { recursive: false })") }],
]
const negative = [
  ["broken_predecessor_hash_cannot_select_A", () => { const value = fixture(); value.manifests[1].predecessorConsumption.outputIdentitySha256 = "wrong"; return adjudicateThreeComponentSmokeFailure(value).selectedCause !== "A" }],
  ["missing_epoch_evidence_selects_D", () => { const value = fixture(); value.manifests[0].metrics.pop(); return adjudicateThreeComponentSmokeFailure(value).selectedCause === "D" }],
  ["missing_review_node_rejected", () => { const value = fixture(); value.review.reviews.pop(); try { adjudicateThreeComponentSmokeFailure(value); return false } catch { return true } }],
  ["nonpersistent_semantic_failure_cannot_select_A", () => { const value = fixture(); value.review.reviews[4].issueCodes = []; return adjudicateThreeComponentSmokeFailure(value).selectedCause !== "A" }],
  ["final_erasure_not_inferred_without_comparison", () => adjudicateThreeComponentSmokeFailure(fixture()).selectedCause !== "C"],
]
const evaluate = ([name, test]) => { try { return { name, passed: test() === true } } catch (error) { return { name, passed: false, error: String(error?.message ?? error) } } }
const positiveResults = positive.map(evaluate); const negativeResults = negative.map(evaluate)
const report = {
  schemaVersion: "stage4-three-component-smoke-failure-boundary-cpu-report-v1",
  status: [...positiveResults, ...negativeResults].every((item) => item.passed) ? "passed" : "failed_closed",
  positiveResults, negativeResults,
  positivePassed: positiveResults.filter((item) => item.passed).length, positiveTotal: positiveResults.length,
  negativePassed: negativeResults.filter((item) => item.passed).length, negativeTotal: negativeResults.length,
  checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
process.exit(report.status === "passed" ? 0 : 1)
