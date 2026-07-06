import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import sharp from "sharp"

import type {
  GameMapCompositeManifest,
  GameMapCompositeMaterialSource,
  GameMapVisualUnitSlot,
} from "./game-map-composite-schema"
import type {
  GameMapApprovedVisualUnitMaterialInput,
} from "./game-map-composite-material-binding"
import type {
  GameMapApprovedVisualUnitMaterialPack,
} from "./game-map-approved-visual-unit-material-pack"
import { validateGameMapApprovedVisualUnitMaterialPack } from "./game-map-approved-visual-unit-material-pack"

export type GameMapMaterialFileInput = {
  slotId: string
  imagePath: string
  approvedAssetId?: string
  tags?: string[]
}

export type BuildGameMapApprovedMaterialPackResult = {
  passed: boolean
  pack: GameMapApprovedVisualUnitMaterialPack | null
  packPath: string | null
  blockedReasons: string[]
  tags: string[]
}

const BLOCKED_MATERIAL_TAGS = [
  "training_candidate",
  "candidate_only",
  "partial_or_crop_candidate",
  "single_model_output_only",
  "single_direct_output",
  "local_asset_preview",
]

export async function buildGameMapApprovedMaterialPackFromFiles(input: {
  manifest: GameMapCompositeManifest
  materialFiles: GameMapMaterialFileInput[]
  outputRoot?: string
  reviewedAt?: string
  reviewer?: "visual_judge" | "project_owner"
  qualityReport?: {
    passed: boolean
    schemaVersion?: string
    status?: string
    summary?: {
      slotCount?: number
      failedCount?: number
    }
  }
  notes?: string[]
}): Promise<BuildGameMapApprovedMaterialPackResult> {
  const { manifest } = input
  const filesBySlotId = new Map(input.materialFiles.map((file) => [file.slotId, file]))
  const missingSlots = manifest.visualUnitSlots.filter(
    (slot) => !filesBySlotId.has(slot.slotId)
  )
  if (missingSlots.length > 0) {
    return blocked("approved_material_pack_missing_slot_files", missingSlots.map((slot) => slot.slotId))
  }

  const extraFiles = input.materialFiles.filter(
    (file) => !manifest.visualUnitSlots.some((slot) => slot.slotId === file.slotId)
  )
  if (extraFiles.length > 0) {
    return blocked("approved_material_pack_extra_slot_files", extraFiles.map((file) => file.slotId))
  }

  const materials: GameMapApprovedVisualUnitMaterialInput[] = []
  const reviewer = input.reviewer ?? "visual_judge"
  if (!isPassedMaterialQualityReport(input.qualityReport, manifest.visualUnitSlots.length)) {
    return blocked("approved_material_pack_quality_report_missing_or_failed", [
      "material_visual_quality_report_required",
    ])
  }
  const materialQualityTags = ["visual_quality_reviewed_for_world"]

  for (const slot of manifest.visualUnitSlots) {
    const file = filesBySlotId.get(slot.slotId)
    if (!file) continue

    if (file.tags?.some((tag) => BLOCKED_MATERIAL_TAGS.includes(tag))) {
      return blocked("approved_material_pack_blocked_file_tags", [slot.slotId])
    }

    const material = await buildMaterialFromFile(slot, file, materialQualityTags)
    if (!material.passed || !material.material) {
      return blocked(material.status, material.blockedReasons)
    }
    materials.push(material.material)
  }

  const reviewedAt = input.reviewedAt ?? new Date().toISOString()
  const pack: GameMapApprovedVisualUnitMaterialPack = {
    schemaVersion: "game-map-approved-visual-unit-material-pack-v1",
    packId: `approved-material-pack-${manifest.worldId}-${manifest.tick}-${safeTimestamp(reviewedAt)}`,
    worldId: manifest.worldId,
    tick: manifest.tick,
    sourceFactIds: [...manifest.sourceFactIds],
    materials,
    review: {
      status: "approved_visual_unit_material_pack",
      reviewer,
      reviewedAt,
      notes: [
        "All material images are bound to GameMapCompositeManifest visual unit slots.",
        "This pack does not contain training, candidate, crop, or single-model-output tags.",
        "Visual quality has been reviewed for world entry.",
        ...(input.notes ?? []),
      ],
    },
    tags: [
      "approved_visual_unit_material_pack",
      "same_source_material_pack",
      "ready_for_runtime_compositor",
      ...materialQualityTags,
    ],
  }

  const validation = validateGameMapApprovedVisualUnitMaterialPack(pack)
  if (!validation.passed) {
    return blocked("approved_material_pack_schema_invalid", validation.blockedReasons)
  }

  const outputRoot = input.outputRoot
    ? resolve(input.outputRoot)
    : join(
        /* turbopackIgnore: true */ process.cwd(),
        ".runtime",
        "game-map-approved-material-packs"
      )
  const outputDir = join(outputRoot, manifest.worldId, String(manifest.tick), pack.packId)
  const packPath = join(outputDir, "approved-material-pack.json")
  await mkdir(outputDir, { recursive: true })
  await writeFile(packPath, JSON.stringify(pack, null, 2), "utf8")

  return {
    passed: true,
    pack,
    packPath,
    blockedReasons: [],
    tags: [
      "approved_visual_unit_material_pack_written",
      "ready_for_runtime_compositor",
    ],
  }
}

