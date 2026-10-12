import assert from "node:assert/strict"
import test from "node:test"

import { validateDryReviewLineage } from
  "../run-ai-painter-mvp256-dry-v24-independent-audit.mjs"

const binding = name => ({ path: `evidence/${name}`, sha256: "a".repeat(64) })
const good = () => {
  const contractBinding = binding("candidate.json")
  const conditionPack = binding("condition-pack.json")
  const referenceRgb = binding("original.png")
  const selected = binding("epoch-24.pt")
  const numeric = binding("numeric.json")
  const detail = binding("detail.json")
  const workerTerminal = binding("worker.json")
  const trainingTerminal = binding("training.json")
  const archive = binding("roles.zlib")
  const manifest = {
    schemaVersion: "ai-painter-mvp256-dry-v24-candidate-manifest-v1",
    status: "candidate_materialized_review_pending",
    capabilityVersion: "stage4_mvp256_dry_v24_closed_loop_candidate_v1",
    inputPath: "evidence/candidate-manifest.json",
    runId: "new-run", packageId: "new-package", candidateContract: contractBinding,
    executionPackage: binding("execution-package.json"), workerTerminal, trainingTerminal,
    datasetManifest: binding("dataset.json"), selectedCheckpoint: selected,
    selectedEpoch: 24, selectedRank: [0.1, -0.2, -24],
    subject: { sampleId: "slot-189", split: "validation", worldId: "world",
      regionId: "region", tick: 0, factHash: "fact", conditionPack, referenceRgb },
    candidate: { sampleId: "slot-189", split: "validation", resolution: [256, 192],
      rgb: binding("generated.png"), sourceCheckpointSha256: selected.sha256 },
    modelStateSha256Before: "model", modelStateSha256After: "model",
    responsibility: { archive, evidence: { tensorArchive: archive } },
  }
  return {
    manifest, contract: { binding: contractBinding,
      value: { review: { candidateCount: 1 }, activation: { reviewExecutionAllowed: false },
        frozenBindings: { numericReview: numeric, detailReview: detail } } },
    execution: { runId: "new-run", packageId: "new-package",
      capabilityVersion: manifest.capabilityVersion, candidateContract: contractBinding,
      datasetManifest: manifest.datasetManifest,
      execution: { reviewPlan: { boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false,
        runtimePublicationAllowed: false, numericThresholdContract: numeric,
        detailThresholdContract: detail } } },
    worker: { runId: "new-run", packageId: "new-package",
      status: "training_completed_review_pending", optimizerStepsGenerator: 2304,
      optimizerStepsDiscriminator: 2304, checkpointReloadVerified: true,
      selectedCheckpoint: selected, selectedEpoch: 24,
      selectedRank: [0.1, -0.2, -24], checkpointPromotable: false },
    registry: { activeExecution: null,
      latestTrainingTerminal: { runId: "new-run", ...trainingTerminal } },
    dataset: { splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 } },
    source: { samples: [{ sampleId: "slot-189", split: "validation", image: referenceRgb }] },
    dryScope: { preselectedSubject: { sampleId: "slot-189", worldId: "world",
      regionId: "region", tick: 0, factHash: "fact", conditionPack } },
    checkpoint: { binding: selected },
    inputBinding: { path: manifest.inputPath, sha256: "a".repeat(64) },
  }
}

test("one immutable selected candidate can enter non-formal review", () => {
  const value = validateDryReviewLineage(good())
  assert.equal(value.stage4Advanced, false)
  assert.equal(value.selectedEpoch, 24)
})

test("run, checkpoint, facts and review plan cannot drift", () => {
  for (const mutate of [
    x => { x.manifest.selectedCheckpoint = binding("other.pt") },
    x => { x.worker.selectedEpoch = 36 },
    x => { x.worker.optimizerStepsGenerator = 2303 },
    x => { x.worker.checkpointPromotable = true },
    x => { x.registry.activeExecution = {} },
    x => { x.registry.latestTrainingTerminal.runId = "old-run" },
    x => { x.manifest.subject.factHash = "other" },
    x => { x.manifest.subject.referenceRgb = binding("wrong-original.png") },
    x => { x.manifest.candidate.resolution = [1024, 768] },
    x => { x.execution.execution.reviewPlan.runtimePublicationAllowed = true },
  ]) {
    const value = good()
    mutate(value)
    assert.throws(() => validateDryReviewLineage(value))
  }
})
