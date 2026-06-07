import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualAiImageGenerationResult,
  WorldVisualFactManifest,
  WorldVisualImageGenerationResponseContract,
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

type ProviderResponseValidationResult =
  | {
      ok: true
      imageUrl: string
      imageFormat: WorldVisualAiImageCandidate["imageFormat"]
      width: number
      height: number
      license: WorldVisualAiImageCandidate["license"]
      originalityConfirmed: true
    }
  | {
      ok: false
      zh: string
      en: string
      tags: string[]
    }

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
        `Image generation service returned status ${response.status}.`,
        ["provider_http_error"]
      )
    }

    const payload = (await response.json()) as ProviderImageResponse
    const candidateResult = buildCandidateFromProviderResponse({
      payload,
      request: input.request,
      factManifest: input.factManifest,
      promptPackage: input.promptPackage,
    })

    if (!candidateResult.ok) {
      return failedResult(candidateResult.zh, candidateResult.en, candidateResult.tags)
    }

    return {
      ok: true,
      candidate: candidateResult.candidate,
      error: null,
      tags: [
        "ai_image_generation_result",
        "candidate_created",
        "response_contract_passed",
        "hidden_until_visual_judge",
      ],
    }
  } catch (error) {
    return failedResult(
      `图像生成请求失败：${error instanceof Error ? error.message : String(error)}`,
      `Image generation request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      ["provider_request_failed"]
    )
  }
}

function buildCandidateFromProviderResponse(input: {
  payload: ProviderImageResponse
  request: WorldVisualAiImageGenerationRequest
  factManifest: WorldVisualFactManifest
  promptPackage: WorldVisualPromptPackage
}):
  | { ok: true; candidate: WorldVisualAiImageCandidate }
  | { ok: false; zh: string; en: string; tags: string[] } {
  const validation = validateProviderImageResponse({
    payload: input.payload,
    contract: input.request.body.responseContract,
  })

  if (!validation.ok) {
    return validation
  }

  return {
    ok: true,
    candidate: {
      candidateId: `ai-image-candidate-${input.factManifest.worldId}-${input.factManifest.tick}-${input.request.providerKind}`,
      providerKind: input.request.providerKind,
      imageUrl: validation.imageUrl,
      imageFormat: validation.imageFormat,
      width: validation.width,
      height: validation.height,
      license: validation.license,
      originalityConfirmed: validation.originalityConfirmed,
      sourceDescription: {
        zh: "由 AI 图像生成模型入口返回的隐藏位图候选图。",
        en: "Hidden bitmap candidate returned by the AI image generation model entry.",
      },
      promptPackageId: input.promptPackage.packageId,
      sourceFactIds: input.factManifest.sourceFactIds,
      canShowToPlayer: false,
      generationNotes: {
        zh: "候选图不能直接展示，必须先进入 Visual Judge；候选图已按 responseContract 返回 imageUrl、imageFormat、width、height、license、originalityConfirmed，并声明遵守正式画面质量与版权安全要求。通过审核后才可生成 ApprovedFrame。",
        en: "The candidate cannot be displayed directly and must enter Visual Judge first. It returned imageUrl, imageFormat, width, height, license, and originalityConfirmed according to responseContract, and declares compliance with formal frame quality and copyright safety requirements. It may become ApprovedFrame only after passing review.",
      },
      tags: [
        "ai_image_candidate",
        input.request.providerKind,
        "generated_candidate",
        "response_contract_passed",
        "hidden_until_visual_judge",
        ...VISUAL_QUALITY_ASSERTION_TAGS,
      ],
    },
  }
}

function validateProviderImageResponse(input: {
  payload: ProviderImageResponse
  contract: WorldVisualImageGenerationResponseContract
}): ProviderResponseValidationResult {
  const missingFields = input.contract.requiredFields.filter(
    (field) => input.payload[field] === undefined || input.payload[field] === null
  )

  if (missingFields.length > 0) {
    return failedValidation(
      `图像生成模型返回缺少必填字段：${missingFields.join(", ")}。`,
      `The image generation model response is missing required fields: ${missingFields.join(", ")}.`,
      ["response_contract_failed", "missing_required_fields"]
    )
  }

  const imageUrl = input.payload.imageUrl?.trim()
  const imageFormat = input.payload.imageFormat
  const width = input.payload.width
  const height = input.payload.height
  const license = input.payload.license
  const originalityConfirmed = input.payload.originalityConfirmed === true

  if (!imageUrl) {
    return failedValidation(
      "图像生成模型返回的 imageUrl 为空。",
      "The image generation model returned an empty imageUrl.",
      ["response_contract_failed", "empty_image_url"]
    )
  }

  if (!isAllowedImageFormat(imageFormat, input.contract)) {
    return failedValidation(
      `图像生成模型返回的 imageFormat 不被允许：${String(imageFormat)}。`,
      `The image generation model returned a disallowed imageFormat: ${String(imageFormat)}.`,
      ["response_contract_failed", "invalid_image_format"]
    )
  }

  if (!Number.isInteger(width) || typeof width !== "number") {
    return failedValidation(
      "图像生成模型返回的 width 不是整数。",
      "The image generation model returned a width that is not an integer.",
      ["response_contract_failed", "invalid_width"]
    )
  }

  if (!Number.isInteger(height) || typeof height !== "number") {
    return failedValidation(
      "图像生成模型返回的 height 不是整数。",
      "The image generation model returned a height that is not an integer.",
      ["response_contract_failed", "invalid_height"]
    )
  }

  if (width < input.contract.minimumWidth || height < input.contract.minimumHeight) {
    return failedValidation(
      `图像生成模型返回尺寸低于契约要求：${width}x${height}，最低要求 ${input.contract.minimumWidth}x${input.contract.minimumHeight}。`,
      `The image generation model returned ${width}x${height}, below the contract minimum ${input.contract.minimumWidth}x${input.contract.minimumHeight}.`,
      ["response_contract_failed", "image_size_below_contract"]
    )
  }

  if (!isAllowedLicense(license, input.contract)) {
    return failedValidation(
      `图像生成模型返回的 license 不被允许：${String(license)}。`,
      `The image generation model returned a disallowed license: ${String(license)}.`,
      ["response_contract_failed", "invalid_license"]
    )
  }

  if (!originalityConfirmed) {
    return failedValidation(
      "图像生成模型没有确认 originalityConfirmed=true。",
      "The image generation model did not confirm originalityConfirmed=true.",
      ["response_contract_failed", "originality_not_confirmed"]
    )
  }

  if (
    input.contract.canShowToPlayer !== false ||
    input.contract.mustPersistAsAiImageCandidate !== true ||
    input.contract.mustPassVisualJudge !== true
  ) {
    return failedValidation(
      "图像生成响应契约不满足隐藏候选图与 VisualJudge 硬闸门要求。",
      "The image generation response contract does not satisfy hidden candidate and VisualJudge hard gate requirements.",
      ["response_contract_failed", "unsafe_contract_gate"]
    )
  }

  return {
    ok: true,
    imageUrl,
    imageFormat,
    width,
    height,
    license,
    originalityConfirmed,
  }
}

function failedValidation(
  zh: string,
  en: string,
  tags: string[]
): ProviderResponseValidationResult {
  return {
    ok: false,
    zh,
    en,
    tags,
  }
}

function failedResult(
  zh: string,
  en: string,
  tags: string[]
): WorldVisualAiImageGenerationResult {
  return {
    ok: false,
    candidate: null,
    error: { zh, en },
    tags: ["ai_image_generation_result", "failed", "display_blocked", ...tags],
  }
}

function isAllowedImageFormat(
  value: unknown,
  contract: WorldVisualImageGenerationResponseContract
): value is WorldVisualAiImageCandidate["imageFormat"] {
  return (
    (value === "png" || value === "webp" || value === "jpg") &&
    contract.allowedImageFormats.includes(value)
  )
}

function isAllowedLicense(
  value: unknown,
  contract: WorldVisualImageGenerationResponseContract
): value is WorldVisualAiImageCandidate["license"] {
  return (
    (value === "self_owned" ||
      value === "cc0" ||
      value === "commercial_license") &&
    contract.allowedLicenses.includes(value)
  )
}