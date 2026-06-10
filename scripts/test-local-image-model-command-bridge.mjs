import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  readRealImageCommandBridgeHealth,
  runRealImageCommandBridge,
} from "../services/local-image-model/real-image-command-bridge.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  printTitle("AI-PET-WORLD real image command bridge test")

  testHealthBlocksWithoutModelCommand()
  testHealthReadyWithModelCommand()
  await testBridgeRejectsMissingCommand()
  await testBridgeRejectsInvalidRequest()
  await testBridgeExecutesAndValidatesStdout()
  await testBridgeRejectsOutputFileNameMismatch()
  await testBridgeCliReturnsSixFields()

  console.log("")
  console.log("RESULT: real image command bridge test passed.")
}

function testHealthBlocksWithoutModelCommand() {
  const health = readRealImageCommandBridgeHealth({
    command: "",
    outputDirectory: "/tmp/ai-pet-world-output",
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_command_bridge_model_command_missing")
  assert.equal(health.canShowToPlayer, false)

  printCheck("command bridge health blocks without model command")
}

function testHealthReadyWithModelCommand() {
  const health = readRealImageCommandBridgeHealth({
    command: process.execPath,
    argsJson: JSON.stringify(["--version"]),
    outputDirectory: "/tmp/ai-pet-world-output",
  })

  assert.equal(health.ok, true)
  assert.equal(health.status, "real_image_command_bridge_ready")
  assert.equal(health.canBridgeRealModelCommand, true)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("command bridge health ready with model command")
}

async function testBridgeRejectsMissingCommand() {
  const result = await runRealImageCommandBridge({
    request: buildRequest(),
    config: {
      command: "",
      outputDirectory: "/tmp/ai-pet-world-output",
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_command_bridge_model_command_missing")
  assert.equal(result.canShowToPlayer, false)

  printCheck("command bridge rejects missing command")
}

async function testBridgeRejectsInvalidRequest() {
  const result = await runRealImageCommandBridge({
    request: {
      canShowToPlayer: false,
    },
    config: {
      command: process.execPath,
      outputDirectory: "/tmp/ai-pet-world-output",
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_command_bridge_request_invalid")
  assert.equal(result.canShowToPlayer, false)

  printCheck("command bridge rejects invalid request")
}

async function testBridgeExecutesAndValidatesStdout() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-pet-world-command-bridge-"))
  const modelScriptPath = path.join(tempDir, "model-command.mjs")
  await writeFile(
    modelScriptPath,
    `
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      process.stdout.write(JSON.stringify({
        ok: true,
        status: "real_image_generated",
        imageFileName: request.outputFileName,
        imageFormat: request.imageFormat,
        width: request.width,
        height: request.height,
        license: "self_owned",
        originalityConfirmed: true
      }));
    `,
    "utf8"
  )

  try {
    const result = await runRealImageCommandBridge({
      request: buildRequest(),
      config: {
        command: process.execPath,
        argsJson: JSON.stringify([modelScriptPath]),
        outputDirectory: tempDir,
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.status, "real_image_command_bridge_completed")
    assert.equal(result.imageFileName, "bridge-output.png")
    assert.equal(result.imageFormat, "png")
    assert.equal(result.width, 1536)
    assert.equal(result.height, 1024)
    assert.equal(result.license, "self_owned")
    assert.equal(result.originalityConfirmed, true)
    assert.equal(result.canShowToPlayer, false)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  printCheck("command bridge executes and validates stdout")
}

async function testBridgeRejectsOutputFileNameMismatch() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-pet-world-command-bridge-"))
  const modelScriptPath = path.join(tempDir, "model-command-mismatch.mjs")
  await writeFile(
    modelScriptPath,
    `
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      process.stdout.write(JSON.stringify({
        ok: true,
        status: "real_image_generated",
        imageFileName: "other.png",
        imageFormat: request.imageFormat,
        width: request.width,
        height: request.height,
        license: "self_owned",
        originalityConfirmed: true
      }));
    `,
    "utf8"
  )

  try {
    const result = await runRealImageCommandBridge({
      request: buildRequest(),
      config: {
        command: process.execPath,
        argsJson: JSON.stringify([modelScriptPath]),
        outputDirectory: tempDir,
      },
    })

    assert.equal(result.ok, false)
    assert.equal(result.status, "real_image_command_bridge_output_file_name_mismatch")
    assert.equal(result.canShowToPlayer, false)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  printCheck("command bridge rejects output file name mismatch")
}

async function testBridgeCliReturnsSixFields() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-pet-world-command-bridge-"))
  const modelScriptPath = path.join(tempDir, "model-command-cli.mjs")
  await writeFile(
    modelScriptPath,
    `
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      process.stdout.write(JSON.stringify({
        ok: true,
        status: "real_image_generated",
        imageFileName: request.outputFileName,
        imageFormat: request.imageFormat,
        width: request.width,
        height: request.height,
        license: "self_owned",
        originalityConfirmed: true
      }));
    `,
    "utf8"
  )

  try {
    const cli = spawnSync(process.execPath, ["services/local-image-model/real-image-command-bridge.mjs"], {
      cwd: process.cwd(),
      input: JSON.stringify(buildRequest()),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND: process.execPath,
        AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON: JSON.stringify([modelScriptPath]),
        AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: tempDir,
      },
    })

    assert.equal(cli.status, 0, cli.stderr)
    const payload = JSON.parse(cli.stdout)
    assert.equal(payload.ok, true)
    assert.equal(payload.status, "real_image_generated")
    assert.equal(payload.imageFileName, "bridge-output.png")
    assert.equal(payload.imageFormat, "png")
    assert.equal(payload.width, 1536)
    assert.equal(payload.height, 1024)
    assert.equal(payload.license, "self_owned")
    assert.equal(payload.originalityConfirmed, true)
    assert.equal(payload.canShowToPlayer, false)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  printCheck("command bridge cli returns six fields")
}

function buildRequest() {
  return {
    schemaVersion: "ai-pet-world-real-image-inference-request-1",
    taskKind: "generate_hidden_world_bitmap_candidate",
    outputPurpose: "hidden_ai_image_candidate",
    outputFileName: "bridge-output.png",
    imageFormat: "png",
    width: 1536,
    height: 1024,
    promptPackage: {
      packageId: "bridge-test-prompt-package",
      positivePromptEn: "bright healing pixel world",
    },
    modelTask: {
      taskKind: "generate_hidden_world_bitmap_candidate",
      canShowToPlayer: false,
    },
    responseContract: {
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPassVisualJudge: true,
    },
    controlSketch: {
      canShowToPlayer: false,
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["bridge-test-fact"],
      canShowToPlayer: false,
    },
    readiness: {
      ok: true,
      status: "real_image_model_assets_ready",
      license: "self_owned",
      originalityConfirmed: true,
      manifestConfigured: true,
      canShowToPlayer: false,
    },
    outputStorage: {
      ok: true,
      status: "local_image_output_storage_ready",
      publicBaseUrlConfigured: true,
      outputDirectoryProvidedByEnv: true,
      canShowToPlayer: false,
    },
    audit: {
      requestId: "bridge-test-request",
    },
    constraints: {
      mustWriteOutputFile: true,
      mustReturnStdoutJson: true,
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