async function buildMaterialFromFile(
  slot: GameMapVisualUnitSlot,
  file: GameMapMaterialFileInput,
  materialQualityTags: string[]
): Promise<{
  passed: boolean
  status: string
  material: GameMapApprovedVisualUnitMaterialInput | null
  blockedReasons: string[]
}> {
  const imagePath = resolve(file.imagePath)
  let bytes: Buffer
  try {
    bytes = await readFile(imagePath)
  } catch {
    return {
      passed: false,
      status: "approved_material_pack_file_unreadable",
      material: null,
      blockedReasons: [slot.slotId],
    }
  }

  const metadata = await sharp(bytes, { failOn: "error" }).metadata()
  const format = normalizeImageFormat(metadata.format)
  if (!metadata.width || !metadata.height || !format) {
    return {
      passed: false,
      status: "approved_material_pack_file_metadata_invalid",
      material: null,
      blockedReasons: [slot.slotId],
    }
  }

  return {
    passed: true,
    status: "approved_material_pack_material_ready",
    material: {
      approvedAssetId: file.approvedAssetId ?? `approved-material-${slot.slotId}`,
      slotId: slot.slotId,
      source: expectedMaterialSource(slot),
      imageUrl: imagePath,
      imageSha256: sha256(bytes),
      imageWidth: metadata.width,
      imageHeight: metadata.height,
      imageFormat: format,
      sourceFactIds: [...slot.sourceFactIds],
      tags: [
        "approved_ai_painter_visual_unit_material",
        "same_source_visual_unit_material",
        ...materialQualityTags,
        ...(file.tags ?? []),
      ],
    },
    blockedReasons: [],
  }
}

function expectedMaterialSource(slot: GameMapVisualUnitSlot): GameMapCompositeMaterialSource {
  return slot.painterContract.inputKind === "condition_mask_object"
    ? "ai_painter_object_visual_unit"
    : "ai_painter_region_texture"
}

function normalizeImageFormat(format: string | undefined): "png" | "webp" | "jpg" | null {
  if (format === "png" || format === "webp") return format
  if (format === "jpeg" || format === "jpg") return "jpg"
  return null
}

function blocked(status: string, reasons: string[]): BuildGameMapApprovedMaterialPackResult {
  return {
    passed: false,
    pack: null,
    packPath: null,
    blockedReasons: [status, ...reasons],
    tags: ["approved_visual_unit_material_pack_blocked"],
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function isPassedMaterialQualityReport(
  report: {
    passed: boolean
    schemaVersion?: string
    status?: string
    summary?: {
      slotCount?: number
      failedCount?: number
    }
  } | undefined,
  requiredSlotCount: number
): boolean {
  return (
    report?.schemaVersion === "game-map-material-quality-report-v1" &&
    report.passed === true &&
    report.status === "game_map_material_quality_passed" &&
    report.summary?.slotCount === requiredSlotCount &&
    report.summary?.failedCount === 0
  )
}

function safeTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}
