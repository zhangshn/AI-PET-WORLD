import { NextResponse } from "next/server"

type LocalImageEngineResponse = Partial<{
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
}>

type LocalImageEngineRawResponse = LocalImageEngineResponse &
  Partial<{
    url: string
    image_url: string
    format: string
    image_format: string
    mimeType: string
    mime_type: string
    contentType: string
    content_type: string
    licence: string
    originality_confirmed: boolean
    original: boolean
    imageBase64: string
    base64: string
    b64_json: string
    size: unknown
    dimensions: unknown
    metadata: unknown
    result: unknown
    image: unknown
    output: unknown
    data: unknown
    images: unknown
    outputs: unknown
  }>

type ValidatedLocalImageEngineResponse = {
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: true
}

type LocalImageModelGenerateRequestBody = Partial<{
  modelTask: Partial<{
    taskKind: string
    outputPurpose: string
    mustReturnResponseContract: boolean
    mustNotDisplayDirectly: boolean
    mustNotRewriteWorldFacts: boolean
    mustNotUseProgrammaticRenderer: boolean
    mustNotCopyUnlicensedThirdPartyWorks: boolean
    canShowToPlayer: boolean
  }>
  promptPackage: unknown
  controlSketch: Partial<{
    canShowToPlayer: boolean
    cannotApprove: boolean
  }>
  responseContract: Partial<{
    requiredFields: string[]
    canShowToPlayer: boolean
    mustPersistAsAiImageCandidate: boolean
    mustPassVisualJudge: boolean
  }>
  metadata: Partial<{
    sourceFactIds: string[]
    canShowToPlayer: boolean
    cannotApprove: boolean
  }>
}>

const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

const ENGINE_TIMEOUT_MS = 120_000

export async function POST(request: Request) {
  const engineEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT?.trim()

  if (!engineEndpoint) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_image_engine_missing",
        message:
          "缺少真实图像引擎 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT，不能生成图片。禁止返回假图、占位图或程序图。",
        messageEn:
          "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT is missing, so no image can be generated. Fake images, placeholders, and programmatic images are forbidden.",
        canShowToPlayer: false,
        tags: [
          "local_image_model_generate",
          "engine_missing",
          "does_not_generate",
          "fake_image_forbidden",
          "not_player_visible",
        ],
      },
      { status: 503 }
    )
  }

  let requestBody: unknown

  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_json",
        message: "正式生成请求体不是合法 JSON。",
        messageEn: "The formal generation request body is not valid JSON.",
        canShowToPlayer: false,
        tags: ["local_image_model_generate", "invalid_json"],
      },
      { status: 400 }
    )
  }

    const requestValidation = validateAdapterGenerationRequest(requestBody)

    if (!requestValidation.ok) {
    return NextResponse.json(
        {
        ok: false,
        status: "local_image_model_request_invalid",
        error: requestValidation.error,
        canShowToPlayer: false,
        tags: [
            "local_image_model_generate",
            "request_invalid",
            "blocked_before_real_engine",
            "does_not_generate",
            "not_player_visible",
        ],
        },
        { status: 422 }
    )
    }

  const engineResult = await callLocalImageEngine({
    endpoint: engineEndpoint,
    requestBody,
  })

  if (!engineResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_image_engine_failed",
        error: engineResult.error,
        canShowToPlayer: false,
        tags: [
          "local_image_model_generate",
          "engine_failed",
          "does_not_generate_candidate",
          "not_player_visible",
        ],
      },
      { status: 502 }
    )
  }

const normalizedPayload = extractEngineImagePayload(engineResult.payload)

