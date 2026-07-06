import sharp from "sharp"

import type {
  GameMapCompositeManifest,
  GameMapCompositeOutput,
  GameMapVisualUnitKind,
} from "./game-map-composite-schema"

export type GameMapFormalVisualJudgeStatus =
  | "formal_game_map_visual_judge_passed"
  | "formal_game_map_visual_judge_failed"

export type GameMapFormalVisualJudgeIssue = {
  code: string
  severity: "error" | "warning"
  message: string
}

export type GameMapFormalVisualJudgeReport = {
  schemaVersion: "game-map-formal-visual-judge-report-v1"
  status: GameMapFormalVisualJudgeStatus
  passed: boolean
  canEnterWorld: boolean
  manifestId: string
  worldId: string
  tick: number
  outputSha256: string
  metrics: {
    width: number
    height: number
    aspectRatio: number
    averageLuma: number
    greenDominanceRatio: number
    blueDominanceRatio: number
    darkPixelRatio: number
    brightPixelRatio: number
    neonHighlightRatio: number
    palePatchArtifactRatio: number
    electricBlueArtifactRatio: number
    transparentPixelRatio: number
    quantizedColorCount: number
    edgeDensity: number
    grassVisualRatio: number
    pathVisualRatio: number
    waterVisualRatio: number
    shorelineVisualRatio: number
    shorelineMaskRatio: number
    lowDetailGrassRatio: number
    washedGrassHazeRatio: number
    pathEdgeDensity: number
    pathContaminationRatio: number
    pathBlackCraterRatio: number
    maxInteriorVerticalBoundaryDelta: number
    maxInteriorHorizontalBoundaryDelta: number
    requiredVisualUnitKindsPresent: boolean
  }
  issues: GameMapFormalVisualJudgeIssue[]
  tags: string[]
}

const REQUIRED_VISUAL_UNIT_KINDS: GameMapVisualUnitKind[] = [
  "grass_texture",
  "water_texture",
  "shoreline_texture",
  "path_texture",
  "tree_visual_unit",
  "rock_visual_unit",
]

type RuntimeCompositorQualityMetrics = {
  gridArtifactSuspected?: boolean
  visibleGridArtifactSuspected?: boolean
  repetitiveTextureArtifactSuspected?: boolean
  denseTextureArtifactSuspected?: boolean
  patchBandArtifactSuspected?: boolean
  objectMaterialAlphaMissingSuspected?: boolean
}

