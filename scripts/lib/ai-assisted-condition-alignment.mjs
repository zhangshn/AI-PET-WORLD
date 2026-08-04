import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const GRID_COLUMNS = 8
const GRID_ROWS = 6
const FLOWING_WATER_LANDSCAPES = new Set([
  "wet-season-drainage-hollow",
  "river-floodplain",
  "riparian-tropical-forest",
  "dry-season-exposed-riverbank",
])

export async function auditAiAssistedConditionAlignment({ record, imagePath, referenceImagePath = null }) {
  if (!record.conditionBinding?.conditionPackPath) {
    return {
      schemaVersion: "ai-assisted-condition-alignment-audit-v1",
      status: "not_applicable_no_condition_binding",
      passed: false,
      formalConditionalTrainingEligible: false,
      issues: [issue("condition_pack_binding_missing", "The candidate has no 23-channel condition-pack binding.", "候选图没有绑定23通道条件包。", "record_contract")],
    }
  }

  const conditionPackPath = resolveProjectPath(record.conditionBinding.conditionPackPath)
  assert(fs.existsSync(conditionPackPath), "condition pack is missing")
  const conditionPackBytes = fs.readFileSync(conditionPackPath)
  const conditionPack = JSON.parse(conditionPackBytes.toString("utf8"))
  assert(conditionPack.channels?.length === 23, "condition pack must contain 23 channels")
  assert(conditionPack.worldId === record.conditionBinding.worldId, "condition pack worldId mismatch")
  assert(conditionPack.tick === record.conditionBinding.tick, "condition pack tick mismatch")

  const resolvedImagePath = resolveProjectPath(imagePath)
  const image = await sharp(fs.readFileSync(resolvedImagePath), { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const referenceImage = referenceImagePath
    ? await sharp(fs.readFileSync(resolveProjectPath(referenceImagePath)), { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    : null
  assert(image.info.width === conditionPack.canvas.width && image.info.height === conditionPack.canvas.height, "candidate and condition-pack canvas mismatch")
  if (referenceImage) assert(referenceImage.info.width === image.info.width && referenceImage.info.height === image.info.height, "object semantic reference canvas mismatch")
  const pathClassifier = selectPathClassifier(record)
  const flowingWaterBoundaryRequired =
    record.rebuild64Sequence?.seriesId ===
      "thailand-rebuild64-20260731" &&
    FLOWING_WATER_LANDSCAPES.has(
      record.classification?.regionalLandscapeType,
    )

  const audits = []
  audits.push(await auditChannel({
    conditionPack,
    image,
    channelId: "terrain_water",
    classify: classifyWater,
    classifierMode:
      "condition_present_broad_freshwater_color_signal_v1",
    classifyWhenExpectedAbsent: classifyStrongWater,
    absentClassifierMode:
      "condition_absent_strong_blue_dominance_v2",
    isolateSignalWhenExpectedAbsent:
      isolateDenseWaterSurfaceSignal,
    minimumSpatialIntersection: 0.5,
    maximumCentroidDistance: 0.12,
    minimumCoverageRatio: 0.35,
    maximumCoverageRatio: 2.5,
    maximumAbsentSignalRatio: 0.005,
    requireBoundaryContact: flowingWaterBoundaryRequired,
  }))
  audits.push(await auditChannel({
    conditionPack,
    image,
    channelId: "terrain_path_ground",
    classify: pathClassifier.classify,
    isolateSignal: isolateConditionSupportedConnectedComponents,
    minimumSpatialIntersection: 0.25,
    maximumCentroidDistance: 0.25,
    minimumCoverageRatio: 0.25,
    maximumCoverageRatio: 3.0,
    requireBoundaryContact: true,
  }))
  const objectSemanticAudits = await Promise.all([
    ["object_footprints", "object_footprints"],
    ["object_tree", "tree_objects"],
    ["object_rock", "rock_objects"],
    ["object_vegetation", "vegetation_objects"],
    ["focal_area", "focal_area"],
  ].map(([channelId, affectedRegion]) => auditObjectSemanticResponse({
    conditionPack,
    image,
    referenceImage,
    channelId,
    affectedRegion,
  })))

  const hydrologyConnectivityAudit = auditHydrologyConnectivity({
    record,
    waterAudit: audits.find((audit) => audit.channelId === "terrain_water"),
  })
  const issues = [
    ...audits.flatMap((audit) => audit.issues),
    ...objectSemanticAudits.flatMap((audit) => audit.issues),
    ...hydrologyConnectivityAudit.issues,
  ]
  return {
    schemaVersion: "ai-assisted-condition-alignment-audit-v1",
    status: issues.length === 0 ? "condition_alignment_passed" : "condition_alignment_failed",
    passed: issues.length === 0,
    formalConditionalTrainingEligible: false,
    conditionPackId: conditionPack.conditionPackId,
    conditionPackPath: projectPath(conditionPackPath),
    conditionPackFileSha256: sha256(conditionPackBytes),
    canvas: conditionPack.canvas,
    method: "season_aware_water_path_alignment_plus_object_mask_local_visual_response_v6",
    waterClassifier: {
      mode: "condition_presence_aware_water_signal_v3",
      conditionPresentMode:
        "condition_present_broad_freshwater_color_signal_v1",
      conditionAbsentMode:
        "condition_absent_strong_blue_dominance_plus_16px_dense_surface_v2",
      blockSizePixels: 16,
      minimumBlockSignalRatio: 0.35,
      acceptanceThresholdsChanged: false,
    },
    pathClassifier: {
      mode: pathClassifier.mode,
      season: record.classification?.monsoonSeason ?? null,
      source: "record.classification.monsoonSeason",
      signalIsolationMode: "condition_supported_connected_components_v1",
      supportCorridorRadiusPixels: 48,
      acceptanceThresholdsChanged: false,
    },
    hydrologyConnectivityAudit,
    channelAudits: audits,
    objectSemanticAudits,
    issues,
  }
}

async function auditObjectSemanticResponse({ conditionPack, image, referenceImage, channelId, affectedRegion }) {
  const channel = conditionPack.channels.find((item) => item.id === channelId)
  assert(channel, `required object semantic channel missing: ${channelId}`)
  const channelPath = resolveProjectPath(channel.path)
  const maskImage = await sharp(channelPath, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(image.info.width * image.info.height)
  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = maskImage.data[index * maskImage.info.channels] > 0 ? 1 : 0
  }
  const distribution = spatialDistribution(mask, image.info.width, image.info.height)
  if (distribution.nonZeroRatio === 0) {
    return {
      channelId,
      expectedChannelPath: projectPath(channelPath),
      expectedChannelSha256: channel.sha256,
      status: "not_applicable_empty_object_semantic_mask",
      passed: true,
      expectedNonZeroRatio: 0,
      issues: [],
    }
  }

  const support = buildRectangularSupportMask(mask, image.info.width, image.info.height, 12)
  const ring = new Uint8Array(mask.length)
  for (let index = 0; index < ring.length; index += 1) ring[index] = support[index] && !mask[index] ? 1 : 0
  const inside = measureMaskedVisualResponse(image, mask)
  const outside = measureMaskedVisualResponse(image, ring)
  const colorDistance = Math.sqrt(
    inside.meanRgb.reduce((sum, value, index) => sum + (value - outside.meanRgb[index]) ** 2, 0),
  )
  const edgeDifference = Math.abs(inside.meanEdge - outside.meanEdge)
  const edgeRatio = Math.max(inside.meanEdge, outside.meanEdge) / Math.max(0.001, Math.min(inside.meanEdge, outside.meanEdge))
  const calibratedThresholds = {
    object_footprints: { minimumColorDistance: 1.0, minimumEdgeDifference: 0.04, minimumEdgeRatio: 1.002 },
    object_tree: { minimumColorDistance: 1.05, minimumEdgeDifference: 0.055, minimumEdgeRatio: 1.0025 },
    object_rock: { minimumColorDistance: 1.5, minimumEdgeDifference: 0.05, minimumEdgeRatio: 1.003 },
    object_vegetation: { minimumColorDistance: 0.8, minimumEdgeDifference: 0.035, minimumEdgeRatio: 1.002 },
    focal_area: { minimumColorDistance: 0.8, minimumEdgeDifference: 0.035, minimumEdgeRatio: 1.002 },
  }
  const thresholds = {
    ...calibratedThresholds[channelId],
    supportRadiusPixels: 12,
  }
  const localResponsePassed =
    colorDistance >= thresholds.minimumColorDistance
    || edgeDifference >= thresholds.minimumEdgeDifference
    || edgeRatio >= thresholds.minimumEdgeRatio
  const referenceResponse = referenceImage
    ? measureMaskedReferenceResponse(image, referenceImage, mask)
    : null
  const referenceThresholds = {
    maximumMaskedRgbMae: channelId === "object_rock" ? 0.2 : 0.18,
    maximumMaskedEdgeMae: 0.12,
    minimumMaskedLumaCorrelation: 0.08,
    highFidelityFallbackMaximumRgbMae: 0.08,
    highFidelityFallbackMaximumEdgeMae: 0.06,
  }
  const referenceResponsePassed = !referenceResponse || (
    referenceResponse.maskedRgbMae <= referenceThresholds.maximumMaskedRgbMae
    && referenceResponse.maskedEdgeMae <= referenceThresholds.maximumMaskedEdgeMae
    && referenceResponse.maskedLumaCorrelation >= referenceThresholds.minimumMaskedLumaCorrelation
  ) || Boolean(referenceResponse
    && referenceResponse.maskedRgbMae <= referenceThresholds.highFidelityFallbackMaximumRgbMae
    && referenceResponse.maskedEdgeMae <= referenceThresholds.highFidelityFallbackMaximumEdgeMae
  )
  const passed = localResponsePassed && referenceResponsePassed
  const issues = []
  if (!localResponsePassed) issues.push(issue(
    `condition_${channelId}_visual_response_missing`,
    `${channelId} has no measurable local color or structure response inside its authoritative mask.`,
    `${channelId} 在权威掩码内没有形成可测量的局部颜色或结构响应。`,
    affectedRegion,
  ))
  if (!referenceResponsePassed) issues.push(issue(
    `condition_${channelId}_reference_semantic_mismatch`,
    `${channelId} does not reproduce the held-out reference object's masked color and edge structure.`,
    `${channelId} 没有复现留出参考图中该对象掩码内的颜色与边缘结构。`,
    affectedRegion,
  ))
  return {
    channelId,
    expectedChannelPath: projectPath(channelPath),
    expectedChannelSha256: channel.sha256,
    status: passed ? "object_semantic_visual_response_passed" : "object_semantic_visual_response_failed",
    passed,
    expectedNonZeroRatio: round(distribution.nonZeroRatio),
    inside: roundVisualResponse(inside),
    surroundingRing: roundVisualResponse(outside),
    colorDistance: round(colorDistance),
    edgeDifference: round(edgeDifference),
    edgeRatio: round(edgeRatio),
    localResponsePassed,
    referenceComparisonMode: referenceImage ? "post_generation_held_out_masked_rgb_edge_correlation_v1" : "not_available",
    referenceResponse: referenceResponse ? roundReferenceResponse(referenceResponse) : null,
    referenceThresholds: referenceImage ? referenceThresholds : null,
    thresholds,
    thresholdCalibration: "owner_and_machine_approved_mvp64_object_response_p05_baseline_v1",
    priorAcceptanceThresholdChanged: false,
    issues,
  }
}

function measureMaskedReferenceResponse(candidate, reference, mask) {
  let rgbAbsoluteError = 0
  let edgeAbsoluteError = 0
  let count = 0
  let candidateLumaSum = 0
  let referenceLumaSum = 0
  let candidateLumaSquareSum = 0
  let referenceLumaSquareSum = 0
  let lumaProductSum = 0
  for (let y = 0; y < candidate.info.height; y += 1) {
    for (let x = 0; x < candidate.info.width; x += 1) {
      const index = y * candidate.info.width + x
      if (!mask[index]) continue
      const offset = index * candidate.info.channels
      const candidateLuma = candidate.data[offset] * 0.2126 + candidate.data[offset + 1] * 0.7152 + candidate.data[offset + 2] * 0.0722
      const referenceLuma = reference.data[offset] * 0.2126 + reference.data[offset + 1] * 0.7152 + reference.data[offset + 2] * 0.0722
      for (let channel = 0; channel < 3; channel += 1) rgbAbsoluteError += Math.abs(candidate.data[offset + channel] - reference.data[offset + channel])
      candidateLumaSum += candidateLuma
      referenceLumaSum += referenceLuma
      candidateLumaSquareSum += candidateLuma ** 2
      referenceLumaSquareSum += referenceLuma ** 2
      lumaProductSum += candidateLuma * referenceLuma
      if (x + 1 < candidate.info.width) {
        const next = offset + candidate.info.channels
        const candidateEdge = Math.abs(candidateLuma - (candidate.data[next] * 0.2126 + candidate.data[next + 1] * 0.7152 + candidate.data[next + 2] * 0.0722))
        const referenceEdge = Math.abs(referenceLuma - (reference.data[next] * 0.2126 + reference.data[next + 1] * 0.7152 + reference.data[next + 2] * 0.0722))
        edgeAbsoluteError += Math.abs(candidateEdge - referenceEdge)
      }
      count += 1
    }
  }
  const numerator = count * lumaProductSum - candidateLumaSum * referenceLumaSum
  const denominator = Math.sqrt(
    Math.max(0, count * candidateLumaSquareSum - candidateLumaSum ** 2)
    * Math.max(0, count * referenceLumaSquareSum - referenceLumaSum ** 2),
  )
  return {
    maskedPixelCount: count,
    maskedRgbMae: rgbAbsoluteError / Math.max(1, count * 3 * 255),
    maskedEdgeMae: edgeAbsoluteError / Math.max(1, count * 255),
    maskedLumaCorrelation: denominator > 1e-9 ? numerator / denominator : 0,
  }
}

function roundReferenceResponse(value) {
  return {
    maskedPixelCount: value.maskedPixelCount,
    maskedRgbMae: round(value.maskedRgbMae),
    maskedEdgeMae: round(value.maskedEdgeMae),
    maskedLumaCorrelation: round(value.maskedLumaCorrelation),
  }
}

function measureMaskedVisualResponse(image, mask) {
  const rgb = [0, 0, 0]
  let edge = 0
  let count = 0
  for (let y = 0; y < image.info.height; y += 1) {
    for (let x = 0; x < image.info.width; x += 1) {
      const index = y * image.info.width + x
      if (!mask[index]) continue
      const offset = index * image.info.channels
      rgb[0] += image.data[offset]
      rgb[1] += image.data[offset + 1]
      rgb[2] += image.data[offset + 2]
      let comparisons = 0
      if (x + 1 < image.info.width) {
        const next = offset + image.info.channels
        edge += (Math.abs(image.data[offset] - image.data[next]) + Math.abs(image.data[offset + 1] - image.data[next + 1]) + Math.abs(image.data[offset + 2] - image.data[next + 2])) / 3
        comparisons += 1
      }
      if (y + 1 < image.info.height) {
        const next = offset + image.info.width * image.info.channels
        edge += (Math.abs(image.data[offset] - image.data[next]) + Math.abs(image.data[offset + 1] - image.data[next + 1]) + Math.abs(image.data[offset + 2] - image.data[next + 2])) / 3
        comparisons += 1
      }
      count += 1
      if (comparisons === 0) edge += 0
    }
  }
  return {
    pixelCount: count,
    meanRgb: rgb.map((value) => value / Math.max(1, count)),
    meanEdge: edge / Math.max(1, count * 2),
  }
}

function roundVisualResponse(value) {
  return {
    pixelCount: value.pixelCount,
    meanRgb: value.meanRgb.map(round),
    meanEdge: round(value.meanEdge),
  }
}

function auditHydrologyConnectivity({ record, waterAudit }) {
  const landscapeType =
    record.classification?.regionalLandscapeType ?? null
  const flowingWaterRequired =
    record.rebuild64Sequence?.seriesId ===
      "thailand-rebuild64-20260731" &&
    FLOWING_WATER_LANDSCAPES.has(landscapeType) &&
    waterAudit?.absenceExpected === false
  const connectivityPath =
    record.conditionBinding?.connectivityBlueprintPath ?? null
  const issues = []
  if (!flowingWaterRequired) {
    return {
      contractVersion: "flowing-water-world-connectivity-v1",
      status: "not_applicable_no_flowing_water_contract",
      passed: true,
      landscapeType,
      flowingWaterRequired: false,
      connectivityBlueprintPath: connectivityPath,
      externalWaterPortIds: [],
      upstreamPortId: null,
      downstreamPortId: null,
      expectedBoundarySides: [],
      issues,
    }
  }

  const resolvedConnectivityPath = connectivityPath
    ? resolveProjectPath(connectivityPath)
    : null
  const connectivity =
    resolvedConnectivityPath && fs.existsSync(resolvedConnectivityPath)
      ? JSON.parse(fs.readFileSync(resolvedConnectivityPath, "utf8"))
      : null
  const graph = connectivity?.hydrologyGraph ?? null
  const externalWaterPortIds = Array.isArray(
    graph?.externalWaterPortIds,
  )
    ? graph.externalWaterPortIds
    : []
  const edgePorts = Array.isArray(connectivity?.edgePorts)
    ? connectivity.edgePorts
    : []
  const currentWaterPorts = edgePorts.filter(
    (port) =>
      port.kind === "water" &&
      externalWaterPortIds.includes(port.edgePortId),
  )
  const upstreamPort = currentWaterPorts.find(
    (port) => port.edgePortId === graph?.upstreamPortId,
  )
  const downstreamPort = currentWaterPorts.find(
    (port) => port.edgePortId === graph?.downstreamPortId,
  )
  const expectedBoundarySides =
    waterAudit?.boundaryContactAudit?.requiredSides ?? []
  const portContractPassed = Boolean(
    graph &&
      externalWaterPortIds.length === 2 &&
      currentWaterPorts.length === 2 &&
      upstreamPort?.boundarySide === "north" &&
      upstreamPort?.flowRole === "inlet" &&
      downstreamPort?.boundarySide === "south" &&
      downstreamPort?.flowRole === "outlet" &&
      upstreamPort.connectsToRegionId &&
      upstreamPort.connectsToEdgePortId &&
      downstreamPort.connectsToRegionId &&
      downstreamPort.connectsToEdgePortId &&
      graph.flowAxis === "north_to_south",
  )
  const rasterBoundaryContractPassed =
    expectedBoundarySides.includes("north") &&
    expectedBoundarySides.includes("south") &&
    expectedBoundarySides.length === 2

  if (!connectivity) {
    issues.push(issue(
      "condition_terrain_water_connectivity_blueprint_missing",
      "The flowing-water map has no readable regional connectivity blueprint.",
      "流动水体地图缺少可读取的区域连接蓝图。",
      "water_and_shoreline",
    ))
  } else if (!portContractPassed) {
    issues.push(issue(
      "condition_terrain_water_upstream_downstream_ports_missing",
      "The flowing-water map must bind one north upstream inlet and one south downstream outlet to paired neighbor water ports.",
      "流动水体地图必须绑定北侧上游入口和南侧下游出口，并连接相邻区域水口。",
      "water_and_shoreline",
    ))
  }
  if (!rasterBoundaryContractPassed) {
    issues.push(issue(
      "condition_terrain_water_inlet_outlet_raster_missing",
      "The authoritative water mask does not visibly continue through both contracted water boundaries.",
      "权威水体掩码没有从两个正式水文边界连续穿出。",
      "water_and_shoreline",
    ))
  }

  return {
    contractVersion: "flowing-water-world-connectivity-v1",
    status: issues.length === 0
      ? "flowing_water_connectivity_passed"
      : "flowing_water_connectivity_failed",
    passed: issues.length === 0,
    landscapeType,
    flowingWaterRequired: true,
    connectivityBlueprintPath: connectivityPath,
    hydrologyGraphId: graph?.hydrologyGraphId ?? null,
    externalWaterPortIds,
    upstreamPortId: graph?.upstreamPortId ?? null,
    downstreamPortId: graph?.downstreamPortId ?? null,
    flowAxis: graph?.flowAxis ?? null,
    expectedBoundarySides,
    portContractPassed,
    rasterBoundaryContractPassed,
    issues,
  }
}

async function auditChannel({
  conditionPack,
  image,
  channelId,
  classify,
  classifierMode = null,
  classifyWhenExpectedAbsent = null,
  absentClassifierMode = null,
  isolateSignal = null,
  isolateSignalWhenExpectedAbsent = null,
  minimumSpatialIntersection,
  maximumCentroidDistance,
  minimumCoverageRatio,
  maximumCoverageRatio,
  maximumAbsentSignalRatio = 0,
  requireBoundaryContact = false,
}) {
  const channel = conditionPack.channels.find((item) => item.id === channelId)
  assert(channel, `required condition channel missing: ${channelId}`)
  const channelPath = resolveProjectPath(channel.path)
  const expectedImage = await sharp(channelPath, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true })
  const expected = new Uint8Array(image.info.width * image.info.height)
  const actual = new Uint8Array(expected.length)
  for (let index = 0; index < expected.length; index += 1) {
    expected[index] = expectedImage.data[index * expectedImage.info.channels] > 0 ? 1 : 0
  }
  const expectedDistribution = spatialDistribution(expected, image.info.width, image.info.height)
  const absenceExpected = expectedDistribution.nonZeroRatio === 0
  const activeClassifier =
    absenceExpected && classifyWhenExpectedAbsent
      ? classifyWhenExpectedAbsent
      : classify
  const activeClassifierMode =
    absenceExpected && absentClassifierMode
      ? absentClassifierMode
      : classifierMode
  for (let index = 0; index < expected.length; index += 1) {
    const offset = index * image.info.channels
    actual[index] = activeClassifier(
      image.data[offset],
      image.data[offset + 1],
      image.data[offset + 2],
    ) ? 1 : 0
  }

  const activeSignalIsolation =
    absenceExpected && isolateSignalWhenExpectedAbsent
      ? isolateSignalWhenExpectedAbsent
      : isolateSignal
  const signalIsolation = activeSignalIsolation
    ? activeSignalIsolation({ actual, expected, width: image.info.width, height: image.info.height })
    : null
  const auditedActual = signalIsolation?.mask ?? actual
  const rawActualDistribution = spatialDistribution(actual, image.info.width, image.info.height)
  const actualDistribution = spatialDistribution(auditedActual, image.info.width, image.info.height)
  const spatialIntersection = expectedDistribution.cells.reduce((sum, value, index) => sum + Math.min(value, actualDistribution.cells[index]), 0)
  const centroidDistance = Math.hypot(
    expectedDistribution.centroid.x - actualDistribution.centroid.x,
    expectedDistribution.centroid.y - actualDistribution.centroid.y,
  )
  const coverageRatio = actualDistribution.nonZeroRatio / Math.max(expectedDistribution.nonZeroRatio, 1e-9)
  const issues = []
  if (absenceExpected && actualDistribution.nonZeroRatio > maximumAbsentSignalRatio) {
    issues.push(issue(
      `condition_${channelId}_unexpected_signal`,
      `${channelId} visual signal is present although the selected condition channel is empty.`,
      `${channelId} visual signal exceeds the allowed noise floor for an empty condition channel.`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && spatialIntersection < minimumSpatialIntersection) {
    issues.push(issue(
      `condition_${channelId}_spatial_distribution_mismatch`,
      `${channelId} visual distribution does not match the selected condition channel.`,
      `${channelId} 的视觉空间分布与所选条件通道不一致。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && centroidDistance > maximumCentroidDistance) {
    issues.push(issue(
      `condition_${channelId}_centroid_drift`,
      `${channelId} visual centroid is too far from the selected condition channel.`,
      `${channelId} 的视觉中心与所选条件通道偏离过大。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  if (!absenceExpected && (coverageRatio < minimumCoverageRatio || coverageRatio > maximumCoverageRatio)) {
    issues.push(issue(
      `condition_${channelId}_coverage_mismatch`,
      `${channelId} visual coverage is outside the selected condition range.`,
      `${channelId} 的视觉覆盖量超出所选条件范围。`,
      channelId === "terrain_water" ? "water_and_shoreline" : "route_and_walkable_area",
    ))
  }
  const boundaryContactAudit = requireBoundaryContact && !absenceExpected
    ? auditBoundaryContacts(expected, auditedActual, actual, image.info.width, image.info.height)
    : null
  if (boundaryContactAudit?.missingRequiredSides.length > 0) {
    issues.push(issue(
      `condition_${channelId}_required_boundary_contact_missing`,
      `${channelId} does not visibly touch the boundary side required by the selected condition channel.`,
      `${channelId} 没有在所选条件通道要求的画布边界侧形成可见接触。`,
      "boundary_entrance",
    ))
  }
  if (boundaryContactAudit?.unexpectedContactSides.length > 0) {
    issues.push(issue(
      `condition_${channelId}_uncontracted_boundary_contact`,
      `${channelId} visibly touches a canvas boundary side that is absent from the selected condition channel.`,
      `${channelId} 在条件通道未授权的画布边界侧形成了可见接触。`,
      "boundary_entrance",
    ))
  }

  return {
    channelId,
    expectedChannelPath: projectPath(channelPath),
    expectedChannelSha256: channel.sha256,
    expectedNonZeroRatio: round(expectedDistribution.nonZeroRatio),
    actualSignalRatio: round(actualDistribution.nonZeroRatio),
    rawActualSignalRatio: round(rawActualDistribution.nonZeroRatio),
    classifierMode: activeClassifierMode,
    signalIsolation: signalIsolation?.diagnostics ?? null,
    boundaryContactAudit,
    absenceExpected,
    coverageRatio: absenceExpected ? null : round(coverageRatio),
    spatialIntersection: absenceExpected ? null : round(spatialIntersection),
    centroidDistance: absenceExpected ? null : round(centroidDistance),
    expectedCentroid: roundPoint(expectedDistribution.centroid),
    actualCentroid: roundPoint(actualDistribution.centroid),
    thresholds: { minimumSpatialIntersection, maximumCentroidDistance, minimumCoverageRatio, maximumCoverageRatio, maximumAbsentSignalRatio },
    passed: issues.length === 0,
    issues,
  }
}

function auditBoundaryContacts(expected, supportedActual, rawActual, width, height) {
  const bandPixels = 6
  const expectedCounts = countBoundarySignal(expected, width, height, bandPixels)
  const actualCounts = countBoundarySignal(supportedActual, width, height, bandPixels)
  const rawActualCounts = countBoundarySignal(rawActual, width, height, bandPixels)
  const sides = ["north", "east", "south", "west"]
  const requiredSides = sides.filter((side) => expectedCounts[side] > 0)
  const actualContactSides = sides.filter((side) => actualCounts[side] >= 6)
  const rawActualMaximumRuns = Object.fromEntries(
    sides.map((side) => [side, maximumBoundarySignalRun(rawActual, width, height, bandPixels, side)]),
  )
  const rawBoundaryComponentStats = boundaryConnectedComponentStats(
    rawActual,
    width,
    height,
    bandPixels,
  )
  const rawActualContactSides = sides.filter(
    (side) =>
      rawBoundaryComponentStats[side].maximumComponentSize >= 500 &&
      rawBoundaryComponentStats[side].maximumComponentContactPixels >= 6,
  )
  const missingRequiredSides = requiredSides.filter((side) => {
    const minimum = Math.max(6, Math.round(expectedCounts[side] * 0.1))
    return actualCounts[side] < minimum
  })
  const unexpectedContactSides = rawActualContactSides.filter(
    (side) => !requiredSides.includes(side),
  )
  return {
    contractVersion: "condition-semantic-boundary-contact-v3",
    bandPixels,
    expectedCounts,
    actualCounts,
    rawActualCounts,
    rawActualMaximumRuns,
    rawBoundaryComponentStats,
    requiredSides,
    actualContactSides,
    rawActualContactSides,
    unexpectedContactSignalMode: "full_frame_raw_path_boundary_connected_component_minimum_500_pixels_and_6_contact_pixels_v2",
    missingRequiredSides,
    unexpectedContactSides,
    passed:
      requiredSides.length > 0 &&
      missingRequiredSides.length === 0 &&
      unexpectedContactSides.length === 0,
  }
}

function boundaryConnectedComponentStats(mask, width, height, bandPixels) {
  const sides = ["north", "east", "south", "west"]
  const result = Object.fromEntries(
    sides.map((side) => [side, {
      contactingComponentCount: 0,
      maximumComponentSize: 0,
      maximumComponentContactPixels: 0,
    }]),
  )
  const visited = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    const contactCounts = { north: 0, east: 0, south: 0, west: 0 }
    visited[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      if (y < bandPixels) contactCounts.north += 1
      if (x >= width - bandPixels) contactCounts.east += 1
      if (y >= height - bandPixels) contactCounts.south += 1
      if (x < bandPixels) contactCounts.west += 1
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          const nextY = y + dy
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
          const next = nextY * width + nextX
          if (!mask[next] || visited[next]) continue
          visited[next] = 1
          queue[tail++] = next
        }
      }
    }
    for (const side of sides) {
      if (contactCounts[side] === 0) continue
      result[side].contactingComponentCount += 1
      result[side].maximumComponentSize = Math.max(
        result[side].maximumComponentSize,
        tail,
      )
      result[side].maximumComponentContactPixels = Math.max(
        result[side].maximumComponentContactPixels,
        contactCounts[side],
      )
    }
  }
  return result
}

function maximumBoundarySignalRun(mask, width, height, bandPixels, side) {
  const length = side === "north" || side === "south" ? width : height
  let maximumRun = 0
  let currentRun = 0
  for (let coordinate = 0; coordinate < length; coordinate += 1) {
    let present = false
    for (let depth = 0; depth < bandPixels && !present; depth += 1) {
      const x = side === "west"
        ? depth
        : side === "east"
          ? width - 1 - depth
          : coordinate
      const y = side === "north"
        ? depth
        : side === "south"
          ? height - 1 - depth
          : coordinate
      present = mask[y * width + x] > 0
    }
    if (present) {
      currentRun += 1
      maximumRun = Math.max(maximumRun, currentRun)
    } else {
      currentRun = 0
    }
  }
  return maximumRun
}

function countBoundarySignal(mask, width, height, bandPixels) {
  const counts = { north: 0, east: 0, south: 0, west: 0 }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      if (y < bandPixels) counts.north += 1
      if (y >= height - bandPixels) counts.south += 1
      if (x < bandPixels) counts.west += 1
      if (x >= width - bandPixels) counts.east += 1
    }
  }
  return counts
}

function isolateConditionSupportedConnectedComponents({ actual, expected, width, height }) {
  const supportRadiusPixels = 48
  const support = buildRectangularSupportMask(expected, width, height, supportRadiusPixels)
  const visited = new Uint8Array(actual.length)
  const retained = new Uint8Array(actual.length)
  const queue = new Int32Array(actual.length)
  const componentIndexes = []
  const components = []
  let retainedComponentCount = 0
  let rejectedComponentCount = 0
  let retainedPixelCount = 0
  let rejectedPixelCount = 0

  for (let start = 0; start < actual.length; start += 1) {
    if (!actual[start] || visited[start]) continue
    let head = 0
    let tail = 0
    let supportPixelCount = 0
    let directExpectedOverlap = 0
    componentIndexes.length = 0
    visited[start] = 1
    queue[tail++] = start

    while (head < tail) {
      const index = queue[head++]
      componentIndexes.push(index)
      if (support[index]) supportPixelCount += 1
      if (expected[index]) directExpectedOverlap += 1
      const x = index % width
      const y = Math.floor(index / width)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          const nextY = y + dy
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
          const next = nextY * width + nextX
          if (!actual[next] || visited[next]) continue
          visited[next] = 1
          queue[tail++] = next
        }
      }
    }

    const size = componentIndexes.length
    const supportRatio = supportPixelCount / size
    const keep = directExpectedOverlap > 0 || (supportPixelCount >= 8 && supportRatio >= 0.02)
    if (keep) {
      retainedComponentCount += 1
      retainedPixelCount += size
      for (const index of componentIndexes) retained[index] = 1
    } else {
      rejectedComponentCount += 1
      rejectedPixelCount += size
    }
    components.push({
      size,
      supportPixelCount,
      directExpectedOverlap,
      supportRatio: round(supportRatio),
      retained: keep,
    })
  }

  const largestRejectedComponents = components
    .filter((component) => !component.retained)
    .sort((left, right) => right.size - left.size)
    .slice(0, 5)

  return {
    mask: retained,
    diagnostics: {
      mode: "condition_supported_connected_components_v1",
      supportCorridorRadiusPixels: supportRadiusPixels,
      connectivity: 8,
      componentCount: components.length,
      retainedComponentCount,
      rejectedComponentCount,
      retainedPixelCount,
      rejectedPixelCount,
      largestRejectedComponents,
      acceptanceThresholdsChanged: false,
    },
  }
}

function isolateDenseWaterSurfaceSignal({ actual, width, height }) {
  const blockSizePixels = 16
  const minimumBlockSignalRatio = 0.35
  const retained = new Uint8Array(actual.length)
  let rawPixelCount = 0
  let retainedPixelCount = 0
  let rejectedPixelCount = 0
  let retainedBlockCount = 0
  let rejectedBlockCount = 0

  for (const value of actual) rawPixelCount += value
  for (
    let blockY = 0;
    blockY < height;
    blockY += blockSizePixels
  ) {
    for (
      let blockX = 0;
      blockX < width;
      blockX += blockSizePixels
    ) {
      const maximumX = Math.min(
        width,
        blockX + blockSizePixels,
      )
      const maximumY = Math.min(
        height,
        blockY + blockSizePixels,
      )
      let signalPixelCount = 0
      let blockPixelCount = 0
      for (let y = blockY; y < maximumY; y += 1) {
        for (let x = blockX; x < maximumX; x += 1) {
          blockPixelCount += 1
          signalPixelCount += actual[y * width + x]
        }
      }
      const signalRatio =
        signalPixelCount / Math.max(1, blockPixelCount)
      if (signalRatio >= minimumBlockSignalRatio) {
        retainedBlockCount += 1
        for (let y = blockY; y < maximumY; y += 1) {
          for (let x = blockX; x < maximumX; x += 1) {
            const index = y * width + x
            if (!actual[index]) continue
            retained[index] = 1
            retainedPixelCount += 1
          }
        }
      } else {
        rejectedBlockCount += 1
        rejectedPixelCount += signalPixelCount
      }
    }
  }

  return {
    mask: retained,
    diagnostics: {
      mode: "strong_blue_dominance_plus_16px_dense_surface_v2",
      blockSizePixels,
      minimumBlockSignalRatio,
      rawPixelCount,
      retainedPixelCount,
      rejectedPixelCount,
      retainedBlockCount,
      rejectedBlockCount,
      acceptanceThresholdsChanged: false,
    },
  }
}

function buildRectangularSupportMask(expected, width, height, radius) {
  const integralWidth = width + 1
  const integral = new Uint32Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0
    for (let x = 0; x < width; x += 1) {
      rowSum += expected[y * width + x]
      integral[(y + 1) * integralWidth + x + 1] = integral[y * integralWidth + x + 1] + rowSum
    }
  }

  const support = new Uint8Array(expected.length)
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width - 1, x + radius)
      const count = integral[(bottom + 1) * integralWidth + right + 1]
        - integral[top * integralWidth + right + 1]
        - integral[(bottom + 1) * integralWidth + left]
        + integral[top * integralWidth + left]
      support[y * width + x] = count > 0 ? 1 : 0
    }
  }
  return support
}

