import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const WORKER_PATH = path.resolve(
  "services",
  "local-image-model",
  "real-image-model-worker.mjs"
)
const COMMAND_BRIDGE_PATH = path.resolve(
  "services",
  "local-image-model",
  "real-image-command-bridge.mjs"
)

await main()

async function main() {
  printTitle("AI-PET-WORLD worker command bridge integration test")

  await testWorkerRunsThroughCommandBridge()
  await testWorkerRejectsBridgeOutputFileNameMismatch()
  await testWorkerRejectsBridgeModelCommandMissing()

  console.log("")
  console.log("RESULT: worker command bridge integration test passed.")
}

async function testWorkerRunsThroughCommandBridge() {
  const fixture = createFixture("bridge-success")
  const modelCommand = createModelCommandFile(
    fixture,
    buildRealModelCommandSource({ mismatchOutputFileName: false })
  )
  const result = await runWorker({
    payload: buildWorkerPayload({ outputFileName: "bridge-success.png" }),
    env: buildWorkerBridgeEnv({ fixture, modelCommand }),
  })
  const stdout = parseJson(result.stdout)

  assert.equal(result.exitCode, 0, result.stderr)
  assert.equal(stdout.ok, true)
  assert.equal(stdout.status, "real_image_generated")
  assert.equal(stdout.imageFileName, "bridge-success.png")
  assert.equal(stdout.imageFormat, "png")
  assert.equal(stdout.width, 1536)
  assert.equal(stdout.height, 1024)
  assert.equal(stdout.license, "self_owned")
  assert.equal(stdout.originalityConfirmed, true)
  assert.equal(stdout.canShowToPlayer, false)
  assert.equal(fs.existsSync(path.join(fixture.outputDirectory, "bridge-success.png")), true)

  printCheck("worker runs through command bridge")
}

async function testWorkerRejectsBridgeOutputFileNameMismatch() {
  const fixture = createFixture("bridge-mismatch")
  const modelCommand = createModelCommandFile(
    fixture,
    buildRealModelCommandSource({ mismatchOutputFileName: true })
  )
  const result = await runWorker({
    payload: buildWorkerPayload({ outputFileName: "bridge-mismatch.png" }),
    env: buildWorkerBridgeEnv({ fixture, modelCommand }),
  })
  const stderr = parseJson(result.stderr)

  assert.equal(result.exitCode, 1)
  assert.equal(stderr.status, "real_image_command_bridge_output_file_name_mismatch")
  assert.equal(stderr.canShowToPlayer, false)

  printCheck("worker rejects bridge output file name mismatch")
}

async function testWorkerRejectsBridgeModelCommandMissing() {
  const fixture = createFixture("bridge-model-missing")
  const result = await runWorker({
    payload: buildWorkerPayload({ outputFileName: "bridge-model-missing.png" }),
    env: {
      AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: fixture.outputDirectory,
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND: process.execPath,
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON: JSON.stringify([
        COMMAND_BRIDGE_PATH,
      ]),
      AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS: "10000",
      AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND: "",
    },
  })
  const stderr = parseJson(result.stderr)

  assert.equal(result.exitCode, 1)
  assert.equal(stderr.status, "real_image_command_bridge_model_command_missing")
  assert.equal(stderr.canShowToPlayer, false)

  printCheck("worker rejects bridge model command missing")
}

function buildWorkerBridgeEnv(input) {
  return {
    AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: input.fixture.outputDirectory,
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND: process.execPath,
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON: JSON.stringify([
      COMMAND_BRIDGE_PATH,
    ]),
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS: "10000",
    AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND: process.execPath,
    AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON: JSON.stringify([input.modelCommand]),
    AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS: "10000",
  }
}

function buildWorkerPayload(input) {
  return {
    outputFileName: input.outputFileName,
    imageFormat: "png",
    width: 1536,
    height: 1024,
    promptPackage: {
      packageId: "worker-command-bridge-test-prompt-package",
      positivePrompt: {
        zh: "明亮治愈的俯视像素世界",
        en: "bright healing top-down pixel world",
      },
      negativePrompt: {
        zh: "禁止占位图、SVG、HTML、JSON、UI 卡片、水印",
        en: "no placeholder, svg, html, json, ui card, watermark",
      },
      sourceFactIds: ["worker-command-bridge-test-fact"],
      canShowToPlayer: false,
    },
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
      tags: ["worker_command_bridge_test"],
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
      minimumWidth: 1536,
      minimumHeight: 1024,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPassVisualJudge: true,
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
    worldFactMetadata: {
      sourceFactIds: ["worker-command-bridge-test-fact"],
      canShowToPlayer: false,
    },
    audit: {
      requestId: "worker-command-bridge-test-request",
    },
    constraints: {
      mustWriteOutputFile: true,
      mustReturnStdoutJson: true,
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
  }
}

function buildRealModelCommandSource(input) {
  return `
import fs from "node:fs"
import path from "node:path"

let text = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { text += chunk })
process.stdin.on("end", () => {
  const request = JSON.parse(text)
  const imageFileName = ${input.mismatchOutputFileName ? `"mismatch.png"` : `request.outputFileName`}
  const filePath = path.join(process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR, imageFileName)
  fs.writeFileSync(filePath, Buffer.from(${JSON.stringify(
    createMinimalPngBuffer({ width: 1536, height: 1024 }).toString("base64")
  )}, "base64"))
  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName,
    imageFormat: request.imageFormat,
    width: request.width,
    height: request.height,
    license: "self_owned",
    originalityConfirmed: true
  }))
})
`
}

function createMinimalPngBuffer(input) {
  const buffer = Buffer.alloc(33)
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0)
  buffer.writeUInt32BE(13, 8)
  buffer.write("IHDR", 12, "ascii")
  buffer.writeUInt32BE(input.width, 16)
  buffer.writeUInt32BE(input.height, 20)
  buffer[24] = 8
  buffer[25] = 2
  buffer[26] = 0
  buffer[27] = 0
  buffer[28] = 0
  buffer.writeUInt32BE(0, 29)
  return buffer
}

function createFixture(name) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), `ai-pet-world-worker-bridge-${name}-`)
  )
  const outputDirectory = path.join(root, "generated")
  fs.mkdirSync(outputDirectory, { recursive: true })

  return { root, outputDirectory }
}

function createModelCommandFile(fixture, source) {
  const filePath = path.join(fixture.root, "real-model-command.mjs")
  fs.writeFileSync(filePath, source, "utf8")
  return filePath
}

async function runWorker(input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER_PATH], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...input.env,
      },
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode, signal, stdout, stderr })
    })
    child.stdin.end(JSON.stringify(input.payload))
  })
}

function parseJson(text) {
  return JSON.parse(text.trim())
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
