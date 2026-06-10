import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  readLocalImageModelRuntimeConfig,
} from "../services/local-image-model/implementation.mjs"
import {
  readRealImageCommandBridgeHealth,
} from "../services/local-image-model/real-image-command-bridge.mjs"
import {
  readRealImageModelWorkerHealth,
} from "../services/local-image-model/real-image-model-worker.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  printTitle("AI-PET-WORLD local image model command config test")

  const envExample = parseEnvExample(await readFile(".env.example", "utf8"))

  testEnvExampleHasThreeStageCommandChain(envExample)
  testEnvExampleKeepsRealModelCommandBlank(envExample)
  testImplementationBuildsWorkerBridgeEnv(envExample)
  testWorkerHealthAcceptsBridgeConfig(envExample)
  testCommandBridgeBlocksUntilRealModelCommand(envExample)

  console.log("")
  console.log("RESULT: local image model command config test passed.")
}

function testEnvExampleHasThreeStageCommandChain(envExample) {
  assert.equal(envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND, "node")
  assert.deepEqual(
    JSON.parse(envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON),
    ["services/local-image-model/real-image-model-worker.mjs"]
  )
  assert.equal(envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND, "node")
  assert.deepEqual(
    JSON.parse(envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON),
    ["services/local-image-model/real-image-command-bridge.mjs"]
  )
  assert.ok(envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR)
  assert.ok(envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL)

  printCheck("env example defines executor worker bridge chain")
}

function testEnvExampleKeepsRealModelCommandBlank(envExample) {
  assert.equal(envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND, "")
  assert.deepEqual(
    JSON.parse(envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON),
    []
  )

  printCheck("env example keeps real model command blank")
}

function testImplementationBuildsWorkerBridgeEnv(envExample) {
  const runtimeConfig = readLocalImageModelRuntimeConfig({
    enabled: "false",
    command: envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND,
    argsJson: envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON,
    timeoutMs: envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS,
    outputStorage: {
      outputDirectory: envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
      publicBaseUrl: envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL,
    },
    worker: {
      command: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
      argsJson: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
      timeoutMs: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS,
    },
    realModelReadiness: {
      enabled: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_ENABLED,
      assetDirectory: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR,
      manifestPath: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST,
      license: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE,
      originalityConfirmed:
        envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED,
    },
  })

  assert.equal(runtimeConfig.command, "node")
  assert.equal(
    runtimeConfig.argsJson,
    envExample.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON
  )
  assert.equal(
    runtimeConfig.workerEnv.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
    "node"
  )
  assert.equal(
    runtimeConfig.workerEnv.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
    envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON
  )
  assert.equal(
    runtimeConfig.workerEnv.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
    envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR
  )

  printCheck("implementation builds worker bridge env")
}

function testWorkerHealthAcceptsBridgeConfig(envExample) {
  const workerHealth = readRealImageModelWorkerHealth({
    command: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
    argsJson: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
    timeoutMs: envExample.AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS,
    outputDirectory: envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
  })

  assert.equal(workerHealth.ok, true)
  assert.equal(workerHealth.status, "real_image_model_worker_ready")
  assert.equal(workerHealth.canBridgeInferenceCommand, true)
  assert.equal(workerHealth.canShowToPlayer, false)

  printCheck("worker health accepts command bridge config")
}

function testCommandBridgeBlocksUntilRealModelCommand(envExample) {
  const bridgeHealth = readRealImageCommandBridgeHealth({
    command: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND,
    argsJson: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON,
    timeoutMs: envExample.AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS,
    outputDirectory: envExample.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
  })

  assert.equal(bridgeHealth.ok, false)
  assert.equal(
    bridgeHealth.status,
    "real_image_command_bridge_model_command_missing"
  )
  assert.equal(bridgeHealth.canBridgeRealModelCommand, false)
  assert.equal(bridgeHealth.canShowToPlayer, false)

  printCheck("command bridge blocks until real model command is configured")
}

function parseEnvExample(raw) {
  const entries = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex < 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    entries[key] = value
  }

  return entries
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
