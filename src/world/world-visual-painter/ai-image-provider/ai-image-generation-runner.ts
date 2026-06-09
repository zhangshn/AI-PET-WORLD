import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualAiImageGenerationResult,
  WorldVisualAiImageProviderKind,
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

type ProviderErrorResponse = Partial<{
  ok: boolean
  status: string
  message: string
  messageEn: string
  error: {
    zh?: string
    en?: string
  }
  canShowToPlayer: boolean
  tags: string[]
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

    const contentType = response.headers.get("content-type")
    const payload = contentType?.includes("application/json")
      ? ((await response.json()) as ProviderImageResponse & ProviderErrorResponse)
      : null

    if (!response.ok) {
      return buildFailedProviderHttpResult({
        httpStatus: response.status,
        contentType,
        payload,
      })
    }

    if (!payload) {
      return failedResult(
        "图像生成服务没有返回 JSON，无法校验 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
        "The image generation service did not return JSON, so imageUrl / imageFormat / width / height / license / originalityConfirmed cannot be validated.",
        [
          "provider_invalid_response",
          "provider_response_not_json",
          "response_contract_failed",
        ]
      )
    }

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
        input.request.providerKind,
        "candidate_created",
        "provider_response_contract_passed",
        "response_contract_passed",
        "hidden_until_visual_judge",
        ...buildProviderProvenanceTags(input.request.providerKind),
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

function buildFailedProviderHttpResult(input: {
  httpStatus: number
  contentType: string | null
  payload: (ProviderImageResponse & ProviderErrorResponse) | null
}): WorldVisualAiImageGenerationResult {
  const providerStatus = input.payload?.status
  const implementationNotConnected =
    providerStatus === "local_image_model_implementation_not_connected"

  if (implementationNotConnected) {
    return failedResult(
      "本地图像模型适配入口已收到正式视觉生成请求，但真实 local image model implementation 尚未接入；因此不能生成隐藏候选图，也不会返回假图或占位图。",
      "The local image model adapter received the formal visual generation request, but no real local image model implementation is connected; therefore no hidden candidate can be generated and no fake image or placeholder will be returned.",
      [
        "provider_http_error",
        "local_model_implementation_not_connected",
        "candidate_not_created",
        "fake_image_forbidden",
        "response_contract_not_confirmed",
      ]
    )
  }

  const providerMessageZh =
    input.payload?.error?.zh ??
    input.payload?.message ??
    `图像生成服务返回失败状态：${input.httpStatus}`
  const providerMessageEn =
    input.payload?.error?.en ??
    input.payload?.messageEn ??
    `Image generation service returned status ${input.httpStatus}.`

  return failedResult(providerMessageZh, providerMessageEn, [
    "provider_http_error",
    `provider_http_status_${input.httpStatus}`,
    input.contentType?.includes("application/json")
      ? "provider_error_json_received"
      : "provider_error_body_not_json",
    ...(input.payload?.tags ?? []),
  ])
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
      sourceDescription: buildProviderSourceDescription(input.request.providerKind),
      promptPackageId: input.promptPackage.packageId,
      sourceFactIds: input.factManifest.sourceFactIds,
      canShowToPlayer: false,
      generationNotes: buildProviderGenerationNotes(input.request.providerKind),
      tags: [
        "ai_image_candidate",
        input.request.providerKind,
        "generated_candidate",
        "provider_response_contract_passed",
        "response_contract_passed",
        "hidden_until_visual_judge",
        ...buildProviderProvenanceTags(input.request.providerKind),
        ...VISUAL_QUALITY_ASSERTION_TAGS,
      ],
    },
  }
}

function buildProviderSourceDescription(
  providerKind: Exclude<WorldVisualAiImageProviderKind, "not_configured" | "manual_import">
) {
  if (providerKind === "local_model") {
    return {
      zh: "由真实本地图像模型入口返回的隐藏位图候选图，已通过 imageUrl / imageFormat / width / height / license / originalityConfirmed 响应契约校验。",
      en: "Hidden bitmap candidate returned by the real local image model entry and validated against the imageUrl / imageFormat / width / height / license / originalityConfirmed response contract.",
    }
  }

  return {
    zh: "由外部 AI 图像生成模型入口返回的隐藏位图候选图，已通过 imageUrl / imageFormat / width / height / license / originalityConfirmed 响应契约校验。",
    en: "Hidden bitmap candidate returned by the external AI image generation entry and validated against the imageUrl / imageFormat / width / height / license / originalityConfirmed response contract.",
  }
}

function buildProviderGenerationNotes(
  providerKind: Exclude<WorldVisualAiImageProviderKind, "not_configured" | "manual_import">
) {
  if (providerKind === "local_model") {
    return {
      zh: "本地图像模型返回结果只被登记为隐藏 AiImageCandidate；不能直接展示，不能绕过 VisualJudge，也不能改写世界事实。该候选图必须继续通过 VisualJudge，生成 ApprovedFrame 后 /world 才能展示。",
      en: "The local image model result is registered only as a hidden AiImageCandidate. It must not be displayed directly, bypass VisualJudge, or rewrite world facts. It must still pass VisualJudge before an ApprovedFrame can be shown by /world.",
    }
  }

  return {
    zh: "图像模型返回结果只被登记为隐藏 AiImageCandidate；不能直接展示，不能绕过 VisualJudge，也不能改写世界事实。该候选图必须继续通过 VisualJudge，生成 ApprovedFrame 后 /world 才能展示。",
    en: "The image model result is registered only as a hidden AiImageCandidate. It must not be displayed directly, bypass VisualJudge, or rewrite world facts. It must still pass VisualJudge before an ApprovedFrame can be shown by /world.",
  }
}

function buildProviderProvenanceTags(
  providerKind: Exclude<WorldVisualAiImageProviderKind, "not_configured" | "manual_import">
) {
  return providerKind === "local_model"
    ? [
        "local_model_ai_image_candidate",
        "real_local_model_response",
        "local_model_response_contract_validated",
        "candidate_source_local_model",
      ]
    : [
        "external_api_ai_image_candidate",
        "external_provider_response",
        "external_response_contract_validated",
        "candidate_source_external_api",
      ]
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

  if (!isAllowedImageUrl(imageUrl)) {
    return failedValidation(
      "图像生成模型返回的 imageUrl 协议不被允许。只允许 http、https 或 data:image URL，禁止本地文件路径。",
      "The image generation model returned a disallowed imageUrl scheme. Only http, https, or data:image URLs are allowed. Local file paths are forbidden.",
      ["response_contract_failed", "invalid_image_url_scheme"]
    )
  }

  if (!isAllowedImageFormat(imageFormat, input.contract)) {
    return failedValidation(
      `图像生成模型返回的 imageFormat 不被允许：${String(imageFormat)}。`,
      `The image generation model returned a disallowed imageFormat: ${String(imageFormat)}.`,
      ["response_contract_failed", "invalid_image_format"]
    )
  }

  if (typeof width !== "number" || !Number.isInteger(width)) {
    return failedValidation(
      "图像生成模型返回的 width 不是整数。",
      "The image generation model returned a width that is not an integer.",
      ["response_contract_failed", "invalid_width"]
    )
  }

  if (typeof height !== "number" || !Number.isInteger(height)) {
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

function isAllowedImageUrl(imageUrl: string): boolean {
  if (imageUrl.startsWith("data:image/")) return true

  try {
    const url = new URL(imageUrl)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
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
