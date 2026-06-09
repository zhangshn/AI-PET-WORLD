import { NextResponse } from "next/server"

import { runRealImageGenerationAdapterDryRun } from "../../../../../services/local-image-model/adapter.mjs"

const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

type DryRunRequestBody = Partial<{
  dryRun: boolean
  requestBody: Record<string, unknown>
}>

export async function POST(request: Request) {
  let body: DryRunRequestBody

  try {
    body = (await request.json()) as DryRunRequestBody
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

  if (body.dryRun !== true || !isRecord(body.requestBody)) {
    return NextResponse.json(
      {
        ok: false,
        status: "local_image_model_dry_run_request_invalid",
        canShowToPlayer: false,
      },
      { status: 422 }
    )
  }

  const result = await runRealImageGenerationAdapterDryRun({
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
    requestBody: body.requestBody,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  return NextResponse.json(result, { status: result.ok === true ? 200 : 502 })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
