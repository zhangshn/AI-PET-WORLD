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
    metadata?.canShowToPlayer === false &&
    metadata?.cannotApprove === true

  const ok =
    body.dryRun === true &&
    understandsModelTask &&
    understandsPromptPackage &&
    understandsControlSketch &&
    understandsResponseContract &&
    understandsVisualFixHints &&
    understandsWorldFactsLocked

  return NextResponse.json(
    {
      ok,
      status: ok
        ? "local_image_model_dry_run_passed"
        : "local_image_model_dry_run_failed",
      model: "ai-pet-world-local-image-model-adapter",
      version: "mvp-adapter-1",
      understandsModelTask,
      understandsPromptPackage,
      understandsControlSketch,
      understandsResponseContract,
      understandsVisualFixHints,
      understandsWorldFactsLocked,
      willReturnImageUrl: true,
      willReturnImageFormat: true,
      willReturnWidth: true,
      willReturnHeight: true,
      willReturnLicense: true,
      willReturnOriginalityConfirmed: true,
      willPersistOnlyAsHiddenCandidate: true,
      message: ok
        ? "本地图像模型 dry-run 契约检查通过。"
        : "本地图像模型 dry-run 契约检查未通过。",
      messageEn: ok
        ? "The local image model dry-run contract check passed."
        : "The local image model dry-run contract check failed.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_dry_run",
        ok ? "contract_passed" : "contract_failed",
        "does_not_generate",
        "not_player_visible",
      ],
    },
    { status: ok ? 200 : 422 }
  )
}