export async function judgeFormalGameMapCompositeOutput(input: {
  manifest: GameMapCompositeManifest
  output: GameMapCompositeOutput
  outputBytes: Buffer
  compositorQualityMetrics?: RuntimeCompositorQualityMetrics
}): Promise<GameMapFormalVisualJudgeReport> {
  const { manifest, output } = input
  const issues: GameMapFormalVisualJudgeIssue[] = []
  const metrics = await measureOutputPixels(input.outputBytes, manifest)
  const requiredVisualUnitKindsPresent = REQUIRED_VISUAL_UNIT_KINDS.every((kind) =>
    manifest.visualUnitSlots.some((slot) => slot.unitKind === kind)
  )
  const fullMetrics = {
    ...metrics,
    requiredVisualUnitKindsPresent,
  }

  if (output.source !== "runtime_compositor_from_ai_visual_units") {
    issues.push(error("formal_output_source_invalid", "Formal map must come from the runtime AI visual-unit compositor."))
  }
  if (!output.tags.includes("complete_game_map_composite_output")) {
    issues.push(error("formal_output_complete_tag_missing", "Formal map must be a complete game-map composite output."))
  }
  if (metrics.width < 1024 || metrics.height < 768) {
    issues.push(error("formal_world_frame_size_too_small", "Formal /world map must be at least 1024x768 for the MVP game view."))
  }
  if (Math.abs(metrics.aspectRatio - 4 / 3) > 0.02) {
    issues.push(error("formal_world_frame_aspect_invalid", "Formal /world map must keep the 4:3 game-map aspect ratio."))
  }
  if (metrics.transparentPixelRatio > 0.005) {
    issues.push(error("formal_world_frame_has_transparency", "Formal /world map must be a complete opaque frame, not a partial layer."))
  }
  if (metrics.averageLuma < 70 || metrics.averageLuma > 180) {
    issues.push(error("formal_world_frame_luma_out_of_range", "Formal /world map brightness is outside the playable natural-home range."))
  }
  if (metrics.greenDominanceRatio > 0.84) {
    issues.push(error("formal_world_frame_green_dominance_too_high", "Formal /world map is dominated by one green field and lacks readable terrain variety."))
  }
  if (metrics.greenDominanceRatio > 0.82 && metrics.brightPixelRatio < 0.0045) {
    issues.push(error("formal_world_frame_green_mush_artifact_too_high", "Formal /world map reads as a blurred green texture field instead of a complete playable game map."))
  }
  if (
    metrics.greenDominanceRatio > 0.68 &&
    metrics.blueDominanceRatio < 0.12 &&
    metrics.edgeDensity > 0.1
  ) {
    issues.push(error("formal_world_frame_noisy_green_field_artifact", "Formal /world map still reads as a noisy green training texture instead of readable grass, path, shoreline, and object gameplay space."))
  }
  if (metrics.blueDominanceRatio < 0.015) {
    issues.push(error("formal_world_frame_water_presence_too_low", "Natural-home MVP requires visible water expression in the final map."))
  }
  if (metrics.greenDominanceRatio > 0.72 && metrics.blueDominanceRatio > 0.16) {
    issues.push(error("formal_world_frame_terrain_balance_failed", "Formal /world map has too much green field plus saturated water, which reads as a material test instead of a playable map."))
  }
  if (metrics.darkPixelRatio > 0.14) {
    issues.push(error("formal_world_frame_too_many_dark_pixels", "Formal /world map has too many dark or muddy pixels for the bright healing target."))
  }
  if (metrics.brightPixelRatio < 0.004) {
    issues.push(error("formal_world_frame_highlight_detail_too_low", "Formal /world map needs visible highlight details such as flowers, water glints, or path detail."))
  }
  if (metrics.neonHighlightRatio > 0.006) {
    issues.push(error("formal_world_frame_neon_highlight_too_high", "Formal /world map has over-saturated yellow-green highlights that read as failed material output instead of natural pixel lighting."))
  }
  if (metrics.palePatchArtifactRatio > 0.0012) {
    issues.push(error("formal_world_frame_pale_patch_artifact_too_high", "Formal /world map has too many pale pink-white pixels, which reads as failed path or pasted highlight material."))
  }
  if (metrics.electricBlueArtifactRatio > 0.01) {
    issues.push(error("formal_world_frame_electric_blue_artifact_too_high", "Formal /world map has over-saturated electric-blue water pixels instead of natural pixel-art water."))
  }
  if (metrics.quantizedColorCount < 900) {
    issues.push(error("formal_world_frame_color_variety_too_low", "Formal /world map needs enough color variety to avoid flat program-like output."))
  }
  if (metrics.edgeDensity < 0.04 || metrics.edgeDensity > 0.22) {
    issues.push(error("formal_world_frame_edge_density_out_of_range", "Formal /world map edge density is outside the readable pixel-art range."))
  }
  if (metrics.grassVisualRatio > 0.7 && metrics.edgeDensity < 0.055 && metrics.pathVisualRatio < 0.09) {
    issues.push(error("formal_world_frame_flat_terrain_readability_failed", "Formal /world map reads as a flat green fill with weak gameplay structure, not a professional readable game map."))
  }
  if (metrics.pathVisualRatio < 0.045) {
    issues.push(error("formal_world_frame_path_presence_too_low", "Formal /world map main roads are not visually present enough for a readable player-enterable map."))
  }
  if (metrics.pathVisualRatio > 0.035 && metrics.pathEdgeDensity < 0.085) {
    issues.push(error("formal_world_frame_path_blur_artifact", "Formal /world map path is too blurred or texture-like; main roads must be readable game-map routes."))
  }
  if (
    metrics.shorelineVisualRatio > 0.14 &&
    metrics.shorelineMaskRatio > 0.14 &&
    metrics.waterVisualRatio > 0.08
  ) {
    issues.push(error("formal_world_frame_shoreline_overpaint_artifact", "Formal /world map shoreline occupies too much of the frame and reads as a pasted vertical material strip."))
  }
  if (metrics.lowDetailGrassRatio > 0.18 && metrics.grassVisualRatio > 0.62) {
    issues.push(error("formal_world_frame_low_detail_grass_fill", "Formal /world map grass is too low-detail across the playable field for a professional game map."))
  }
  if (metrics.washedGrassHazeRatio > 0.14 && metrics.grassVisualRatio > 0.62) {
    issues.push(error("formal_world_frame_washed_grass_haze", "Formal /world map grass has too much washed cloudy haze; a professional game map needs readable terrain material, not foggy texture fill."))
  }
  if (metrics.pathContaminationRatio > 0.14) {
    issues.push(error("formal_world_frame_path_contaminated_by_non_path_material", "Formal /world map path is contaminated by grass, muddy dark blobs, or water-like pixels; player routes must read as coherent path material."))
  }
  if (metrics.pathBlackCraterRatio > 0.006) {
    issues.push(error("formal_world_frame_path_black_crater_artifact", "Formal /world map path contains black crater-like artifacts; professional routes need coherent walkable road material, not holes or burned patches."))
  }
  if (metrics.maxInteriorVerticalBoundaryDelta > 0.09) {
    issues.push(error("formal_world_frame_vertical_paste_boundary_detected", "Formal /world map has a strong internal vertical paste boundary, which looks like a stitched image strip."))
  }
  if (metrics.maxInteriorHorizontalBoundaryDelta > 0.07) {
    issues.push(error("formal_world_frame_horizontal_paste_boundary_detected", "Formal /world map has a strong internal horizontal paste boundary, which looks like a stitched image strip."))
  }
  if (!requiredVisualUnitKindsPresent) {
    issues.push(error("formal_world_frame_required_units_missing", "Natural-home MVP must include grass, water, shoreline, path, trees, and rocks."))
  }

  const compositorQuality = input.compositorQualityMetrics
  if (
    compositorQuality?.gridArtifactSuspected ||
    compositorQuality?.visibleGridArtifactSuspected ||
    compositorQuality?.repetitiveTextureArtifactSuspected ||
    compositorQuality?.denseTextureArtifactSuspected ||
    compositorQuality?.patchBandArtifactSuspected ||
    compositorQuality?.objectMaterialAlphaMissingSuspected
  ) {
    issues.push(error("formal_world_frame_compositor_quality_failed", "Runtime compositor detected visible grid, repetition, patch-band, or alpha issues."))
  }

  const passed = issues.filter((issue) => issue.severity === "error").length === 0

  return {
    schemaVersion: "game-map-formal-visual-judge-report-v1",
    status: passed
      ? "formal_game_map_visual_judge_passed"
      : "formal_game_map_visual_judge_failed",
    passed,
    canEnterWorld: passed,
    manifestId: manifest.manifestId,
    worldId: manifest.worldId,
    tick: manifest.tick,
    outputSha256: output.imageSha256,
    metrics: fullMetrics,
    issues,
    tags: passed
      ? [
          "formal_game_map_visual_judge_passed",
          "formal_full_world_frame_visual_quality_passed",
          "world_page_ready_after_formal_visual_judge",
        ]
      : [
          "formal_game_map_visual_judge_failed",
          "world_page_blocked_by_formal_visual_judge",
        ],
  }
}

