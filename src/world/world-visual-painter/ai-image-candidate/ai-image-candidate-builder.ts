import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageProviderStatus,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

const ALLOWED_MANUAL_LICENSES = [
  "self_owned",
  "cc0",
  "commercial_license",
] as const

const VISUAL_QUALITY_ASSERTION_TAGS = [
  "bright_healing_detailed_top_down_pixel_style",
  "clear_world_focal_point",
  "terrain_layer_depth",
  "path_logic",
  "natural_boundary",
  "material_construction_relation",
  "no_placeholder_blocks",
  "no_dirty_paths",
  "no_random_scatter",
  "no_garbled_text",
  "no_watermark",
  "no_ui_card",
  "no_added_world_facts",
  "copyright_safe",
] as const

type ManualLicense = (typeof ALLOWED_MANUAL_LICENSES)[number]

export function buildWorldVisualAiImageCandidate(input: {
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
  providerStatus: WorldVisualAiImageProviderStatus
}): WorldVisualAiImageCandidate | null {
  if (input.providerStatus.providerKind === "manual_import") {
    return buildManualImportCandidate(input)
  }

  return null
}

function buildManualImportCandidate(input: {
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}): WorldVisualAiImageCandidate | null {
  const imageUrl = process.env.AI_PET_WORLD_MANUAL_IMAGE_URL?.trim()
  const width = Number(process.env.AI_PET_WORLD_MANUAL_IMAGE_WIDTH)
  const height = Number(process.env.AI_PET_WORLD_MANUAL_IMAGE_HEIGHT)
  const imageFormat = parseImageFormat(
    process.env.AI_PET_WORLD_MANUAL_IMAGE_FORMAT
  )
  const license = parseManualLicense(process.env.AI_PET_WORLD_MANUAL_IMAGE_LICENSE)
  const originalityConfirmed =
    process.env.AI_PET_WORLD_MANUAL_IMAGE_ORIGINALITY_CONFIRMED === "true"

  if (!imageUrl || !width || !height || !imageFormat || !license) {
    return null
  }

  if (!originalityConfirmed) {
    return null
  }

  return {
    candidateId: `manual-ai-image-candidate-${input.factManifest.worldId}-${input.factManifest.tick}`,
    providerKind: "manual_import",
    imageUrl,
    imageFormat,
    width,
    height,
    license,
    originalityConfirmed,
    sourceDescription: {
      zh: "通过授权人工导入流程登记的隐藏 AI 位图候选图。",
      en: "Hidden AI bitmap candidate registered through the authorized manual import flow.",
    },
    promptPackageId: input.promptPackage.packageId,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    generationNotes: {
      zh: "该候选图必须继续经过 Visual Judge；候选图声明已遵守明亮治愈、精细俯视像素风、清晰主焦点、地形层次、路径逻辑、自然边界、材料/施工关系、无占位块、无脏路径、无随机散点、无乱码、无水印、无 UI 卡片、无新增世界事实、无侵权风险等正式画面要求。只有生成 ApprovedFrame 后才能展示。",
      en: "This candidate must still pass Visual Judge. It declares compliance with the formal frame requirements: bright healing detailed top-down pixel style, clear world focal point, terrain layering, path logic, natural boundaries, material/construction relationship, no placeholder blocks, no dirty paths, no random scatter, no garbled text, no watermark, no UI cards, no added world facts, and no infringement risk. It can only be displayed after ApprovedFrame is produced.",
    },
    tags: [
      "ai_image_candidate",
      "manual_import",
      "authorized_source_required",
      "hidden_until_visual_judge",
      ...VISUAL_QUALITY_ASSERTION_TAGS,
    ],
  }
}

function parseImageFormat(
  value: string | undefined
): WorldVisualAiImageCandidate["imageFormat"] | null {
  if (value === "png" || value === "webp" || value === "jpg") return value
  return null
}

function parseManualLicense(value: string | undefined): ManualLicense | null {
  for (const license of ALLOWED_MANUAL_LICENSES) {
    if (value === license) return license
  }

  return null
}