import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualAiImageGenerationResult,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

type ProviderImageResponse = Partial<{
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
}>

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

export async function runWorldVisualAiImageGenerationRequest(input: {
  request: WorldVisualAiImageGenerationRequest
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}): Promise<WorldVisualAiImageGenerationResult> {
  try {
    const response = await fetch(input.request.endpoint, {
      method: input.request.method,
      headers: input.request.headers,
      body: JSON.stringify(input.request.body),
    })

    if (!response.ok) {
      return failedResult(
        `图像生成服务返回失败状态：${response.status}`,
        `Image generation service returned status ${response.status}.`
      )
    }

    const payload = (await response.json()) as ProviderImageResponse
    const candidate = buildCandidateFromProviderResponse({
      payload,
      request: input.request,
      factManifest: input.factManifest,
      promptPackage: input.promptPackage,
    })

    if (!candidate) {
      return failedResult(
        "图像生成服务没有显式返回合格的 imageUrl、imageFormat、width、height、授权信息或原创确认。",
        "The image generation service did not explicitly return valid imageUrl, imageFormat, width, height, license, or originality confirmation."
      )
    }

    return {
      ok: true,
      candidate,
      error: null,
      tags: [
        "ai_image_generation_result",
        "candidate_created",
        "hidden_until_visual_judge",
      ],
    }
  } catch (error) {
    return failedResult(
      `图像生成请求失败：${error instanceof Error ? error.message : String(error)}`,
      `Image generation request failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function buildCandidateFromProviderResponse(input: {
  payload: ProviderImageResponse
  request: WorldVisualAiImageGenerationRequest
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}): WorldVisualAiImageCandidate | null {
  const imageUrl = input.payload.imageUrl?.trim()
  const imageFormat = input.payload.imageFormat
  const width = input.payload.width
  const height = input.payload.height
  const license = input.payload.license
  const originalityConfirmed = input.payload.originalityConfirmed === true

  if (!imageUrl || !license || !originalityConfirmed) return null
  if (!isSupportedImageFormat(imageFormat)) return null
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null
  if (typeof width !== "number" || typeof height !== "number") return null
  if (width < 1024 || height < 768) return null
  if (!["self_owned", "cc0", "commercial_license"].includes(license)) {
    return null
  }

  return {
    candidateId: `ai-image-candidate-${input.factManifest.worldId}-${input.factManifest.tick}-${input.request.providerKind}`,
    providerKind: input.request.providerKind,
    imageUrl,
    imageFormat,
    width,
    height,
    license,
    originalityConfirmed,
    sourceDescription: {
      zh: "由 AI 图像生成模型入口返回的隐藏位图候选图。",
      en: "Hidden bitmap candidate returned by the AI image generation model entry.",
    },
    promptPackageId: input.promptPackage.packageId,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    generationNotes: {
      zh: "候选图不能直接展示，必须先进入 Visual Judge；候选图声明已遵守明亮治愈、精细俯视像素风、清晰主焦点、地形层次、路径逻辑、自然边界、材料/施工关系、无占位块、无脏路径、无随机散点、无乱码、无水印、无 UI 卡片、无新增世界事实、无侵权风险等正式画面要求。通过审核后才可生成 ApprovedFrame。",
      en: "The candidate cannot be displayed directly and must enter Visual Judge first. It declares compliance with the formal frame requirements: bright healing detailed top-down pixel style, clear world focal point, terrain layering, path logic, natural boundaries, material/construction relationship, no placeholder blocks, no dirty paths, no random scatter, no garbled text, no watermark, no UI cards, no added world facts, and no infringement risk. It may become ApprovedFrame only after passing review.",
    },
    tags: [
      "ai_image_candidate",
      input.request.providerKind,
      "generated_candidate",
      "hidden_until_visual_judge",
      ...VISUAL_QUALITY_ASSERTION_TAGS,
    ],
  }
}

function failedResult(
  zh: string,
  en: string
): WorldVisualAiImageGenerationResult {
  return {
    ok: false,
    candidate: null,
    error: { zh, en },
    tags: ["ai_image_generation_result", "failed", "display_blocked"],
  }
}

function isSupportedImageFormat(
  value: unknown
): value is WorldVisualAiImageCandidate["imageFormat"] {
  return value === "png" || value === "webp" || value === "jpg"
}