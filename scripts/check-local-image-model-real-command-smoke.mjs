import { existsSync, readFileSync } from "node:fs"

import {
  generateRealImageWithRunnerImplementation,
  readRealImageRunnerImplementationHealth,
  runRealImageRunnerImplementationDryRun,
} from "../services/local-image-model/real-image-runner-implementation.mjs"

const EXECUTE_REAL_COMMAND = process.argv.includes("--execute-real-command")
const HTTP_ENGINE_COMMAND_SCRIPT =
  "services/local-image-model/real-image-http-engine-command.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  printTitle("AI-PET-WORLD real model command smoke check")

  const env = withDerivedHttpEngineCommandEnv(loadRuntimeEnv())
  const runtimeInput = buildRuntimeInput(env)
  const realModelCommandConfigured = hasValue(
    env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND
  )
  const httpEngineCommandDerived = env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND_DERIVED === "http_engine"
  const health = readRealImageRunnerImplementationHealth(runtimeInput)
  const dryRun = await runRealImageRunnerImplementationDryRun(runtimeInput)

  printCheck("runner implementation health inspected")
  printCheck("runner implementation dry-run inspected")

  if (!realModelCommandConfigured) {
    printSafeBlockedSummary({ health, dryRun })
    console.log("")
    console.log("RESULT: real model command smoke check passed in safe blocked mode.")
    return
  }

  printCheck(
    httpEngineCommandDerived
      ? "real model command derived from HTTP engine endpoint"
      : "real model command is configured"
  )

  if (health.ok !== true || dryRun.ok !== true) {
    throw new Error(
      `真实模型命令已配置，但执行链路尚未 ready：health=${health.status}, dryRun=${dryRun.status}`
    )
  }

  if (!EXECUTE_REAL_COMMAND) {
    printReadyButNotExecutedSummary({ health, dryRun, httpEngineCommandDerived })
    console.log("")
    console.log(
      "RESULT: real model command smoke check passed without executing command."
    )
    return
  }

  printCheck("explicit execute flag accepted")
  console.log("")
  console.log("即将执行真实模型命令：这一步会调用本地模型并要求写入真实图片文件。")

  const result = await generateRealImageWithRunnerImplementation(runtimeInput)

  if (result.ok !== true) {
    throw new Error(
      `真实模型命令烟测失败：${result.status} / executor=${result.executorShell?.status}`
    )
  }

  if (result.canShowToPlayer !== false) {
    throw new Error("真实模型命令烟测结果不能直接 canShowToPlayer=true。")
  }

  printCheck("real command executed")
  printCheck("stdout JSON accepted")
  printCheck("output file verified")
  printCheck("result remains hidden candidate source only")

  console.log("")
  console.log(`imageUrl: ${result.imageUrl}`)
  console.log(`imageFormat: ${result.imageFormat}`)
  console.log(`width: ${result.width}`)
  console.log(`height: ${result.height}`)
  console.log(`license: ${result.license}`)
  console.log(`originalityConfirmed: ${result.originalityConfirmed}`)
  console.log("")
  console.log("RESULT: real model command smoke check passed with real execution.")
}

function buildRuntimeInput(env) {
  return {
    enabled: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED,
    command: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND,
    argsJson: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON,
    timeoutMs: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS,
    workerEnv: {
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND:
        env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON:
        env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS:
        env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS,
      AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND:
        env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND,
      AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON:
        env.AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON,
      AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS:
        env.AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS,
      AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT:
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT,
      AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE:
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE,
      AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED:
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED,
      AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE:
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE,
      AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS:
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS,
      AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR:
        env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
    },
    outputStorage: {
      outputDirectory: env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
      publicBaseUrl: env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL,
    },
    readiness: buildSmokeReadiness(env),
    requestBody: buildSmokeRequestBody(),
    requestAudit: {
      requestId: "real-command-smoke-check",
      node: "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-26.6",
    },
  }
}

function buildSmokeReadiness(env) {
  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: hasValue(env.AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR),
    manifestConfigured: hasValue(env.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST),
    license:
      env.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE ||
      env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE ||
      "self_owned",
    originalityConfirmed:
      String(
        env.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED ??
          env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED
      ).toLowerCase() === "true",
    manifest: buildSmokeManifest(env),
    canRunInference: false,
    adapterConnected: false,
    canShowToPlayer: false,
    tags: [
      "real_image_model_readiness",
      "smoke_check_readiness",
      "not_player_visible",
    ],
  }
}

