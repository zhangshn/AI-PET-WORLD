import assert from "node:assert/strict"

import {
  DECISIONS,
  adjudicateModelFamilyAxes,
  deriveFullBackboneSpatialAffineContract,
} from "./lib/ai-painter-stage4-model-family-discrimination-v1.mjs"

const clone = (value) => JSON.parse(JSON.stringify(value))

function fixture() {
  return {
    axisEvidence: {
      finalOutput: { formallyCovered: true, realVisualFailure: true },
      perClass: { formallyCovered: true, realVisualFailure: true },
      decoderOnlySpatialAffine: {
        formallyCovered: true,
        realVisualFailure: true,
      },
      fullBackboneSpatialAffine: { previouslyTested: false },
    },
    modelBoundary: {
      conditionChannels: 23,
      baseChannels: 64,
      widthHierarchy: [64, 128, 256],
      residualBlocks: [
        { id: "block0", role: "encoder_level0", channels: 64 },
        { id: "block1", role: "encoder_level1", channels: 128 },
        { id: "middle1", role: "bottleneck_first", channels: 256 },
        { id: "middle2", role: "bottleneck_second", channels: 256 },
        { id: "up_block1", role: "decoder_level1", channels: 128 },
        { id: "up_block0", role: "decoder_level0", channels: 64 },
      ],
      spatialAffine: {
        conditionChannels: 23,
        kernelSize: 3,
        padding: 1,
        bias: true,
        projectionsPerBlock: 2,
        projectionOutputFormula: "2 * blockChannels",
        affineFormula: "normalized * (1 + gamma) + beta",
      },
    },
    freeParameterAudit: {
      freeParameterChosen: false,
      freeParameterFields: [],
    },
  }
}

const positives = []
const negatives = []

const exact = fixture()
assert.equal(adjudicateModelFamilyAxes(exact), DECISIONS.UNIQUE)
positives.push("exact_three_axis_evidence_selects_unique_bounded_successor")

const contract = deriveFullBackboneSpatialAffineContract(exact)
assert.equal(contract.status, "uniquely_derived_inactive")
assert.deepEqual(
  contract.blockAudit.map(({ id, channels }) => ({ id, channels })),
  [
    { id: "block0", channels: 64 },
    { id: "block1", channels: 128 },
    { id: "middle1", channels: 256 },
    { id: "middle2", channels: 256 },
    { id: "up_block1", channels: 128 },
    { id: "up_block0", channels: 64 },
  ],
)
assert.equal(contract.projectionCount, 12)
assert.equal(contract.parameterTensorCount, 24)
assert.equal(contract.parameterCount, 745472)
assert.equal(contract.currentDecoderOnlyParameterCount, 159744)
assert.equal(contract.netNewParameterCount, 585728)
positives.push("six_blocks_and_all_parameter_identities_are_exactly_derived")

const negativeCases = [
  [
    "missing_prior_axis_evidence_pauses",
    (value) => { delete value.axisEvidence.finalOutput },
  ],
  [
    "block_omission_pauses",
    (value) => { value.modelBoundary.residualBlocks.pop() },
  ],
  [
    "middle_blocks_cannot_be_merged",
    (value) => {
      value.modelBoundary.residualBlocks.splice(
        2,
        2,
        { id: "middle", role: "bottleneck", channels: 256 },
      )
    },
  ],
  [
    "derived_width_change_pauses",
    (value) => { value.modelBoundary.residualBlocks[1].channels = 96 },
  ],
  [
    "projection_kernel_change_pauses",
    (value) => { value.modelBoundary.spatialAffine.kernelSize = 1 },
  ],
  [
    "projection_bias_change_pauses",
    (value) => { value.modelBoundary.spatialAffine.bias = false },
  ],
  [
    "affine_formula_change_pauses",
    (value) => {
      value.modelBoundary.spatialAffine.affineFormula =
        "normalized * gamma + beta"
    },
  ],
  [
    "free_parameter_injection_pauses",
    (value) => {
      value.freeParameterAudit.freeParameterChosen = true
      value.freeParameterAudit.freeParameterFields = ["hiddenWidth"]
    },
  ],
  [
    "already_tested_full_backbone_axis_pauses",
    (value) => {
      value.axisEvidence.fullBackboneSpatialAffine.previouslyTested = true
    },
  ],
  [
    "per_class_failure_evidence_cannot_be_dropped",
    (value) => { value.axisEvidence.perClass.realVisualFailure = false },
  ],
]

for (const [name, mutate] of negativeCases) {
  const value = clone(exact)
  mutate(value)
  const result = adjudicateModelFamilyAxes(value)
  assert.equal(result, DECISIONS.PAUSE, name)
  negatives.push(name)
}

const report = {
  schemaVersion:
    "ai-painter-stage4-model-family-discrimination-cpu-report-v1",
  status: "passed",
  decision: DECISIONS.UNIQUE,
  exactDerivedIdentity: {
    blockCount: contract.blockAudit.length,
    projectionCount: contract.projectionCount,
    parameterTensorCount: contract.parameterTensorCount,
    parameterCount: contract.parameterCount,
    currentDecoderOnlyParameterCount: contract.currentDecoderOnlyParameterCount,
    netNewParameterCount: contract.netNewParameterCount,
  },
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  executionBoundary: {
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelModified: false,
    lossModified: false,
    dataModified: false,
    reviewThresholdsModified: false,
    trainingStarted: false,
  },
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