if (!normalizedPayload) {
  return NextResponse.json(
    {
      ok: false,
      status: "local_image_engine_response_invalid",
      error: {
        zh: "真实图像引擎返回结果中找不到可归一化的图片字段。需要直接返回 imageUrl/imageFormat/width/height/license/originalityConfirmed，或放在 result、image、output 字段中。",
        en: "The real image engine response does not contain a normalizable image payload. It must return imageUrl/imageFormat/width/height/license/originalityConfirmed directly, or inside result, image, or output.",
      },
      payload: engineResult.payload,
      canShowToPlayer: false,
      tags: [
        "local_image_model_generate",
        "engine_response_invalid",
        "engine_response_not_normalizable",
        "response_contract_failed_before_runner",
        "not_player_visible",
      ],
    },
    { status: 502 }
  )
}

const payloadWithConfiguredDefaults =
  applyConfiguredEngineSafetyDefaults(normalizedPayload)
const validation = validateEngineResponse(payloadWithConfiguredDefaults)

if (!validation.ok) {
  return NextResponse.json(
    {
      ok: false,
      status: "local_image_engine_response_invalid",
      error: validation.error,
      payload: engineResult.payload,
      normalizedPayload,
      payloadWithConfiguredDefaults,
      configuredSafetyDefaults: readConfiguredEngineSafetyDefaults(),
      canShowToPlayer: false,
      tags: [
        "local_image_model_generate",
        "engine_response_invalid",
        "engine_response_normalized",
        "configured_safety_defaults_checked",
        "response_contract_failed_before_runner",
        "not_player_visible",
      ],
    },
    { status: 502 }
  )
}

  return NextResponse.json(
    {
      imageUrl: validation.payload.imageUrl,
      imageFormat: validation.payload.imageFormat,
      width: validation.payload.width,
      height: validation.payload.height,
      license: validation.payload.license,
      originalityConfirmed: validation.payload.originalityConfirmed,
    },
    { status: 200 }
  )
}

async function callLocalImageEngine(input: {
  endpoint: string
  requestBody: unknown
}): Promise<
  | { ok: true; payload: LocalImageEngineRawResponse }
  | { ok: false; error: { zh: string; en: string } }
> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS)

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: buildEngineHeaders(),
      body: JSON.stringify(input.requestBody),
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type")

    if (!contentType?.includes("application/json")) {
      return {
        ok: false,
        error: {
          zh: "真实图像引擎没有返回 JSON。",
          en: "The real image engine did not return JSON.",
        },
      }
    }
    const payload = (await response.json()) as LocalImageEngineRawResponse

    if (!response.ok) {
      return {
        ok: false,
        error: {
          zh: `真实图像引擎返回失败状态：${response.status}`,
          en: `The real image engine returned status ${response.status}.`,
        },
      }
    }

    return {
      ok: true,
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        zh: `真实图像引擎请求失败：${
          error instanceof Error ? error.message : String(error)
        }`,
        en: `The real image engine request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildEngineHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  }

  const apiKey = process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY?.trim()

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`
  }

  return headers
}

function applyConfiguredEngineSafetyDefaults(
  payload: LocalImageEngineResponse
): LocalImageEngineResponse {
  const configuredDefaults = readConfiguredEngineSafetyDefaults()

  return {
    ...payload,
    license: payload.license ?? configuredDefaults.license ?? undefined,
    originalityConfirmed:
      payload.originalityConfirmed ??
      configuredDefaults.originalityConfirmed ??
      undefined,
  }
}

function readConfiguredEngineSafetyDefaults(): {
  license: LocalImageEngineResponse["license"] | null
  originalityConfirmed: true | null
} {
  return {
    license: readConfiguredEngineLicense(
      process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE
    ),
    originalityConfirmed:
      process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED ===
      "true"
        ? true
        : null,
  }
}

function readConfiguredEngineLicense(
  value: string | undefined
): LocalImageEngineResponse["license"] | null {
  const normalized = value?.trim()

  if (
    normalized === "self_owned" ||
    normalized === "cc0" ||
    normalized === "commercial_license"
  ) {
    return normalized
  }

  return null
}

