import { NextResponse } from "next/server"

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

export async function POST(request: Request) {
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
          "blocked_before_generation",
          "does_not_generate",
          "not_player_visible",
        ],
      },
      { status: 422 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      status: "local_image_model_implementation_not_connected",
      message:
        "本地图像模型适配入口已收到正式视觉生成请求，但当前没有接入真实 local image model implementation。不会返回假图、占位图或程序绘图结果。",
      messageEn:
        "The local image model adapter received a formal visual generation request, but no real local image model implementation is connected. It will not return fake images, placeholders, or programmatic render results.",
      requiredResponseShape: {
        imageUrl: "http(s) URL or data:image URL",
        imageFormat: "png | webp | jpg",
        width: "number",
        height: "number",
        license: "self_owned | cc0 | commercial_license",
        originalityConfirmed: true,
      },
      nextStep: {
        zh: "根据 GPT_HANDOFF.md，下一步应连接真实 image provider 或 local image model，并让它返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
        en: "According to GPT_HANDOFF.md, the next step is to connect a real image provider or local image model that returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      },
      canShowToPlayer: false,
      tags: [
        "local_image_model_generate",
        "implementation_not_connected",
        "contract_checked",
        "does_not_generate",
        "fake_image_forbidden",
        "not_player_visible",
      ],
    },
    { status: 501 }
  )
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