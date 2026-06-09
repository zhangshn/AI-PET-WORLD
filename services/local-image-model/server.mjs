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
      version: "contract-shell-3",
      endpoints: {
        health: "/health",
        dryRun: "/dry-run",
        generate: "/generate",
        generatedImage: `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/:fileName`,
      },
      canShowToPlayer: false,
      tags: [
        "local_image_model_contract_server",
        "contract_server_ready",
        "generated_route_ready",
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
      version: "contract-shell-3",
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
      version: "contract-shell-3",
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
      message:
        "请求的 generated 图片不存在。当前服务不会生成假图，也不会返回占位图。",
      messageEn:
        "The requested generated image does not exist. This service will not generate fake images or return placeholders.",
      canShowToPlayer: false,
      tags: [
        "generated_image_route",
        "generated_image_not_found",
        "does_not_generate",
        "fake_image_forbidden",
        "not_player_visible",
      ],
    })
    return
  }

  if (!fileStat.isFile()) {
    createJsonResponse(response, 404, {
      ok: false,
      status: "generated_image_not_file",
      fileName: outputReference.fileName,
      canShowToPlayer: false,
      tags: [
        "generated_image_route",
        "generated_image_not_file",
        "not_player_visible",
      ],
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
      tags: [
        "generated_image_route",
        "generated_image_too_large",
        "not_player_visible",
      ],
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

  stream.on("error", () => {
    response.destroy()
  })

  stream.pipe(response)
}

function readGeneratedImageFileName(url) {
  const routePrefix = `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/`

  if (!url.pathname.startsWith(routePrefix)) {
    return {
      ok: false,
      status: "generated_image_route_mismatch",
      message: "generated image route 不匹配。",
      messageEn: "The generated image route does not match.",
      canShowToPlayer: false,
      tags: ["generated_image_route", "route_mismatch"],
    }
  }

  const encodedFileName = url.pathname.slice(routePrefix.length)

  if (!encodedFileName) {
    return {
      ok: false,
      status: "generated_image_file_name_missing",
      message: "generated image 文件名不能为空。",
      messageEn: "The generated image file name cannot be empty.",
      canShowToPlayer: false,
      tags: ["generated_image_route", "file_name_missing"],
    }
  }

  try {
    const fileName = decodeURIComponent(encodedFileName)

    return {
      ok: true,
      fileName,
    }
  } catch {
    return {
      ok: false,
      status: "generated_image_file_name_invalid_encoding",
      message: "generated image 文件名 URL 编码不合法。",
      messageEn: "The generated image file name URL encoding is invalid.",
      canShowToPlayer: false,
      tags: ["generated_image_route", "file_name_invalid_encoding"],
    }
  }
}

function readImageContentType(imageFormat) {
  if (imageFormat === "png") {
    return "image/png"
  }

  if (imageFormat === "webp") {
    return "image/webp"
  }

  return "image/jpeg"
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

    if (request.method === "GET" && url.pathname.startsWith(
      `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/`
    )) {
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
  console.log(
    `[local-image-model] generated: http://localhost:${PORT}${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/:fileName`
  )
  console.log("[local-image-model] implementation entry: ./implementation.mjs")
  console.log("[local-image-model] real image model implementation: not connected")
  console.log("[local-image-model] fake image output: forbidden")
})