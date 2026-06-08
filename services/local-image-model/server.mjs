// 当前文件作用：提供 AI-PET-WORLD 自研 local image model 的本地契约服务入口，并把真实图像生成能力委托给 implementation。

import http from "node:http"

import {
  generateLocalImageCandidate,
  readLocalImageModelImplementationHealth,
  runLocalImageModelImplementationDryRun,
} from "./implementation.mjs"

const HOST = "127.0.0.1"
const PORT = 7001

const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

function createJsonResponse(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body, "utf8"),
  })

  response.end(body)
}

function createNotFoundResponse(response) {
  createJsonResponse(response, 404, {
    ok: false,
    status: "not_found",
    message: "未知 local image model endpoint。",
    messageEn: "Unknown local image model endpoint.",
    canShowToPlayer: false,
    tags: ["local_image_model_contract_server", "not_found"],
  })
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")

  if (!rawBody.trim()) {
    return {
      ok: false,
      error: "Request body is empty.",
      payload: null,
    }
  }

  try {
    const payload = JSON.parse(rawBody)

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {
        ok: false,
        error: "Request body must be a JSON object.",
        payload: null,
      }
    }

    return {
      ok: true,
      error: null,
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      payload: null,
    }
  }
}

function handleHealth(response) {
  const implementationHealth = readLocalImageModelImplementationHealth({
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  createJsonResponse(response, 200, {
    ...implementationHealth,
    contractServer: {
      ok: true,
      status: "local_image_model_contract_server_ready",
      model: "ai-pet-world-local-image-model-contract-server",
      version: "contract-shell-2",
      endpoints: {
        health: "/health",
        dryRun: "/dry-run",
        generate: "/generate",
      },
      canShowToPlayer: false,
      tags: [
        "local_image_model_contract_server",
        "contract_server_ready",
        "not_player_visible",
      ],
    },
  })
}

async function handleDryRun(request, response) {
  const bodyResult = await readJsonBody(request)

  if (!bodyResult.ok) {
    createJsonResponse(response, 400, {
      ok: false,
      status: "invalid_json",
      message: bodyResult.error,
      messageEn: bodyResult.error,
      canShowToPlayer: false,
      tags: ["local_image_model_dry_run", "invalid_json"],
    })
    return
  }

  const requestBody = bodyResult.payload?.requestBody
  const requestAudit = validateGenerationRequest(requestBody)

  if (!requestAudit.requestContractValid) {
    createJsonResponse(response, 422, {
      ok: false,
      status: "local_image_model_dry_run_request_invalid",
      model: "ai-pet-world-local-image-model-contract-server",
      version: "contract-shell-2",
      ...requestAudit,
      requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
      willReturnImageUrl: false,
      willReturnImageFormat: false,
      willReturnWidth: false,
      willReturnHeight: false,
      willReturnLicense: false,
      willReturnOriginalityConfirmed: false,
      willPersistOnlyAsHiddenCandidate: false,
      message: "dry-run 请求契约检查未通过。",
      messageEn: "The dry-run request contract check failed.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_dry_run",
        "request_contract_failed",
        "does_not_generate",
        "not_player_visible",
      ],
    })
    return
  }

  const dryRunResult = await runLocalImageModelImplementationDryRun({
    requestBody,
    requestAudit,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  createJsonResponse(response, dryRunResult.ok ? 200 : 501, dryRunResult)
}

async function handleGenerate(request, response) {
  const bodyResult = await readJsonBody(request)

  if (!bodyResult.ok) {
    createJsonResponse(response, 400, {
      ok: false,
      status: "invalid_json",
      message: bodyResult.error,
      messageEn: bodyResult.error,
      canShowToPlayer: false,
      tags: ["local_image_model_generate", "invalid_json"],
    })
    return
  }

  const requestBody = bodyResult.payload
  const requestAudit = validateGenerationRequest(requestBody)

  if (!requestAudit.requestContractValid) {
    createJsonResponse(response, 422, {
      ok: false,
      status: "local_image_model_generate_request_invalid",
      model: "ai-pet-world-local-image-model-contract-server",
      version: "contract-shell-2",
      ...requestAudit,
      requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
      message: "正式生成请求契约检查未通过。",
      messageEn: "The formal generate request contract check failed.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_generate",
        "request_contract_failed",
        "does_not_generate",
        "not_player_visible",
      ],
    })
    return
  }

  const generateResult = await generateLocalImageCandidate({
    requestBody,
    requestAudit,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  createJsonResponse(response, generateResult.ok ? 200 : 501, generateResult)
}

function validateGenerationRequest(requestBody) {
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
    return buildAudit(false, false, false, false, false, false)
  }

  const modelTask = requestBody.modelTask
  const responseContract = requestBody.responseContract
  const metadata = requestBody.metadata

  const understandsModelTask =
    isRecord(modelTask) &&
    modelTask.taskKind === "generate_hidden_world_bitmap_candidate" &&
    modelTask.outputPurpose === "hidden_ai_image_candidate" &&
    modelTask.mustReturnResponseContract === true &&
    modelTask.mustNotDisplayDirectly === true &&
    modelTask.mustNotRewriteWorldFacts === true &&
    modelTask.mustNotUseProgrammaticRenderer === true &&
    modelTask.mustNotCopyUnlicensedThirdPartyWorks === true &&
    modelTask.canShowToPlayer === false

  const understandsPromptPackage = Boolean(requestBody.promptPackage)
  const understandsControlSketch = Boolean(requestBody.controlSketch)

  const understandsResponseContract =
    isRecord(responseContract) &&
    Array.isArray(responseContract.requiredFields) &&
    REQUIRED_RESPONSE_FIELDS.every((field) =>
      responseContract.requiredFields.includes(field)
    ) &&
    responseContract.canShowToPlayer === false &&
    responseContract.mustPersistAsAiImageCandidate === true &&
    responseContract.mustPassVisualJudge === true

  const understandsVisualFixHints = Array.isArray(requestBody.visualFixHints)

  const understandsWorldFactsLocked =
    isRecord(metadata) &&
    Array.isArray(metadata.sourceFactIds) &&
    metadata.sourceFactIds.length > 0 &&
    metadata.canShowToPlayer === false &&
    metadata.cannotApprove === true

  return buildAudit(
    understandsModelTask,
    understandsPromptPackage,
    understandsControlSketch,
    understandsResponseContract,
    understandsVisualFixHints,
    understandsWorldFactsLocked
  )
}

function buildAudit(
  understandsModelTask,
  understandsPromptPackage,
  understandsControlSketch,
  understandsResponseContract,
  understandsVisualFixHints,
  understandsWorldFactsLocked
) {
  const requestContractValid =
    understandsModelTask &&
    understandsPromptPackage &&
    understandsControlSketch &&
    understandsResponseContract &&
    understandsVisualFixHints &&
    understandsWorldFactsLocked

  return {
    requestContractValid,
    understandsModelTask,
    understandsPromptPackage,
    understandsControlSketch,
    understandsResponseContract,
    understandsVisualFixHints,
    understandsWorldFactsLocked,
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`)

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      handleHealth(response)
      return
    }

    if (request.method === "POST" && url.pathname === "/dry-run") {
      await handleDryRun(request, response)
      return
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      await handleGenerate(request, response)
      return
    }

    createNotFoundResponse(response)
  } catch (error) {
    createJsonResponse(response, 500, {
      ok: false,
      status: "contract_server_error",
      message: error instanceof Error ? error.message : String(error),
      messageEn: error instanceof Error ? error.message : String(error),
      canShowToPlayer: false,
      tags: ["local_image_model_contract_server", "server_error"],
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log("[local-image-model] contract server started")
  console.log(`[local-image-model] health:   http://localhost:${PORT}/health`)
  console.log(`[local-image-model] dry-run:  http://localhost:${PORT}/dry-run`)
  console.log(`[local-image-model] generate: http://localhost:${PORT}/generate`)
  console.log("[local-image-model] implementation entry: ./implementation.mjs")
  console.log("[local-image-model] real image model implementation: not connected")
  console.log("[local-image-model] fake image output: forbidden")
})