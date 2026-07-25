import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const REQUIRED_CHANNELS = [
  "terrain_grass",
  "terrain_water",
  "terrain_path_ground",
  "terrain_shoreline",
  "terrain_natural_boundary",
  "walkable",
  "collision",
  "object_footprints",
  "focal_area",
]

export async function auditCompleteMapScope({ blueprint, directorOutput, task, conditionPack, connectivityBlueprint }) {
  const issues = []
  const evidence = {}
  const canvas = blueprint.canvas ?? task.outputSize
  const channels = new Map((conditionPack.channels ?? []).map((entry) => [entry.id, entry]))
  const channelIds = [...channels.keys()]
  const semanticContractText = JSON.stringify({ blueprint, directorOutput, task })
  const transformDerivedMarkers = [...semanticContractText.matchAll(/[^"]+_complete_map_transform_\d+/g)]
    .map((match) => match[0])
    .slice(0, 20)

  evidence.structuralNovelty = {
    sharedSkeletonTransformMarkerDetected: transformDerivedMarkers.length > 0,
    forbiddenMarkerPattern: "_complete_map_transform_<index>",
    detectedMarkers: transformDerivedMarkers,
    policy: "new complete-map geometry must originate from current world facts and director output; mirror, rotation, or indexed transform reuse is forbidden before RGB generation",
  }
  requireEvidence(issues, transformDerivedMarkers.length === 0, "transform_derived_complete_map_skeleton_forbidden")

  requireEvidence(issues, conditionPack.channels?.length === 23 && new Set(channelIds).size === 23, "complete_map_scope_requires_exactly_23_unique_channels")
  requireEvidence(issues, REQUIRED_CHANNELS.every((id) => channels.has(id)), "complete_map_scope_required_channels_missing")
  requireEvidence(issues, canvas?.width === 1024 && canvas?.height === 768, "complete_map_scope_native_canvas_mismatch")
  requireEvidence(issues, blueprint.canvas?.frameScope === "complete_runtime_frame", "blueprint_frame_scope_is_not_complete_runtime_frame")
  requireEvidence(issues, task.singleMapScope?.activeGoal === "single_complete_map_visual", "task_goal_is_not_complete_map_visual")
  requireEvidence(issues, directorOutput.singleMapScopePlan?.activeGoal === "single_complete_map_visual", "director_goal_is_not_complete_map_visual")
  requireEvidence(issues, /complete/.test(directorOutput.sceneIntent?.sceneType ?? ""), "director_scene_type_is_not_complete_map")
  requireEvidence(issues, blueprint.sourceImageGeometryRead === false, "blueprint_reads_historical_rgb_geometry")
  requireEvidence(issues, task.drawingProcess?.sourceImageGeometryRead === false, "task_reads_historical_rgb_geometry")

  const entrance = auditBounds(blueprint.geometry?.entranceBounds, canvas)
  evidence.entrance = entrance
  evidence.siteSelection = {
    policy: blueprint.semanticRules?.siteSelectionPolicy ?? null,
    presetHomeBounds: blueprint.geometry?.focalBounds ?? null,
  }
  requireEvidence(issues, entrance.valid && entrance.touchesCanvasEdge, "complete_map_boundary_entrance_or_exit_missing")
  requireEvidence(
    issues,
    blueprint.semanticRules?.siteSelectionPolicy === "initial_natural_world_no_preset_home_site"
      && blueprint.geometry?.focalBounds == null,
    "preset_home_site_or_construction_clearing_forbidden",
  )

  const mustShow = new Set(directorOutput.sceneIntent?.mustShow ?? [])
  const readOrder = directorOutput.compositionPlan?.readOrder ?? []
  for (const item of ["entrance", "main_path", "natural_boundary"]) {
    requireEvidence(issues, mustShow.has(item), `director_must_show_missing_${item}`)
    requireEvidence(issues, readOrder.includes(item), `director_read_order_missing_${item}`)
  }
  requireEvidence(
    issues,
    !mustShow.has("home_center") && !readOrder.includes("home_center"),
    "preset_home_site_or_construction_clearing_forbidden",
  )

  if (issues.length === 0 || REQUIRED_CHANNELS.every((id) => channels.has(id))) {
    const [route, water, boundary, walkable, collision, objects, focalChannel] = await Promise.all([
      readChannel(channels.get("terrain_path_ground")),
      readChannel(channels.get("terrain_water")),
      readChannel(channels.get("terrain_natural_boundary")),
      readChannel(channels.get("walkable")),
      readChannel(channels.get("collision")),
      readChannel(channels.get("object_footprints")),
      readChannel(channels.get("focal_area")),
    ])
    assertSameDimensions([route, water, boundary, walkable, collision, objects, focalChannel])
    const routeStats = rasterStats(route, entrance.rasterBounds)
    const waterStats = rasterStats(water)
    const boundaryStats = rasterStats(boundary)
    const walkableStats = rasterStats(walkable)
    const collisionStats = rasterStats(collision)
    const objectStats = rasterStats(objects)
    const focalStats = rasterStats(focalChannel)
    const overlaps = overlapStats(route, water, collision)
    evidence.raster = {
      route: routeStats,
      water: waterStats,
      naturalBoundary: boundaryStats,
      walkable: walkableStats,
      collision: collisionStats,
      objects: objectStats,
      focalArea: focalStats,
      overlaps,
    }
    requireEvidence(issues, routeStats.nonZeroPixels > 0, "complete_map_route_missing")
    requireEvidence(issues, routeStats.maximumNormalizedSpan >= 0.35, "complete_map_route_span_too_local")
    requireEvidence(issues, routeStats.edgeTouchCount >= 1, "complete_map_route_has_no_boundary_connection")
    requireEvidence(issues, routeStats.intersectsPrimaryBounds, "complete_map_route_does_not_reach_entrance")
    requireEvidence(issues, overlaps.routeWater === 0, "complete_map_route_overlaps_water")
    requireEvidence(issues, overlaps.routeCollision === 0, "complete_map_route_overlaps_collision")
    requireEvidence(issues, boundaryStats.nonZeroPixels > 0 && boundaryStats.edgeTouchCount >= 2, "complete_map_natural_boundary_not_frame_scale")
    requireEvidence(issues, walkableStats.nonZeroRatio >= 0.015, "complete_map_walkable_space_insufficient")
    requireEvidence(issues, focalStats.nonZeroPixels === 0, "preset_home_site_or_construction_clearing_forbidden")
    requireEvidence(issues, objectStats.nonZeroRatio > 0 && objectStats.nonZeroRatio < 0.35, "complete_map_object_density_not_readable")
    requireEvidence(issues, collisionStats.nonZeroRatio > 0 && collisionStats.nonZeroRatio < 0.75, "complete_map_collision_scope_invalid")
    requireEvidence(issues, Boolean(blueprint.geometry?.hasWater) === (waterStats.nonZeroPixels > 0), "water_channel_conflicts_with_current_world_facts")

    const terrainKindCount = new Set((blueprint.geometry?.terrainRegions ?? []).map((entry) => entry.kind)).size
    const recognizableSpaceEvidence = [
      routeStats.maximumNormalizedSpan >= 0.35 ? "continuous_natural_passage" : null,
      walkableStats.nonZeroRatio >= 0.015 ? "walkable_route_space" : null,
      terrainKindCount >= 3 ? "ecological_terrain_diversity" : null,
      boundaryStats.edgeTouchCount >= 2 ? "natural_boundary_zone" : null,
      objectStats.nonZeroRatio > 0 ? "ecological_object_zone" : null,
      waterStats.nonZeroPixels > 0 ? "world_fact_water_zone" : null,
    ].filter(Boolean)
    evidence.recognizableSpaceEvidence = recognizableSpaceEvidence
    requireEvidence(issues, recognizableSpaceEvidence.length >= 4, "complete_map_multiple_recognizable_spaces_missing")
  }

  const connectivity = auditConnectivity(blueprint, task, connectivityBlueprint)
  evidence.largeWorldConnectivity = connectivity
  requireEvidence(issues, connectivity.passed, connectivity.failureCode)

  const localSceneSignals = []
  if (evidence.raster?.route?.maximumNormalizedSpan < 0.35) localSceneSignals.push("short_route_span")
  if ((evidence.recognizableSpaceEvidence ?? []).length < 4) localSceneSignals.push("insufficient_space_or_ecology_zones")
  if (!connectivity.passed) localSceneSignals.push("large_world_connection_unproven")
  evidence.localSceneSignals = localSceneSignals
  if (localSceneSignals.length > 0 && !issues.includes("local_scene_not_complete_map")) issues.push("local_scene_not_complete_map")

  const uniqueIssues = [...new Set(issues)]
  const failureCode = uniqueIssues.includes("transform_derived_complete_map_skeleton_forbidden")
    ? "transform_derived_complete_map_skeleton_forbidden"
    : uniqueIssues.includes("preset_home_site_or_construction_clearing_forbidden")
      ? "preset_home_site_or_construction_clearing_forbidden"
      : uniqueIssues.length > 0
        ? "local_scene_not_complete_map"
        : null
  return {
    schemaVersion: "complete-map-scope-audit-v1",
    status: issues.length === 0 ? "complete_map_scope_passed" : "blocked_before_generation",
    passed: issues.length === 0,
    failureCode,
    issues: uniqueIssues,
    sourceIdentity: {
      blueprintId: blueprint.blueprintId,
      directorRunId: directorOutput.directorRunId,
      taskId: task.taskId,
      conditionPackId: conditionPack.conditionPackId,
      connectivityBlueprintId: connectivityBlueprint.blueprintId,
    },
    evidence,
    generatedImageCreated: false,
    computeStarted: false,
    automaticStorage: true,
  }
}

function auditConnectivity(blueprint, task, connectivity) {
  const pathPorts = (connectivity.edgePorts ?? []).filter((entry) => entry.regionId === connectivity.currentRegion?.regionId && entry.kind === "path")
  const nodes = new Set(connectivity.pathGraph?.nodes ?? [])
  const bound = blueprint.connectivityBlueprintId === connectivity.blueprintId
    && task.sourceBindings?.connectivityBlueprintPath
    && task.worldProfileId === connectivity.worldProfileId
  const passed = Boolean(
    bound
    && (connectivity.currentRegion?.neighborRegionIds ?? []).length > 0
    && pathPorts.length > 0
    && nodes.has("entry_point")
    && pathPorts.some((port) => nodes.has(port.edgePortId)),
  )
  return {
    passed,
    failureCode: passed ? null : "complete_map_large_world_connectivity_unproven",
    boundToCurrentBlueprint: Boolean(bound),
    neighborRegionCount: connectivity.currentRegion?.neighborRegionIds?.length ?? 0,
    pathPortIds: pathPorts.map((entry) => entry.edgePortId),
    pathGraphId: connectivity.pathGraph?.pathGraphId ?? null,
    pathGraphNodes: [...nodes],
  }
}

async function readChannel(channel) {
  if (!channel?.path) throw new Error(`condition channel path missing: ${channel?.id ?? "unknown"}`)
  const resolved = resolveProjectPath(channel.path)
  const { data, info } = await sharp(resolved, { failOn: "error" }).greyscale().raw().toBuffer({ resolveWithObject: true })
  return { id: channel.id, data, width: info.width, height: info.height }
}

function rasterStats(channel, primaryBounds = null, secondaryBounds = null) {
  const width = Number(channel.width)
  const height = Number(channel.height)
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`condition channel dimensions invalid: ${channel.id}`)
  }
  let nonZeroPixels = 0
  let minimumX = width
  let maximumX = -1
  let minimumY = height
  let maximumY = -1
  let intersectsPrimaryBounds = false
  let intersectsSecondaryBounds = false
  const touchedEdges = new Set()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (channel.data[y * width + x] === 0) continue
      nonZeroPixels += 1
      minimumX = Math.min(minimumX, x)
      maximumX = Math.max(maximumX, x)
      minimumY = Math.min(minimumY, y)
      maximumY = Math.max(maximumY, y)
      if (x === 0) touchedEdges.add("left")
      if (x === width - 1) touchedEdges.add("right")
      if (y === 0) touchedEdges.add("top")
      if (y === height - 1) touchedEdges.add("bottom")
      if (primaryBounds && pointInBounds(x, y, primaryBounds)) intersectsPrimaryBounds = true
      if (secondaryBounds && pointInBounds(x, y, secondaryBounds)) intersectsSecondaryBounds = true
    }
  }
  const widthSpan = maximumX >= minimumX ? maximumX - minimumX + 1 : 0
  const heightSpan = maximumY >= minimumY ? maximumY - minimumY + 1 : 0
  return {
    channelId: channel.id,
    nonZeroPixels,
    nonZeroRatio: round(nonZeroPixels / (width * height), 6),
    bounds: nonZeroPixels ? { x: minimumX, y: minimumY, width: widthSpan, height: heightSpan } : null,
    normalizedWidthSpan: round(widthSpan / width, 6),
    normalizedHeightSpan: round(heightSpan / height, 6),
    maximumNormalizedSpan: round(Math.max(widthSpan / width, heightSpan / height), 6),
    edgeTouches: [...touchedEdges].sort(),
    edgeTouchCount: touchedEdges.size,
    intersectsPrimaryBounds,
    intersectsSecondaryBounds,
  }
}