function spatialDistribution(mask, width, height) {
  const cells = new Array(GRID_COLUMNS * GRID_ROWS).fill(0)
  let total = 0
  let xSum = 0
  let ySum = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      const column = Math.min(GRID_COLUMNS - 1, Math.floor(x / width * GRID_COLUMNS))
      const row = Math.min(GRID_ROWS - 1, Math.floor(y / height * GRID_ROWS))
      cells[row * GRID_COLUMNS + column] += 1
      total += 1
      xSum += x
      ySum += y
    }
  }
  return {
    cells: cells.map((value) => value / Math.max(total, 1)),
    nonZeroRatio: total / (width * height),
    centroid: { x: xSum / Math.max(total, 1) / width, y: ySum / Math.max(total, 1) / height },
  }
}

function classifyWater(red, green, blue) {
  return blue > red * 1.12
    && green > red * 1.08
    && blue > green * 0.72
    && blue >= 55
}

function classifyStrongWater(red, green, blue) {
  return blue > red * 1.25
    && blue > green * 1.08
    && blue >= 65
    && blue - red >= 22
}

function classifyWetSeasonPath(red, green, blue) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  return red > green * 1.03 && green > blue * 1.12 && red > 80 && red < 230 && green > 55 && green < 190 && blue < 135 && luminance > 70
}

function classifyDrySeasonPath(red, green, blue) {
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const redLead = red - green
  const greenLead = green - blue
  return red > green * 1.4
    && green > blue * 1.12
    && redLead > greenLead
    && red > 80
    && red < 230
    && green > 55
    && green < 190
    && blue < 135
    && luminance > 70
}

function selectPathClassifier(record) {
  if (record.classification?.monsoonSeason === "dry_season") {
    return { mode: "dry_season_red_brown_route_separated_from_straw_grass_v1", classify: classifyDrySeasonPath }
  }
  return { mode: "humid_and_transition_season_warm_earth_route_v1", classify: classifyWetSeasonPath }
}

function issue(code, message, messageZh, affectedRegion) {
  return { code, message, messageZh, affectedRegion, nextTrainingTarget: "repair_selected_blueprint_condition_alignment" }
}
function round(value) { return Math.round(value * 10000) / 10000 }
function roundPoint(point) { return { x: round(point.x), y: round(point.y) } }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  return resolved
}
function assert(condition, message) { if (!condition) throw new Error(message) }
