import { Buffer } from "node:buffer"
import { createServer } from "node:http"

const PORT = readIntegerEnv("AI_PET_WORLD_REAL_IMAGE_UPSTREAM_PORT", 8000)

const PUBLIC_BASE_URL =
  process.env.AI_PET_WORLD_REAL_IMAGE_UPSTREAM_PUBLIC_BASE_URL?.trim() ||
  `http://localhost:${PORT}`

const SD_WEBUI_TXT2IMG_ENDPOINT =
  process.env.AI_PET_WORLD_SD_WEBUI_TXT2IMG_ENDPOINT?.trim() || null

const SD_WEBUI_TIMEOUT_MS = readIntegerEnv(
  "AI_PET_WORLD_SD_WEBUI_TIMEOUT_MS",
  180000
)

const DEFAULT_WIDTH = readIntegerEnv("AI_PET_WORLD_REAL_IMAGE_WIDTH", 1536)
const DEFAULT_HEIGHT = readIntegerEnv("AI_PET_WORLD_REAL_IMAGE_HEIGHT", 1024)
const DEFAULT_STEPS = readIntegerEnv("AI_PET_WORLD_SD_WEBUI_STEPS", 24)
const DEFAULT_CFG_SCALE = readNumberEnv("AI_PET_WORLD_SD_WEBUI_CFG_SCALE", 7)
const DEFAULT_SAMPLER =
  process.env.AI_PET_WORLD_SD_WEBUI_SAMPLER?.trim() || "DPM++ 2M Karras"

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", PUBLIC_BASE_URL)

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, SD_WEBUI_TXT2IMG_ENDPOINT ? 200 : 503, {
        ok: Boolean(SD_WEBUI_TXT2IMG_ENDPOINT),
        status: SD_WEBUI_TXT2IMG_ENDPOINT
          ? "real_image_upstream_ready"
          : "sd_webui_endpoint_missing",
        model: "ai-pet-world-real-image-upstream-sd-webui-bridge",
        version: "mvp-sd-webui-bridge-1",
        endpoint: `${PUBLIC_BASE_URL}/generate`,
        sdWebuiTxt2ImgEndpointConfigured: Boolean(SD_WEBUI_TXT2IMG_ENDPOINT),
        sdWebuiTxt2ImgEndpoint: SD_WEBUI_TXT2IMG_ENDPOINT
          ? maskLocalEndpoint(SD_WEBUI_TXT2IMG_ENDPOINT)
          : null,
        output: {
          returnsImageBase64: true,
          imageFormat: "png",
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        },
        message: SD_WEBUI_TXT2IMG_ENDPOINT
          ? "真实上游出图桥接服务已就绪，会调用 SD WebUI txt2img。"
          : "真实上游出图桥接服务已启动，但还没有配置 AI_PET_WORLD_SD_WEBUI_TXT2IMG_ENDPOINT，所以不会生成假图。",
        messageEn: SD_WEBUI_TXT2IMG_ENDPOINT
          ? "The real upstream image bridge is ready and will call SD WebUI txt2img."
          : "The real upstream image bridge is running, but AI_PET_WORLD_SD_WEBUI_TXT2IMG_ENDPOINT is not configured, so it will not generate fake images.",
        canShowToPlayer: false,
        tags: [
          "real_image_upstream",
          "sd_webui_bridge",
          SD_WEBUI_TXT2IMG_ENDPOINT
            ? "sd_webui_endpoint_configured"
            : "sd_webui_endpoint_missing",
          "no_fake_image",
        ],
      })
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      return handleGenerate(request, response)
    }

    return sendJson(response, 404, {
      ok: false,
      status: "not_found",
      message: "未找到接口。",
      messageEn: "Endpoint not found.",
    })
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      status: "server_error",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(PORT, () => {
  console.log(`[ai-pet-world-real-upstream] listening on ${PUBLIC_BASE_URL}`)
  console.log(
    `[ai-pet-world-real-upstream] sd webui: ${
      SD_WEBUI_TXT2IMG_ENDPOINT || "missing"
    }`
  )
})

async function handleGenerate(request, response) {
  if (!SD_WEBUI_TXT2IMG_ENDPOINT) {
    return sendJson(response, 503, {
      ok: false,
      status: "sd_webui_endpoint_missing",
      message:
        "缺少 AI_PET_WORLD_SD_WEBUI_TXT2IMG_ENDPOINT，不能生成图片。不会返回假图或占位图。",
      messageEn:
        "AI_PET_WORLD_SD_WEBUI_TXT2IMG_ENDPOINT is missing, so no image can be generated. Fake images and placeholders will not be returned.",
      canShowToPlayer: false,
      tags: [
        "real_image_upstream",
        "sd_webui_endpoint_missing",
        "does_not_generate",
        "fake_image_forbidden",
      ],
    })
  }

  const requestBody = await readJsonRequest(request)
  const normalizedRequest = normalizeGenerationRequest(requestBody)
  const sdPayload = buildSdWebuiTxt2ImgPayload(normalizedRequest)
  const sdResult = await callSdWebuiTxt2Img(sdPayload)

  if (!sdResult.ok) {
    return sendJson(response, 502, {
      ok: false,
      status: "sd_webui_txt2img_failed",
      error: sdResult.error,
      canShowToPlayer: false,
      tags: ["real_image_upstream", "sd_webui_failed"],
    })
  }

  return sendJson(response, 200, {
    imageBase64: sdResult.imageBase64,
    imageFormat: "png",
    width: normalizedRequest.width,
    height: normalizedRequest.height,
    license: "self_owned",
    originalityConfirmed: true,
    metadata: {
      upstream: "sd_webui_txt2img",
      promptLength: normalizedRequest.prompt.length,
      negativePromptLength: normalizedRequest.negativePrompt.length,
      steps: DEFAULT_STEPS,
      cfgScale: DEFAULT_CFG_SCALE,
      sampler: DEFAULT_SAMPLER,
    },
  })
}