async function measureOutputPixels(bytes: Buffer, manifest: GameMapCompositeManifest): Promise<{
  width: number
  height: number
  aspectRatio: number
  averageLuma: number
  greenDominanceRatio: number
  blueDominanceRatio: number
  darkPixelRatio: number
  brightPixelRatio: number
  neonHighlightRatio: number
  palePatchArtifactRatio: number
  electricBlueArtifactRatio: number
  transparentPixelRatio: number
  quantizedColorCount: number
  edgeDensity: number
  grassVisualRatio: number
  pathVisualRatio: number
  waterVisualRatio: number
  shorelineVisualRatio: number
  shorelineMaskRatio: number
  lowDetailGrassRatio: number
  washedGrassHazeRatio: number
  pathEdgeDensity: number
  pathContaminationRatio: number
  pathBlackCraterRatio: number
  maxInteriorVerticalBoundaryDelta: number
  maxInteriorHorizontalBoundaryDelta: number
}> {
  const raw = await sharp(bytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { data, info } = raw
  const pixelCount = info.width * info.height
  let lumaSum = 0
  let greenDominant = 0
  let blueDominant = 0
  let darkPixels = 0
  let brightPixels = 0
  let neonHighlightPixels = 0
  let palePatchArtifactPixels = 0
  let electricBlueArtifactPixels = 0
  let transparentPixels = 0
  let edgeHits = 0
  let grassVisualPixels = 0
  let pathVisualPixels = 0
  let waterVisualPixels = 0
  let shorelineVisualPixels = 0
  let shorelineMaskPixels = 0
  let lowDetailGrassPixels = 0
  let washedGrassHazePixels = 0
  let pathEdgeHits = 0
  let pathMaskPixels = 0
  let pathContaminatedPixels = 0
  let pathBlackCraterPixels = 0
  let maxInteriorVerticalBoundaryDelta = 0
  let maxInteriorHorizontalBoundaryDelta = 0
  const quantizedColors = new Set<string>()
  const pathSlots = manifest.visualUnitSlots.filter((slot) => slot.unitKind === "path_texture")
  const shorelineSlots = manifest.visualUnitSlots.filter(
    (slot) => slot.unitKind === "shoreline_texture"
  )

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * info.channels
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const alpha = data[offset + 3] ?? 255
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    const maxChannel = Math.max(red, green, blue)
    const minChannel = Math.min(red, green, blue)
    const saturation = maxChannel - minChannel
    const x = index % info.width
    const y = Math.floor(index / info.width)

    lumaSum += luma
    if (alpha < 250) transparentPixels += 1
    if (green > red * 1.08 && green > blue * 1.08) greenDominant += 1
    if (blue > green * 1.08 && blue > red * 1.08) blueDominant += 1
    if (luma < 42) darkPixels += 1
    if (luma > 188) brightPixels += 1
    if (red > 160 && green > 172 && blue < 120 && green >= red * 0.9) {
      neonHighlightPixels += 1
    }
    if (luma > 178 && red > 170 && green > 145 && blue > 125) {
      palePatchArtifactPixels += 1
    }
    if (blue > 185 && green > 120 && red < 110 && blue > green * 1.2) {
      electricBlueArtifactPixels += 1
    }
    const isGrassVisual = green > red * 1.08 && green > blue * 1.02 && luma > 48 && luma < 170
    const isPathVisual =
      red > 95 &&
      green > 75 &&
      blue < 85 &&
      red > blue * 1.35 &&
      green > blue * 1.15
    const isWaterVisual =
      blue > 70 &&
      green > 75 &&
      green >= red * 1.05 &&
      blue >= red * 1.08 &&
      !(green > red * 1.35 && green > blue * 1.05)
    const isShorelineVisual =
      (red > 85 && green > 85 && blue < 80 && green > red * 0.75) ||
      (red > 70 && green > 90 && blue < 70)
    if (isGrassVisual) grassVisualPixels += 1
    if (isPathVisual) pathVisualPixels += 1
    if (isWaterVisual) waterVisualPixels += 1
    if (isShorelineVisual && !isPathVisual) shorelineVisualPixels += 1
    if (shorelineSlots.some((slot) => pointInSlotMask(x + 0.5, y + 0.5, slot))) {
      shorelineMaskPixels += 1
    }
    if (isGrassVisual && saturation < 55) lowDetailGrassPixels += 1
    if (isGrassVisual && luma > 92 && saturation < 72) washedGrassHazePixels += 1
    const inPathMask = pathSlots.some((slot) => pointInSlotMask(x + 0.5, y + 0.5, slot))
    if (inPathMask) {
      pathMaskPixels += 1
      const isGreenPathPollution =
        green > red * 1.08 &&
        green > blue * 1.04 &&
        luma > 42 &&
        luma < 150
      const isMuddyPathBlob =
        luma < 86 &&
        green > red * 0.78 &&
        blue < 118 &&
        saturation > 24
      const isWaterPathPollution =
        blue > red * 1.15 &&
        green > red * 1.04 &&
        luma > 58
      const isPathBlackCrater =
        luma < 58 &&
        red < 82 &&
        green < 78 &&
        blue < 70
      if ((isGreenPathPollution || isMuddyPathBlob || isWaterPathPollution) && !isPathVisual) {
        pathContaminatedPixels += 1
      }
      if (isPathBlackCrater) {
        pathBlackCraterPixels += 1
      }
    }
    quantizedColors.add(`${red >> 3},${green >> 3},${blue >> 3}`)

    if (x > 0) {
      const neighbor = index - 1
      const edgeDistance = rgbDistance(data, offset, neighbor * info.channels)
      if (edgeDistance > 48) edgeHits += 1
      if (isPathVisual && edgeDistance > 42) pathEdgeHits += 1
    }
    if (y > 0) {
      const neighbor = index - info.width
      const edgeDistance = rgbDistance(data, offset, neighbor * info.channels)
      if (edgeDistance > 48) edgeHits += 1
      if (isPathVisual && edgeDistance > 42) pathEdgeHits += 1
    }
  }

  const interiorInset = 24
  for (let x = interiorInset; x < info.width - interiorInset; x += 1) {
    let total = 0
    for (let y = interiorInset; y < info.height - interiorInset; y += 1) {
      const leftOffset = (y * info.width + x - 1) * info.channels
      const rightOffset = (y * info.width + x) * info.channels
      total += rgbDistance(data, leftOffset, rightOffset)
    }
    const delta = total / Math.max(1, (info.height - interiorInset * 2) * 3 * 255)
    maxInteriorVerticalBoundaryDelta = Math.max(maxInteriorVerticalBoundaryDelta, delta)
  }

  for (let y = interiorInset; y < info.height - interiorInset; y += 1) {
    let total = 0
    for (let x = interiorInset; x < info.width - interiorInset; x += 1) {
      const topOffset = ((y - 1) * info.width + x) * info.channels
      const bottomOffset = (y * info.width + x) * info.channels
      total += rgbDistance(data, topOffset, bottomOffset)
    }
    const delta = total / Math.max(1, (info.width - interiorInset * 2) * 3 * 255)
    maxInteriorHorizontalBoundaryDelta = Math.max(maxInteriorHorizontalBoundaryDelta, delta)
  }

  return {
    width: info.width,
    height: info.height,
    aspectRatio: round(info.width / info.height, 4),
    averageLuma: round(lumaSum / pixelCount, 4),
    greenDominanceRatio: round(greenDominant / pixelCount, 4),
    blueDominanceRatio: round(blueDominant / pixelCount, 4),
    darkPixelRatio: round(darkPixels / pixelCount, 4),
    brightPixelRatio: round(brightPixels / pixelCount, 4),
    neonHighlightRatio: round(neonHighlightPixels / pixelCount, 4),
    palePatchArtifactRatio: round(palePatchArtifactPixels / pixelCount, 4),
    electricBlueArtifactRatio: round(electricBlueArtifactPixels / pixelCount, 4),
    transparentPixelRatio: round(transparentPixels / pixelCount, 4),
    quantizedColorCount: quantizedColors.size,
    edgeDensity: round(edgeHits / Math.max(1, pixelCount * 2), 4),
    grassVisualRatio: round(grassVisualPixels / pixelCount, 4),
    pathVisualRatio: round(pathVisualPixels / pixelCount, 4),
    waterVisualRatio: round(waterVisualPixels / pixelCount, 4),
    shorelineVisualRatio: round(shorelineVisualPixels / pixelCount, 4),
    shorelineMaskRatio: round(shorelineMaskPixels / pixelCount, 4),
    lowDetailGrassRatio: round(lowDetailGrassPixels / Math.max(1, grassVisualPixels), 4),
    washedGrassHazeRatio: round(washedGrassHazePixels / Math.max(1, grassVisualPixels), 4),
    pathEdgeDensity: round(pathEdgeHits / Math.max(1, pathVisualPixels * 2), 4),
    pathContaminationRatio: round(pathContaminatedPixels / Math.max(1, pathMaskPixels), 4),
    pathBlackCraterRatio: round(pathBlackCraterPixels / Math.max(1, pathMaskPixels), 4),
    maxInteriorVerticalBoundaryDelta: round(maxInteriorVerticalBoundaryDelta, 4),
    maxInteriorHorizontalBoundaryDelta: round(maxInteriorHorizontalBoundaryDelta, 4),
  }
}

