export const DECISIONS = Object.freeze({
  UNIQUE:
    "full_backbone_spatial_affine_is_unique_bounded_successor_axis",
  PAUSE: "pause",
})

const REQUIRED_BLOCK_LAYOUT = Object.freeze([
  Object.freeze({ id: "block0", role: "encoder_level0", channels: 64 }),
  Object.freeze({ id: "block1", role: "encoder_level1", channels: 128 }),
  Object.freeze({ id: "middle1", role: "bottleneck_first", channels: 256 }),
  Object.freeze({ id: "middle2", role: "bottleneck_second", channels: 256 }),
  Object.freeze({ id: "up_block1", role: "decoder_level1", channels: 128 }),
  Object.freeze({ id: "up_block0", role: "decoder_level0", channels: 64 }),
])

const REQUIRED_AFFINE_BOUNDARY = Object.freeze({
  conditionChannels: 23,
  kernelSize: 3,
  padding: 1,
  bias: true,
  projectionsPerBlock: 2,
  projectionOutputFormula: "2 * blockChannels",
  affineFormula: "normalized * (1 + gamma) + beta",
})

const CURRENT_DECODER_ONLY_BLOCK_IDS = Object.freeze([
  "up_block1",
  "up_block0",
])

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function expectedLayoutFromBoundary(modelBoundary) {
  const baseChannels = modelBoundary?.baseChannels
  const widthHierarchy = modelBoundary?.widthHierarchy
  if (
    baseChannels !== 64
    || !sameJson(widthHierarchy, [64, 128, 256])
  ) {
    return null
  }
  return [
    { id: "block0", role: "encoder_level0", channels: widthHierarchy[0] },
    { id: "block1", role: "encoder_level1", channels: widthHierarchy[1] },
    { id: "middle1", role: "bottleneck_first", channels: widthHierarchy[2] },
    { id: "middle2", role: "bottleneck_second", channels: widthHierarchy[2] },
    { id: "up_block1", role: "decoder_level1", channels: widthHierarchy[1] },
    { id: "up_block0", role: "decoder_level0", channels: widthHierarchy[0] },
  ]
}

function parameterAuditForBlock(block, affineBoundary) {
  const projectionOutputChannels = block.channels * 2
  const weightParametersPerProjection = (
    projectionOutputChannels
    * affineBoundary.conditionChannels
    * affineBoundary.kernelSize
    * affineBoundary.kernelSize
  )
  const biasParametersPerProjection = affineBoundary.bias
    ? projectionOutputChannels
    : 0
  const parametersPerProjection = (
    weightParametersPerProjection + biasParametersPerProjection
  )
  const projectionCount = affineBoundary.projectionsPerBlock
  const tensorCount = projectionCount * (affineBoundary.bias ? 2 : 1)
  return {
    ...clone(block),
    projectionCount,
    tensorCount,
    projectionOutputChannels,
    parametersPerProjection,
    parameterCount: parametersPerProjection * projectionCount,
  }
}

function evidenceBoundaryPasses(input) {
  const evidence = input?.axisEvidence
  return (
    evidence?.finalOutput?.formallyCovered === true
    && evidence.finalOutput.realVisualFailure === true
    && evidence.perClass?.formallyCovered === true
    && evidence.perClass.realVisualFailure === true
    && evidence.decoderOnlySpatialAffine?.formallyCovered === true
    && evidence.decoderOnlySpatialAffine.realVisualFailure === true
    && evidence.fullBackboneSpatialAffine?.previouslyTested === false
  )
}

function freeParameterBoundaryPasses(input) {
  return (
    input?.freeParameterAudit?.freeParameterChosen === false
    && sameJson(input.freeParameterAudit.freeParameterFields, [])
  )
}

/**
 * Derive, rather than choose, the only bounded full-backbone affine contract.
 *
 * The return value always contains an eligibility result. Invalid or incomplete
 * evidence is represented as an ineligible contract and must therefore pause;
 * callers cannot turn malformed input into a new architecture by catching an
 * exception and supplying fallback values.
 */
export function deriveFullBackboneSpatialAffineContract(input) {
  const modelBoundary = input?.modelBoundary
  const expectedLayout = expectedLayoutFromBoundary(modelBoundary)
  const suppliedLayout = modelBoundary?.residualBlocks
  const affineBoundary = modelBoundary?.spatialAffine

  const checks = {
    priorAxesFormallyCoveredAndFailed: evidenceBoundaryPasses(input),
    fixedConditionBoundary:
      modelBoundary?.conditionChannels === 23
      && affineBoundary?.conditionChannels === 23,
    exactSixBlockLayout:
      expectedLayout !== null
      && sameJson(expectedLayout, REQUIRED_BLOCK_LAYOUT)
      && sameJson(suppliedLayout, expectedLayout),
    exactAffineBoundary: sameJson(affineBoundary, REQUIRED_AFFINE_BOUNDARY),
    noFreeParameter: freeParameterBoundaryPasses(input),
  }

  const eligible = Object.values(checks).every(Boolean)
  if (!eligible) {
    return {
      schemaVersion:
        "ai-painter-stage4-model-family-discrimination-derived-contract-v1",
      status: "ineligible_pause",
      candidateAxis: "full_backbone_spatial_affine",
      checks,
      blockAudit: [],
      projectionCount: 0,
      parameterTensorCount: 0,
      parameterCount: 0,
      currentDecoderOnlyParameterCount: 159744,
      netNewParameterCount: 0,
    }
  }

  const blockAudit = expectedLayout.map((block) =>
    parameterAuditForBlock(block, affineBoundary))
  const projectionCount = blockAudit.reduce(
    (total, block) => total + block.projectionCount,
    0,
  )
  const parameterTensorCount = blockAudit.reduce(
    (total, block) => total + block.tensorCount,
    0,
  )
  const parameterCount = blockAudit.reduce(
    (total, block) => total + block.parameterCount,
    0,
  )
  const currentDecoderOnlyParameterCount = blockAudit
    .filter(({ id }) => CURRENT_DECODER_ONLY_BLOCK_IDS.includes(id))
    .reduce((total, block) => total + block.parameterCount, 0)
  const netNewParameterCount = parameterCount - currentDecoderOnlyParameterCount

  // These are consequences of the frozen 23-channel, 3x3+bias formula and
  // existing 64/128/256/256/128/64 residual-block widths, not selected knobs.
  const exactDerivedIdentity = (
    blockAudit.length === 6
    && projectionCount === 12
    && parameterTensorCount === 24
    && parameterCount === 745472
    && currentDecoderOnlyParameterCount === 159744
    && netNewParameterCount === 585728
  )

  return {
    schemaVersion:
      "ai-painter-stage4-model-family-discrimination-derived-contract-v1",
    status: exactDerivedIdentity
      ? "uniquely_derived_inactive"
      : "ineligible_pause",
    candidateAxis: "full_backbone_spatial_affine",
    checks: {
      ...checks,
      exactDerivedIdentity,
    },
    blockAudit,
    projectionCount,
    parameterTensorCount,
    parameterCount,
    currentDecoderOnlyParameterCount,
    netNewParameterCount,
    mutationBoundary: {
      newLossAllowed: false,
      lossWeightChangeAllowed: false,
      dataChangeAllowed: false,
      reviewThresholdChangeAllowed: false,
      freeArchitectureParameterAllowed: false,
      trainingActivated: false,
    },
  }
}

export function adjudicateModelFamilyAxes(input) {
  const contract = deriveFullBackboneSpatialAffineContract(input)
  return contract.status === "uniquely_derived_inactive"
    ? DECISIONS.UNIQUE
    : DECISIONS.PAUSE
}