function buildSmokeManifest(env) {
  const license =
    env.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE ||
    env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE ||
    "self_owned"
  const originalityConfirmed =
    String(
      env.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED ??
        env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED
    ).toLowerCase() === "true"

  return {
    ok: true,
    status: "real_model_manifest_valid",
    schemaVersion: "ai-pet-world-real-image-model-manifest-v1",
    modelName: "AI-PET-WORLD Real Model Command Smoke Check",
    modelVersion: "smoke-check-1",
    license,
    dataSourceType: "self_owned",
    commercialUseAllowed: true,
    originalityConfirmed,
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
    tags: ["real_model_manifest", "smoke_check_manifest", "not_player_visible"],
  }
}

function buildSmokeRequestBody() {
  return {
    requestId: "real-command-smoke-check",
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
      tags: ["real_command_smoke_model_task"],
    },
    promptPackage: {
      packageId: "real-command-smoke-prompt-package",
      positivePromptEn:
        "Top-down cozy pixel world frame, original tiny grassland, small home base, soft daytime light, coherent terrain, true bitmap image.",
      negativePromptEn:
        "No placeholder, no SVG, no HTML, no JSON debug image, no watermark, no copied character, no third-party IP.",
      sourceFactIds: ["real-command-smoke-world-fact"],
      canShowToPlayer: false,
      tags: ["real_command_smoke_prompt_package"],
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
      tags: ["real_command_smoke_response_contract"],
    },
    controlSketch: {
      controlSketchId: "real-command-smoke-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
      isPlayerVisible: false,
      tags: ["real_command_smoke_control_sketch"],
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["real-command-smoke-world-fact"],
      biome: "grassland",
      timeOfDay: "daytime",
      weather: "clear",
      canShowToPlayer: false,
      tags: ["real_command_smoke_world_fact_metadata"],
    },
    constraints: {
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
  }
}

function printSafeBlockedSummary(input) {
  console.log("")
  console.log("当前状态：真实模型命令未配置，烟测保持安全阻断。")
  console.log(`health: ${input.health.status}`)
  console.log(`dryRun: ${input.dryRun.status}`)
  console.log("不会执行真实模型命令。")
  console.log("不会写入图片文件。")
  console.log("不会生成 hidden candidate。")
}

function printReadyButNotExecutedSummary(input) {
  console.log("")
  console.log(
    input.httpEngineCommandDerived
      ? "当前状态：已从 HTTP engine endpoint 派生命令，执行链路 dry-run 已 ready。"
      : "当前状态：真实模型命令已配置，执行链路 dry-run 已 ready。"
  )
  console.log(`health: ${input.health.status}`)
  console.log(`dryRun: ${input.dryRun.status}`)
  console.log("本次未执行真实命令。")
  console.log("如需真实执行烟测，请运行：")
  console.log("npm run check:local-image-model-real-command-smoke -- --execute-real-command")
}

function loadRuntimeEnv() {
  return {
    ...parseEnvFile(".env.example"),
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env,
  }
}

function withDerivedHttpEngineCommandEnv(env) {
  if (
    hasValue(env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND) ||
    !hasValue(env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT)
  ) {
    return env
  }

  return {
    ...env,
    AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED: "true",
    AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND:
      env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND || process.execPath,
    AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON:
      env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON ||
      JSON.stringify(["services/local-image-model/real-image-model-worker.mjs"]),
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND:
      env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND || process.execPath,
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON:
      env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON ||
      JSON.stringify(["services/local-image-model/real-image-command-bridge.mjs"]),
    AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND: process.execPath,
    AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON: JSON.stringify([
      HTTP_ENGINE_COMMAND_SCRIPT,
    ]),
    AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS:
      env.AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS ||
      env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS ||
      "180000",
    AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND_DERIVED: "http_engine",
  }
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const entries = {}
  const raw = readFileSync(filePath, "utf8")

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex < 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = stripEnvQuotes(trimmed.slice(separatorIndex + 1).trim())
    entries[key] = value
  }

  return entries
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0
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
