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
      zh: "该候选图必须继续经过 Visual Judge；只有生成 ApprovedFrame 后才能展示。",
      en: "This candidate must still pass Visual Judge. It can only be displayed after ApprovedFrame is produced.",
    },
    tags: [
      "ai_image_candidate",
      "manual_import",
      "authorized_source_required",
      "hidden_until_visual_judge",
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
