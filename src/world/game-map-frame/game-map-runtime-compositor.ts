import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"

import sharp from "sharp"

import type {
  GameMapCompositeManifest,
  GameMapCompositeOutput,
  GameMapVisualUnitSlot,
} from "./game-map-composite-schema"
import { bindGameMapCompositeOutput } from "./game-map-composite-material-binding"
import type { GameMapFormalVisualJudgeReport } from "./game-map-formal-visual-judge"
import { judgeFormalGameMapCompositeOutput } from "./game-map-formal-visual-judge"

export type GameMapRuntimeCompositorStatus =
  | "runtime_composite_output_written"
  | "blocked_materials_incomplete"
  | "blocked_material_image_unreadable"
  | "blocked_material_image_mismatch"
  | "blocked_composite_output_binding"

export type GameMapRuntimeCompositorAuditItem = {
  slotId: string
  unitKind: GameMapVisualUnitSlot["unitKind"]
  bindingId: string
  approvedAssetId: string
  left: number
  top: number
  width: number
  height: number
  sourceImageWidth: number
  sourceImageHeight: number
  sourceImageUrl: string
  sourceImageSha256: string
  sourceHasAlpha: boolean
}

export type GameMapRuntimeCompositorQualityMetrics = {
  averageVerticalSeamDelta: number
  averageHorizontalSeamDelta: number
  maxVerticalGridSeamDelta: number
  maxHorizontalGridSeamDelta: number
  maxVerticalGridSeamRatio: number
  maxHorizontalGridSeamRatio: number
  visibleGridArtifactSuspected: boolean
  minHorizontalTextureRepeatDelta: number
  minVerticalTextureRepeatDelta: number
  repetitiveTextureArtifactSuspected: boolean
  denseTextureArtifactSuspected: boolean
  maxTerrainPatchVerticalDelta: number
  maxTerrainPatchHorizontalDelta: number
  maxTerrainPatchVerticalRatio: number
  maxTerrainPatchHorizontalRatio: number
  terrainPatchArtifactSuspected: boolean
  patchBandArtifactSuspected: boolean
  objectMaterialAlphaMissingCount: number
  objectMaterialAlphaMissingSuspected: boolean
  gridArtifactSuspected: boolean
}

type TerrainPatchFeather = {
  left: boolean
  top: boolean
}

export type GameMapRuntimeCompositorResult = {
  status: GameMapRuntimeCompositorStatus
  passed: boolean
  manifest: GameMapCompositeManifest | null
  output: GameMapCompositeOutput | null
  outputPath: string | null
  auditPath: string | null
  formalVisualJudgePath: string | null
  formalVisualJudgeReport?: GameMapFormalVisualJudgeReport
  auditItems: GameMapRuntimeCompositorAuditItem[]
  qualityMetrics?: GameMapRuntimeCompositorQualityMetrics
  blockedReasons: string[]
  tags: string[]
}

