import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import {
  buildRealImageCommandAdapterTemplateContext,
  buildRealImageCommandAdapterTemplateNotImplemented,
} from "../services/local-image-model/real-image-command-adapter-template.mjs"
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
    requestId: "real-command-adapter-template-inspect",
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

  const context = buildRealImageCommandAdapterTemplateContext(payloadResult.payload)
  assert.equal(context.ok, true)
  assert.equal(context.status, "real_image_command_adapter_template_context_ready")
  assert.equal(context.outputFileName, payloadResult.payload.outputFileName)
  assert.equal(context.canShowToPlayer, false)
  assert.equal(context.outputDirectoryHidden, true)

  const notImplemented = buildRealImageCommandAdapterTemplateNotImplemented({
    context,
  })
  assert.equal(notImplemented.ok, false)
  assert.equal(
    notImplemented.status,
    "real_image_command_adapter_template_not_implemented"
  )
  assert.equal(notImplemented.canGenerateRealBitmap, false)
  assert.equal(notImplemented.canShowToPlayer, false)
  assert.equal(
    notImplemented.detail.requiredStdout.imageFileName,
    payloadResult.payload.outputFileName
  )

  const cliResult = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../services/local-image-model/real-image-command-adapter-template.mjs", import.meta.url))],
    {
      input: JSON.stringify(payloadResult.payload),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: "data/local-image-model/generated",
      },
    }
  )

  assert.notEqual(cliResult.status, 0)
  assert.equal(cliResult.stdout.trim(), "")

  const stderrPayload = JSON.parse(cliResult.stderr)
  assert.equal(stderrPayload.ok, false)
  assert.equal(
    stderrPayload.status,
    "real_image_command_adapter_template_not_implemented"
  )
  assert.equal(stderrPayload.canGenerateRealBitmap, false)
  assert.equal(stderrPayload.canShowToPlayer, false)

  printTitle("AI-PET-WORLD real model command adapter template")
  printCheck("formal stdin payload can be built")
  printCheck("formal stdin payload validates")
  printCheck("adapter template context can be built")
  printCheck("adapter template keeps output directory hidden")
  printCheck("adapter template reports required stdout shape")
  printCheck("adapter template CLI fails by default")
  printCheck("adapter template does not print success stdout")

  console.log("")
  console.log("真实模型命令适配模板已经准备好。")
  console.log("它会读取正式 stdin JSON，并提取：")
  console.log("- requestId")
  console.log("- outputFileName")
  console.log("- imageFormat")
  console.log("- promptPackage")
  console.log("- controlSketch")
  console.log("- worldFactMetadata")
  console.log("- responseContract")
  console.log("")
  console.log("默认行为：失败退出，不生成图片，不返回成功 stdout。")
  console.log("使用方式：复制 services/local-image-model/real-image-command-adapter-template.mjs，")
  console.log("在复制文件中接入你的真实本地模型，然后让 stdout 返回契约 JSON。")
  console.log("")
  console.log("RESULT: real model command adapter template inspection passed.")
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
    modelName: "AI-PET-WORLD Real Model Command Adapter Template Inspector",
    modelVersion: "adapter-template-inspect-1",
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
    requestId: "real-command-adapter-template-inspect",
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
      tags: ["adapter_template_inspection_model_task"],
    },
    promptPackage: {
      packageId: "adapter-template-inspection-prompt-package",
      positivePromptEn:
        "Top-down pixel world frame, bright tiny world, coherent terrain, true generated bitmap.",
      negativePromptEn:
        "No placeholder, no SVG, no HTML, no file path, no third-party character.",
      sourceFactIds: ["adapter-template-inspection-world-fact"],
      canShowToPlayer: false,
      tags: ["adapter_template_inspection_prompt_package"],
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
      tags: ["adapter_template_inspection_response_contract"],
    },
    controlSketch: {
      controlSketchId: "adapter-template-inspection-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
      isPlayerVisible: false,
      tags: ["adapter_template_inspection_control_sketch"],
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["adapter-template-inspection-world-fact"],
      biome: "grassland",
      timeOfDay: "daytime",
      weather: "clear",
      canShowToPlayer: false,
      tags: ["adapter_template_inspection_world_fact_metadata"],
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
