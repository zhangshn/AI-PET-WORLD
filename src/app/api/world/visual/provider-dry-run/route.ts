import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  readWorldVisualAiImageProviderStatus,
} from "@/world/world-visual-painter"

const PROVIDER_DRY_RUN_TIMEOUT_MS = 8000

type ProviderDryRunPayload = Partial<{
  ok: boolean
  status: string
  model: string
  version: string
  understandsModelTask: boolean
  understandsPromptPackage: boolean
  understandsControlSketch: boolean
  understandsResponseContract: boolean
  understandsVisualFixHints: boolean
  understandsWorldFactsLocked: boolean
  willReturnImageUrl: boolean
  willReturnImageFormat: boolean
  willReturnWidth: boolean
  willReturnHeight: boolean
  willReturnLicense: boolean
  willReturnOriginalityConfirmed: boolean
  willPersistOnlyAsHiddenCandidate: boolean
  message: string
  messageEn: string
}>

export async function GET() {
  const providerStatus = readWorldVisualAiImageProviderStatus()

  if (providerStatus.providerKind !== "local_model") {
    return NextResponse.json(
      {
        ok: false,
        status: "not_local_model",
        providerStatus,
        message: "当前 provider 不是 local_model，不执行本地图像模型 dry-run。",
        messageEn:
          "The current provider is not local_model, so local image model dry-run will not run.",
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "not_local_model",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
        ],
      },
      { status: 409 }
    )
  }

  const endpoint = getDryRunEndpoint()
  if (!endpoint) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_model_endpoint_missing",
        providerStatus,
        message:
          "缺少 AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT，不能执行本地图像模型 dry-run。",
        messageEn:
          "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT is missing, so local image model dry-run cannot run.",
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "local_model_endpoint_missing",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
        ],
      },
      { status: 409 }
    )
  }

  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_missing",
        providerStatus,
        endpoint,
        message: "世界尚未创建，不能构建真实 AiImageGenerationRequest 进行 dry-run。",
        messageEn:
          "Runtime world has not been created, so a real AiImageGenerationRequest cannot be built for dry-run.",
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "runtime_save_required",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
        ],
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtimeReadResult.record,
  })

  if (!decision.aiImageGenerationRequest || !decision.promptPackage) {
    return NextResponse.json(
      {
        ok: false,
        status: "generation_request_missing",
        providerStatus,
        endpoint,
        message: decision.aiImageProviderStatus.reason.zh,
        messageEn: decision.aiImageProviderStatus.reason.en,
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "generation_request_missing",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
        ],
      },
      { status: 409 }
    )
  }

  const dryRunResult = await runLocalModelDryRun({
    endpoint,
    requestBody: decision.aiImageGenerationRequest.body,
  })

  return NextResponse.json(
    {
      ok: dryRunResult.ok,
      status: dryRunResult.ok
        ? "local_model_dry_run_passed"
        : "local_model_dry_run_failed",
      providerStatus,
      endpoint,
      requestAudit: {
        requestId: decision.aiImageGenerationRequest.requestId,
        providerKind: decision.aiImageGenerationRequest.providerKind,
        hasModelTask: Boolean(decision.aiImageGenerationRequest.body.modelTask),
        hasPromptPackage: Boolean(
          decision.aiImageGenerationRequest.body.promptPackage
        ),
        hasControlSketch: Boolean(
          decision.aiImageGenerationRequest.body.controlSketch
        ),
        hasResponseContract: Boolean(
          decision.aiImageGenerationRequest.body.responseContract
        ),
        visualFixHintCount:
          decision.aiImageGenerationRequest.body.visualFixHints.length,
        sourceFactIdCount:
          decision.aiImageGenerationRequest.body.metadata.sourceFactIds.length,
        canShowToPlayer: decision.aiImageGenerationRequest.canShowToPlayer,
      },
      dryRun: dryRunResult,
      expectedDryRunResponse: {
        ok: "boolean",
        understandsModelTask: "boolean",
        understandsPromptPackage: "boolean",
        understandsControlSketch: "boolean",
        understandsResponseContract: "boolean",
        understandsVisualFixHints: "boolean",
        understandsWorldFactsLocked: "boolean",
        willReturnImageUrl: "boolean",
        willReturnImageFormat: "boolean",
        willReturnWidth: "boolean",
        willReturnHeight: "boolean",
        willReturnLicense: "boolean",
        willReturnOriginalityConfirmed: "boolean",
        willPersistOnlyAsHiddenCandidate: "boolean",
      },
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "provider-dry-run 只验证本地图像模型能否理解请求契约，不生成图片、不保存候选图、不展示画面。",
        displayRuleEn:
          "provider-dry-run only verifies whether the local image model understands the request contract. It does not generate images, persist candidates, or display frames.",
      },
      nextStep: dryRunResult.ok
        ? {
            zh: "本地图像模型 dry-run 通过。下一步调用 POST /api/world/visual/generate 生成隐藏候选图。",
            en: "The local image model dry-run passed. Next call POST /api/world/visual/generate to create a hidden candidate.",
            endpoint: "POST /api/world/visual/generate",
          }
        : {
            zh: "本地图像模型 dry-run 未通过。先修复模型服务对 modelTask、PromptPackage、ControlSketch、responseContract 的理解。",
            en: "The local image model dry-run failed. Fix the model service understanding of modelTask, PromptPackage, ControlSketch, and responseContract first.",
            endpoint: null,
          },
      canShowToPlayer: false,
      tags: [
        "world_visual_provider_dry_run_api",
        dryRunResult.ok
          ? "local_model_dry_run_passed"
          : "local_model_dry_run_failed",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
        "not_player_visible",
      ],
    },
    { status: dryRunResult.ok ? 200 : 502 }
  )
}