export async function composeGameMapRuntimeOutput(input: {
  manifest: GameMapCompositeManifest
  outputRoot?: string
  composedAt?: string
}): Promise<GameMapRuntimeCompositorResult> {
  const { manifest } = input
  const outputRoot = input.outputRoot
    ? resolve(input.outputRoot)
    : join(
        /* turbopackIgnore: true */ process.cwd(),
        ".runtime",
        "game-map-runtime-compositor"
      )
  const composedAt = input.composedAt ?? new Date().toISOString()
  const bindingsBySlotId = new Map(
    manifest.visualMaterialBindings.map((binding) => [binding.slotId, binding])
  )

  const missingSlots = manifest.visualUnitSlots.filter(
    (slot) => !bindingsBySlotId.has(slot.slotId)
  )
  if (missingSlots.length > 0) {
    return blocked("blocked_materials_incomplete", missingSlots.map((slot) => slot.slotId))
  }

  const frameWidth = Math.ceil(
    Math.max(...manifest.tileChunks.map((chunk) => chunk.bounds.x + chunk.bounds.width))
  )
  const frameHeight = Math.ceil(
    Math.max(...manifest.tileChunks.map((chunk) => chunk.bounds.y + chunk.bounds.height))
  )
  const compositeInputs: sharp.OverlayOptions[] = []
  const auditItems: GameMapRuntimeCompositorAuditItem[] = []

  const orderedSlots = [...manifest.visualUnitSlots].sort((left, right) => {
    const priorityDelta = runtimeCompositorZIndex(left) - runtimeCompositorZIndex(right)
    if (priorityDelta !== 0) return priorityDelta
    return left.zIndex - right.zIndex
  })
  const terrainPatchFeathers = buildTerrainPatchFeathers(orderedSlots)

  for (const slot of orderedSlots) {
    const binding = bindingsBySlotId.get(slot.slotId)
    if (!binding) continue

    const sourceBytes = await readMaterialImageBytes(binding.imageUrl)
    if (sourceBytes === null) {
      return blocked("blocked_material_image_unreadable", [binding.imageUrl])
    }

    const sourceSha256 = sha256(sourceBytes)
    if (sourceSha256 !== binding.imageSha256) {
      return blocked("blocked_material_image_mismatch", [
        `${slot.slotId}:sha256_mismatch`,
      ])
    }

    const metadata = await sharp(sourceBytes, { failOn: "error" }).metadata()
    if (
      metadata.width !== binding.imageWidth ||
      metadata.height !== binding.imageHeight ||
      metadata.format !== binding.imageFormat
    ) {
      return blocked("blocked_material_image_mismatch", [
        `${slot.slotId}:metadata_mismatch`,
      ])
    }

    if (slot.unitKind === "boundary_texture") {
      continue
    }

    const placement = slotToPlacement(slot)
    const resizedMaterial = await sharp(sourceBytes, { failOn: "error" })
      .resize(placement.width, placement.height, { fit: "cover" })
      .png()
      .toBuffer()
    const material = await applySlotAlphaMask(
      resizedMaterial,
      slot,
      placement,
      terrainPatchFeathers.get(slot.slotId)
    )

    compositeInputs.push({
      input: material,
      left: placement.left,
      top: placement.top,
    })
    auditItems.push({
      slotId: slot.slotId,
      unitKind: slot.unitKind,
      bindingId: binding.bindingId,
      approvedAssetId: binding.approvedAssetId,
      left: placement.left,
      top: placement.top,
      width: placement.width,
      height: placement.height,
      sourceImageWidth: binding.imageWidth,
      sourceImageHeight: binding.imageHeight,
      sourceImageUrl: binding.imageUrl,
      sourceImageSha256: sourceSha256,
      sourceHasAlpha: metadata.hasAlpha === true,
    })
  }

  const outputDir = join(outputRoot, manifest.worldId, String(manifest.tick))
  const outputPath = join(outputDir, `${manifest.manifestId}-composite-output.png`)
  const auditPath = join(outputDir, `${manifest.manifestId}-compositor-audit.json`)
  const formalVisualJudgePath = join(
    outputDir,
    `${manifest.manifestId}-formal-visual-judge.json`
  )
  await mkdir(outputDir, { recursive: true })

  const compositeBytes = await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer()
  let outputBytes = await repairCompositeSeams(compositeBytes, auditItems)
  outputBytes = await applyProfessionalNaturalHomeFinish(outputBytes, orderedSlots)
  const outputSha256 = sha256(outputBytes)
  const qualityMetrics = await measureCompositeOutputQuality(outputBytes, auditItems)
  const qualityTags =
    qualityMetrics.gridArtifactSuspected ||
    qualityMetrics.repetitiveTextureArtifactSuspected ||
    qualityMetrics.objectMaterialAlphaMissingSuspected
    ? [
        "composite_quality_failed_candidate_only",
        "composite_grid_artifact_suspected",
        ...(qualityMetrics.visibleGridArtifactSuspected
          ? ["composite_visible_grid_artifact_suspected"]
          : []),
        ...(qualityMetrics.patchBandArtifactSuspected
          ? ["composite_patch_band_artifact_suspected"]
          : []),
    ...(qualityMetrics.repetitiveTextureArtifactSuspected
          ? ["composite_repetitive_texture_suspected"]
          : []),
        ...(qualityMetrics.denseTextureArtifactSuspected
          ? ["composite_dense_texture_suspected"]
          : []),
        ...(qualityMetrics.objectMaterialAlphaMissingSuspected
          ? ["composite_object_material_alpha_missing"]
          : []),
      ]
    : ["composite_quality_grid_artifact_not_detected"]
  await writeFile(outputPath, outputBytes)

  const baseOutput: GameMapCompositeOutput = {
    source: "runtime_compositor_from_ai_visual_units",
    imageUrl: outputPath,
    imageSha256: outputSha256,
    imageWidth: frameWidth,
    imageHeight: frameHeight,
    imageFormat: "png",
    sourceFactIds: manifest.sourceFactIds,
    tags: [
      "runtime_compositor_from_ai_visual_units",
      "complete_game_map_composite_output",
      "ai_visual_unit_composite_audit",
      ...qualityTags,
    ],
  }
  const formalVisualJudgeReport = await judgeFormalGameMapCompositeOutput({
    manifest,
    output: baseOutput,
    outputBytes,
    compositorQualityMetrics: qualityMetrics,
  })
  await writeFile(
    formalVisualJudgePath,
    JSON.stringify(formalVisualJudgeReport, null, 2),
    "utf8"
  )
  const formalVisualJudgeTags = formalVisualJudgeReport.passed
    ? formalVisualJudgeReport.tags
    : [
        ...formalVisualJudgeReport.tags,
        "composite_quality_failed_candidate_only",
      ]
  const output: GameMapCompositeOutput = {
    ...baseOutput,
    tags: uniqueTags([...baseOutput.tags, ...formalVisualJudgeTags]),
  }

  await writeFile(
    auditPath,
    JSON.stringify(
      {
        schemaVersion: "game-map-runtime-compositor-audit-v1",
        composedAt,
        manifestId: manifest.manifestId,
        worldId: manifest.worldId,
        tick: manifest.tick,
        outputPath,
        outputSha256,
        outputWidth: frameWidth,
        outputHeight: frameHeight,
        formalVisualJudgePath,
        formalVisualJudgeStatus: formalVisualJudgeReport.status,
        sourceFactIds: manifest.sourceFactIds,
        itemCount: auditItems.length,
        qualityMetrics,
        items: auditItems,
        tags: [
          "runtime_compositor_from_ai_visual_units",
          "complete_game_map_composite_output",
          "ai_visual_unit_composite_audit",
          ...qualityTags,
          ...formalVisualJudgeTags,
        ],
      },
      null,
      2
    ),
    "utf8"
  )

  const outputBinding = bindGameMapCompositeOutput({ manifest, output })
  if (!outputBinding.passed || outputBinding.manifest === null) {
    return {
      status: "blocked_composite_output_binding",
      passed: false,
      manifest: null,
      output,
      outputPath,
      auditPath,
      formalVisualJudgePath,
      auditItems,
      qualityMetrics,
      formalVisualJudgeReport,
      blockedReasons: outputBinding.blockedReasons,
      tags: ["runtime_compositor_blocked"],
    }
  }

  return {
    status: "runtime_composite_output_written",
    passed: true,
    manifest: outputBinding.manifest,
    output,
    outputPath,
    auditPath,
    formalVisualJudgePath,
    auditItems,
    qualityMetrics,
    formalVisualJudgeReport,
    blockedReasons: [],
    tags: [
      "runtime_composite_output_written",
      "runtime_compositor_from_ai_visual_units",
      "world_page_candidate_after_composite_judge",
    ],
  }
}

