// 当前文件作用：定义 AI-PET-WORLD 自研 local image model 的输入输出契约、图片返回校验与安全边界。

export const LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME =
  "ai-pet-world-local-image-model-implementation"

export const LOCAL_IMAGE_MODEL_IMPLEMENTATION_VERSION =
  "implementation-missing-2"

export const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

export const ALLOWED_IMAGE_FORMATS = ["png", "webp", "jpg"]

export const ALLOWED_LICENSES = [
  "self_owned",
  "cc0",
  "commercial_license",
]

export const MINIMUM_IMAGE_WIDTH = 512
export const MINIMUM_IMAGE_HEIGHT = 512

export function buildImplementationNotConnectedHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: LOCAL_IMAGE_MODEL_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    supportsWorldVisualPainter: true,
    supportsResponseContract: true,
    supportsHiddenCandidateOutput: true,
    supportsPng: true,
    supportsWebp: true,
    supportsJpg: true,
    requiredResponseShape: requiredResponseFields,
    outputContract: buildOutputContract(requiredResponseFields),
    message: "local image model implementation 尚未接入真实图像生成能力。",
    messageEn:
      "The local image model implementation has not connected a real image generation capability yet.",
    nextStep: {
      zh: "下一步接入真实图像生成实现，使 /generate 返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect a real image generation implementation so /generate returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_implementation",
      "implementation_not_connected",
      "output_contract_exposed",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function buildImplementationNotConnectedDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: LOCAL_IMAGE_MODEL_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    outputContract: buildOutputContract(requiredResponseFields),
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "契约服务理解正式视觉请求，但真实 local image model implementation 尚未接入，因此不能声明会返回 6 个图片字段。",
    messageEn:
      "The contract service understands the formal visual request, but no real local image model implementation is connected, so it cannot declare the six image fields.",
    nextStep: {
      zh: "接入真实 local image model 后，dry-run 必须返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting a real local image model, dry-run must return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_dry_run",
      "implementation_not_connected",
      "request_contract_checked",
      "output_contract_exposed",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function buildImplementationNotConnectedGenerate(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "local_image_model_implementation_not_connected",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: LOCAL_IMAGE_MODEL_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    outputContract: buildOutputContract(requiredResponseFields),
    message:
      "真实 local image model implementation 尚未接入。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "No real local image model implementation is connected. This service will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实图像生成模型，使 /generate 返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect a real image generation model so /generate returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "local_image_model_generate",
      "implementation_not_connected",
      "request_contract_checked",
      "output_contract_exposed",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function validateRealImageGenerationResult(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const payload = input.payload

  if (!isRecord(payload)) {
    return buildValidationFailure({
      zh: "真实图像生成实现没有返回 JSON 对象。",
      en: "The real image generation implementation did not return a JSON object.",
      tags: ["real_image_result_invalid", "payload_not_object"],
    })
  }

  const missingFields = requiredResponseFields.filter(
    (field) => payload[field] === undefined || payload[field] === null
  )

  if (missingFields.length > 0) {
    return buildValidationFailure({
      zh: `真实图像生成实现缺少必填字段：${missingFields.join(", ")}。`,
      en: `The real image generation implementation is missing required fields: ${missingFields.join(", ")}.`,
      tags: ["real_image_result_invalid", "missing_required_fields"],
    })
  }

  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : ""
  const imageUrlValidation = validateImageUrl(imageUrl)

  if (!imageUrlValidation.ok) {
    return buildValidationFailure({
      zh: imageUrlValidation.zh,
      en: imageUrlValidation.en,
      tags: ["real_image_result_invalid", ...imageUrlValidation.tags],
    })
  }

  if (!ALLOWED_IMAGE_FORMATS.includes(payload.imageFormat)) {
    return buildValidationFailure({
      zh: `真实图像生成实现返回的 imageFormat 不被允许：${String(
        payload.imageFormat
      )}。`,
      en: `The real image generation implementation returned a disallowed imageFormat: ${String(
        payload.imageFormat
      )}.`,
      tags: ["real_image_result_invalid", "invalid_image_format"],
    })
  }

  if (!Number.isInteger(payload.width) || payload.width < MINIMUM_IMAGE_WIDTH) {
    return buildValidationFailure({
      zh: `真实图像生成实现返回的 width 不合法，最低要求 ${MINIMUM_IMAGE_WIDTH}。`,
      en: `The real image generation implementation returned an invalid width. Minimum is ${MINIMUM_IMAGE_WIDTH}.`,
      tags: ["real_image_result_invalid", "invalid_width"],
    })
  }

  if (!Number.isInteger(payload.height) || payload.height < MINIMUM_IMAGE_HEIGHT) {
    return buildValidationFailure({
      zh: `真实图像生成实现返回的 height 不合法，最低要求 ${MINIMUM_IMAGE_HEIGHT}。`,
      en: `The real image generation implementation returned an invalid height. Minimum is ${MINIMUM_IMAGE_HEIGHT}.`,
      tags: ["real_image_result_invalid", "invalid_height"],
    })
  }

  if (!ALLOWED_LICENSES.includes(payload.license)) {
    return buildValidationFailure({
      zh: `真实图像生成实现返回的 license 不被允许：${String(payload.license)}。`,
      en: `The real image generation implementation returned a disallowed license: ${String(
        payload.license
      )}.`,
      tags: ["real_image_result_invalid", "invalid_license"],
    })
  }

  if (payload.originalityConfirmed !== true) {
    return buildValidationFailure({
      zh: "真实图像生成实现没有确认 originalityConfirmed=true。",
      en: "The real image generation implementation did not confirm originalityConfirmed=true.",
      tags: ["real_image_result_invalid", "originality_not_confirmed"],
    })
  }

  if (payload.canShowToPlayer === true) {
    return buildValidationFailure({
      zh: "真实图像生成实现不允许直接声明 canShowToPlayer=true，图片必须先进入隐藏候选图与 VisualJudge。",
      en: "The real image generation implementation may not declare canShowToPlayer=true. The image must enter hidden candidate and VisualJudge first.",
      tags: ["real_image_result_invalid", "unsafe_display_gate"],
    })
  }

  return {
    ok: true,
    imageUrl,
    imageFormat: payload.imageFormat,
    width: payload.width,
    height: payload.height,
    license: payload.license,
    originalityConfirmed: true,
    canShowToPlayer: false,
    tags: [
      "real_image_result_valid",
      "response_contract_passed",
      "hidden_candidate_only",
    ],
  }
}

export function buildSuccessfulDryRunResponse(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: true,
    status: "local_image_model_dry_run_passed",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: "implementation-connected",
    implementationConnected: true,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    outputContract: buildOutputContract(requiredResponseFields),
    willReturnImageUrl: true,
    willReturnImageFormat: true,
    willReturnWidth: true,
    willReturnHeight: true,
    willReturnLicense: true,
    willReturnOriginalityConfirmed: true,
    willPersistOnlyAsHiddenCandidate: true,
    canShowToPlayer: false,
    tags: [
      "local_image_model_dry_run",
      "implementation_connected",
      "response_contract_ready",
      "not_player_visible",
    ],
  }
}

export function buildSuccessfulGenerateResponse(input = {}) {
  const validation = validateRealImageGenerationResult({
    payload: input.payload,
    requiredResponseFields: input.requiredResponseFields,
  })

  if (!validation.ok) {
    return {
      ok: false,
      status: "local_image_model_real_output_invalid",
      ...(input.requestAudit ?? {}),
      error: validation.error,
      canShowToPlayer: false,
      tags: [
        "local_image_model_generate",
        "real_output_invalid",
        ...validation.tags,
      ],
    }
  }

  return {
    ok: true,
    status: "local_image_model_generate_passed",
    imageUrl: validation.imageUrl,
    imageFormat: validation.imageFormat,
    width: validation.width,
    height: validation.height,
    license: validation.license,
    originalityConfirmed: validation.originalityConfirmed,
    canShowToPlayer: false,
    tags: [
      "local_image_model_generate",
      "real_output_valid",
      "hidden_candidate_only",
      "response_contract_passed",
    ],
  }
}

function buildOutputContract(requiredResponseFields) {
  return {
    requiredFields: requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    mustReturnBitmap: true,
    mustReturnHttpHttpsOrDataImageUrl: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function validateImageUrl(imageUrl) {
  if (!imageUrl) {
    return {
      ok: false,
      zh: "真实图像生成实现返回的 imageUrl 为空。",
      en: "The real image generation implementation returned an empty imageUrl.",
      tags: ["empty_image_url"],
    }
  }

  const lowerImageUrl = imageUrl.toLowerCase()

  if (lowerImageUrl.startsWith("data:image/svg")) {
    return {
      ok: false,
      zh: "真实图像生成实现不能返回 SVG data:image。",
      en: "The real image generation implementation must not return SVG data:image.",
      tags: ["svg_forbidden"],
    }
  }

  if (lowerImageUrl.startsWith("data:image/")) {
    return {
      ok: true,
      tags: ["data_image_url_allowed"],
    }
  }

  try {
    const url = new URL(imageUrl)
    const allowedProtocol = url.protocol === "http:" || url.protocol === "https:"

    if (!allowedProtocol) {
      return {
        ok: false,
        zh: "真实图像生成实现返回的 imageUrl 协议不被允许，只允许 http、https 或 data:image。",
        en: "The real image generation implementation returned a disallowed imageUrl protocol. Only http, https, or data:image are allowed.",
        tags: ["invalid_image_url_protocol"],
      }
    }

    const pathname = url.pathname.toLowerCase()
    const forbiddenExtensions = [".svg", ".html", ".htm", ".json", ".txt"]

    if (forbiddenExtensions.some((extension) => pathname.endsWith(extension))) {
      return {
        ok: false,
        zh: "真实图像生成实现返回的 imageUrl 指向了禁止的文件类型。",
        en: "The real image generation implementation returned an imageUrl pointing to a forbidden file type.",
        tags: ["forbidden_image_url_extension"],
      }
    }

    return {
      ok: true,
      tags: ["network_image_url_allowed"],
    }
  } catch {
    return {
      ok: false,
      zh: "真实图像生成实现返回的 imageUrl 不是有效 URL。",
      en: "The real image generation implementation returned an invalid imageUrl.",
      tags: ["invalid_image_url"],
    }
  }
}

function buildValidationFailure(input) {
  return {
    ok: false,
    error: {
      zh: input.zh,
      en: input.en,
    },
    tags: input.tags,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}