function pointInSlotMask(
  x: number,
  y: number,
  slot: GameMapCompositeManifest["visualUnitSlots"][number]
): boolean {
  const bounds = slot.bounds
  if (
    x < bounds.x ||
    y < bounds.y ||
    x > bounds.x + bounds.width ||
    y > bounds.y + bounds.height
  ) {
    return false
  }
  const geometry = slot.maskGeometry
  if (geometry.kind === "rect") {
    const rect = geometry.rect
    return (
      x >= rect.x &&
      y >= rect.y &&
      x <= rect.x + rect.width &&
      y <= rect.y + rect.height
    )
  }
  return pointInPolygon(x, y, geometry.points)
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const currentPoint = points[index]
    const previousPoint = points[previous]
    if (!currentPoint || !previousPoint) continue
    const intersects =
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x
    if (intersects) inside = !inside
  }
  return inside
}

function rgbDistance(data: Buffer, leftOffset: number, rightOffset: number): number {
  return (
    Math.abs((data[leftOffset] ?? 0) - (data[rightOffset] ?? 0)) +
    Math.abs((data[leftOffset + 1] ?? 0) - (data[rightOffset + 1] ?? 0)) +
    Math.abs((data[leftOffset + 2] ?? 0) - (data[rightOffset + 2] ?? 0))
  )
}

function error(code: string, message: string): GameMapFormalVisualJudgeIssue {
  return {
    code,
    severity: "error",
    message,
  }
}

function round(value: number, digits: number): number {
  const base = 10 ** digits
  return Math.round(value * base) / base
}
