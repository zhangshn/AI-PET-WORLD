import { existsSync, readFileSync } from "node:fs"

import {
  readLocalImageModelImplementationHealth,
  readLocalImageModelRuntimeConfig,
} from "../services/local-image-model/implementation.mjs"
import {
  readRealImageCommandBridgeHealth,
} from "../services/local-image-model/real-image-command-bridge.mjs"

const REQUIRE_REAL_COMMAND = process.argv.includes("--require-real-command")

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  printTitle("AI-PET-WORLD real model command env acceptance")

  const env = loadRuntimeEnv()
  const runtimeInput = buildRuntimeInput(env)
  const runtimeConfig = readLocalImageModelRuntimeConfig(runtimeInput)
  const implementationHealth = readLocalImageModelImplementationHealth({
    ...runtimeInput,
    requestBody: buildAcceptanceRequestBody(),
  })
  const bridgeHealth = readRealImageCommandBridgeHealth({
    command: env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND,
    argsJson: env.AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON,
    timeoutMs: env.AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS,
    outputDirectory: env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
  })
  const realModelCommandConfigured = hasValue(
    env.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND
  )

  assertBaseChain({ runtimeConfig, implementationHealth })
  assertBridgeConfig({ bridgeHealth, realModelCommandConfigured })

  printCheck("executor -> worker env chain accepted")
  printCheck("worker -> command bridge env chain accepted")
  printCheck("readiness and output-storage gates inspected")

  if (!realModelCommandConfigured) {
    printBlockedSummary({ implementationHealth, bridgeHealth })

    if (REQUIRE_REAL_COMMAND) {
      throw new Error(
        "真实模型命令未配置：请设置 AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND 后再运行 --require-real-command。"
      )
    }

    console.log("")
    console.log(
      "RESULT: real model command env acceptance passed in safe blocked mode."
    )
    return
  }

  if (!bridgeHealth.ok) {
    throw new Error(
      `真实模型命令 bridge health 未通过：${bridgeHealth.status}`
    )
  }

  if (!implementationHealth.ok) {
    throw new Error(
      `local image model implementation health 未通过：${implementationHealth.status}`
    )
  }

  printCheck("real model command configured")
  printCheck("command bridge health ready")
  printReadySummary({ implementationHealth, bridgeHealth })

  console.log("")
  console.log("RESULT: real model command env acceptance passed.")
}

function assertBaseChain(input) {
  const { runtimeConfig, implementationHealth } = input

  if (!runtimeConfig.workerEnv.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND) {
    throw new Error(
      "缺少 AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND，worker 不能接入 command bridge。"
    )
  }

  if (!runtimeConfig.workerEnv.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON) {
    throw new Error(
      "缺少 AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON，worker 不能定位 command bridge。"
    )
  }

  if (!runtimeConfig.workerHealth.ok) {
    throw new Error(`worker health 未通过：${runtimeConfig.workerHealth.status}`)
  }

  if (!implementationHealth.adapter?.runner?.outputStorage?.ok) {
    throw new Error(
      `output-storage 未就绪：${implementationHealth.adapter?.runner?.outputStorage?.status}`
    )
  }
}

function assertBridgeConfig(input) {
  const { bridgeHealth, realModelCommandConfigured } = input

  if (!realModelCommandConfigured) {
    if (bridgeHealth.status !== "real_image_command_bridge_model_command_missing") {
      throw new Error(
        `真实模型命令未配置时，bridge 必须停在 model_command_missing，实际为：${bridgeHealth.status}`
      )
    }
    return
  }

  if (bridgeHealth.status === "real_image_command_bridge_model_args_invalid") {
    throw new Error("AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON 必须是字符串数组 JSON。")
  }

  if (bridgeHealth.status === "real_image_command_bridge_output_directory_missing") {
    throw new Error("缺少 AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR。")
  }
}

function printBlockedSummary(input) {
  console.log("")
  console.log("当前状态：真实模型命令未配置，链路保持安全阻断。")
  console.log(`implementation: ${input.implementationHealth.status}`)
  console.log(`command bridge: ${input.bridgeHealth.status}`)
  console.log("不会执行真实模型命令。")
  console.log("不会生成 hidden candidate。")
  console.log("不会进入 VisualJudge / ApprovedFrame / /world 展示。")
}

function printReadySummary(input) {
  console.log("")
  console.log("当前状态：真实模型命令已配置，可进入下一步真实 generate 验证。")
  console.log(`implementation: ${input.implementationHealth.status}`)
  console.log(`command bridge: ${input.bridgeHealth.status}`)
  console.log("本检查不会执行真实模型命令；正式生成请调用视觉生成链路。")
}

function loadRuntimeEnv() {
  return {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env,
  }
}

function buildRuntimeInput(env) {
  return {
    enabled: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED,
    command: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND,
    argsJson: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON,
    timeoutMs: env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS,
    worker: {
      command: env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
      argsJson: env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
      timeoutMs: env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS,
    },
    realModelReadiness: {
      enabled: env.AI_PET_WORLD_REAL_IMAGE_MODEL_ENABLED,
      assetDirectory: env.AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR,
      manifestPath: env.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST,
      license: env.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE,
      originalityConfirmed:
        env.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED,
    },
    outputStorage: {
      outputDirectory: env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
      publicBaseUrl: env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL,
    },
  }
}

function buildAcceptanceRequestBody() {
  return {
    requestId: "real-command-env-acceptance-request",
    imageFormat: "png",
    width: 1536,
    height: 1024,
    modelTask: {
      taskKind: "generate_hidden_world_bitmap_candidate",
      outputPurpose: "hidden_ai_image_candidate",
      canShowToPlayer: false,
    },
    promptPackage: {
      packageId: "real-command-env-acceptance-prompt-package",
      positivePromptEn: "Bright healing top-down pixel world frame.",
      sourceFactIds: ["real-command-env-acceptance-fact"],
      canShowToPlayer: false,
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
      mustPassVisualJudge: true,
    },
    controlSketch: {
      controlSketchId: "real-command-env-acceptance-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["real-command-env-acceptance-fact"],
      canShowToPlayer: false,
    },
    constraints: {
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
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
