import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  readRealImageModelWorkerHealth,
  readRealImageModelWorkerConfig,
} from "../services/local-image-model/real-image-model-worker.mjs"

const WORKER_PATH = path.resolve(
  "services",
  "local-image-model",
  "real-image-model-worker.mjs"
)

await main()

async function main() {
  printTitle("AI-PET-WORLD real image model worker test")

  testWorkerHealthBlocksWithoutInferenceCommand()
  testWorkerHealthReadyWithInferenceCommand()
  await testWorkerBlocksWithoutInferenceCommand()
  await testWorkerRejectsInvalidInferenceStdout()
  await testWorkerRejectsMissingOutputFile()
  await testWorkerAcceptsVerifiedPngOutput()
  await testWorkerRejectsBitmapSizeMismatch()

  console.log("")
  console.log("RESULT: real image model worker test passed.")
}

function testWorkerHealthBlocksWithoutInferenceCommand() {
  const fixture = createFixture("health-missing-command")
  const config = readRealImageModelWorkerConfig({
    outputDirectory: fixture.outputDirectory,
  })
  const health = readRealImageModelWorkerHealth({
    outputDirectory: fixture.outputDirectory,
  })

  assert.equal(config.command, "")
  assert.equal(config.argsValid, true)
  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_model_worker_inference_command_missing")
  assert.equal(health.canShowToPlayer, false)

  printCheck("worker health blocks without inference command")
}

function testWorkerHealthReadyWithInferenceCommand() {
  const fixture = createFixture("health-ready")
  const inference = createInferenceFile(fixture, `process.stdout.write("{}")\n`)
  const health = readRealImageModelWorkerHealth({
    command: process.execPath,
    argsJson: JSON.stringify([inference]),
    outputDirectory: fixture.outputDirectory,
  })

  assert.equal(health.ok, true)
  assert.equal(health.status, "real_image_model_worker_ready")
  assert.equal(health.inferenceCommandConfigured, true)
  assert.equal(health.inferenceArgsValid, true)
  assert.equal(health.outputDirectoryConfigured, true)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("worker health ready with inference command")
}

async function testWorkerBlocksWithoutInferenceCommand() {
  const fixture = createFixture("missing-command")
  const result = await runWorker({
    payload: buildPayload({ outputFileName: "missing-command.png" }),
    env: {
      AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: fixture.outputDirectory,
    },
  })

  assert.equal(result.exitCode, 1)
  assert.equal(
    parseJson(result.stderr).status,
    "real_image_model_worker_inference_command_missing"
  )

  printCheck("worker blocks without inference command")
}

async function testWorkerRejectsInvalidInferenceStdout() {
  const fixture = createFixture("invalid-stdout")
  const inference = createInferenceFile(
    fixture,
    `process.stdout.write("not-json")\n`
  )
  const result = await runWorker({
    payload: buildPayload({ outputFileName: "invalid-stdout.png" }),
    env: buildInferenceEnv({ fixture, inference }),
  })

  assert.equal(result.exitCode, 1)
  assert.equal(parseJson(result.stderr).status, "real_image_model_worker_stdout_json_invalid")

  printCheck("worker rejects invalid inference stdout")
}

async function testWorkerRejectsMissingOutputFile() {
  const fixture = createFixture("missing-output")
  const inference = createInferenceFile(
    fixture,
    `
let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
  const payload = JSON.parse(input)
  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName: payload.outputFileName,
    imageFormat: "png",
    width: 512,
    height: 512,
    license: "self_owned",
    originalityConfirmed: true
  }))
})
`
  )
  const result = await runWorker({
    payload: buildPayload({ outputFileName: "missing-output.png" }),
    env: buildInferenceEnv({ fixture, inference }),
  })

  assert.equal(result.exitCode, 1)
  assert.equal(parseJson(result.stderr).status, "real_image_model_worker_output_file_missing")

  printCheck("worker rejects missing output file")
}

async function testWorkerAcceptsVerifiedPngOutput() {
  const fixture = createFixture("verified-png")
  const inference = createInferenceFile(fixture, buildPngInferenceSource({ width: 512, height: 512 }))
  const result = await runWorker({
    payload: buildPayload({ outputFileName: "verified-png.png" }),
    env: buildInferenceEnv({ fixture, inference }),
  })
  const stdout = parseJson(result.stdout)

  assert.equal(result.exitCode, 0)
  assert.equal(stdout.ok, true)
  assert.equal(stdout.status, "real_image_generated")
  assert.equal(stdout.imageFileName, "verified-png.png")
  assert.equal(stdout.imageFormat, "png")
  assert.equal(stdout.width, 512)
  assert.equal(stdout.height, 512)
  assert.equal(stdout.license, "self_owned")
  assert.equal(stdout.originalityConfirmed, true)
  assert.equal(stdout.canShowToPlayer, false)

  printCheck("worker accepts verified png output")
}

async function testWorkerRejectsBitmapSizeMismatch() {
  const fixture = createFixture("size-mismatch")
  const inference = createInferenceFile(fixture, buildPngInferenceSource({ width: 512, height: 512 }))
  const result = await runWorker({
    payload: buildPayload({ outputFileName: "size-mismatch.png" }),
    env: buildInferenceEnv({ fixture, inference, declaredWidth: 768, declaredHeight: 512 }),
  })

  assert.equal(result.exitCode, 1)
  assert.equal(parseJson(result.stderr).status, "real_image_model_worker_bitmap_size_mismatch")

  printCheck("worker rejects bitmap size mismatch")
}

function buildPayload(input) {
  return {
    outputFileName: input.outputFileName,
    promptPackage: {
      packageId: "worker-test-prompt-package",
      positivePrompt: "bright healing top-down pixel art world",
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
  }
}

function buildInferenceEnv(input) {
  return {
    AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: input.fixture.outputDirectory,
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND: process.execPath,
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON: JSON.stringify([input.inference]),
    AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS: "10000",
    AI_PET_WORLD_TEST_DECLARED_WIDTH: String(input.declaredWidth ?? 512),
    AI_PET_WORLD_TEST_DECLARED_HEIGHT: String(input.declaredHeight ?? 512),
  }
}

function createFixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-pet-world-worker-${name}-`))
  const outputDirectory = path.join(root, "generated")
  fs.mkdirSync(outputDirectory, { recursive: true })

  return { root, outputDirectory }
}

function createInferenceFile(fixture, source) {
  const filePath = path.join(fixture.root, "inference.mjs")
  fs.writeFileSync(filePath, source, "utf8")
  return filePath
}

function buildPngInferenceSource(input) {
  return `
import fs from "node:fs"
import path from "node:path"

let text = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { text += chunk })
process.stdin.on("end", () => {
  const payload = JSON.parse(text)
  const filePath = path.join(process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR, payload.outputFileName)
  fs.writeFileSync(filePath, Buffer.from(${JSON.stringify(
    createMinimalPngBuffer(input).toString("base64")
  )}, "base64"))
  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName: payload.outputFileName,
    imageFormat: "png",
    width: Number(process.env.AI_PET_WORLD_TEST_DECLARED_WIDTH),
    height: Number(process.env.AI_PET_WORLD_TEST_DECLARED_HEIGHT),
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
