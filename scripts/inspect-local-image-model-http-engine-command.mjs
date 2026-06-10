import assert from "node:assert/strict"

import {
  __internalRealImageHttpEngineCommand,
  readHttpEngineCommandConfig,
} from "../services/local-image-model/real-image-http-engine-command.mjs"
import {
  buildRealImageExecutorStdinPayload,
  validateRealImageExecutorStdinPayload,
} from "../services/local-image-model/real-image-execution-payload.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  const missingConfig = readHttpEngineCommandConfig({
    endpoint: "",
    outputDirectory: "data/local-image-model/generated",
    originalityConfirmed: "true",
  })
  assert.equal(missingConfig.ok, false)
  assert.equal(
    missingConfig.status,
    "real_image_http_engine_command_endpoint_missing"
  )

  const config = readHttpEngineCommandConfig({
    endpoint: "http://localhost:7860/generate",
    outputDirectory: "data/local-image-model/generated",
    license: "self_owned",
    originalityConfirmed: "true",
    requestMode: "prompt_package",
    timeoutMs: "180000",
  })
  assert.equal(config.ok, true)
  assert.equal(config.endpoint, "http://localhost:7860/generate")
  assert.equal(config.license, "self_owned")
  assert.equal(config.originalityConfirmed, true)
  assert.equal(config.requestMode, "prompt_package")
  assert.equal(config.canShowToPlayer, false)

  const payloadResult = buildRealImageExecutorStdinPayload({
    requestId: "http-engine-command-inspect",
    requestBody: buildInspectRequestBody(),
    readiness: buildInspectReadiness(),
    outputStorage: {
      outputDirectory: "data/local-image-model/generated",
      publicBaseUrl: "http://127.0.0.1:7001",
    },
    timeoutMs: 180000,
  })
  assert.equal(payloadResult.ok, true)

  const validation = validateRealImageExecutorStdinPayload(payloadResult.payload)
  assert.equal(validation.ok, true)

  const request = __internalRealImageHttpEngineCommand.buildHttpEngineRequest({
    payload: payloadResult.payload,
    config,
  })
  assert.equal(request.ok, true)
  assert.equal(request.body.schemaVersion, "ai-pet-world-http-engine-request-v1")
  assert.equal(request.body.requestMode, "prompt_package")
  assert.equal(request.body.outputFileName, payloadResult.payload.outputFileName)
  assert.equal(request.body.imageFormat, "png")
  assert.equal(request.body.canShowToPlayer, false)
  assert.equal(request.body.constraints.mustReturnRealBitmap, true)
  assert.equal(request.body.constraints.mustNotReturnPlaceholder, true)
  assert.equal(request.body.constraints.mustNotReturnSvg, true)
  assert.equal(request.body.constraints.canShowToPlayer, false)

  printTitle("AI-PET-WORLD HTTP engine command adapter")
  printCheck("missing endpoint is rejected")
  printCheck("HTTP engine config can be read")
  printCheck("formal executor stdin payload can be built")
  printCheck("formal executor stdin payload validates")
  printCheck("HTTP engine request can be built")
  printCheck("hidden candidate constraints are preserved")
  printCheck("player-visible gate remains closed")

  console.log("")
  console.log("HTTP engine command adapter 已准备好。")
  console.log("它会读取现有 .env.local 中的：")
  console.log("- AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT")
  console.log("- AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE")
  console.log("- AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED")
  console.log("- AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE")
  console.log("- AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS")
  console.log("")
  console.log("它会把本地 HTTP engine 返回的 imageBase64 / dataUrl / imageUrl 写入输出目录。")
  console.log("随后 stdout 返回真实命令契约 JSON。")
  console.log("")
  console.log("RESULT: HTTP engine command adapter inspection passed.")
}

function buildInspectReadiness() {
  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: true,
    manifestConfigured: true,
    license: "self_owned",
    originalityConfirmed: true,
    manifest: buildInspectManifest(),
    canRunInference: false,
    adapterConnected: false,
    canShowToPlayer: false,
    tags: ["real_image_model_readiness", "assets_ready", "not_player_visible"],
  }
}

function buildInspectManifest() {
  return {
    ok: true,
    status: "real_model_manifest_valid",
    schemaVersion: "ai-pet-world-real-image-model-manifest-v1",
    modelName: "AI-PET-WORLD HTTP Engine Command Adapter Inspector",
    modelVersion: "http-engine-command-inspect-1",
    license: "self_owned",
    dataSourceType: "self_owned",
    commercialUseAllowed: true,
    originalityConfirmed: true,
    unlicensedThirdPartyArtworkAllowed: false,
    outputCapabilities: {
      supportedImageFormats: ["png", "webp", "jpg"],
      minimumWidth: 1024,
      minimumHeight: 768,
      canReturnPlaceholder: false,
      canReturnSvg: false,
      canReturnHtml: false,
      canReturnJsonDebugImage: false,
      canReturnProgrammaticRenderer: false,
    },
    canShowToPlayer: false,
    tags: ["real_model_manifest", "manifest_valid", "not_player_visible"],
  }
}

function buildInspectRequestBody() {
  return {
    requestId: "http-engine-command-inspect",
    imageFormat: "png",
    width: 1536,
    height: 1024,
    modelTask: {
      taskKind: "generate_hidden_world_bitmap_candidate",
      modelRole: "ai_image_generation_model",
      outputPurpose: "hidden_ai_image_candidate",
      worldFrameKind: "static_top_down_pixel_world_frame",
      mustReturnResponseContract: true,
      mustNotDisplayDirectly: true,
      mustNotRewriteWorldFacts: true,
      mustNotUseProgrammaticRenderer: true,
      mustNotCopyUnlicensedThirdPartyWorks: true,
      canShowToPlayer: false,
      tags: ["http_engine_command_inspection_model_task"],
    },
    promptPackage: {
      packageId: "http-engine-command-inspection-prompt-package",
      positivePromptEn:
        "Top-down cozy pixel world frame, original tiny grassland, small home base, soft daytime light, true bitmap image.",
      negativePromptEn:
        "No placeholder, no SVG, no HTML, no JSON debug image, no watermark, no copied character.",
      sourceFactIds: ["http-engine-command-inspection-world-fact"],
      canShowToPlayer: false,
      tags: ["http_engine_command_inspection_prompt_package"],
    },
    responseContract: {
      requiredFields: [
        "imageUrl",
        "imageFormat",
        "width",
        "height",
        "license",
        "originalityConfirmed",
      ],
      allowedImageFormats: ["png", "webp", "jpg"],
      allowedLicenses: ["self_owned", "cc0", "commercial_license"],
      minimumWidth: 1024,
      minimumHeight: 768,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPersistOnlyAsHiddenCandidate: true,
      mustPassVisualJudge: true,
      mustCreateApprovedFrameBeforeRuntimeRender: true,
      tags: ["http_engine_command_inspection_response_contract"],
    },
    controlSketch: {
      controlSketchId: "http-engine-command-inspection-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
      isPlayerVisible: false,
      tags: ["http_engine_command_inspection_control_sketch"],
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["http-engine-command-inspection-world-fact"],
      biome: "grassland",
      timeOfDay: "daytime",
      weather: "clear",
      canShowToPlayer: false,
      tags: ["http_engine_command_inspection_world_fact_metadata"],
    },
    constraints: {
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
  }
}

function printTitle(title) {
  console.log("")
  console.log("=".repeat(title.length))
  console.log(title)
  console.log("=".repeat(title.length))
}

function printCheck(name) {
  console.log(`[passed] ${name}`)
}
