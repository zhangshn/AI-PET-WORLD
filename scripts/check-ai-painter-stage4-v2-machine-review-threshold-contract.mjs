import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import {
  STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES,
  buildStage4V2ScreenReviewCompositionPlan,
  validateStage4V2ScreenReviewRequest,
} from "./lib/ai-painter-stage4-v2-screen-review-contract-boundary.mjs"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, "..")
const CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json"
const CONTRACT_SHA256 = "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df"
const ARCHITECTURE_ID = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const STYLE_FINGERPRINT_PATH = ".runtime/ai-painter/style-fingerprints/ai-assisted-project-style-fingerprint-2026-08-02T00-28-21-150Z/style-fingerprint.json"
const STYLE_FINGERPRINT_SHA256 = "873d26eafb260a8e2d52608ea7108b2fe5d7d9c349f112dbd3bbd2e164e1c6d4"
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const EXPECTED_IMPLEMENTATIONS = Object.freeze({
  boundary: Object.freeze({
    path: "scripts/lib/ai-painter-stage4-v2-screen-review-contract-boundary.mjs",
    sha256: "71574b70a04b54e63714c7a783cb52bb6e7cb576cab963536cdbc42e8c02911b",
  }),
  conditionAlignment: Object.freeze({
    path: "scripts/lib/ai-assisted-condition-alignment.mjs",
    sha256: "c01ea4efba9835e488e42c7ed44d2aef434ee3db21b06e84e70379722bcc145e",
  }),
  professionalAesthetic: Object.freeze({
    path: "scripts/lib/ai-assisted-professional-aesthetic.mjs",
    sha256: "d07af489c4398e05abe94060fa773a65710ed9e57a72df2514352075fdf2e7e8",
  }),
  styleFeatureExtractor: Object.freeze({
    path: "scripts/lib/ai-assisted-style-fingerprint.mjs",
    sha256: "924f7db154c15c84df1b9e50b40dd57cc20c22d1b9b0ce72741bfd8835888d15",
  }),
  historicalScreenReviewRunner: Object.freeze({
    path: "scripts/run-ai-painter-stage4-spatial-affine-screen-review.mjs",
    sha256: "889082172e3000a91622d5b769dfc4feeae346e4c2aa194191356611e5a0166b",
  }),
})

const MULTISCALE_TEXTURE_FEATURES = Object.freeze([
  "native_edge_density_004",
  "native_edge_density_008",
  "native_edge_density_014",
  "native_gradient_mean",
  "native_laplacian_mean",
  "half_edge_density_004",
  "half_edge_density_008",
  "half_edge_density_014",
  "half_gradient_mean",
  "half_laplacian_mean",
  "quarter_edge_density_004",
  "quarter_edge_density_008",
  "quarter_edge_density_014",
  "quarter_gradient_mean",
  "quarter_laplacian_mean",
])