async function readMaterialImageBytes(imageUrl: string): Promise<Buffer | null> {
  if (imageUrl.startsWith("data:image/")) {
    const commaIndex = imageUrl.indexOf(",")
    if (commaIndex < 0) return null
    return Buffer.from(imageUrl.slice(commaIndex + 1), "base64")
  }

  const filePath = isAbsolute(imageUrl)
    ? imageUrl
    : resolve(/* turbopackIgnore: true */ process.cwd(), imageUrl)

  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

async function applyProfessionalNaturalHomeFinish(
  outputBytes: Buffer,
  slots: GameMapVisualUnitSlot[]
): Promise<Buffer> {
  const raw = await sharp(outputBytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = raw.info.width
  const height = raw.info.height
  const channels = raw.info.channels
  const data = Buffer.from(raw.data)
  const pathSlots = slots.filter((slot) => slot.unitKind === "path_texture")
  const shorelineSlots = slots.filter((slot) => slot.unitKind === "shoreline_texture")
  const waterSlots = slots.filter((slot) => slot.unitKind === "water_texture")
  const objectSlots = slots.filter((slot) => isObjectVisualUnit(slot.unitKind))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels
      const red = data[offset] ?? 0
      const green = data[offset + 1] ?? 0
      const blue = data[offset + 2] ?? 0
      const alpha = data[offset + 3] ?? 255
      if (alpha < 250) continue

      const inPath = pathSlots.some((slot) => pointInVisualSlot(x + 0.5, y + 0.5, slot))
      const inShoreline = shorelineSlots.some((slot) =>
        pointInVisualSlot(x + 0.5, y + 0.5, slot)
      )
      const inWater = waterSlots.some((slot) => pointInVisualSlot(x + 0.5, y + 0.5, slot))
      const inObject = objectSlots.some((slot) => pointInVisualSlot(x + 0.5, y + 0.5, slot))
      const nearPath =
        !inPath &&
        !inShoreline &&
        !inWater &&
        !inObject &&
        pathSlots.some((slot) => pointNearVisualSlot(x + 0.5, y + 0.5, slot, 4))

      if (inPath) {
        writePixel(data, offset, stylizePathPixel(x, y))
      } else if (nearPath) {
        writePixel(data, offset, stylizePathShoulderPixel(red, green, blue, x, y))
      } else if (inShoreline) {
        writePixel(data, offset, stylizeShorelinePixel(red, green, blue, x, y))
      } else if (inWater) {
        writePixel(data, offset, stylizeWaterPixel(red, green, blue, x, y))
      } else if (!inWater && !inObject && isNaturalGrassPixel(red, green, blue)) {
        writePixel(data, offset, stylizeGrassPixel(red, green, blue, x, y))
      }
    }
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer()
}

function stylizeGrassPixel(
  red: number,
  green: number,
  blue: number,
  x: number,
  y: number
): [number, number, number] {
  const broad = smoothNoiseSigned(x / 118, y / 118, 101)
  const meadow = smoothNoiseSigned(x / 37, y / 31, 211)
  const tuft = smoothNoiseSigned(x / 13, y / 11, 307)
  const coolMoss = smoothNoiseSigned(x / 19, y / 17, 353)
  const warmLeaf = smoothNoiseSigned(x / 9, y / 8, 367)
  const blade = noiseSigned(x, y, 409)
  const contour = Math.sin(x * 0.025 + y * 0.015 + broad * 1.1)
  const detail = Math.sin(x * 0.73 + y * 0.31 + tuft * 1.8)
  const paletteA = smoothNoiseSigned(x / 41, y / 37, 907)
  const paletteB = smoothNoiseSigned(x / 29, y / 43, 911)
  const paletteC = smoothNoiseSigned(x / 47, y / 31, 919)

  if (coolMoss > 0.62) {
    return [
      clampByte(44 + broad * 11 + warmLeaf * 6 + blade * 2 + paletteA * 18 + paletteB * 12, 24, 126),
      clampByte(118 + broad * 15 + tuft * 10 + detail * 3 + paletteB * 20 + paletteC * 10, 88, 188),
      clampByte(52 + meadow * 10 + blade * 2 + paletteC * 24 - paletteA * 10, 22, 138),
    ]
  }

  if (warmLeaf < -0.56) {
    return [
      clampByte(68 + broad * 18 + tuft * 10 + blade * 2 + paletteA * 22 + paletteB * 14, 36, 146),
      clampByte(102 + meadow * 18 + contour * 4 + paletteB * 22 + paletteC * 10, 74, 178),
      clampByte(88 + coolMoss * 13 + blade * 2 + paletteC * 22 - paletteA * 8, 50, 150),
    ]
  }

  let nextRed =
    red * 0.16 +
    54 +
    broad * 17 +
    meadow * 16 +
    tuft * 12 +
    warmLeaf * 10 +
    blade * 7 +
    contour * 3 +
    paletteA * 44 +
    paletteB * 28
  let nextGreen =
    green * 0.12 +
    118 +
    broad * 17 +
    meadow * 18 +
    tuft * 14 +
    warmLeaf * 8 +
    detail * 4 +
    paletteB * 42 +
    paletteC * 26
  let nextBlue =
    blue * 0.16 +
    38 +
    broad * 12 +
    meadow * 16 -
    tuft * 7 +
    blade * 7 +
    paletteC * 46 -
    paletteA * 20

  if (smoothNoiseSigned(x / 23, y / 19, 613) > 0.58) {
    nextRed += 12
    nextGreen -= 2
    nextBlue += 15
  }
  if (smoothNoiseSigned(x / 17, y / 29, 719) < -0.62) {
    nextRed -= 10
    nextGreen += 13
    nextBlue -= 6
  }

  nextRed = clampByte(nextRed, 20, 174)
  nextBlue = clampByte(nextBlue, Math.max(16, nextRed / 1.62), 166)
  nextGreen = clampByte(Math.max(nextGreen, nextRed * 1.1, nextBlue * 1.06), 86, 222)
  const luma = nextRed * 0.299 + nextGreen * 0.587 + nextBlue * 0.114
  const saturation = Math.max(nextRed, nextGreen, nextBlue) - Math.min(nextRed, nextGreen, nextBlue)
  if (luma > 82 && saturation < 96) {
    const recovery = 96 - saturation
    nextGreen = clampByte(nextGreen + recovery * 0.72, 96, 222)
    nextRed = clampByte(nextRed - recovery * 0.42, 18, 174)
    nextBlue = clampByte(nextBlue - recovery * 0.36, 14, 166)
  }
  if (nextRed > 160 && nextGreen > 172 && nextBlue < 124) {
    nextBlue = 124
  }
  const finalLuma = nextRed * 0.299 + nextGreen * 0.587 + nextBlue * 0.114
  if (nextRed > 168 && nextGreen > 145 && nextBlue > 125 && finalLuma > 176) {
    nextRed = clampByte(nextRed - 18, 20, 166)
    nextGreen = clampByte(nextGreen - 8, 86, 214)
  }
  const cellX = Math.floor(x / 7)
  const cellY = Math.floor(y / 7)
  nextRed = clampByte(nextRed + noiseSigned(cellX, cellY, 923) * 16, 20, 174)
  nextGreen = clampByte(nextGreen + noiseSigned(cellX, cellY, 929) * 18, 86, 222)
  nextBlue = clampByte(nextBlue + noiseSigned(cellX, cellY, 937) * 16, 16, 166)
  const postNoiseLuma = nextRed * 0.299 + nextGreen * 0.587 + nextBlue * 0.114
  const postNoiseSaturation =
    Math.max(nextRed, nextGreen, nextBlue) - Math.min(nextRed, nextGreen, nextBlue)
  if (postNoiseLuma > 82 && postNoiseSaturation < 98) {
    const recovery = 98 - postNoiseSaturation
    nextGreen = clampByte(nextGreen + recovery * 0.86, 96, 222)
    nextRed = clampByte(nextRed - recovery * 0.42, 18, 174)
    nextBlue = clampByte(nextBlue - recovery * 0.38, 14, 166)
  }
  let pathLikeGrass =
    nextRed > 95 &&
    nextGreen > 75 &&
    nextBlue < 85 &&
    nextRed > nextBlue * 1.35 &&
    nextGreen > nextBlue * 1.15
  if (pathLikeGrass) {
    nextBlue = clampByte(Math.max(nextBlue, nextRed / 1.18, 88), 86, 166)
    nextGreen = clampByte(Math.max(nextGreen, nextBlue * 1.08), 92, 222)
  }
  pathLikeGrass =
    nextRed > 95 &&
    nextGreen > 75 &&
    nextBlue < 85 &&
    nextRed > nextBlue * 1.35 &&
    nextGreen > nextBlue * 1.15
  if (pathLikeGrass) {
    nextBlue = clampByte(Math.max(nextBlue, 92), 90, 166)
  }
  if (nextRed > 160 && nextGreen > 172 && nextBlue < 124) {
    nextBlue = 124
  }
  const understoryPatch =
    smoothNoiseSigned(x / 53, y / 47, 941) > 0.34 &&
    smoothNoiseSigned(x / 17, y / 19, 947) > -0.18
  if (understoryPatch) {
    return [
      clampByte(56 + paletteA * 12 + noiseSigned(cellX, cellY, 953) * 5, 34, 86),
      clampByte(142 + paletteB * 20 + noiseSigned(cellX, cellY, 957) * 7, 112, 190),
      clampByte(58 + paletteC * 12 + noiseSigned(cellX, cellY, 967) * 5, 34, 92),
    ]
  }

  return [nextRed, nextGreen, nextBlue]
}

function stylizePathPixel(x: number, y: number): [number, number, number] {
  if (smoothNoiseSigned(x / 5.5, y / 4.75, 761) > 0.965) {
    return [218, 196, 124]
  }

  const coarse = smoothNoiseSigned(x / 34, y / 31, 401)
  const wash = smoothNoiseSigned(x / 11, y / 13, 457)
  const pebble = smoothNoiseSigned(x / 4.5, y / 4.25, 503)
  const gravel = smoothNoiseSigned(x / 2.25, y / 2.75, 557)
  const grain = noiseSigned(x, y, 509)
  const redGrain = noiseSigned(x, y, 701)
  const greenGrain = noiseSigned(x, y, 709)
  const blueGrain = noiseSigned(x, y, 719)
  const thread = Math.sin(x * 0.079 + y * 0.047 + coarse * 1.6)
  const red = clampByte(
    158 +
      coarse * 46 +
      wash * 36 +
      pebble * 30 +
      gravel * 24 +
      grain * 24 +
      redGrain * 34 +
      thread * 10,
    96,
    246
  )
  const greenBase =
    112 +
    coarse * 35 +
    wash * 30 +
    pebble * 24 +
    gravel * 20 +
    grain * 18 +
    greenGrain * 30 +
    thread * 8
  const green = clampByte(Math.min(greenBase, red * 0.86), 76, 202)
  const blue = clampByte(
    44 + coarse * 24 + wash * 20 + pebble * 24 + gravel * 20 - grain * 8 + blueGrain * 24,
    16,
    84
  )
  return [red, green, blue]
}

function stylizePathShoulderPixel(
  red: number,
  green: number,
  blue: number,
  x: number,
  y: number
): [number, number, number] {
  const dust = smoothNoiseSigned(x / 18, y / 15, 829)
  const grain = noiseSigned(x, y, 839)
  return [
    clampByte(red * 0.35 + 126 + dust * 24 + grain * 10, 92, 184),
    clampByte(green * 0.28 + 104 + dust * 18 + grain * 8, 78, 154),
    clampByte(blue * 0.18 + 42 + dust * 10 - grain * 4, 24, 82),
  ]
}

function stylizeWaterPixel(
  red: number,
  green: number,
  blue: number,
  x: number,
  y: number
): [number, number, number] {
  const ripple = Math.sin(x * 0.055 + y * 0.033 + smoothNoiseSigned(x / 23, y / 17, 853))
  const glint =
    noiseSigned(x, y, 857) > 0.94 &&
    smoothNoiseSigned(x / 19, y / 11, 859) > -0.45
  if (glint) {
    return [122, 214, 232]
  }
  return [
    clampByte(red * 0.9 + ripple * 2, 38, 128),
    clampByte(green * 0.96 + ripple * 5, 92, 190),
    clampByte(blue * 0.96 + ripple * 7, 106, 218),
  ]
}

function stylizeShorelinePixel(
  red: number,
  green: number,
  blue: number,
  x: number,
  y: number
): [number, number, number] {
  const flow = noiseSigned(Math.floor(x / 16), Math.floor(y / 22), 607)
  const ripple = Math.sin(y * 0.035 + flow * 1.4)
  const redBlend = red * 0.55 + 82 + flow * 14
  const greenBlend = green * 0.55 + 98 + ripple * 10
  const blueBlend = blue * 0.5 + 72 + flow * 12
  return [
    clampByte(redBlend, 56, 126),
    clampByte(greenBlend, 78, 152),
    clampByte(blueBlend, 58, 128),
  ]
}

function isNaturalGrassPixel(red: number, green: number, blue: number): boolean {
  const luma = red * 0.299 + green * 0.587 + blue * 0.114
  return green > red * 1.02 && green > blue * 0.96 && luma > 42 && luma < 174
}

function writePixel(
  data: Buffer,
  offset: number,
  color: [number, number, number]
): void {
  data[offset] = color[0]
  data[offset + 1] = color[1]
  data[offset + 2] = color[2]
}

function pointInVisualSlot(x: number, y: number, slot: GameMapVisualUnitSlot): boolean {
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
  return pointInVisualPolygon(x, y, geometry.points)
}

function pointNearVisualSlot(
  x: number,
  y: number,
  slot: GameMapVisualUnitSlot,
  radius: number
): boolean {
  const samples = [
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.7, radius * 0.7],
    [-radius * 0.7, radius * 0.7],
    [radius * 0.7, -radius * 0.7],
    [-radius * 0.7, -radius * 0.7],
  ] as const
  return samples.some(([dx, dy]) => pointInVisualSlot(x + dx, y + dy, slot))
}

