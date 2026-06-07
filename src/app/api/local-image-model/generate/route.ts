import { NextResponse } from "next/server"

type LocalImageEngineResponse = Partial<{
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
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

  const validation = validateEngineResponse(engineResult.payload)

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_image_engine_response_invalid",
        error: validation.error,
        payload: engineResult.payload,
        canShowToPlayer: false,
        tags: [
          "local_image_model_generate",
          "engine_response_invalid",
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
  | { ok: true; payload: LocalImageEngineResponse }
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

    const payload = (await response.json()) as LocalImageEngineResponse

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