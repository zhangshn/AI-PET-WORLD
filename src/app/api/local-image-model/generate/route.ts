import { NextResponse } from "next/server"

type LocalImageEngineResponse = Partial<{
  imageUrl: string
  imageFormat: "png" | "webp" | "jpg"
  width: number
  height: number
  license: "self_owned" | "cc0" | "commercial_license"
  originalityConfirmed: boolean
}>

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

function validateEngineResponse(
  payload: LocalImageEngineResponse
):
  | { ok: true; payload: Required<LocalImageEngineResponse> }
  | { ok: false; error: { zh: string; en: string } } {
  if (!payload.imageUrl || !isAllowedImageUrl(payload.imageUrl)) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageUrl 缺失或协议不被允许。只允许 http、https 或 data:image URL。",
        en: "The real image engine returned a missing or disallowed imageUrl. Only http, https, or data:image URLs are allowed.",
      },
    }
  }

  if (
    payload.imageFormat !== "png" &&
    payload.imageFormat !== "webp" &&
    payload.imageFormat !== "jpg"
  ) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 imageFormat 不被允许。",
        en: "The real image engine returned a disallowed imageFormat.",
      },
    }
  }

  if (!Number.isInteger(payload.width) || payload.width <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 width 不合法。",
        en: "The real image engine returned an invalid width.",
      },
    }
  }

  if (!Number.isInteger(payload.height) || payload.height <= 0) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 height 不合法。",
        en: "The real image engine returned an invalid height.",
      },
    }
  }

  if (
    payload.license !== "self_owned" &&
    payload.license !== "cc0" &&
    payload.license !== "commercial_license"
  ) {
    return {
      ok: false,
      error: {
        zh: "真实图像引擎返回的 license 不被允许。",
        en: "The real image engine returned a disallowed license.",
      },
    }
  }

  if (payload.originalityConfirmed !== true) {
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
      imageUrl: payload.imageUrl,
      imageFormat: payload.imageFormat,
      width: payload.width,
      height: payload.height,
      license: payload.license,
      originalityConfirmed: payload.originalityConfirmed,
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