const EXPECTED_PROFESSIONAL_THRESHOLDS = Object.freeze({
  axes: Object.freeze({
    native_edge_density_004: 0.855874,
    native_edge_density_008: 0.562074,
    native_edge_density_014: 0.296174,
    native_gradient_mean: 0.111929,
    native_laplacian_mean: 0.317459,
    half_edge_density_004: 0.891644,
    half_edge_density_008: 0.611024,
    half_edge_density_014: 0.326163,
    half_gradient_mean: 0.119572,
    half_laplacian_mean: 0.460406,
    quarter_edge_density_004: 0.911364,
    quarter_edge_density_008: 0.645688,
    quarter_edge_density_014: 0.351684,
    quarter_gradient_mean: 0.125905,
    quarter_laplacian_mean: 0.480829,
  }),
  quietRegionUpperEnvelope: 0.128601,
  textureHierarchyUpperEnvelope: 0.821317,
})

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function resolveProjectFile(relativePath) {
  assert.equal(typeof relativePath, "string", "path must be a string")
  assert(relativePath.length > 0, "path must not be empty")
  assert(!path.isAbsolute(relativePath), `absolute path is forbidden: ${relativePath}`)
  assert(
    !/(^|[\\/])latest(?:\.json)?(?:[\\/]|$)/i.test(relativePath),
    `latest pointer is forbidden: ${relativePath}`,
  )
  const resolved = path.resolve(ROOT, relativePath)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${relativePath}`,
  )
  assert(fs.existsSync(resolved), `file is missing: ${relativePath}`)
  assert(fs.statSync(resolved).isFile(), `path is not a file: ${relativePath}`)
  return resolved
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveProjectFile(relativePath), "utf8"))
}

function sha256File(relativePath) {
  return sha256Bytes(fs.readFileSync(resolveProjectFile(relativePath)))
}

function featureMap(features) {
  assert.equal(features.featureNames.length, features.vector.length)
  return Object.fromEntries(features.featureNames.map((name, index) => [name, features.vector[index]]))
}

function round6(value) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function deriveProfessionalThresholds(fingerprint) {
  const approvedFeatures = fingerprint.positiveSamples.map((sample) => featureMap(sample.features))
  const axes = Object.fromEntries(MULTISCALE_TEXTURE_FEATURES.map((name) => [
    name,
    round6(Math.max(...approvedFeatures.map((features) => features[name])) * 1.05 + 0.000001),
  ]))
  const quietRegionUpperEnvelope = round6(
    Math.max(...approvedFeatures.map((features) => features.block_variance_q10)) * 1.05 + 0.000001,
  )
  const textureHierarchyUpperEnvelope = round6(
    Math.max(...approvedFeatures.map(
      (features) => features.block_variance_q10 / Math.max(features.block_variance_q90, 0.000000001),
    )) * 1.05 + 0.000001,
  )
  return { axes, quietRegionUpperEnvelope, textureHierarchyUpperEnvelope }
}

function assertImplementationBinding(binding, expected, role) {
  assert.equal(binding.path, expected.path, `${role} path changed`)
  assert.equal(binding.sha256, expected.sha256, `${role} declared SHA-256 changed`)
  assert.equal(sha256File(binding.path), expected.sha256, `${role} source bytes changed`)
}

function assertThreshold(value, comparator, expected, unit, role) {
  assert.deepEqual(value, { comparator, value: expected, unit }, `${role} threshold changed`)
}

function assertSourceAnchors() {
  const conditionSource = fs.readFileSync(
    resolveProjectFile(EXPECTED_IMPLEMENTATIONS.conditionAlignment.path),
    "utf8",
  )
  for (const anchor of [
    "const GRID_COLUMNS = 8",
    "const GRID_ROWS = 6",
    "minimumSpatialIntersection: 0.5",
    "maximumCentroidDistance: 0.12",
    "minimumCoverageRatio: 0.35",
    "maximumCoverageRatio: 2.5",
    "maximumAbsentSignalRatio: 0.005",
    "minimumSpatialIntersection: 0.25",
    "maximumCentroidDistance: 0.25",
    "maximumCoverageRatio: 3.0",
    "supportRadiusPixels: 12",
    "const bandPixels = 6",
    "maximumComponentSize >= 500",
    "supportPixelCount >= 8 && supportRatio >= 0.02",
    "const blockSizePixels = 16",
    "const minimumBlockSignalRatio = 0.35",
    "blue > red * 1.12",
    "red > green * 1.4",
  ]) {
    assert(conditionSource.includes(anchor), `condition-alignment source anchor changed: ${anchor}`)
  }
  for (const code of [
    "condition_terrain_water_connectivity_blueprint_missing",
    "condition_terrain_water_upstream_downstream_ports_missing",
    "condition_terrain_water_inlet_outlet_raster_missing",
    "required_boundary_contact_missing",
    "uncontracted_boundary_contact",
    "reference_semantic_mismatch",
  ]) {
    assert(conditionSource.includes(code), `condition-alignment failure code changed: ${code}`)
  }

  const aestheticSource = fs.readFileSync(
    resolveProjectFile(EXPECTED_IMPLEMENTATIONS.professionalAesthetic.path),
    "utf8",
  )
  for (const anchor of [
    "maximum * 1.05 + 1e-6",
    "textureViolations.length < 4",
    "textureViolations.length >= 4",
    "professional_single_axis_texture_envelope_exceeded_diagnostic",
    "professional_multiscale_texture_noise_overload",
    "professional_quiet_region_missing",
    "professional_texture_hierarchy_collapsed",
  ]) {
    assert(aestheticSource.includes(anchor), `professional-aesthetic source anchor changed: ${anchor}`)
  }
}

function validateThresholdContract(contract, { verifyContractBytes = false } = {}) {
  assert.equal(contract.schemaVersion, "ai-painter-stage4-v2-machine-review-threshold-contract-v1")
  assert.equal(contract.contractId, "ai-painter-stage4-v2-machine-review-threshold-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.immutable, true)
  assert.equal(contract.architectureId, ARCHITECTURE_ID)
  assert.equal(contract.activation.cpuContractValidationAllowed, true)
  for (const [gate, enabled] of Object.entries(contract.activation)) {
    if (gate === "cpuContractValidationAllowed") continue
    assert.equal(enabled, false, `${gate} must remain disabled`)
  }
  if (verifyContractBytes) assert.equal(sha256File(CONTRACT_PATH), CONTRACT_SHA256, "threshold contract bytes changed")

  assertImplementationBinding(
    contract.formalReviewBoundary.implementation,
    EXPECTED_IMPLEMENTATIONS.boundary,
    "V2 review composition boundary",
  )
  assert.equal(contract.formalReviewBoundary.runnerState, "pending_execution_package_materialization")
  assert.equal(contract.formalReviewBoundary.dispatchable, false)
  assert.equal(contract.formalReviewBoundary.latestPointerAllowed, false)
  assert.equal(contract.formalReviewBoundary.historicalRunSelectionAllowed, false)
  assert.equal(contract.formalReviewBoundary.crossExecutionPackageEvidenceAllowed, false)
  assert.equal(contract.formalReviewBoundary.thresholdOverrideAllowed, false)
  assert.equal(contract.formalReviewBoundary.trustedAuthoritySource, "verified_immutable_current_execution_package_lineage")
  assert.equal(contract.formalReviewBoundary.authoritativeLineageSchema, "ai-painter-stage4-v2-current-execution-package-lineage-v1")
  assert.equal(contract.formalReviewBoundary.authoritativeLineageStatus, "verified_immutable_current_execution_package")
  assert.equal(contract.formalReviewBoundary.authoritativeLineageOrigin, "current_execution_registry_committed_transaction")
  assert.equal(contract.formalReviewBoundary.authoritativeRegistryTransactionSchema, "ai-painter-current-execution-registry-transaction-v1")
  assert.equal(contract.formalReviewBoundary.authoritativeRegistryTransactionStatus, "committed")
  assert.equal(contract.formalReviewBoundary.authoritativeCurrentRegistrySchema, "ai-painter-current-execution-registry-v1")
  assert.equal(contract.formalReviewBoundary.authoritativeCurrentExecutionState, "package_materialized")
  assert.equal(contract.formalReviewBoundary.authoritativeTaskCapsuleSchema, "ai-painter-local-task-capsule-v1")
  assert.equal(contract.formalReviewBoundary.authoritativeSourceTerminalSchema, "stage4-v2-cpu-contract-acceptance-terminal-v1")
  assert.equal(contract.formalReviewBoundary.authoritativeSourceTerminalStatus, "stage4_v2_cpu_contract_acceptance_passed_inactive")
  assert.equal(contract.formalReviewBoundary.authoritativeSourceTerminalExecutionState, "completed")
  assert.equal(contract.formalReviewBoundary.authoritativeLineageSelfAttestationSufficient, false)
  assert.equal(contract.formalReviewBoundary.requestSelfAttestationSufficient, false)
  assert.equal(contract.formalReviewBoundary.candidateFileMetadataVerificationRequired, true)
  assert.equal(contract.formalReviewBoundary.conditionPackContentVerificationRequired, true)
  assert.equal(contract.formalReviewBoundary.referenceAndMaskFileMetadataVerificationRequired, true)
  assert.equal(contract.formalReviewBoundary.thresholdContractContentVerificationRequired, true)

  assertImplementationBinding(
    contract.implementationProvenance.conditionAlignment,
    EXPECTED_IMPLEMENTATIONS.conditionAlignment,
    "condition alignment",
  )
  assertImplementationBinding(
    contract.implementationProvenance.professionalAesthetic,
    EXPECTED_IMPLEMENTATIONS.professionalAesthetic,
    "professional aesthetic",
  )
  assertImplementationBinding(
    contract.implementationProvenance.styleFeatureExtractor,
    EXPECTED_IMPLEMENTATIONS.styleFeatureExtractor,
    "style feature extractor",
  )
  assertImplementationBinding(
    contract.implementationProvenance.historicalScreenReviewRunner,
    EXPECTED_IMPLEMENTATIONS.historicalScreenReviewRunner,
    "historical screen-review runner",
  )
  assert.equal(contract.implementationProvenance.conditionAlignment.role, "algorithm_provenance_reference_not_dispatchable")
  assert.equal(contract.implementationProvenance.professionalAesthetic.role, "algorithm_provenance_reference_not_dispatchable")
  assert.equal(contract.implementationProvenance.historicalScreenReviewRunner.role, "historical_provenance_reference_not_dispatchable")
  assert.equal(contract.implementationProvenance.historicalScreenReviewRunner.v2Authority, false)
  assert.equal(contract.implementationProvenance.historicalScreenReviewRunner.dispatchable, false)

  assert.equal(contract.styleFingerprint.path, STYLE_FINGERPRINT_PATH)
  assert.equal(contract.styleFingerprint.sha256, STYLE_FINGERPRINT_SHA256)
  assert.equal(contract.styleFingerprint.selectionMode, "explicit_immutable_path_and_sha256_only")
  assert.equal(sha256File(STYLE_FINGERPRINT_PATH), STYLE_FINGERPRINT_SHA256, "style fingerprint bytes changed")
  const fingerprint = readJson(STYLE_FINGERPRINT_PATH)
  assert.equal(fingerprint.schemaVersion, contract.styleFingerprint.schemaVersion)
  assert.equal(fingerprint.fingerprintId, contract.styleFingerprint.fingerprintId)
  assert.equal(fingerprint.status, contract.styleFingerprint.status)
  assert.equal(fingerprint.positiveSampleCount, 112)
  assert.equal(fingerprint.negativeSampleCount, 2)
  assert.equal(fingerprint.positiveSamples.length, 112)
  assert.deepEqual(deriveProfessionalThresholds(fingerprint), EXPECTED_PROFESSIONAL_THRESHOLDS)

}

function validateNumericThresholds(contract) {
  const common = contract.commonMeasurementContract
  assert.deepEqual(common.rgbChannelDomain, { minimum: 0, maximum: 255, unit: "uint8_channel_intensity" })
  assert.deepEqual(common.luminance, {
    redCoefficient: 0.2126,
    greenCoefficient: 0.7152,
    blueCoefficient: 0.0722,
    unit: "linear_weight_over_uint8_channel_intensity",
  })
  assert.deepEqual(common.spatialDistributionGrid, { columns: 8, rows: 6, unit: "grid_cells" })

  const water = contract.conditionAlignmentThresholds.water
  assert.equal(water.channelId, "terrain_water")
  assert.deepEqual(water.presentClassifier.rules, [
    { metric: "blue_divided_by_red", comparator: ">", value: 1.12, unit: "ratio" },
    { metric: "green_divided_by_red", comparator: ">", value: 1.08, unit: "ratio" },
    { metric: "blue_divided_by_green", comparator: ">", value: 0.72, unit: "ratio" },
    { metric: "blue", comparator: ">=", value: 55, unit: "uint8_channel_intensity" },
  ])
  assert.deepEqual(water.absentClassifier.rules, [
    { metric: "blue_divided_by_red", comparator: ">", value: 1.25, unit: "ratio" },
    { metric: "blue_divided_by_green", comparator: ">", value: 1.08, unit: "ratio" },
    { metric: "blue", comparator: ">=", value: 65, unit: "uint8_channel_intensity" },
    { metric: "blue_minus_red", comparator: ">=", value: 22, unit: "uint8_channel_intensity_delta" },
  ])
  assertThreshold(water.absentSignalIsolation.blockSizePixels, "=", 16, "pixels", "water block size")
  assertThreshold(water.absentSignalIsolation.minimumBlockSignalRatio, ">=", 0.35, "pixel_fraction", "water block signal ratio")
  assertThreshold(water.alignment.minimumSpatialIntersection, ">=", 0.5, "normalized_grid_mass_intersection", "water intersection")
  assertThreshold(water.alignment.maximumCentroidDistance, "<=", 0.12, "normalized_canvas_euclidean_distance", "water centroid")
  assertThreshold(water.alignment.minimumCoverageRatio, ">=", 0.35, "actual_to_expected_nonzero_ratio", "water min coverage")
  assertThreshold(water.alignment.maximumCoverageRatio, "<=", 2.5, "actual_to_expected_nonzero_ratio", "water max coverage")
  assertThreshold(water.alignment.maximumAbsentSignalRatio, "<=", 0.005, "canvas_pixel_fraction", "water absence")

  const pathThresholds = contract.conditionAlignmentThresholds.path
  assert.equal(pathThresholds.channelId, "terrain_path_ground")
  assert.equal(pathThresholds.wetSeasonClassifier.rules.length, 8)
  assert.equal(pathThresholds.drySeasonClassifier.rules.length, 9)
  assert.deepEqual(pathThresholds.wetSeasonClassifier.rules[0], { metric: "red_divided_by_green", comparator: ">", value: 1.03, unit: "ratio" })
  assert.deepEqual(pathThresholds.drySeasonClassifier.rules[0], { metric: "red_divided_by_green", comparator: ">", value: 1.4, unit: "ratio" })
  assert.deepEqual(pathThresholds.drySeasonClassifier.rules[2], { metric: "red_minus_green", comparator: ">", otherMetric: "green_minus_blue", unit: "uint8_channel_intensity_delta" })
  assertThreshold(pathThresholds.signalIsolation.supportCorridorRadiusPixels, "=", 48, "pixels", "path support radius")
  assertThreshold(pathThresholds.signalIsolation.connectivity, "=", 8, "pixel_neighbors", "path connectivity")
  assertThreshold(pathThresholds.signalIsolation.retentionAlternativeOne.directExpectedOverlap, ">", 0, "pixels", "path direct overlap")
  assertThreshold(pathThresholds.signalIsolation.retentionAlternativeTwo.supportPixelCount, ">=", 8, "pixels", "path support pixels")
  assertThreshold(pathThresholds.signalIsolation.retentionAlternativeTwo.supportRatio, ">=", 0.02, "component_pixel_fraction", "path support ratio")
  assertThreshold(pathThresholds.alignment.minimumSpatialIntersection, ">=", 0.25, "normalized_grid_mass_intersection", "path intersection")
  assertThreshold(pathThresholds.alignment.maximumCentroidDistance, "<=", 0.25, "normalized_canvas_euclidean_distance", "path centroid")
  assertThreshold(pathThresholds.alignment.minimumCoverageRatio, ">=", 0.25, "actual_to_expected_nonzero_ratio", "path min coverage")
  assertThreshold(pathThresholds.alignment.maximumCoverageRatio, "<=", 3, "actual_to_expected_nonzero_ratio", "path max coverage")
  assertThreshold(pathThresholds.alignment.maximumAbsentSignalRatio, "<=", 0, "canvas_pixel_fraction", "path absence")

  const objects = contract.conditionAlignmentThresholds.objects
  assertThreshold(objects.supportRadiusPixels, "=", 12, "pixels", "object support radius")
  assert.equal(objects.localAcceptanceLogic, "minimumColorDistance_or_minimumEdgeDifference_or_minimumEdgeRatio")
  assert.deepEqual(Object.keys(objects.channels), STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES)
  const expectedObjects = {
    object_footprints: [1, 0.04, 1.002],
    object_tree: [1.05, 0.055, 1.0025],
    object_rock: [1.5, 0.05, 1.003],
    object_vegetation: [0.8, 0.035, 1.002],
  }
  for (const [role, [color, edge, ratio]] of Object.entries(expectedObjects)) {
    assertThreshold(objects.channels[role].minimumColorDistance, ">=", color, "rgb_euclidean_uint8_intensity", `${role} color`)
    assertThreshold(objects.channels[role].minimumEdgeDifference, ">=", edge, "normalized_luminance_gradient", `${role} edge`)
    assertThreshold(objects.channels[role].minimumEdgeRatio, ">=", ratio, "ratio", `${role} edge ratio`)
  }

  const reference = contract.conditionAlignmentThresholds.referenceSemantics
  assert.equal(reference.standardAcceptanceLogic, "maximumMaskedRgbMae_and_maximumMaskedEdgeMae_and_minimumMaskedLumaCorrelation")
  assert.equal(reference.highFidelityFallbackLogic, "highFidelityFallbackMaximumRgbMae_and_highFidelityFallbackMaximumEdgeMae")
  for (const role of STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES) {
    assertThreshold(reference.channels[role].maximumMaskedRgbMae, "<=", role === "object_rock" ? 0.2 : 0.18, "normalized_rgb_mae", `${role} reference RGB`)
  }
  assertThreshold(reference.shared.maximumMaskedEdgeMae, "<=", 0.12, "normalized_luminance_edge_mae", "reference edge")
  assertThreshold(reference.shared.minimumMaskedLumaCorrelation, ">=", 0.08, "pearson_correlation", "reference correlation")
  assertThreshold(reference.shared.highFidelityFallbackMaximumRgbMae, "<=", 0.08, "normalized_rgb_mae", "reference fallback RGB")
  assertThreshold(reference.shared.highFidelityFallbackMaximumEdgeMae, "<=", 0.06, "normalized_luminance_edge_mae", "reference fallback edge")

  const boundary = contract.conditionAlignmentThresholds.boundary
  assertThreshold(boundary.bandPixels, "=", 6, "pixels", "boundary band")
  assert.deepEqual(boundary.requiredSideDefinition, { metric: "expectedBoundarySignalCount", comparator: ">", value: 0, unit: "pixels" })
  assertThreshold(boundary.minimumSupportedContactPixels, ">=", 6, "pixels", "boundary supported contact")
  assert.equal(boundary.requiredSideMinimumFormula, "max(6_pixels,round(expectedBoundarySignalCount*0.1))")
  assertThreshold(boundary.requiredSideExpectedFraction, ">=", 0.1, "expected_boundary_signal_fraction", "boundary expected fraction")
  assertThreshold(boundary.unexpectedRawComponentMinimumSize, ">=", 500, "pixels", "boundary raw component")
  assertThreshold(boundary.unexpectedRawComponentMinimumContactPixels, ">=", 6, "pixels", "boundary raw contact")

  const flowingWater = contract.conditionAlignmentThresholds.flowingWaterConnectivity
  assert.deepEqual(flowingWater.applicability, {
    allRulesRequired: true,
    rebuild64SequenceSeriesId: "thailand-rebuild64-20260731",
    regionalLandscapeTypes: [
      "wet-season-drainage-hollow",
      "river-floodplain",
      "riparian-tropical-forest",
      "dry-season-exposed-riverbank",
    ],
    waterMaskPresence: { comparator: ">", value: 0, unit: "expected_nonzero_pixels" },
  })
  assert.deepEqual(flowingWater.requiredBoundarySides, ["north", "south"])
  assertThreshold(flowingWater.requiredBoundarySideCount, "=", 2, "sides", "flowing-water boundary side count")
  assert.deepEqual(flowingWater.requiredPorts, ["upstream_inlet", "downstream_outlet"])
  assert.equal(flowingWater.requiredBoundarySidesOnlyWhenApplicabilityMatches, true)

  const professional = contract.professionalAestheticThresholds
  assertThreshold(professional.derivation.minimumPositiveSampleCount, ">=", 5, "samples", "minimum calibration count")
  assertThreshold(professional.derivation.actualPositiveSampleCount, "=", 112, "samples", "actual calibration count")
  assertThreshold(professional.derivation.upperEnvelopeMargin, "=", 1.05, "multiplier", "aesthetic margin")
  assertThreshold(professional.derivation.epsilon, "=", 0.000001, "dimensionless", "aesthetic epsilon")
  assertThreshold(professional.derivation.roundingDecimalPlaces, "=", 6, "decimal_places", "aesthetic rounding")
  assert.deepEqual(professional.multiscaleTextureUpperEnvelope.axes, EXPECTED_PROFESSIONAL_THRESHOLDS.axes)
  assert.deepEqual(professional.multiscaleTextureUpperEnvelope.diagnosticViolationCount, { comparator: "between_inclusive", minimum: 1, maximum: 3, unit: "axes" })
  assertThreshold(professional.multiscaleTextureUpperEnvelope.failureViolationCount, ">=", 4, "axes", "texture failure count")
  assert.deepEqual(professional.quietRegionUpperEnvelope, {
    feature: "block_variance_q10",
    comparator: "<=",
    value: 0.128601,
    unit: "normalized_luminance_block_variance",
  })
  assertThreshold(professional.textureHierarchyUpperEnvelope.denominatorFloor, "=", 0.000000001, "normalized_luminance_block_variance", "hierarchy denominator")
  assert.equal(professional.textureHierarchyUpperEnvelope.comparator, "<=")
  assert.equal(professional.textureHierarchyUpperEnvelope.value, 0.821317)
  assert.equal(professional.textureHierarchyUpperEnvelope.unit, "variance_ratio")
}

function validateFailureAndTrainingSeparation(contract) {
  const requiredCodes = [
    "condition_terrain_water_unexpected_signal",
    "condition_terrain_water_spatial_distribution_mismatch",
    "condition_terrain_water_centroid_drift",
    "condition_terrain_water_coverage_mismatch",
    "condition_terrain_water_required_boundary_contact_missing",
    "condition_terrain_water_uncontracted_boundary_contact",
    "condition_terrain_path_ground_unexpected_signal",
    "condition_terrain_path_ground_spatial_distribution_mismatch",
    "condition_terrain_path_ground_centroid_drift",
    "condition_terrain_path_ground_coverage_mismatch",
    "condition_terrain_path_ground_required_boundary_contact_missing",
    "condition_terrain_path_ground_uncontracted_boundary_contact",
    ...STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES.flatMap((role) => [
      `condition_${role}_visual_response_missing`,
      `condition_${role}_reference_semantic_mismatch`,
    ]),
    "condition_terrain_water_connectivity_blueprint_missing",
    "condition_terrain_water_upstream_downstream_ports_missing",
    "condition_terrain_water_inlet_outlet_raster_missing",
    "professional_multiscale_texture_noise_overload",
    "professional_quiet_region_missing",
    "professional_texture_hierarchy_collapsed",
  ]
  const declaredCodes = [
    ...contract.failureCodes.waterAndPath,
    ...contract.failureCodes.objects,
    ...contract.failureCodes.hydrology,
    ...contract.failureCodes.professionalAesthetic,
  ]
  assert.deepEqual(declaredCodes, requiredCodes)
  assert.deepEqual(contract.failureCodes.diagnosticOnly, ["professional_single_axis_texture_envelope_exceeded_diagnostic"])

  const separation = contract.reviewTrainingSeparation
  for (const field of [
    "reviewResultsUsedAsTrainingTarget",
    "machineAuditPassFailUsedAsLoss",
    "failureCodesUsedAsLoss",
    "failedPreviewPixelsUsedAsTrainingTarget",
    "thresholdAdaptationDuringTraining",
    "thresholdLoweringAllowed",
  ]) assert.equal(separation[field], false, `${field} must remain false`)
  assert.equal(separation.reviewRole, "post_generation_acceptance_and_failure_evidence_only")
}

function expectFailure(label, action) {
  assert.throws(action, undefined, `${label} must fail closed`)
}

async function expectAsyncFailure(label, action) {
  await assert.rejects(action, undefined, `${label} must fail closed`)
}

function runContractMutationRegressions(contract) {
  const cases = [
    ["activation", (value) => { value.activation.trainingAllowed = true }],
    ["boundary dispatch", (value) => { value.formalReviewBoundary.dispatchable = true }],
    ["registry authority schema", (value) => { value.formalReviewBoundary.authoritativeRegistryTransactionSchema = "untrusted-registry-v1" }],
    ["historical runner authority", (value) => { value.implementationProvenance.historicalScreenReviewRunner.v2Authority = true }],
    ["source identity", (value) => { value.implementationProvenance.conditionAlignment.sha256 = "0".repeat(64) }],
    ["latest fingerprint", (value) => { value.styleFingerprint.path = ".runtime/ai-painter/style-fingerprints/latest.json" }],
    ["water threshold", (value) => { value.conditionAlignmentThresholds.water.alignment.minimumSpatialIntersection.value = 0.49 }],
    ["object threshold", (value) => { value.conditionAlignmentThresholds.objects.channels.object_tree.minimumEdgeDifference.value = 0.054 }],
    ["aesthetic threshold", (value) => { value.professionalAestheticThresholds.quietRegionUpperEnvelope.value = 0.2 }],
    ["training feedback", (value) => { value.reviewTrainingSeparation.reviewResultsUsedAsTrainingTarget = true }],
  ]
  for (const [label, mutate] of cases) {
    const mutated = structuredClone(contract)
    mutate(mutated)
    expectFailure(label, () => {
      validateThresholdContract(mutated)
      validateNumericThresholds(mutated)
      validateFailureAndTrainingSeparation(mutated)
    })
  }
}

function buildBoundaryFixture() {
  const executionPackageIdentity = "stage4-v2-review-fixture-package-0001"
  const datasetReleaseIdentity = "stage4-v2-dataset-release-fixture-0001"
  const artifact = (role, artifactPath) => ({
    role,
    path: artifactPath,
    sha256: "a".repeat(64),
  })
  const request = {
    schemaVersion: "ai-painter-stage4-v2-screen-review-request-v1",
    status: "cpu_supported_inactive",
    architectureId: ARCHITECTURE_ID,
    executionPackageIdentity,
    datasetReleaseIdentity,
    stage: "stage0",
    bindingPolicy: {
      explicitArtifactsOnly: true,
      latestPointerAllowed: false,
      historicalRunSelectionAllowed: false,
      crossExecutionPackageEvidenceAllowed: false,
      thresholdOverrideAllowed: false,
      reviewOutputMayBecomeTrainingTarget: false,
      failedPixelFeedbackMayBecomeTrainingTarget: false,
    },
    candidateRgb: {
      ...artifact("complete_rgb_candidate", ".runtime/ai-painter/current-package/candidate.png"),
      executionPackageIdentity,
      completeFrame: true,
      width: 256,
      height: 192,
    },
    conditionPack: {
      ...artifact("condition_pack", "data/ai-painter/current-package/condition-pack.json"),
      datasetReleaseIdentity,
      conditionPackId: "condition-pack-fixture-0001",
      channelCount: 23,
    },
    referenceRgb: {
      ...artifact("approved_reference_rgb", "data/ai-painter/current-package/reference.png"),
      datasetReleaseIdentity,
      width: 256,
      height: 192,
    },
    objectMasks: STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES.map((role) =>
      ({ ...artifact(role, `data/ai-painter/current-package/${role}.png`), datasetReleaseIdentity })),
    thresholdContract: {
      ...artifact("machine_review_threshold_contract", CONTRACT_PATH),
      sha256: sha256File(CONTRACT_PATH),
      schemaVersion: "ai-painter-stage4-v2-machine-review-threshold-contract-v1",
    },
  }
  const trustedAuthority = {
    registryRecord: { path: ".runtime/ai-painter/current-execution-registry/transactions/fixture/transaction.json", sha256: "c".repeat(64) },
    executionPackageRecord: { path: ".runtime/ai-painter/stage4-v2-execution-packages/fixture/package.json", sha256: "d".repeat(64) },
    testOnlyFixture: true,
    fixtureRegistry: {
      schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
      status: "committed",
      transactionId: "stage4-v2-review-fixture-transaction-0001",
      registryRevision: 7,
      eventSequence: 9,
      currentSha256: "e".repeat(64),
      currentStaged: {
        path: ".runtime/ai-painter/current-execution-registry/transactions/fixture/current.staged.json",
        sha256: "e".repeat(64),
      },
      fixtureCurrentStaged: {
        schemaVersion: "ai-painter-current-execution-registry-v1",
        registryRevision: 7,
        eventSequence: 9,
        transactionId: "stage4-v2-review-fixture-transaction-0001",
        packageId: executionPackageIdentity,
        capabilityVersion: ARCHITECTURE_ID,
        executionState: "package_materialized",
        activeExecution: null,
        taskId: "plan_stage4_v2_readonly_gpu_qualification",
        runId: executionPackageIdentity,
        terminalEvidence: {
          path: ".runtime/ai-painter/current-package/cpu-contract-terminal.json",
          sha256: "f".repeat(64),
        },
        taskCapsule: {
          path: ".runtime/ai-painter/current-package/task-capsule.json",
          sha256: "1".repeat(64),
        },
      },
      fixtureTaskCapsule: {
        schemaVersion: "ai-painter-local-task-capsule-v1",
        runId: executionPackageIdentity,
        architectureId: ARCHITECTURE_ID,
        latestTerminal: {
          path: ".runtime/ai-painter/current-package/cpu-contract-terminal.json",
          sha256: "f".repeat(64),
        },
        nextAllowedAction: { taskId: "plan_stage4_v2_readonly_gpu_qualification" },
      },
    },
    fixtureLineage: {
      schemaVersion: "ai-painter-stage4-v2-current-execution-package-lineage-v1",
      authority: "local_ai_pet_world_program",
      status: "verified_immutable_current_execution_package",
      origin: "current_execution_registry_committed_transaction",
      registryTransaction: {
        transactionId: "stage4-v2-review-fixture-transaction-0001",
        registryRevision: 7,
        eventSequence: 9,
        currentSha256: "e".repeat(64),
      },
      executionPackageIdentity,
      executionPackageRoot: ".runtime/ai-painter/current-package",
      datasetReleaseIdentity,
      currentExecution: {
        taskId: "plan_stage4_v2_readonly_gpu_qualification",
        runId: executionPackageIdentity,
      },
      sourceTerminal: {
        path: ".runtime/ai-painter/current-package/cpu-contract-terminal.json",
        sha256: "f".repeat(64),
        status: "stage4_v2_cpu_contract_acceptance_passed_inactive",
      },
      candidateRgb: { path: request.candidateRgb.path, sha256: request.candidateRgb.sha256 },
      conditionPack: { path: request.conditionPack.path, sha256: request.conditionPack.sha256 },
      referenceRgb: { path: request.referenceRgb.path, sha256: request.referenceRgb.sha256 },
      objectMasks: request.objectMasks.map(({ role, path: artifactPath, sha256 }) => ({ role, path: artifactPath, sha256 })),
      thresholdContract: { path: request.thresholdContract.path, sha256: request.thresholdContract.sha256 },
    },
  }
  return { request, trustedAuthority }
}

async function runBoundaryRegressions() {
  const fixture = buildBoundaryFixture()
  const plan = await buildStage4V2ScreenReviewCompositionPlan(fixture.request, {
    projectRoot: ROOT,
    verifyFiles: false,
    trustedAuthority: fixture.trustedAuthority,
  })
  assert.equal(plan.status, "formal_runner_pending_execution_package_materialization")
  assert.equal(plan.dispatchable, false)
  assert.deepEqual(plan.compositionBoundary.map((item) => item.order), [1, 2, 3])
  assert.equal(plan.forbiddenFeedback.reviewOutputMayBecomeTrainingTarget, false)
  assert.deepEqual(plan.flowingWaterConnectivity.requiredBoundarySides, [])

  const cases = [
    ["latest candidate", (value) => { value.candidateRgb.path = ".runtime/ai-painter/latest.json" }],
    ["historical selector", (value) => { value.historicalRunId = "old-run" }],
    ["cross-package candidate", (value) => { value.executionPackageIdentity = "other-package-identity-0001" }],
    ["cross-dataset mask", (value) => { value.objectMasks[0].datasetReleaseIdentity = "other-dataset-release-0001" }],
    ["mask role replacement", (value) => { value.objectMasks[0].role = "focal_area" }],
    ["threshold contract replacement", (value) => { value.thresholdContract.sha256 = "b".repeat(64) }],
    ["threshold override", (value) => { value.bindingPolicy.thresholdOverrideAllowed = true }],
    ["review training feedback", (value) => { value.bindingPolicy.reviewOutputMayBecomeTrainingTarget = true }],
    ["wrong stage dimensions", (value) => { value.candidateRgb.width = 1024 }],
  ]
  for (const [label, mutate] of cases) {
    const mutated = structuredClone(fixture.request)
    mutate(mutated)
    await expectAsyncFailure(label, () => validateStage4V2ScreenReviewRequest(mutated, {
      projectRoot: ROOT,
      verifyFiles: false,
      trustedAuthority: fixture.trustedAuthority,
    }))
  }

  const authorityCases = [
    ["fixture registry schema", (value) => { value.fixtureRegistry.schemaVersion = "untrusted-registry-v1" }],
    ["fixture historical lineage", (value) => { value.fixtureLineage.status = "historical_execution_package" }],
    ["fixture cross-package candidate", (value) => { value.fixtureLineage.candidateRgb.path = ".runtime/ai-painter/other-package/candidate.png" }],
    ["fixture threshold replacement", (value) => { value.fixtureLineage.thresholdContract.sha256 = "b".repeat(64) }],
    ["fixture self-declared identity", (value) => { value.executionPackageIdentity = "other-package-identity-0001" }],
  ]
  for (const [label, mutate] of authorityCases) {
    const mutatedAuthority = structuredClone(fixture.trustedAuthority)
    mutate(mutatedAuthority)
    await expectAsyncFailure(label, () => validateStage4V2ScreenReviewRequest(fixture.request, {
      projectRoot: ROOT,
      verifyFiles: false,
      trustedAuthority: mutatedAuthority,
    }))
  }

  await expectAsyncFailure("self-reported authority", () => validateStage4V2ScreenReviewRequest(
    fixture.request,
    { projectRoot: ROOT, verifyFiles: false },
  ))
}

async function runFileDerivedBoundaryRegressions() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-stage4-v2-boundary-"))
  const writeFixture = async (relativePath, color) => {
    const absolutePath = path.join(temporaryRoot, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    await sharp({ create: { width: 256, height: 192, channels: 3, background: color } }).png().toFile(absolutePath)
    return absolutePath
  }
  const binding = (relativePath, role) => ({
    role,
    path: relativePath,
    sha256: sha256Bytes(fs.readFileSync(path.join(temporaryRoot, relativePath))),
  })
  try {
    await writeFixture(".runtime/ai-painter/current-package/candidate.png", { r: 30, g: 120, b: 50 })
    await writeFixture("data/ai-painter/current-package/reference.png", { r: 25, g: 115, b: 55 })
    for (const role of STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES) {
      await writeFixture(`data/ai-painter/current-package/${role}.png`, { r: 0, g: 0, b: 0 })
    }
    const conditionPath = "data/ai-painter/current-package/condition-pack.json"
    fs.mkdirSync(path.dirname(path.join(temporaryRoot, conditionPath)), { recursive: true })
    fs.writeFileSync(path.join(temporaryRoot, conditionPath), JSON.stringify({
      conditionPackId: "condition-pack-file-fixture-0001",
      channels: Array.from({ length: 23 }, (_, index) => ({ index })),
      canvas: { width: 256, height: 192 },
      reviewSubject: {
        rebuild64SequenceSeriesId: "not-the-rebuild64-series",
        regionalLandscapeType: "river-floodplain",
        expectedWaterMaskNonzeroPixels: 7,
      },
    }))
    const registryRecordPath = ".runtime/ai-painter/current-execution-registry/transactions/fixture/transaction.json"
    const executionPackageRecordPath = ".runtime/ai-painter/stage4-v2-execution-packages/fixture/package.json"
    const thresholdPath = CONTRACT_PATH
    fs.mkdirSync(path.dirname(path.join(temporaryRoot, thresholdPath)), { recursive: true })
    fs.copyFileSync(path.join(ROOT, CONTRACT_PATH), path.join(temporaryRoot, thresholdPath))
    const executionPackageIdentity = "stage4-v2-review-file-fixture-package-0001"
    const datasetReleaseIdentity = "stage4-v2-dataset-release-file-fixture-0001"
    const request = {
      schemaVersion: "ai-painter-stage4-v2-screen-review-request-v1",
      status: "cpu_supported_inactive",
      architectureId: ARCHITECTURE_ID,
      executionPackageIdentity,
      datasetReleaseIdentity,
      stage: "stage0",
      bindingPolicy: {
        explicitArtifactsOnly: true, latestPointerAllowed: false, historicalRunSelectionAllowed: false,
        crossExecutionPackageEvidenceAllowed: false, thresholdOverrideAllowed: false,
        reviewOutputMayBecomeTrainingTarget: false, failedPixelFeedbackMayBecomeTrainingTarget: false,
      },
      candidateRgb: { ...binding(".runtime/ai-painter/current-package/candidate.png", "complete_rgb_candidate"), executionPackageIdentity, completeFrame: true, width: 256, height: 192 },
      conditionPack: { ...binding(conditionPath, "condition_pack"), datasetReleaseIdentity, conditionPackId: "condition-pack-file-fixture-0001", channelCount: 23 },
      referenceRgb: { ...binding("data/ai-painter/current-package/reference.png", "approved_reference_rgb"), datasetReleaseIdentity, width: 256, height: 192 },
      objectMasks: STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES.map((role) => ({ ...binding(`data/ai-painter/current-package/${role}.png`, role), datasetReleaseIdentity })),
      thresholdContract: { ...binding(thresholdPath, "machine_review_threshold_contract"), schemaVersion: "ai-painter-stage4-v2-machine-review-threshold-contract-v1" },
    }
    const terminalPath = ".runtime/ai-painter/current-package/cpu-contract-terminal.json"
    const writeJson = (relativePath, value) => {
      const absolutePath = path.join(temporaryRoot, relativePath)
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
      fs.writeFileSync(absolutePath, JSON.stringify(value))
    }
    const currentStagedPath = ".runtime/ai-painter/current-execution-registry/transactions/fixture/current.staged.json"
    writeJson(terminalPath, {
      schemaVersion: "stage4-v2-cpu-contract-acceptance-terminal-v1",
      runId: executionPackageIdentity,
      architectureId: ARCHITECTURE_ID,
      executionState: "completed",
      status: "stage4_v2_cpu_contract_acceptance_passed_inactive",
    })
    const taskCapsulePath = ".runtime/ai-painter/current-package/task-capsule.json"
    writeJson(taskCapsulePath, {
      schemaVersion: "ai-painter-local-task-capsule-v1",
      runId: executionPackageIdentity,
      architectureId: ARCHITECTURE_ID,
      latestTerminal: binding(terminalPath, "cpu_contract_acceptance_terminal"),
      nextAllowedAction: { taskId: "plan_stage4_v2_readonly_gpu_qualification" },
    })
    writeJson(currentStagedPath, {
      schemaVersion: "ai-painter-current-execution-registry-v1",
      registryRevision: 7,
      eventSequence: 9,
      transactionId: "stage4-v2-review-file-fixture-transaction-0001",
      packageId: executionPackageIdentity,
      capabilityVersion: ARCHITECTURE_ID,
      executionState: "package_materialized",
      activeExecution: null,
      taskId: "plan_stage4_v2_readonly_gpu_qualification",
      runId: executionPackageIdentity,
      terminalEvidence: binding(terminalPath, "cpu_contract_acceptance_terminal"),
      taskCapsule: binding(taskCapsulePath, "current_task_capsule"),
    })
    const registry = {
      schemaVersion: "ai-painter-current-execution-registry-transaction-v1",
      status: "committed",
      transactionId: "stage4-v2-review-file-fixture-transaction-0001",
      registryRevision: 7,
      eventSequence: 9,
      currentSha256: binding(currentStagedPath, "current_staged").sha256,
      currentStaged: binding(currentStagedPath, "current_staged"),
    }
    const lineageFor = (activeRequest) => ({
      schemaVersion: "ai-painter-stage4-v2-current-execution-package-lineage-v1",
      authority: "local_ai_pet_world_program",
      status: "verified_immutable_current_execution_package",
      origin: "current_execution_registry_committed_transaction",
      registryTransaction: {
        transactionId: registry.transactionId,
        registryRevision: registry.registryRevision,
        eventSequence: registry.eventSequence,
        currentSha256: registry.currentSha256,
      },
      executionPackageIdentity: activeRequest.executionPackageIdentity,
      executionPackageRoot: ".runtime/ai-painter/current-package",
      datasetReleaseIdentity: activeRequest.datasetReleaseIdentity,
      currentExecution: {
        taskId: "plan_stage4_v2_readonly_gpu_qualification",
        runId: executionPackageIdentity,
      },
      sourceTerminal: {
        ...binding(terminalPath, "cpu_contract_acceptance_terminal"),
        status: "stage4_v2_cpu_contract_acceptance_passed_inactive",
      },
      candidateRgb: { path: activeRequest.candidateRgb.path, sha256: activeRequest.candidateRgb.sha256 },
      conditionPack: { path: activeRequest.conditionPack.path, sha256: activeRequest.conditionPack.sha256 },
      referenceRgb: { path: activeRequest.referenceRgb.path, sha256: activeRequest.referenceRgb.sha256 },
      objectMasks: activeRequest.objectMasks.map(({ role, path: artifactPath, sha256 }) => ({ role, path: artifactPath, sha256 })),
      thresholdContract: { path: activeRequest.thresholdContract.path, sha256: activeRequest.thresholdContract.sha256 },
    })
    const writeAuthorityRecords = (activeRequest) => {
      writeJson(registryRecordPath, registry)
      writeJson(executionPackageRecordPath, lineageFor(activeRequest))
      return {
        registryRecord: binding(registryRecordPath, "current_execution_registry_transaction"),
        executionPackageRecord: binding(executionPackageRecordPath, "stage4_v2_execution_package"),
      }
    }
    const writeLineage = (lineage) => {
      writeJson(executionPackageRecordPath, lineage)
      return {
        registryRecord: binding(registryRecordPath, "current_execution_registry_transaction"),
        executionPackageRecord: binding(executionPackageRecordPath, "stage4_v2_execution_package"),
      }
    }
    let trustedAuthority = writeAuthorityRecords(request)
    const ordinary = await validateStage4V2ScreenReviewRequest(request, { projectRoot: temporaryRoot, trustedAuthority })
    assert.deepEqual(ordinary.dimensions, { width: 256, height: 192, format: "png" })
    assert.deepEqual(ordinary.flowingWaterConnectivity.requiredBoundarySides, [])
    const flowing = structuredClone(request)
    const condition = JSON.parse(fs.readFileSync(path.join(temporaryRoot, conditionPath), "utf8"))
    condition.reviewSubject.rebuild64SequenceSeriesId = "thailand-rebuild64-20260731"
    fs.writeFileSync(path.join(temporaryRoot, conditionPath), JSON.stringify(condition))
    flowing.conditionPack.sha256 = sha256Bytes(fs.readFileSync(path.join(temporaryRoot, conditionPath)))
    trustedAuthority = writeAuthorityRecords(flowing)
    const conditional = await validateStage4V2ScreenReviewRequest(flowing, { projectRoot: temporaryRoot, trustedAuthority })
    assert.deepEqual(conditional.flowingWaterConnectivity.requiredBoundarySides, ["north", "south"])
    const badDimensions = structuredClone(flowing)
    badDimensions.candidateRgb.width = 1024
    await expectAsyncFailure("file-derived candidate dimensions", () => validateStage4V2ScreenReviewRequest(badDimensions, { projectRoot: temporaryRoot, trustedAuthority }))

    const currentStaged = JSON.parse(fs.readFileSync(path.join(temporaryRoot, currentStagedPath), "utf8"))
    currentStaged.packageId = "other-package-identity-0001"
    writeJson(currentStagedPath, currentStaged)
    registry.currentSha256 = binding(currentStagedPath, "current_staged").sha256
    registry.currentStaged = binding(currentStagedPath, "current_staged")
    await expectAsyncFailure("currentStaged package replacement", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeAuthorityRecords(flowing),
    }))
    currentStaged.packageId = executionPackageIdentity
    writeJson(currentStagedPath, currentStaged)
    registry.currentSha256 = binding(currentStagedPath, "current_staged").sha256
    registry.currentStaged = binding(currentStagedPath, "current_staged")

    writeJson(executionPackageRecordPath, {})
    await expectAsyncFailure("empty execution package record", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeLineage({}),
    }))

    let tamperedLineage = lineageFor(flowing)
    tamperedLineage.status = "historical_execution_package"
    await expectAsyncFailure("historical execution package record", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeLineage(tamperedLineage),
    }))

    tamperedLineage = lineageFor(flowing)
    tamperedLineage.candidateRgb.path = ".runtime/ai-painter/other-package/candidate.png"
    await expectAsyncFailure("cross-package lineage candidate", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeLineage(tamperedLineage),
    }))

    tamperedLineage = lineageFor(flowing)
    tamperedLineage.thresholdContract.sha256 = "b".repeat(64)
    await expectAsyncFailure("lineage threshold field replacement", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeLineage(tamperedLineage),
    }))

    registry.registryRevision = 0
    writeJson(registryRecordPath, registry)
    await expectAsyncFailure("invalid registry revision", () => validateStage4V2ScreenReviewRequest(flowing, {
      projectRoot: temporaryRoot,
      trustedAuthority: writeLineage(lineageFor(flowing)),
    }))
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

const contract = readJson(CONTRACT_PATH)
assert.match(CONTRACT_SHA256, SHA256_PATTERN)
validateThresholdContract(contract, { verifyContractBytes: true })
validateNumericThresholds(contract)
validateFailureAndTrainingSeparation(contract)
assertSourceAnchors()
runContractMutationRegressions(contract)
await runBoundaryRegressions()
await runFileDerivedBoundaryRegressions()

console.log(JSON.stringify({
  status: "passed",
  contractPath: CONTRACT_PATH,
  contractSha256: CONTRACT_SHA256,
  architectureId: ARCHITECTURE_ID,
  styleFingerprintPath: STYLE_FINGERPRINT_PATH,
  styleFingerprintSha256: STYLE_FINGERPRINT_SHA256,
  derivedProfessionalThresholdCount: MULTISCALE_TEXTURE_FEATURES.length + 2,
  formalReviewRunnerState: contract.formalReviewBoundary.runnerState,
  formalReviewRunnerDispatchable: contract.formalReviewBoundary.dispatchable,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
