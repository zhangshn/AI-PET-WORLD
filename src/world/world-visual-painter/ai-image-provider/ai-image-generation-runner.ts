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
      zh: "由已配置的 AI 图像生成入口返回的隐藏位图候选图。",
      en: "Hidden bitmap candidate returned by the configured AI image generation entry.",
    },
    promptPackageId: input.promptPackage.packageId,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    generationNotes: {
      zh: "候选图不能直接展示，必须先进入 Visual Judge，通过后才可生成 ApprovedFrame。",
      en: "The candidate cannot be displayed directly. It must enter Visual Judge and may become ApprovedFrame only after passing review.",
    },
    tags: [
      "ai_image_candidate",
      input.request.providerKind,
      "generated_candidate",
      "hidden_until_visual_judge",
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