function getDryRunEndpoint(): string | null {
  const endpoint = process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT?.trim()
  if (!endpoint) return null

  try {
    const url = new URL(endpoint)
    if (url.pathname.endsWith("/dry-run")) return url.toString()

    url.pathname = `${url.pathname.replace(/\/+$/, "")}/dry-run`
    return url.toString()
  } catch {
    return null
  }
}

async function runLocalModelDryRun(input: {
  endpoint: string
  requestBody: unknown
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_DRY_RUN_TIMEOUT_MS)

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dryRun: true,
        requestBody: input.requestBody,
      }),
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type")
    const payload = contentType?.includes("application/json")
      ? ((await response.json()) as ProviderDryRunPayload)
      : null

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        contentType,
        payload,
        contractAudit: null,
        message: `本地图像模型 dry-run endpoint 返回失败状态：${response.status}`,
        messageEn: `The local image model dry-run endpoint returned status ${response.status}.`,
        tags: ["local_model_dry_run_failed", "http_error"],
      }
    }

    const contractAudit = {
      understandsModelTask: payload?.understandsModelTask === true,
      understandsPromptPackage: payload?.understandsPromptPackage === true,
      understandsControlSketch: payload?.understandsControlSketch === true,
      understandsResponseContract:
        payload?.understandsResponseContract === true,
      understandsVisualFixHints: payload?.understandsVisualFixHints === true,
      understandsWorldFactsLocked:
        payload?.understandsWorldFactsLocked === true,
      willReturnRequiredResponseFields:
        payload?.willReturnImageUrl === true &&
        payload?.willReturnImageFormat === true &&
        payload?.willReturnWidth === true &&
        payload?.willReturnHeight === true &&
        payload?.willReturnLicense === true &&
        payload?.willReturnOriginalityConfirmed === true,
      willPersistOnlyAsHiddenCandidate:
        payload?.willPersistOnlyAsHiddenCandidate === true,
    }

    const ok =
      payload?.ok === true &&
      contractAudit.understandsModelTask &&
      contractAudit.understandsPromptPackage &&
      contractAudit.understandsControlSketch &&
      contractAudit.understandsResponseContract &&
      contractAudit.understandsVisualFixHints &&
      contractAudit.understandsWorldFactsLocked &&
      contractAudit.willReturnRequiredResponseFields &&
      contractAudit.willPersistOnlyAsHiddenCandidate

    return {
      ok,
      httpStatus: response.status,
      contentType,
      payload,
      contractAudit,
      message: ok
        ? "本地图像模型 dry-run 契约探针通过。"
        : "本地图像模型 dry-run 返回 JSON，但契约声明不完整。",
      messageEn: ok
        ? "The local image model dry-run contract probe passed."
        : "The local image model dry-run returned JSON, but contract declarations are incomplete.",
      tags: [
        ok ? "local_model_dry_run_passed" : "local_model_dry_run_failed",
        "dry_run_json_received",
      ],
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      contentType: null,
      payload: null,
      contractAudit: null,
      message: `本地图像模型 dry-run 请求失败：${
        error instanceof Error ? error.message : String(error)
      }`,
      messageEn: `The local image model dry-run request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tags: ["local_model_dry_run_failed", "request_failed"],
    }
  } finally {
    clearTimeout(timeout)
  }
}