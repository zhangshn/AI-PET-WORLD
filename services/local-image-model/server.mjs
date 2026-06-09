// 当前文件作用：提供 AI-PET-WORLD 自研 local image model 的本地契约服务入口，并安全读取未来真实生成的本地图片。

import fs from "node:fs"
import { stat } from "node:fs/promises"
import http from "node:http"

import {
  generateLocalImageCandidate,
  readLocalImageModelImplementationHealth,
  runLocalImageModelImplementationDryRun,
} from "./implementation.mjs"
import {
  buildLocalImageOutputReference,
  LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX,
  MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES,
} from "./output-storage.mjs"

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
    canShowToPlayer: false,
  })
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")

  if (!rawBody.trim()) {
    return { ok: false, error: "Request body is empty.", payload: null }
  }

  try {
    const payload = JSON.parse(rawBody)

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, error: "Request body must be a JSON object.", payload: null }
    }

    return { ok: true, error: null, payload }
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
      version: "contract-server-runtime-config-1",
      endpoints: {
        health: "/health",
        dryRun: "/dry-run",
        generate: "/generate",
        generatedImage: `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/:fileName`,
      },
      canShowToPlayer: false,
      tags: ["local_image_model_contract_server", "contract_server_ready"],
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
      canShowToPlayer: false,
    })
    return
  }

  const requestBody = bodyResult.payload?.requestBody
  const requestAudit = validateGenerationRequest(requestBody)

  if (!requestAudit.requestContractValid) {
    createJsonResponse(response, 422, {
      ok: false,
      status: "local_image_model_dry_run_request_invalid",
      ...requestAudit,
      requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
      canShowToPlayer: false,
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
      canShowToPlayer: false,
    })
    return
  }

  const requestBody = bodyResult.payload
  const requestAudit = validateGenerationRequest(requestBody)

  if (!requestAudit.requestContractValid) {
    createJsonResponse(response, 422, {
      ok: false,
      status: "local_image_model_generate_request_invalid",
      ...requestAudit,
      requiredResponseShape: REQUIRED_RESPONSE_FIELDS,
      canShowToPlayer: false,
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

async function handleGeneratedImage(url, response) {
  const fileNameResult = readGeneratedImageFileName(url)

  if (!fileNameResult.ok) {
    createJsonResponse(response, 400, fileNameResult)
    return
  }

  const outputReference = buildLocalImageOutputReference({
    fileName: fileNameResult.fileName,
  })

  if (!outputReference.ok) {
    createJsonResponse(response, 400, {
      ...outputReference,
      status: "generated_image_file_name_invalid",
    })
    return
  }

  let fileStat

  try {
    fileStat = await stat(outputReference.internalFilePath)
  } catch {
    createJsonResponse(response, 404, {
      ok: false,
      status: "generated_image_not_found",
      fileName: outputReference.fileName,
      imageUrl: outputReference.imageUrl,
      canShowToPlayer: false,
    })
    return
  }

  if (!fileStat.isFile()) {
    createJsonResponse(response, 404, {
      ok: false,
      status: "generated_image_not_file",
      fileName: outputReference.fileName,
      canShowToPlayer: false,
    })
    return
  }

  if (fileStat.size > MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES) {
    createJsonResponse(response, 413, {
      ok: false,
      status: "generated_image_too_large",
      fileName: outputReference.fileName,
      sizeBytes: fileStat.size,
      maxFileBytes: MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES,
      canShowToPlayer: false,
    })
    return
  }

  response.writeHead(200, {
    "content-type": readImageContentType(outputReference.imageFormat),
    "content-length": fileStat.size,
    "cache-control": "no-store",
    "x-ai-pet-world-can-show-to-player": "false",
    "x-ai-pet-world-route": "local-image-model-generated",
    "x-ai-pet-world-image-format": outputReference.imageFormat,
    "content-disposition": `inline; filename="${outputReference.fileName}"`,
  })

  const stream = fs.createReadStream(outputReference.internalFilePath)
  stream.on("error", () => response.destroy())
  stream.pipe(response)
}

function readGeneratedImageFileName(url) {
  const routePrefix = `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/`

  if (!url.pathname.startsWith(routePrefix)) {
    return { ok: false, status: "generated_image_route_mismatch", canShowToPlayer: false }
  }

  const encodedFileName = url.pathname.slice(routePrefix.length)

  if (!encodedFileName) {
    return { ok: false, status: "generated_image_file_name_missing", canShowToPlayer: false }
  }

  try {
    return { ok: true, fileName: decodeURIComponent(encodedFileName) }
  } catch {
    return {
      ok: false,
      status: "generated_image_file_name_invalid_encoding",
      canShowToPlayer: false,
    }
  }
}

function readImageContentType(imageFormat) {
  if (imageFormat === "png") return "image/png"
  if (imageFormat === "webp") return "image/webp"
  return "image/jpeg"
}

function validateGenerationRequest(requestBody) {
  if (!isRecord(requestBody)) {
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

    if (
      request.method === "GET" &&
      url.pathname.startsWith(`${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/`)
    ) {
      await handleGeneratedImage(url, response)
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
      canShowToPlayer: false,
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log("[local-image-model] contract server started")
  console.log(`[local-image-model] health:   http://localhost:${PORT}/health`)
  console.log(`[local-image-model] dry-run:  http://localhost:${PORT}/dry-run`)
  console.log(`[local-image-model] generate: http://localhost:${PORT}/generate`)
  console.log(
    `[local-image-model] generated: http://localhost:${PORT}${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/:fileName`
  )
  console.log("[local-image-model] implementation entry: ./implementation.mjs")
  console.log("[local-image-model] fake image output: forbidden")
})
