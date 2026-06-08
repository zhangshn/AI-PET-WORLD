import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  readWorldVisualAiImageProviderStatus,
} from "@/world/world-visual-painter"

const PROVIDER_DRY_RUN_TIMEOUT_MS = 8000

const REQUIRED_RESPONSE_SHAPE = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

type ProviderDryRunPayload = Partial<{
  ok: boolean
  status: string
  model: string
  version: string
  requestContractValid: boolean
  understandsModelTask: boolean
  understandsPromptPackage: boolean
  understandsControlSketch: boolean
  understandsResponseContract: boolean
  understandsVisualFixHints: boolean
  understandsWorldFactsLocked: boolean
  requiredResponseShape: string[]
  willReturnImageUrl: boolean
  willReturnImageFormat: boolean
  willReturnWidth: boolean
  willReturnHeight: boolean
  willReturnLicense: boolean
  willReturnOriginalityConfirmed: boolean
  willPersistOnlyAsHiddenCandidate: boolean
  message: string
  messageEn: string
  nextStep: {
    zh?: string
    en?: string
    endpoint?: string | null
  }
  canShowToPlayer: boolean
  tags: string[]
}>

export async function GET() {
  const providerStatus = readWorldVisualAiImageProviderStatus()

  if (providerStatus.providerKind !== "local_model") {
    return NextResponse.json(
      {
        ok: false,
        status: "not_local_model",
        providerStatus,
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
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
          "not_player_visible",
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
        missingEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT",
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
        message:
          "当前已选择 local_model，但缺少 AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT，因此不能执行本地图像模型 dry-run，也不能确认模型是否会返回正式视觉链路所需的 6 个字段。",
        messageEn:
          "local_model is selected, but AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT is missing, so local image model dry-run cannot run and the required six response fields cannot be confirmed.",
        nextStep: {
          zh: "根据 GPT_HANDOFF.md，下一步应连接真实 local image model，并通过 dry-run 确认它理解 modelTask、PromptPackage、ControlSketch、responseContract，且会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
          en: "According to GPT_HANDOFF.md, next connect a real local image model and use dry-run to confirm it understands modelTask, PromptPackage, ControlSketch, responseContract, and will return imageUrl / imageFormat / width / height / license / originalityConfirmed.",
          endpoint: null,
        },
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "local_model_endpoint_missing",
          "local_model_dry_run_blocked",
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

  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_missing",
        providerStatus,
        endpoint,
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
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
          "not_player_visible",
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
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
        message: decision.aiImageProviderStatus.reason.zh,
        messageEn: decision.aiImageProviderStatus.reason.en,
        canShowToPlayer: false,
        tags: [
          "world_visual_provider_dry_run_api",
          "generation_request_missing",
          "status_only",
          "does_not_generate",
          "does_not_modify_world_facts",
          "not_player_visible",
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
        : dryRunResult.status,
      providerStatus,
      endpoint,
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
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
        requestContractValid: "boolean",
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
        candidateRule:
          "dry-run 通过也不代表可以直接展示图片。正式图片仍必须先进入隐藏 AiImageCandidate，并通过 VisualJudge 与 ApprovedFrame。",
        candidateRuleEn:
          "Passing dry-run does not mean an image can be displayed directly. Formal images must still enter hidden AiImageCandidate and pass VisualJudge and ApprovedFrame.",
      },
      nextStep: buildDryRunNextStep(dryRunResult),
      canShowToPlayer: false,
      tags: [
        "world_visual_provider_dry_run_api",
        dryRunResult.ok
          ? "local_model_dry_run_passed"
          : "local_model_dry_run_failed",
        dryRunResult.status,
        "required_response_shape_exposed",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
        "not_player_visible",
      ],
    },
    { status: dryRunResult.ok ? 200 : dryRunResult.httpStatus }
  )
}

function getDryRunEndpoint(): string | null {
  const explicitEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT?.trim()
  if (explicitEndpoint) return normalizeEndpoint(explicitEndpoint)

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

function normalizeEndpoint(endpoint: string): string | null {
  try {
    return new URL(endpoint).toString()
  } catch {
    return null
  }
}

async function runLocalModelDryRun(input: {
  endpoint: string
  requestBody: unknown
}): Promise<{
  ok: boolean
  status: string
  httpStatus: number
  contentType: string | null
  payload: ProviderDryRunPayload | null
  contractAudit: {
    requestContractValid: boolean
    understandsModelTask: boolean
    understandsPromptPackage: boolean
    understandsControlSketch: boolean
    understandsResponseContract: boolean
    understandsVisualFixHints: boolean
    understandsWorldFactsLocked: boolean
    willReturnRequiredResponseFields: boolean
    willPersistOnlyAsHiddenCandidate: boolean
  } | null
  message: string
  messageEn: string
  tags: string[]
}> {
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

    const contractAudit = buildContractAudit(payload)

    if (!response.ok) {
      const implementationNotConnected =
        payload?.status === "local_image_model_implementation_not_connected"

      return {
        ok: false,
        status: implementationNotConnected
          ? "local_model_implementation_not_connected"
          : "local_model_dry_run_http_failed",
        httpStatus: response.status,
        contentType,
        payload,
        contractAudit,
        message: implementationNotConnected
          ? "本地图像模型 dry-run 请求契约已被适配器检查，但真实 local image model implementation 尚未接入。"
          : `本地图像模型 dry-run endpoint 返回失败状态：${response.status}`,
        messageEn: implementationNotConnected
          ? "The local image model dry-run request contract was checked by the adapter, but no real local image model implementation is connected."
          : `The local image model dry-run endpoint returned status ${response.status}.`,
        tags: [
          "local_model_dry_run_failed",
          implementationNotConnected
            ? "implementation_not_connected"
            : "http_error",
        ],
      }
    }

    const ok =
      payload?.ok === true &&
      contractAudit.requestContractValid &&
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
      status: ok
        ? "local_model_dry_run_passed"
        : "local_model_dry_run_contract_incomplete",
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
      status: "local_model_dry_run_request_failed",
      httpStatus: 502,
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

function buildContractAudit(payload: ProviderDryRunPayload | null) {
  return {
    requestContractValid: payload?.requestContractValid === true,
    understandsModelTask: payload?.understandsModelTask === true,
    understandsPromptPackage: payload?.understandsPromptPackage === true,
    understandsControlSketch: payload?.understandsControlSketch === true,
    understandsResponseContract: payload?.understandsResponseContract === true,
    understandsVisualFixHints: payload?.understandsVisualFixHints === true,
    understandsWorldFactsLocked: payload?.understandsWorldFactsLocked === true,
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
}

function buildDryRunNextStep(dryRunResult: {
  ok: boolean
  status: string
}) {
  if (dryRunResult.ok) {
    return {
      zh: "本地图像模型 dry-run 通过。下一步调用 POST /api/world/visual/generate 生成隐藏候选图。",
      en: "The local image model dry-run passed. Next call POST /api/world/visual/generate to create a hidden candidate.",
      endpoint: "POST /api/world/visual/generate",
    }
  }

  if (dryRunResult.status === "local_model_implementation_not_connected") {
    return {
      zh: "本地图像模型适配器已检查正式请求契约，但真实 local image model implementation 尚未接入。下一步应连接真实 local image model，并让 dry-run 声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "The local image model adapter has checked the formal request contract, but no real local image model implementation is connected. Next connect a real local image model and make dry-run declare it will return imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      endpoint: null,
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
    }
  }

  return {
    zh: "本地图像模型 dry-run 未通过。先修复模型服务对 modelTask、PromptPackage、ControlSketch、responseContract 与 6 个返回字段的声明。",
    en: "The local image model dry-run failed. Fix the model service declaration for modelTask, PromptPackage, ControlSketch, responseContract, and the six response fields first.",
    endpoint: null,
    requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
  }
}