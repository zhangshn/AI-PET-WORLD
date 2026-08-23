import { adjudicateMultisampleCapacityGradientInterference, DECISION_A, DECISION_B, DECISION_C, DECISION_D } from "./lib/ai-painter-stage4-multisample-capacity-gradient-interference.mjs"

const classes = ["footprints", "tree", "rock", "vegetation"]
const fixture = () => ({
  status: "current_model_multisample_capacity_gradient_interference_gpu_diagnostic_completed",
  population: { train: 48, validation: 8 }, classIdentityOrder: classes,
  sourceOrderPreserved: true, conditionChannelCount: 23,
  sampleDiagnostics: Array.from({ length: 56 }, (_, index) => ({ sampleId: `sample-${index}`, conditionRepresentationFinite: true, finalRgbFinite: true, classDiagnostics: classes.map((classIdentity) => ({ classIdentity, gradientFinite: true, sharedFinalPathGradientNonZero: true, ownConditionChannelReachesFinalPath: true })) })),
  capacityEvidence: { exactConditionRepresentationCollisionCount: 0, exactFinalRgbCollisionCount: 0 },
  interferenceEvidence: { train: { negativePairCount: 1, crossClassNegativePairCount: 1 }, validation: { negativePairCount: 1, crossClassNegativePairCount: 1 } },
  stateHashes: { denoiserUnchanged: true, autoencoderUnchanged: true },
  safety: { optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, trainingStarted: false, denoiserCheckpointRead: false },
})
const positives = [
  ["interference_only", (v) => v, DECISION_B],
  ["capacity_only", (v) => { v.capacityEvidence.exactConditionRepresentationCollisionCount = 1; v.interferenceEvidence.validation.negativePairCount = 0; return v }, DECISION_A],
  ["joint", (v) => { v.capacityEvidence.exactFinalRgbCollisionCount = 1; return v }, DECISION_C],
  ["insufficient", (v) => { v.interferenceEvidence.train.negativePairCount = 0; return v }, DECISION_D],
].map(([name, mutate, expected]) => ({ name, passed: adjudicateMultisampleCapacityGradientInterference(mutate(fixture())).selectedDecision === expected }))
const negativeMutations = [
  ["record_count", (v) => v.sampleDiagnostics.pop()], ["duplicate", (v) => { v.sampleDiagnostics[1].sampleId = v.sampleDiagnostics[0].sampleId }],
  ["split", (v) => { v.population.train = 47 }], ["class_order", (v) => v.classIdentityOrder.reverse()],
  ["source_order", (v) => { v.sourceOrderPreserved = false }], ["channels", (v) => { v.conditionChannelCount = 22 }],
  ["class_count", (v) => v.sampleDiagnostics[0].classDiagnostics.pop()], ["representation_nonfinite", (v) => { v.sampleDiagnostics[0].conditionRepresentationFinite = false }],
  ["rgb_nonfinite", (v) => { v.sampleDiagnostics[0].finalRgbFinite = false }], ["gradient_nonfinite", (v) => { v.sampleDiagnostics[0].classDiagnostics[0].gradientFinite = false }],
  ["gradient_zero", (v) => { v.sampleDiagnostics[0].classDiagnostics[0].sharedFinalPathGradientNonZero = false }], ["condition_unreached", (v) => { v.sampleDiagnostics[0].classDiagnostics[0].ownConditionChannelReachesFinalPath = false }],
  ["denoiser_changed", (v) => { v.stateHashes.denoiserUnchanged = false }], ["autoencoder_changed", (v) => { v.stateHashes.autoencoderUnchanged = false }],
  ["optimizer", (v) => { v.safety.optimizerCreated = true }], ["backward", (v) => { v.safety.backwardExecuted = true }],
  ["weight_change", (v) => { v.safety.modelWeightsModified = true }], ["training", (v) => { v.safety.trainingStarted = true }],
  ["denoiser_checkpoint", (v) => { v.safety.denoiserCheckpointRead = true }],
]
const negatives = negativeMutations.map(([name, mutate]) => { let rejected = false; try { const value = fixture(); mutate(value); adjudicateMultisampleCapacityGradientInterference(value) } catch { rejected = true } return { name, passed: rejected } })
const report = { schemaVersion: "stage4-multisample-capacity-gradient-interference-cpu-report-v1", status: positives.every((x) => x.passed) && negatives.every((x) => x.passed) ? "passed" : "failed", positive: { passed: positives.filter((x) => x.passed).length, total: positives.length, cases: positives }, negative: { passed: negatives.filter((x) => x.passed).length, total: negatives.length, cases: negatives }, gpuStarted: false, checkpointRead: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false }
console.log(JSON.stringify(report, null, 2))
if (report.status !== "passed") process.exitCode = 1
