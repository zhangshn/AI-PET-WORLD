import { NextResponse } from "next/server"

import { generateRealImageWithAdapter } from "../../../../../services/local-image-model/adapter.mjs"

const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

type LocalImageModelRequestBody = Record<string, unknown>

export async function POST(request: Request) {
  let requestBody: unknown

  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_json",
        canShowToPlayer: false,
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
      },
      { status: 422 }
    )
  }

  const result = await generateRealImageWithAdapter({
    enabled: process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED,
    command: process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND,
    argsJson: process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON,
    timeoutMs: process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS,
    realModelReadiness: {
      enabled: process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ENABLED,
      assetDirectory: process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR,
      manifestPath: process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST_PATH,
      license: process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE,
      originalityConfirmed:
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED,
    },
    outputStorage: {
      outputDirectory: process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
      publicBaseUrl: process.env.AI_PET_WORLD_LOCAL_IMAGE_PUBLIC_BASE_URL,
    },
    requestBody: requestValidation.requestBody,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  if (result.ok === true) {
    return NextResponse.json(result, { status: 200 })
  }

  return NextResponse.json(result, { status: 502 })
}

function validateAdapterGenerationRequest(
  requestBody: unknown
):
  | { ok: true; requestBody: LocalImageModelRequestBody }
  | { ok: false; error: { zh: string; en: string } } {
  if (!isRecord(requestBody)) {
    return {
      ok: false,
      error: {
        zh: "本地图像模型适配器收到的请求体不是对象。",
        en: "The local image model adapter received a request body that is not an object.",
      },
    }
  }

  const modelTask = readRecord(requestBody.modelTask)
  const responseContract = readRecord(requestBody.responseContract)
  const metadata = readRecord(requestBody.metadata)
  const controlSketch = readRecord(requestBody.controlSketch)

  if (
    modelTask.taskKind !== "generate_hidden_world_bitmap_candidate" ||
    modelTask.outputPurpose !== "hidden_ai_image_candidate" ||
    modelTask.mustReturnResponseContract !== true ||
    modelTask.mustNotDisplayDirectly !== true ||
    modelTask.mustNotRewriteWorldFacts !== true ||
    modelTask.mustNotUseProgrammaticRenderer !== true ||
    modelTask.mustNotCopyUnlicensedThirdPartyWorks !== true ||
    modelTask.canShowToPlayer !== false
  ) {
    return buildRequestError(
      "modelTask 不符合隐藏候选图生成契约。",
      "modelTask does not match the hidden candidate generation contract."
    )
  }

  if (!requestBody.promptPackage) {
    return buildRequestError("缺少 PromptPackage。", "PromptPackage is missing.")
  }

  if (controlSketch.canShowToPlayer !== false || controlSketch.cannotApprove !== true) {
    return buildRequestError(
      "ControlSketch 必须禁止展示并禁止 Approved。",
      "ControlSketch must be non-displayable and cannot be approved."
    )
  }

  const requiredFields = responseContract.requiredFields

  if (
    !Array.isArray(requiredFields) ||
    !REQUIRED_RESPONSE_FIELDS.every((field) => requiredFields.includes(field)) ||
    responseContract.canShowToPlayer !== false ||
    responseContract.mustPersistAsAiImageCandidate !== true ||
    responseContract.mustPassVisualJudge !== true
  ) {
    return buildRequestError(
      "responseContract 不完整或不满足隐藏候选图与 VisualJudge 硬闸门。",
      "responseContract is incomplete or does not satisfy the hidden candidate and VisualJudge hard gate."
    )
  }

  if (
    !Array.isArray(metadata.sourceFactIds) ||
    metadata.sourceFactIds.length === 0 ||
    metadata.canShowToPlayer !== false ||
    metadata.cannotApprove !== true
  ) {
    return buildRequestError(
      "metadata 缺少世界事实来源链或展示闸门不正确。",
      "metadata is missing source fact links or has incorrect display gates."
    )
  }

  return { ok: true, requestBody }
}

function buildRequestError(zh: string, en: string) {
  return {
    ok: false as const,
    error: {
      zh: `本地图像模型适配器拒绝请求：${zh}`,
      en: `The local image model adapter rejected the request: ${en}`,
    },
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
