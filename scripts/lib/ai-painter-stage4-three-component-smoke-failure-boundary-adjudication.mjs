export const DECISIONS = Object.freeze({
  A: "three_component_responsibility_or_existing_supervision_semantically_insufficient",
  B: "predecessor_output_identity_or_component_consumption_wiring_defect",
  C: "final_visual_harmonization_erases_predecessor_spatial_or_object_semantics",
  D: "evidence_insufficient_failed_closed",
})

export function adjudicateThreeComponentSmokeFailure({ manifests, review, directWiringDefectEvidence = false, finalErasureComparisonEvidence = false }) {
  if (!Array.isArray(manifests) || manifests.length !== 3) throw new Error("exactly_three_component_manifests_required")
  if (!review || !Array.isArray(review.reviews) || review.reviews.length !== 5) throw new Error("five_fixed_review_nodes_required")
  const [terrain, object, final] = manifests
  const completed = manifests.every((item) => item.status === "component_smoke_training_completed" && item.epochCount === 30 && Array.isArray(item.metrics) && item.metrics.length === 30 && item.modelStateHashes?.weightsChanged === true)
  const lossesImproved = manifests.every((item) => Number(item.metrics.at(-1)?.trainingCompositeLoss) < Number(item.metrics[0]?.trainingCompositeLoss))
  const chainIdentityExact = object.predecessorConsumption?.roleId === terrain.roleId
    && object.predecessorConsumption?.outputIdentitySha256 === terrain.outputIdentity?.sha256
    && final.predecessorConsumption?.roleId === object.roleId
    && final.predecessorConsumption?.outputIdentitySha256 === object.outputIdentity?.sha256
  const expectedEpochs = [1, 5, 10, 20, 30]
  const fixedTimelineExact = review.reviews.every((item, index) => item.epoch === expectedEpochs[index])
  const aestheticsPassed = review.reviews.every((item) => item.professionalAesthetic?.passed === true)
  const conditionAlignmentFailed = review.reviews.every((item) => item.conditionAlignment?.passed === false)
  const persistentObjectMismatch = review.reviews.every((item) => ["footprints", "tree", "rock", "vegetation"].every((name) => item.issueCodes?.includes(`condition_object_${name}_reference_semantic_mismatch`)))
  const persistentTerrainMismatch = review.reviews.every((item) => item.issueCodes?.includes("condition_terrain_water_spatial_distribution_mismatch") && item.issueCodes?.some((code) => code.startsWith("condition_terrain_path_ground_")))

  const evidence = { completed, lossesImproved, chainIdentityExact, fixedTimelineExact, aestheticsPassed, conditionAlignmentFailed, persistentObjectMismatch, persistentTerrainMismatch, directWiringDefectEvidence, finalErasureComparisonEvidence }
  if (!completed || !fixedTimelineExact) return decision("D", evidence, "component completion or five-node identity evidence is incomplete")
  if (directWiringDefectEvidence || !chainIdentityExact) return decision("B", evidence, "predecessor output or consumption identity does not form an exact chain")
  if (finalErasureComparisonEvidence) return decision("C", evidence, "a bound before/after final-component semantic comparison proves semantic erasure")
  if (lossesImproved && aestheticsPassed && conditionAlignmentFailed && persistentObjectMismatch && persistentTerrainMismatch) {
    return decision("A", evidence, "all responsibility components trained and the evidence chain is exact, while frozen semantic alignment failures persist across every review node; no bound evidence isolates final-component erasure")
  }
  return decision("D", evidence, "available evidence does not uniquely separate semantic insufficiency from an unmeasured boundary")
}

function decision(selectedCause, evidence, rationale) {
  return { selectedCause, selectedDecision: DECISIONS[selectedCause], evidence, rationale, uniqueDecision: true }
}
