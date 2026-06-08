import { NextResponse } from "next/server"

import { readWorldVisualAiImageProviderStatus } from "@/world/world-visual-painter"

const PROVIDER_HEALTH_TIMEOUT_MS = 5000

const REQUIRED_RESPONSE_SHAPE = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

type ProviderHealthPayload = Partial<{
  ok: boolean
  status: string
  model: string
  version: string
  supportsWorldVisualPainter: boolean
  supportsResponseContract: boolean
  supportsHiddenCandidateOutput: boolean
  supportsPng: boolean
  supportsWebp: boolean
  supportsJpg: boolean
  message: string
  messageEn: string
}>

export async function GET() {
  const providerStatus = readWorldVisualAiImageProviderStatus()
  const endpoint = getHealthEndpoint()

  if (providerStatus.providerKind !== "local_model") {
    return NextResponse.json(
      {
        ok: false,
        status: "not_local_model",
        providerStatus,
        message: "当前 provider 不是 local_model，不执行本地图像模型健康检查。",
        messageEn:
          "The current provider is not local_model, so local image model health check will not run.",
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_health_api",
          "not_local_model",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
          "not_player_visible",
        ],
      },
      { status: 409 }
    )
  }

  if (!endpoint) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_model_endpoint_missing",
        providerStatus,
        missingEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT",
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
        message:
          "当前已选择 local_model，但缺少 AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT，因此不能检查本地图像模型，也不能自动生成隐藏候选图。",
        messageEn:
          "local_model is selected, but AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT is missing, so the local image model cannot be checked and hidden candidate generation is blocked.",
        nextStep: {
          zh: "根据 GPT_HANDOFF.md，下一步应连接真实 local image model，并确认它返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
          en: "According to GPT_HANDOFF.md, next connect a real local image model and confirm it returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
          endpoint: null,
        },
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_health_api",
          "local_model_endpoint_missing",
          "local_model_generation_blocked",
          "required_response_shape_exposed",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
          "not_player_visible",
        ],
      },
      { status: 409 }
    )
  }

  const healthResult = await fetchLocalModelHealth(endpoint)

  return NextResponse.json(
    {
      ok: healthResult.ok,
      status: healthResult.ok ? "local_model_ready" : "local_model_unhealthy",
      providerStatus,
      endpoint,
      health: healthResult,
      expectedHealthResponse: {
        ok: "boolean",
        supportsWorldVisualPainter: "boolean",
        supportsResponseContract: "boolean",
        supportsHiddenCandidateOutput: "boolean",
        supportsPng: "boolean",
        supportsWebp: "boolean",
        supportsJpg: "boolean",
      },
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "provider-health 只检查本地图像模型是否可用，不生成图片，不保存候选图，不展示任何画面。",
        displayRuleEn:
          "provider-health only checks whether the local image model is available. It does not generate images, persist candidates, or display any frame.",
        candidateRule:
          "即使 health 检查通过，模型返回结果也只能进入隐藏 AiImageCandidate，并必须通过 VisualJudge 与 ApprovedFrame 后才能展示。",
        candidateRuleEn:
          "Even if health passes, model output may only enter hidden AiImageCandidate and must pass VisualJudge and ApprovedFrame before display.",
      },
      nextStep: healthResult.ok
        ? {
            zh: "本地图像模型健康检查通过。下一步调用 provider-dry-run，确认模型理解正式视觉请求契约与 6 个返回字段。",
            en: "The local image model health check passed. Next call provider-dry-run to confirm the model understands the formal visual request contract and the six response fields.",
            endpoint: "GET /api/world/visual/provider-dry-run",
          }
        : {
            zh: "本地图像模型健康检查未通过。先修复 endpoint 或模型服务健康响应。",
            en: "The local image model health check failed. Fix the endpoint or model health response first.",
            endpoint: null,
          },
      canShowToPlayer: false,
      tags: [
        "world_visual_provider_health_api",
        healthResult.ok ? "local_model_ready" : "local_model_unhealthy",
        "required_response_shape_exposed",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
        "not_player_visible",
      ],
    },
    { status: healthResult.ok ? 200 : 502 }
  )
}

function getHealthEndpoint(): string | null {
  const explicitEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT?.trim()
  if (explicitEndpoint) return normalizeEndpoint(explicitEndpoint)

  const endpoint = process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT?.trim()
  if (!endpoint) return null

  try {
    const url = new URL(endpoint)
    if (url.pathname.endsWith("/health")) return url.toString()

    url.pathname = `${url.pathname.replace(/\/+$/, "")}/health`
    return url.toString()
  } catch {
    return null
  }
}

function normalizeEndpoint(endpoint: string): string | null {
  try {
    return new URL(endpoint).toString()
  } catch {
    return null
  }
}

async function fetchLocalModelHealth(endpoint: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type")
    const payload = contentType?.includes("application/json")
      ? ((await response.json()) as ProviderHealthPayload)
      : null

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        contentType,
        payload,
        message: `本地图像模型 health endpoint 返回失败状态：${response.status}`,
        messageEn: `The local image model health endpoint returned status ${response.status}.`,
        tags: ["local_model_health_failed", "http_error"],
      }
    }

    const capabilityAudit = {
      supportsWorldVisualPainter:
        payload?.supportsWorldVisualPainter === true,
      supportsResponseContract: payload?.supportsResponseContract === true,
      supportsHiddenCandidateOutput:
        payload?.supportsHiddenCandidateOutput === true,
      supportsAtLeastOneBitmapFormat:
        payload?.supportsPng === true ||
        payload?.supportsWebp === true ||
        payload?.supportsJpg === true,
    }

    const ok =
      payload?.ok === true &&
      capabilityAudit.supportsWorldVisualPainter &&
      capabilityAudit.supportsResponseContract &&
      capabilityAudit.supportsHiddenCandidateOutput &&
      capabilityAudit.supportsAtLeastOneBitmapFormat

    return {
      ok,
      httpStatus: response.status,
      contentType,
      payload,
      capabilityAudit,
      message: ok
        ? "本地图像模型 health check 通过。"
        : "本地图像模型 health check 返回 JSON，但能力声明不完整。",
      messageEn: ok
        ? "The local image model health check passed."
        : "The local image model health check returned JSON, but capability declarations are incomplete.",
      tags: [
        ok ? "local_model_health_passed" : "local_model_health_failed",
        "health_json_received",
      ],
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      contentType: null,
      payload: null,
      capabilityAudit: null,
      message: `本地图像模型 health check 请求失败：${
        error instanceof Error ? error.message : String(error)
      }`,
      messageEn: `The local image model health check request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tags: ["local_model_health_failed", "request_failed"],
    }
  } finally {
    clearTimeout(timeout)
  }
}