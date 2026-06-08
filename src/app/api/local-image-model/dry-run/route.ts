import { NextResponse } from "next/server"

type DryRunRequestBody = Partial<{
  dryRun: boolean
  requestBody: Partial<{
    modelTask: {
      taskKind?: string
      outputPurpose?: string
      mustReturnResponseContract?: boolean
      mustNotDisplayDirectly?: boolean
      mustNotRewriteWorldFacts?: boolean
      mustNotUseProgrammaticRenderer?: boolean
      mustNotCopyUnlicensedThirdPartyWorks?: boolean
      canShowToPlayer?: boolean
    }
    promptPackage: unknown
    controlSketch: unknown
    responseContract: Partial<{
      requiredFields: string[]
      mustPersistAsAiImageCandidate: boolean
      mustPassVisualJudge: boolean
      canShowToPlayer: boolean
    }>
    visualFixHints: unknown[]
    metadata: Partial<{
      sourceFactIds: string[]
      canShowToPlayer: boolean
      cannotApprove: boolean
    }>
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
  let body: DryRunRequestBody

  try {
    body = (await request.json()) as DryRunRequestBody
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_json",
        message: "dry-run 请求体不是合法 JSON。",
        messageEn: "The dry-run request body is not valid JSON.",
        canShowToPlayer: false,
        tags: ["local_image_model_dry_run", "invalid_json"],
      },
      { status: 400 }
    )
  }

  const requestBody = body.requestBody
  const modelTask = requestBody?.modelTask
  const responseContract = requestBody?.responseContract
  const metadata = requestBody?.metadata

  const understandsModelTask =
    modelTask?.taskKind === "generate_hidden_world_bitmap_candidate" &&
    modelTask.outputPurpose === "hidden_ai_image_candidate" &&
    modelTask.mustReturnResponseContract === true &&
    modelTask.mustNotDisplayDirectly === true &&
    modelTask.mustNotRewriteWorldFacts === true &&
    modelTask.mustNotUseProgrammaticRenderer === true &&
    modelTask.mustNotCopyUnlicensedThirdPartyWorks === true &&
    modelTask.canShowToPlayer === false

  const understandsPromptPackage = Boolean(requestBody?.promptPackage)
  const understandsControlSketch = Boolean(requestBody?.controlSketch)

  const understandsResponseContract =
    Boolean(responseContract) &&
    REQUIRED_RESPONSE_FIELDS.every((field) =>
      responseContract?.requiredFields?.includes(field)
    ) &&
    responseContract?.mustPersistAsAiImageCandidate === true &&
    responseContract?.mustPassVisualJudge === true &&
    responseContract?.canShowToPlayer === false

  const understandsVisualFixHints = Array.isArray(requestBody?.visualFixHints)

  const understandsWorldFactsLocked =
    Array.isArray(metadata?.sourceFactIds) &&
    metadata.sourceFactIds.length > 0 &&
    metadata?.canShowToPlayer === false &&
    metadata?.cannotApprove === true

  const requestContractValid =
    body.dryRun === true &&
    understandsModelTask &&
    understandsPromptPackage &&
    understandsControlSketch &&
    understandsResponseContract &&
    understandsVisualFixHints &&
    understandsWorldFactsLocked

  if (!requestContractValid) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_image_model_dry_run_request_invalid",
        model: "ai-pet-world-local-image-model-adapter",
        version: "mvp-adapter-1",
        requestContractValid,
        understandsModelTask,
        understandsPromptPackage,
        understandsControlSketch,
        understandsResponseContract,
        understandsVisualFixHints,
        understandsWorldFactsLocked,
        requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
        willReturnImageUrl: false,
        willReturnImageFormat: false,
        willReturnWidth: false,
        willReturnHeight: false,
        willReturnLicense: false,
        willReturnOriginalityConfirmed: false,
        willPersistOnlyAsHiddenCandidate: false,
        message: "本地图像模型 dry-run 请求契约检查未通过。",
        messageEn: "The local image model dry-run request contract check failed.",
        canShowToPlayer: false,
        tags: [
          "local_image_model_dry_run",
          "request_contract_failed",
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
      model: "ai-pet-world-local-image-model-adapter",
      version: "mvp-adapter-1",
      requestContractValid,
      understandsModelTask,
      understandsPromptPackage,
      understandsControlSketch,
      understandsResponseContract,
      understandsVisualFixHints,
      understandsWorldFactsLocked,
      requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
      willReturnImageUrl: false,
      willReturnImageFormat: false,
      willReturnWidth: false,
      willReturnHeight: false,
      willReturnLicense: false,
      willReturnOriginalityConfirmed: false,
      willPersistOnlyAsHiddenCandidate: false,
      message:
        "本地图像模型适配器理解正式视觉请求契约，但当前没有接入真实 local image model implementation，因此不能承诺返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      messageEn:
        "The local image model adapter understands the formal visual request contract, but no real local image model implementation is connected, so it cannot promise imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      nextStep: {
        zh: "根据 GPT_HANDOFF.md，下一步应连接真实 local image model；真实模型的 dry-run 必须声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
        en: "According to GPT_HANDOFF.md, next connect a real local image model; the real model dry-run must declare that it will return imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      },
      canShowToPlayer: false,
      tags: [
        "local_image_model_dry_run",
        "implementation_not_connected",
        "request_contract_checked",
        "required_response_shape_exposed",
        "does_not_generate",
        "fake_image_forbidden",
        "not_player_visible",
      ],
    },
    { status: 501 }
  )
}