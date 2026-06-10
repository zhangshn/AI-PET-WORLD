import assert from "node:assert/strict"

import {
  buildRealImageExecutorStdinPayload,
  validateRealImageExecutorStdinPayload,
} from "../services/local-image-model/real-image-execution-payload.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  const payloadResult = buildRealImageExecutorStdinPayload({
    requestId: "real-command-stdin-contract-inspect",
    requestBody: buildInspectRequestBody(),
    readiness: buildInspectReadiness(),
    outputStorage: {
      outputDirectory: "data/local-image-model/generated",
      publicBaseUrl: "http://127.0.0.1:7001",
    },
    timeoutMs: 600000,
  })

  assert.equal(payloadResult.ok, true)

  const validation = validateRealImageExecutorStdinPayload(payloadResult.payload)
  assert.equal(validation.ok, true)
  assert.equal(payloadResult.payload.canShowToPlayer, false)
  assert.equal(payloadResult.payload.audit.willExecuteCommand, false)
  assert.equal(payloadResult.payload.audit.didExecuteCommand, false)
  assert.equal(payloadResult.payload.constraints.mustPersistOnlyAsHiddenCandidate, true)
  assert.equal(payloadResult.payload.constraints.mustPassVisualJudge, true)
  assert.equal(
    payloadResult.payload.constraints.mustCreateApprovedFrameBeforePlayerView,
    true
  )
  assert.equal(Object.hasOwn(payloadResult.payload.outputStorage, "outputDirectory"), false)
  assert.equal(Object.hasOwn(payloadResult.payload.outputStorage, "internalFilePath"), false)
  assert.equal(Object.hasOwn(payloadResult.payload.outputStorage, "localFilePath"), false)

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(payloadResult.payload, null, 2))
    return
  }

  printTitle("AI-PET-WORLD real model command stdin contract")
  printCheck("stdin payload can be built")
  printCheck("stdin payload validates")
  printCheck("world facts are locked")
  printCheck("hidden candidate gate is required")
  printCheck("VisualJudge gate is required")
  printCheck("ApprovedFrame gate is required")
  printCheck("local output directory is not exposed in payload")

  console.log("")
  console.log("真实模型命令将从 stdin 收到一个 JSON 对象。")
  console.log(`schemaVersion: ${payloadResult.payload.schemaVersion}`)
  console.log(`payloadKind: ${payloadResult.payload.payloadKind}`)
  console.log(`outputFileName: ${payloadResult.payload.outputFileName}`)
  console.log(`imageFormat: ${payloadResult.payload.outputStorage.imageFormat}`)
  console.log(`publicBaseUrl: ${payloadResult.payload.outputStorage.publicBaseUrl}`)
  console.log("")
  console.log("真实模型命令必须完成：")
  console.log("1. 读取 stdin JSON。")
  console.log("2. 生成真实 PNG/WebP/JPG 位图。")
  console.log("3. 写入 AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR 下的 outputFileName。")
  console.log("4. stdout 只返回六字段 JSON 契约。")
  console.log("5. 不返回 file://、本机路径、SVG、HTML、JSON 调试图、占位图或程序绘图结果。")
  console.log("")
  console.log("查看完整 stdin JSON：")
  console.log("npm run inspect:local-image-model-real-command-request -- --json")
  console.log("")
  console.log("RESULT: real model command stdin contract inspection passed.")
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
    tags: [
      "real_image_model_readiness",
      "assets_ready",
      "manifest_valid",
      "stdin_contract_inspection_only",
      "not_player_visible",
    ],
  }
}

function buildInspectManifest() {
  return {
    ok: true,
    status: "real_model_manifest_valid",
    schemaVersion: "ai-pet-world-real-image-model-manifest-v1",
    modelName: "AI-PET-WORLD Real Model Command Contract Inspector",
    modelVersion: "contract-inspect-1",
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
    requestId: "real-command-stdin-contract-inspect",
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
      tags: ["stdin_contract_inspection_model_task"],
    },
    promptPackage: {
      packageId: "stdin-contract-inspection-prompt-package",
      positivePromptEn:
        "Top-down pixel world frame, clear terrain, coherent tiny world objects, no placeholder.",
      negativePromptEn:
        "No placeholder, no SVG, no HTML, no JSON debug image, no watermark, no third-party character.",
      sourceFactIds: ["stdin-contract-inspection-world-fact"],
      canShowToPlayer: false,
      tags: ["stdin_contract_inspection_prompt_package"],
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
      tags: ["stdin_contract_inspection_response_contract"],
    },
    controlSketch: {
      controlSketchId: "stdin-contract-inspection-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
      isPlayerVisible: false,
      tags: ["stdin_contract_inspection_control_sketch"],
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["stdin-contract-inspection-world-fact"],
      biome: "grassland",
      timeOfDay: "daytime",
      weather: "clear",
      canShowToPlayer: false,
      tags: ["stdin_contract_inspection_world_fact_metadata"],
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