function normalizeGenerationRequest(requestBody) {
  const prompt =
    readString(requestBody.prompt) ||
    readString(requestBody.positivePrompt) ||
    readNestedString(requestBody.promptPackage, [
      "positivePrompt",
      "positivePromptEn",
      "positivePromptZh",
    ]) ||
    "top-down pixel art fantasy creature habitat, cozy world, game scene"

  const negativePrompt =
    readString(requestBody.negativePrompt) ||
    readNestedString(requestBody.promptPackage, [
      "negativePrompt",
      "negativePromptEn",
      "negativePromptZh",
    ]) ||
    "text, watermark, logo, ui, blurry, low quality, malformed, duplicate"

  const width =
    readNumber(requestBody.width) ||
    readNestedNumber(requestBody.outputSize, ["width"]) ||
    DEFAULT_WIDTH

  const height =
    readNumber(requestBody.height) ||
    readNestedNumber(requestBody.outputSize, ["height"]) ||
    DEFAULT_HEIGHT

  return {
    prompt,
    negativePrompt,
    width,
    height,
  }
}

function buildSdWebuiTxt2ImgPayload(input) {
  return {
    prompt: input.prompt,
    negative_prompt: input.negativePrompt,
    width: input.width,
    height: input.height,
    steps: DEFAULT_STEPS,
    cfg_scale: DEFAULT_CFG_SCALE,
    sampler_name: DEFAULT_SAMPLER,
    batch_size: 1,
    n_iter: 1,
    restore_faces: false,
    tiling: false,
    send_images: true,
    save_images: false,
  }
}

async function callSdWebuiTxt2Img(payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SD_WEBUI_TIMEOUT_MS)

  try {
    const response = await fetch(SD_WEBUI_TXT2IMG_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type") || ""

    if (!response.ok) {
      return {
        ok: false,
        error: {
          zh: `SD WebUI txt2img 返回失败状态：${response.status}`,
          en: `SD WebUI txt2img returned status ${response.status}.`,
        },
      }
    }

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        error: {
          zh: "SD WebUI txt2img 没有返回 JSON。",
          en: "SD WebUI txt2img did not return JSON.",
        },
      }
    }

    const payloadJson = await response.json()
    const imageBase64 = pickSdWebuiImageBase64(payloadJson)

    if (!imageBase64) {
      return {
        ok: false,
        error: {
          zh: "SD WebUI txt2img 返回 JSON 中找不到 images[0]。",
          en: "SD WebUI txt2img response JSON does not contain images[0].",
        },
      }
    }

    return {
      ok: true,
      imageBase64,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        zh: `SD WebUI txt2img 请求失败：${
          error instanceof Error ? error.message : String(error)
        }。当前超时 ${SD_WEBUI_TIMEOUT_MS}ms。`,
        en: `SD WebUI txt2img request failed: ${
          error instanceof Error ? error.message : String(error)
        }. Current timeout is ${SD_WEBUI_TIMEOUT_MS}ms.`,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

function pickSdWebuiImageBase64(value) {
  if (!isRecord(value)) return null

  if (Array.isArray(value.images) && typeof value.images[0] === "string") {
    return value.images[0]
  }

  if (Array.isArray(value.data) && typeof value.data[0] === "string") {
    return value.data[0]
  }

  return null
}

async function readJsonRequest(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")
  return rawBody ? JSON.parse(rawBody) : {}
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body, null, 2))
}

function readString(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function readNestedString(value, keys) {
  if (!isRecord(value)) return null

  for (const key of keys) {
    const nested = readString(value[key])
    if (nested) return nested
  }

  return null
}

function readNestedNumber(value, keys) {
  if (!isRecord(value)) return null

  for (const key of keys) {
    const nested = readNumber(value[key])
    if (nested !== null) return nested
  }

  return null
}

function readIntegerEnv(name, fallback) {
  const rawValue = process.env[name]?.trim()
  const parsed = rawValue ? Number(rawValue) : fallback
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readNumberEnv(name, fallback) {
  const rawValue = process.env[name]?.trim()
  const parsed = rawValue ? Number(rawValue) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function maskLocalEndpoint(value) {
  return value.replace(/\/\/([^/@]+)@/, "//***@")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}