function pointInVisualPolygon(
  x: number,
  y: number,
  points: Array<{ x: number; y: number }>
): boolean {
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

function noiseSigned(x: number, y: number, salt: number): number {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 3266489917) ^ salt
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (((value ^ (value >>> 16)) >>> 0) / 4294967295) * 2 - 1
}

function smoothNoiseSigned(x: number, y: number, salt: number): number {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const tx = smoothStep(x - left)
  const ty = smoothStep(y - top)
  const topBlend = lerp(
    noiseSigned(left, top, salt),
    noiseSigned(left + 1, top, salt),
    tx
  )
  const bottomBlend = lerp(
    noiseSigned(left, top + 1, salt),
    noiseSigned(left + 1, top + 1, salt),
    tx
  )
  return lerp(topBlend, bottomBlend, ty)
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(left: number, right: number, amount: number): number {
  return left + (right - left) * amount
}

function clampByte(value: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function slotToPlacement(slot: GameMapVisualUnitSlot): {
  left: number
  top: number
  width: number
  height: number
} {
  return {
    left: Math.max(0, Math.floor(slot.bounds.x)),
    top: Math.max(0, Math.floor(slot.bounds.y)),
    width: Math.max(1, Math.ceil(slot.bounds.width)),
    height: Math.max(1, Math.ceil(slot.bounds.height)),
  }
}

async function applySlotAlphaMask(
  material: Buffer,
  slot: GameMapVisualUnitSlot,
  placement: ReturnType<typeof slotToPlacement>,
  terrainPatchFeather?: TerrainPatchFeather
): Promise<Buffer> {
  const materialRaw = await sharp(material, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let maskPipeline = sharp(
    Buffer.from(buildSlotAlphaMaskSvg(slot, placement.width, placement.height, placement))
  )
    .greyscale()
  const maskBlur = slotMaskBlurRadius(slot)
  if (maskBlur > 0) {
    maskPipeline = maskPipeline.blur(maskBlur)
  }
  const maskRaw = await maskPipeline
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = Buffer.from(materialRaw.data)
  for (let pixelIndex = 0; pixelIndex < placement.width * placement.height; pixelIndex += 1) {
    const x = pixelIndex % placement.width
    const y = Math.floor(pixelIndex / placement.width)
    const materialOffset = pixelIndex * materialRaw.info.channels
    const maskOffset = pixelIndex * maskRaw.info.channels
    const maskAlpha = maskRaw.data[maskOffset] ?? 0
    const sourceAlpha = materialRaw.data[materialOffset + 3] ?? 255
    const feather = terrainPatchFeather
      ? terrainPatchFeatherFactor(x, y, placement, terrainPatchFeather)
      : 1
    const alpha = isObjectVisualUnit(slot.unitKind)
      ? Math.min(sourceAlpha, maskAlpha)
      : maskAlpha
    pixels[materialOffset + 3] = Math.round(alpha * feather)
  }

  return sharp(pixels, {
    raw: {
      width: placement.width,
      height: placement.height,
      channels: materialRaw.info.channels,
    },
  })
    .png()
    .toBuffer()
}

function slotMaskBlurRadius(slot: GameMapVisualUnitSlot): number {
  if (slot.unitKind === "water_texture") return 5
  if (slot.unitKind === "shoreline_texture") return 4
  if (slot.unitKind === "path_texture") return 2
  if (slot.unitKind === "boundary_texture") return 3
  if (isObjectVisualUnit(slot.unitKind)) return 1
  return 0
}

function runtimeCompositorZIndex(slot: GameMapVisualUnitSlot): number {
  if (
    slot.unitKind === "grass_detail_visual_unit" ||
    slot.unitKind === "flower_visual_unit" ||
    slot.unitKind === "shrub_visual_unit"
  ) {
    return 45 + slot.zIndex / 10000
  }
  if (slot.unitKind === "path_texture") {
    return 60 + slot.zIndex / 10000
  }
  return slot.zIndex
}

function isObjectVisualUnit(unitKind: GameMapVisualUnitSlot["unitKind"]): boolean {
  return (
    unitKind === "tree_visual_unit" ||
    unitKind === "rock_visual_unit" ||
    unitKind === "shrub_visual_unit" ||
    unitKind === "flower_visual_unit" ||
    unitKind === "grass_detail_visual_unit"
  )
}

function buildTerrainPatchFeathers(
  slots: GameMapVisualUnitSlot[]
): Map<string, TerrainPatchFeather> {
  const patchSlots = slots
    .map((slot) => ({ slot, patch: parseTerrainPatchSlotId(slot.slotId) }))
    .filter(
      (
        item
      ): item is {
        slot: GameMapVisualUnitSlot
        patch: { groupId: string; row: number; column: number }
      } => item.patch !== null && item.slot.unitKind === "grass_texture"
    )
  const patchKeys = new Set(
    patchSlots.map((item) => patchKey(item.patch.groupId, item.patch.row, item.patch.column))
  )
  const feathers = new Map<string, TerrainPatchFeather>()

  for (const item of patchSlots) {
    feathers.set(item.slot.slotId, {
      left: patchKeys.has(
        patchKey(item.patch.groupId, item.patch.row, item.patch.column - 1)
      ),
      top: patchKeys.has(
        patchKey(item.patch.groupId, item.patch.row - 1, item.patch.column)
      ),
    })
  }

  return feathers
}

function parseTerrainPatchSlotId(
  slotId: string
): { groupId: string; row: number; column: number } | null {
  const match = /^(.*)-patch-(\d+)-(\d+)$/.exec(slotId)
  if (!match) return null
  return {
    groupId: match[1] ?? "",
    row: Number(match[2]),
    column: Number(match[3]),
  }
}

function patchKey(groupId: string, row: number, column: number): string {
  return `${groupId}:${row}:${column}`
}

function terrainPatchFeatherFactor(
  x: number,
  y: number,
  placement: ReturnType<typeof slotToPlacement>,
  feather: TerrainPatchFeather
): number {
  const featherWidth = Math.max(1, Math.min(32, Math.floor(placement.width / 3), Math.floor(placement.height / 3)))
  let factor = 1

  if (feather.left && x < featherWidth) {
    factor = Math.min(factor, 0.55 + (x / featherWidth) * 0.45)
  }
  if (feather.top && y < featherWidth) {
    factor = Math.min(factor, 0.55 + (y / featherWidth) * 0.45)
  }

  return Math.max(0, Math.min(1, factor))
}

function buildSlotAlphaMaskSvg(
  slot: GameMapVisualUnitSlot,
  width: number,
  height: number,
  placement: ReturnType<typeof slotToPlacement>
): string {
  const shape =
    slot.maskGeometry.kind === "polygon"
      ? `<polygon points="${slot.maskGeometry.points
          .map((point) => `${round(point.x - placement.left)},${round(point.y - placement.top)}`)
          .join(" ")}" fill="white" />`
      : `<rect x="${round(slot.maskGeometry.rect.x - placement.left)}" y="${round(
          slot.maskGeometry.rect.y - placement.top
        )}" width="${round(slot.maskGeometry.rect.width)}" height="${round(
          slot.maskGeometry.rect.height
        )}" fill="white" />`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="black" />
  ${shape}
</svg>`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function blocked(
  status: Exclude<GameMapRuntimeCompositorStatus, "runtime_composite_output_written">,
  blockedReasons: string[]
): GameMapRuntimeCompositorResult {
  return {
    status,
    passed: false,
    manifest: null,
    output: null,
    outputPath: null,
    auditPath: null,
    formalVisualJudgePath: null,
    auditItems: [],
    qualityMetrics: undefined,
    blockedReasons,
    tags: ["runtime_compositor_blocked"],
  }
}

async function measureCompositeOutputQuality(
  outputBytes: Buffer,
  auditItems: GameMapRuntimeCompositorAuditItem[] = []
): Promise<GameMapRuntimeCompositorQualityMetrics> {
  const raw = await sharp(outputBytes, { failOn: "error" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = raw.info.width
  const height = raw.info.height
  const channels = raw.info.channels
  const data = raw.data

  const verticalDeltas: number[] = []
  for (let x = 1; x < width; x += 1) {
    verticalDeltas.push(measureVerticalSeamDelta(data, width, height, channels, x))
  }
  const horizontalDeltas: number[] = []
  for (let y = 1; y < height; y += 1) {
    horizontalDeltas.push(measureHorizontalSeamDelta(data, width, height, channels, y))
  }

  const averageVerticalSeamDelta = average(verticalDeltas)
  const averageHorizontalSeamDelta = average(horizontalDeltas)
  const maxVerticalGridSeamDelta = max(
    gridLines(width).map((x) => measureVerticalSeamDelta(data, width, height, channels, x))
  )
  const maxHorizontalGridSeamDelta = max(
    gridLines(height).map((y) => measureHorizontalSeamDelta(data, width, height, channels, y))
  )
  const maxVerticalGridSeamRatio = ratio(
    maxVerticalGridSeamDelta,
    averageVerticalSeamDelta
  )
  const maxHorizontalGridSeamRatio = ratio(
    maxHorizontalGridSeamDelta,
    averageHorizontalSeamDelta
  )
  const repetitiveTextureMetrics = measureRepetitiveTextureMetrics(
    data,
    width,
    height,
    channels
  )
  const terrainPatchBoundaries = terrainPatchBoundaryLines(auditItems, width, height)
  const maxTerrainPatchVerticalDelta = max(
    terrainPatchBoundaries.vertical.map((x) =>
      measureVerticalSeamDelta(data, width, height, channels, x)
    )
  )
  const maxTerrainPatchHorizontalDelta = max(
    terrainPatchBoundaries.horizontal.map((y) =>
      measureHorizontalSeamDelta(data, width, height, channels, y)
    )
  )
  const maxTerrainPatchVerticalRatio = ratio(
    maxTerrainPatchVerticalDelta,
    averageVerticalSeamDelta
  )
  const maxTerrainPatchHorizontalRatio = ratio(
    maxTerrainPatchHorizontalDelta,
    averageHorizontalSeamDelta
  )
  const terrainPatchArtifactSuspected =
    (maxTerrainPatchVerticalDelta >= 0.06 && maxTerrainPatchVerticalRatio >= 1.25) ||
    (maxTerrainPatchHorizontalDelta >= 0.06 && maxTerrainPatchHorizontalRatio >= 1.25)
  const patchBandArtifactSuspected =
    (maxTerrainPatchVerticalDelta >= 0.035 && maxTerrainPatchVerticalRatio >= 1.1) ||
    (maxTerrainPatchHorizontalDelta >= 0.045 && maxTerrainPatchHorizontalRatio >= 1.2) ||
    (maxHorizontalGridSeamDelta >= 0.06 && maxHorizontalGridSeamRatio >= 1.55)
  const objectMaterialAlphaMissingCount = auditItems.filter(
    (item) => isObjectVisualUnitKind(item.unitKind) && !item.sourceHasAlpha
  ).length
  const objectMaterialAlphaMissingSuspected = objectMaterialAlphaMissingCount > 0
  const visibleGridArtifactSuspected =
    maxVerticalGridSeamDelta >= 0.08 &&
    maxVerticalGridSeamRatio >= 1.65 &&
    maxHorizontalGridSeamDelta >= 0.055 &&
    maxHorizontalGridSeamRatio >= 1.35
  const repetitiveTextureArtifactSuspected =
    repetitiveTextureMetrics.minHorizontalTextureRepeatDelta < 0.012 ||
    repetitiveTextureMetrics.minVerticalTextureRepeatDelta < 0.012
  const denseTextureArtifactSuspected =
    averageVerticalSeamDelta >= 0.055 && averageHorizontalSeamDelta >= 0.045
  const gridArtifactSuspected =
    (maxVerticalGridSeamDelta >= 0.075 && maxVerticalGridSeamRatio >= 2.35) ||
    (maxHorizontalGridSeamDelta >= 0.075 && maxHorizontalGridSeamRatio >= 2.35) ||
    visibleGridArtifactSuspected ||
    terrainPatchArtifactSuspected ||
    patchBandArtifactSuspected ||
    repetitiveTextureArtifactSuspected ||
    denseTextureArtifactSuspected ||
    objectMaterialAlphaMissingSuspected

  return {
    averageVerticalSeamDelta: roundMetric(averageVerticalSeamDelta),
    averageHorizontalSeamDelta: roundMetric(averageHorizontalSeamDelta),
    maxVerticalGridSeamDelta: roundMetric(maxVerticalGridSeamDelta),
    maxHorizontalGridSeamDelta: roundMetric(maxHorizontalGridSeamDelta),
    maxVerticalGridSeamRatio: roundMetric(maxVerticalGridSeamRatio),
    maxHorizontalGridSeamRatio: roundMetric(maxHorizontalGridSeamRatio),
    visibleGridArtifactSuspected,
    minHorizontalTextureRepeatDelta: roundMetric(
      repetitiveTextureMetrics.minHorizontalTextureRepeatDelta
    ),
    minVerticalTextureRepeatDelta: roundMetric(
      repetitiveTextureMetrics.minVerticalTextureRepeatDelta
    ),
    repetitiveTextureArtifactSuspected,
    denseTextureArtifactSuspected,
    maxTerrainPatchVerticalDelta: roundMetric(maxTerrainPatchVerticalDelta),
    maxTerrainPatchHorizontalDelta: roundMetric(maxTerrainPatchHorizontalDelta),
    maxTerrainPatchVerticalRatio: roundMetric(maxTerrainPatchVerticalRatio),
    maxTerrainPatchHorizontalRatio: roundMetric(maxTerrainPatchHorizontalRatio),
    terrainPatchArtifactSuspected,
    patchBandArtifactSuspected,
    objectMaterialAlphaMissingCount,
    objectMaterialAlphaMissingSuspected,
    gridArtifactSuspected,
  }
}

async function repairCompositeSeams(
  outputBytes: Buffer,
  auditItems: GameMapRuntimeCompositorAuditItem[]
): Promise<Buffer> {
  const raw = await sharp(outputBytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = raw.info.width
  const height = raw.info.height
  const channels = raw.info.channels
  const data = Buffer.from(raw.data)
  const boundaries = terrainPatchBoundaryLines(auditItems, width, height)

  for (const x of boundaries.vertical) {
    softenVerticalSeam(data, width, height, channels, x, 5)
  }
  for (const y of boundaries.horizontal) {
    softenHorizontalSeam(data, width, height, channels, y, 5)
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer()
}

function softenVerticalSeam(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  radius: number
): void {
  const leftReference = Math.max(0, x - radius * 3)
  const rightReference = Math.min(width - 1, x + radius * 3)
  if (leftReference >= x || rightReference <= x) return
  for (let y = 0; y < height; y += 1) {
    const left = pixelAt(data, width, channels, leftReference, y)
    const right = pixelAt(data, width, channels, rightReference, y)
    for (let column = Math.max(0, x - radius); column <= Math.min(width - 1, x + radius); column += 1) {
      const strength = 0.62 * (1 - Math.abs(column - x) / Math.max(1, radius + 1))
      blendPixel(data, width, channels, column, y, left, right, strength)
    }
  }
}

function softenHorizontalSeam(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  y: number,
  radius: number
): void {
  const topReference = Math.max(0, y - radius * 3)
  const bottomReference = Math.min(height - 1, y + radius * 3)
  if (topReference >= y || bottomReference <= y) return
  for (let x = 0; x < width; x += 1) {
    const top = pixelAt(data, width, channels, x, topReference)
    const bottom = pixelAt(data, width, channels, x, bottomReference)
    for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row += 1) {
      const strength = 0.62 * (1 - Math.abs(row - y) / Math.max(1, radius + 1))
      blendPixel(data, width, channels, x, row, top, bottom, strength)
    }
  }
}

function pixelAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): number[] {
  const offset = (y * width + x) * channels
  return [
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 255,
  ]
}

function blendPixel(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number,
  first: number[],
  second: number[],
  strength: number
): void {
  const offset = (y * width + x) * channels
  const target = [
    (first[0] + second[0]) / 2,
    (first[1] + second[1]) / 2,
    (first[2] + second[2]) / 2,
    Math.max(first[3], second[3]),
  ]
  for (let channel = 0; channel < Math.min(channels, 4); channel += 1) {
    const current = data[offset + channel] ?? 0
    data[offset + channel] = Math.round(current * (1 - strength) + target[channel] * strength)
  }
}

function isObjectVisualUnitKind(unitKind: GameMapVisualUnitSlot["unitKind"]): boolean {
  return unitKind.endsWith("_visual_unit")
}

function measureRepetitiveTextureMetrics(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): {
  minHorizontalTextureRepeatDelta: number
  minVerticalTextureRepeatDelta: number
} {
  const shifts = [8, 12, 16, 24, 32, 48, 64].filter(
    (shift) => shift < width / 2 && shift < height / 2
  )
  if (shifts.length === 0) {
    return {
      minHorizontalTextureRepeatDelta: 1,
      minVerticalTextureRepeatDelta: 1,
    }
  }

  return {
    minHorizontalTextureRepeatDelta: Math.min(
      ...shifts.map((shift) =>
        measureTextureRepeatDelta(data, width, height, channels, shift, 0)
      )
    ),
    minVerticalTextureRepeatDelta: Math.min(
      ...shifts.map((shift) =>
        measureTextureRepeatDelta(data, width, height, channels, 0, shift)
      )
    ),
  }
}

function measureTextureRepeatDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  shiftX: number,
  shiftY: number
): number {
  let total = 0
  let count = 0
  const step = 4
  for (let y = 0; y < height - shiftY; y += step) {
    for (let x = 0; x < width - shiftX; x += step) {
      total += Math.abs(
        luminanceAt(data, width, channels, x, y) -
          luminanceAt(data, width, channels, x + shiftX, y + shiftY)
      )
      count += 1
    }
  }
  return count === 0 ? 1 : total / count
}

function terrainPatchBoundaryLines(
  auditItems: GameMapRuntimeCompositorAuditItem[],
  width: number,
  height: number
): { vertical: number[]; horizontal: number[] } {
  const vertical = new Set<number>()
  const horizontal = new Set<number>()

  for (const item of auditItems) {
    const patch = parseTerrainPatchSlotId(item.slotId)
    if (!patch) continue
    if (patch.column > 0) {
      addBoundaryLine(vertical, item.left, width)
      addBoundaryLine(vertical, item.left + 32, width)
    }
    if (patch.row > 0) {
      addBoundaryLine(horizontal, item.top, height)
      addBoundaryLine(horizontal, item.top + 32, height)
    }
  }

  return {
    vertical: [...vertical],
    horizontal: [...horizontal],
  }
}

function addBoundaryLine(lines: Set<number>, value: number, limit: number): void {
  const rounded = Math.round(value)
  if (rounded > 0 && rounded < limit) {
    lines.add(rounded)
  }
}

function measureVerticalSeamDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number
): number {
  let total = 0
  for (let y = 0; y < height; y += 1) {
    total += Math.abs(
      luminanceAt(data, width, channels, x, y) -
        luminanceAt(data, width, channels, x - 1, y)
    )
  }
  return total / height
}

function measureHorizontalSeamDelta(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  y: number
): number {
  let total = 0
  for (let x = 0; x < width; x += 1) {
    total += Math.abs(
      luminanceAt(data, width, channels, x, y) -
        luminanceAt(data, width, channels, x, y - 1)
    )
  }
  return total / width
}

function luminanceAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): number {
  const offset = (y * width + x) * channels
  const red = data[offset] ?? 0
  const green = data[offset + 1] ?? 0
  const blue = data[offset + 2] ?? 0
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

function gridLines(size: number): number[] {
  const lines: number[] = []
  for (let value = 64; value < size; value += 64) {
    lines.push(value)
  }
  return lines
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function max(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values)
}

function ratio(value: number, baseline: number): number {
  return baseline <= 0 ? 0 : value / baseline
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