function extractEngineImagePayload(
  payload: LocalImageEngineRawResponse
): LocalImageEngineResponse | null {
  const rootDefaults = pickEngineImageMetadata(payload)
  const directPayload = pickEngineImagePayload(payload, rootDefaults)
  if (directPayload) return directPayload

  const nestedPayloads = collectNestedPayloads([
    payload.result,
    payload.image,
    payload.output,
    payload.data,
    payload.images,
    payload.outputs,
    payload.metadata,
  ])

  for (const nestedPayload of nestedPayloads) {
    const pickedPayload = pickEngineImagePayload(nestedPayload, rootDefaults)
    if (pickedPayload) return pickedPayload
  }

  return null
}

function collectNestedPayloads(values: unknown[]): unknown[] {
  const collected: unknown[] = []

  for (const value of values) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      collected.push(...value)
      continue
    }

    collected.push(value)

    if (isRecord(value)) {
      for (const nestedKey of ["result", "image", "output", "data", "metadata"]) {
        const nestedValue = value[nestedKey]
        if (Array.isArray(nestedValue)) {
          collected.push(...nestedValue)
        } else if (nestedValue !== undefined && nestedValue !== null) {
          collected.push(nestedValue)
        }
      }
    }
  }

  return collected
}

function pickEngineImagePayload(
  value: unknown,
  defaults: LocalImageEngineResponse | null
): LocalImageEngineResponse | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return {
      imageUrl: buildDataImageUrl({
        imageBase64: value.trim(),
        imageFormat: defaults?.imageFormat,
      }),
      imageFormat: defaults?.imageFormat,
      width: defaults?.width,
      height: defaults?.height,
      license: defaults?.license,
      originalityConfirmed: defaults?.originalityConfirmed,
    }
  }

  if (!isRecord(value)) return null

  const hasAnyKnownField =
    "imageUrl" in value ||
    "image_url" in value ||
    "url" in value ||
    "imageBase64" in value ||
    "base64" in value ||
    "b64_json" in value ||
    "imageFormat" in value ||
    "image_format" in value ||
    "format" in value ||
    "mimeType" in value ||
    "mime_type" in value ||
    "contentType" in value ||
    "content_type" in value ||
    "width" in value ||
    "height" in value ||
    "w" in value ||
    "h" in value ||
    "size" in value ||
    "dimensions" in value ||
    "license" in value ||
    "licence" in value ||
    "originalityConfirmed" in value ||
    "originality_confirmed" in value ||
    "original" in value

  if (!hasAnyKnownField) return null

  const imageUrl =
    readString(value["imageUrl"]) ??
    readString(value["image_url"]) ??
    readString(value["url"])
  const imageBase64 =
    readString(value["imageBase64"]) ??
    readString(value["base64"]) ??
    readString(value["b64_json"])
  const imageFormat =
    readEngineImageFormat(value["imageFormat"]) ??
    readEngineImageFormat(value["image_format"]) ??
    readEngineImageFormat(value["format"]) ??
    readEngineImageFormat(value["mimeType"]) ??
    readEngineImageFormat(value["mime_type"]) ??
    readEngineImageFormat(value["contentType"]) ??
    readEngineImageFormat(value["content_type"]) ??
    defaults?.imageFormat
  const width =
    readNumber(value["width"]) ??
    readNumber(value["w"]) ??
    readNestedNumber(value["size"], ["width", "w"]) ??
    readNestedNumber(value["dimensions"], ["width", "w"]) ??
    defaults?.width
  const height =
    readNumber(value["height"]) ??
    readNumber(value["h"]) ??
    readNestedNumber(value["size"], ["height", "h"]) ??
    readNestedNumber(value["dimensions"], ["height", "h"]) ??
    defaults?.height
  const license =
    readEngineImageLicense(value["license"]) ??
    readEngineImageLicense(value["licence"]) ??
    defaults?.license
  const originalityConfirmed =
    readBoolean(value["originalityConfirmed"]) ??
    readBoolean(value["originality_confirmed"]) ??
    readBoolean(value["original"]) ??
    defaults?.originalityConfirmed

  return {
    imageUrl:
      imageUrl ??
      buildDataImageUrl({
        imageBase64,
        imageFormat,
      }),
    imageFormat,
    width,
    height,
    license,
    originalityConfirmed,
  }
}