function overlapStats(route, water, collision) {
  let routeWater = 0
  let routeCollision = 0
  for (let index = 0; index < route.data.length; index += 1) {
    if (route.data[index] === 0) continue
    if (water.data[index] > 0) routeWater += 1
    if (collision.data[index] > 0) routeCollision += 1
  }
  return { routeWater, routeCollision }
}

function auditBounds(bounds, canvas) {
  const valid = Boolean(bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && bounds.width > 0 && bounds.height > 0)
  const touchesCanvasEdge = valid && (bounds.x <= 0 || bounds.y <= 0 || bounds.x + bounds.width >= canvas.width || bounds.y + bounds.height >= canvas.height)
  const rasterBounds = valid
    ? {
        x: clamp(bounds.x, 0, canvas.width - 1),
        y: clamp(bounds.y, 0, canvas.height - 1),
        width: Math.max(1, clamp(bounds.x + bounds.width, 1, canvas.width) - clamp(bounds.x, 0, canvas.width - 1)),
        height: Math.max(1, clamp(bounds.y + bounds.height, 1, canvas.height) - clamp(bounds.y, 0, canvas.height - 1)),
      }
    : null
  return { valid, touchesCanvasEdge, bounds: valid ? bounds : null, rasterBounds }
}

function pointInBounds(x, y, bounds) { return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height }
function requireEvidence(issues, condition, code) { if (!condition) issues.push(code) }
function assertSameDimensions(channels) { const first = channels[0]; if (!channels.every((entry) => entry.width === first.width && entry.height === first.height)) throw new Error("complete-map scope channels have inconsistent dimensions") }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); if (!(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`))) throw new Error(`path escapes project: ${value}`); if (!fs.existsSync(resolved)) throw new Error(`condition channel file missing: ${value}`); return resolved }
function round(value, precision = 6) { const factor = 10 ** precision; return Math.round(value * factor) / factor }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)) }