function pickEngineImageMetadata(
  value: unknown
): LocalImageEngineResponse | null {
  if (!isRecord(value)) return null

  return {
    imageFormat:
      readEngineImageFormat(value["imageFormat"]) ??
      readEngineImageFormat(value["image_format"]) ??
      readEngineImageFormat(value["format"]) ??
      readEngineImageFormat(value["mimeType"]) ??
      readEngineImageFormat(value["mime_type"]) ??
      readEngineImageFormat(value["contentType"]) ??
      readEngineImageFormat(value["content_type"]),
    width:
      readNumber(value["width"]) ??
      readNumber(value["w"]) ??
      readNestedNumber(value["size"], ["width", "w"]) ??
      readNestedNumber(value["dimensions"], ["width", "w"]),
    height:
      readNumber(value["height"]) ??
      readNumber(value["h"]) ??
      readNestedNumber(value["size"], ["height", "h"]) ??
      readNestedNumber(value["dimensions"], ["height", "h"]),
    license:
      readEngineImageLicense(value["license"]) ??
      readEngineImageLicense(value["licence"]),
    originalityConfirmed:
      readBoolean(value["originalityConfirmed"]) ??
      readBoolean(value["originality_confirmed"]) ??
      readBoolean(value["original"]),
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function readNestedNumber(
  value: unknown,
  keys: string[]
): number | undefined {
  if (!isRecord(value)) return undefined

  for (const key of keys) {
    const nestedNumber = readNumber(value[key])
    if (nestedNumber !== undefined) return nestedNumber
  }

  return undefined
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value

  if (typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }

  return undefined
}

function buildDataImageUrl(input: {
  imageBase64: string | null
  imageFormat: LocalImageEngineResponse["imageFormat"] | undefined
}): string | undefined {
  if (!input.imageBase64 || !input.imageFormat) return undefined

  if (input.imageBase64.startsWith("data:image/")) {
    return input.imageBase64
  }

  return `data:image/${input.imageFormat};base64,${input.imageBase64}`
}

function readEngineImageFormat(
  value: unknown
): LocalImageEngineResponse["imageFormat"] | undefined {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : null

  if (
    normalized === "png" ||
    normalized === "image/png" ||
    normalized === "webp" ||
    normalized === "image/webp" ||
    normalized === "jpg" ||
    normalized === "image/jpg"
  ) {
    return normalized.includes("webp")
      ? "webp"
      : normalized.includes("png")
        ? "png"
        : "jpg"
  }

  if (normalized === "jpeg" || normalized === "image/jpeg") {
    return "jpg"
  }

  return undefined
}

function readEngineImageLicense(
  value: unknown
): LocalImageEngineResponse["license"] | undefined {
  if (
    value === "self_owned" ||
    value === "cc0" ||
    value === "commercial_license"
  ) {
    return value
  }

  return undefined
}

function validateAdapterGenerationRequest(
  requestBody: unknown
): { ok: true } | { ok: false; error: { zh: string; en: string } } {
  if (!isRecord(requestBody)) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器收到的请求体不是对象。",
        en: "The local image model adapter received a request body that is not an object.",
      },
    }
  }

  const body = requestBody as LocalImageModelGenerateRequestBody
  const modelTask = body.modelTask
  const responseContract = body.responseContract
  const metadata = body.metadata
  const controlSketch = body.controlSketch

  const modelTaskIsValid =
    modelTask?.taskKind === "generate_hidden_world_bitmap_candidate" &&
    modelTask.outputPurpose === "hidden_ai_image_candidate" &&
    modelTask.mustReturnResponseContract === true &&
    modelTask.mustNotDisplayDirectly === true &&
    modelTask.mustNotRewriteWorldFacts === true &&
    modelTask.mustNotUseProgrammaticRenderer === true &&
    modelTask.mustNotCopyUnlicensedThirdPartyWorks === true &&
    modelTask.canShowToPlayer === false

  if (!modelTaskIsValid) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器拒绝请求：modelTask 不符合隐藏候选图生成契约。",
        en: "The local image model adapter rejected the request: modelTask does not match the hidden candidate generation contract.",
      },
    }
  }

  if (!body.promptPackage) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器拒绝请求：缺少 PromptPackage。",
        en: "The local image model adapter rejected the request: PromptPackage is missing.",
      },
    }
  }

  if (
    !controlSketch ||
    controlSketch.canShowToPlayer !== false ||
    controlSketch.cannotApprove !== true
  ) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器拒绝请求：ControlSketch 必须禁止展示并禁止 Approved。",
        en: "The local image model adapter rejected the request: ControlSketch must be non-displayable and cannot be approved.",
      },
    }
  }

  const responseContractIsValid =
    Boolean(responseContract) &&
    REQUIRED_RESPONSE_FIELDS.every((field) =>
      responseContract?.requiredFields?.includes(field)
    ) &&
    responseContract?.canShowToPlayer === false &&
    responseContract?.mustPersistAsAiImageCandidate === true &&
    responseContract?.mustPassVisualJudge === true

  if (!responseContractIsValid) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器拒绝请求：responseContract 不完整或不满足隐藏候选图与 VisualJudge 硬闸门。",
        en: "The local image model adapter rejected the request: responseContract is incomplete or does not satisfy the hidden candidate and VisualJudge hard gate.",
      },
    }
  }

  if (
    !metadata ||
    !Array.isArray(metadata.sourceFactIds) ||
    metadata.sourceFactIds.length === 0 ||
    metadata.canShowToPlayer !== false ||
    metadata.cannotApprove !== true
  ) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器拒绝请求：metadata 缺少世界事实来源链或展示闸门不正确。",
        en: "The local image model adapter rejected the request: metadata is missing source fact links or has incorrect display gates.",
      },
    }
  }

  return { ok: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateEngineResponse(
  payload: LocalImageEngineResponse
):
  | { ok: true; payload: ValidatedLocalImageEngineResponse }
  | { ok: false; error: { zh: string; en: string } } {
  const imageUrl = payload.imageUrl
  const imageFormat = payload.imageFormat
  const width = payload.width
  const height = payload.height
  const license = payload.license
  const originalityConfirmed = payload.originalityConfirmed

  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageUrl 缺失或协议不被允许。只允许 http、https 或 data:image URL。",
        en: "The real image engine returned a missing or disallowed imageUrl. Only http, https, or data:image URLs are allowed.",
      },
    }
  }

  if (imageFormat !== "png" && imageFormat !== "webp" && imageFormat !== "jpg") {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageFormat 不被允许。",
        en: "The real image engine returned a disallowed imageFormat.",
      },
    }
  }

  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 width 不合法。",
        en: "The real image engine returned an invalid width.",
      },
    }
  }

  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 height 不合法。",
        en: "The real image engine returned an invalid height.",
      },
    }
  }

  if (
    license !== "self_owned" &&
    license !== "cc0" &&
    license !== "commercial_license"
  ) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 license 不被允许。",
        en: "The real image engine returned a disallowed license.",
      },
    }
  }

  if (originalityConfirmed !== true) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎没有确认 originalityConfirmed=true。",
        en: "The real image engine did not confirm originalityConfirmed=true.",
      },
    }
  }

  return {
    ok: true,
    payload: {
      imageUrl,
      imageFormat,
      width,
      height,
      license,
      originalityConfirmed,
    },
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