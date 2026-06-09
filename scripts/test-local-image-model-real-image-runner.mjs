import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  generateRealImageWithAdapter,
  readRealImageGenerationAdapterHealth,
  runRealImageGenerationAdapterDryRun,
} from "../services/local-image-model/adapter.mjs"
import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"
import {
  generateRealImageWithRunner,
  readRealImageRunnerHealth,
  runRealImageRunnerDryRun,
} from "../services/local-image-model/real-image-runner.mjs"

main()

async function main() {
  printTitle("AI-PET-WORLD real image runner boundary test")

  testRunnerHealthDefaultBlocked()
  await testRunnerDryRunDefaultBlocked()
  await testRunnerGenerateDefaultBlocked()
  await testRunnerGenerateReturnsSixFieldsWhenExecutorSucceeds()
  testAdapterHealthExposesRunnerBoundary()
  await testAdapterDryRunExposesRunnerBoundary()
  await testAdapterGenerateReturnsSixFieldsWhenRunnerSucceeds()

  console.log("")
  console.log("RESULT: real image runner boundary test passed.")
}

function testRunnerHealthDefaultBlocked() {
  const health = readRealImageRunnerHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_runner_blocked")
  assert.equal(health.runnerConnected, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner health default blocked")
}

async function testRunnerDryRunDefaultBlocked() {
  const dryRun = await runRealImageRunnerDryRun({
    requestBody: buildRequestBody(),
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_runner_blocked")
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("runner dry-run default blocked")
}

async function testRunnerGenerateDefaultBlocked() {
  const generate = await generateRealImageWithRunner({
    requestBody: buildRequestBody(),
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_generation_runner_blocked")
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("runner generate default blocked")
}

async function testRunnerGenerateReturnsSixFieldsWhenExecutorSucceeds() {
  const fixture = createFixture("runner-generate-six-fields")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const generate = await generateRealImageWithRunner(
    buildReadyRunnerInput({
      fixture,
      worker,
      requestId: "runner-generate-six-fields",
    })
  )

  assert.equal(generate.ok, true)
  assert.equal(generate.status, "real_image_generation_runner_generate_passed")
  assert.equal(generate.imageUrl.endsWith(".png"), true)
  assert.equal(generate.imageFormat, "png")
  assert.equal(generate.width, 1024)
  assert.equal(generate.height, 1024)
  assert.equal(generate.license, "self_owned")
  assert.equal(generate.originalityConfirmed, true)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("runner generate returns six fields when executor succeeds")
}

function testAdapterHealthExposesRunnerBoundary() {
  const health = readRealImageGenerationAdapterHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_adapter_blocked")
  assert.equal(health.adapterConnected, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)
  assert.equal(health.runner.status, "real_image_generation_runner_blocked")

  printCheck("adapter health exposes runner boundary")
}

async function testAdapterDryRunExposesRunnerBoundary() {
  const dryRun = await runRealImageGenerationAdapterDryRun({
    requestBody: buildRequestBody(),
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_adapter_blocked")
  assert.equal(dryRun.runner.status, "real_image_generation_runner_blocked")
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("adapter dry-run exposes runner boundary")
}

async function testAdapterGenerateReturnsSixFieldsWhenRunnerSucceeds() {
  const fixture = createFixture("adapter-generate-six-fields")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const generate = await generateRealImageWithAdapter(
    buildReadyRunnerInput({
      fixture,
      worker,
      requestId: "adapter-generate-six-fields",
    })
  )

  assert.equal(generate.ok, true)
  assert.equal(generate.status, "real_image_generation_adapter_generate_passed")
  assert.equal(generate.imageUrl.endsWith(".png"), true)
  assert.equal(generate.imageFormat, "png")
  assert.equal(generate.width, 1024)
  assert.equal(generate.height, 1024)
  assert.equal(generate.license, "self_owned")
  assert.equal(generate.originalityConfirmed, true)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("adapter generate returns six fields when runner succeeds")
}

function buildReadyRunnerInput(input) {
  return {
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([input.worker]),
    requestAudit: {
      requestId: input.requestId,
    },
    realModelReadiness: {
      enabled: true,
      assetDirectory: input.fixture.root,
      manifestPath: input.fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
    outputStorage: {
      outputDirectory: input.fixture.outputDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    requestBody: buildRequestBody(),
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  }
}

function createFixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-pet-world-${name}-`))
  const outputDirectory = path.join(root, "generated")
  const manifestPath = path.join(root, "model-manifest.json")
  fs.mkdirSync(outputDirectory, { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(buildValidManifest(), null, 2), "utf8")

  return {
    root,
    outputDirectory,
    manifestPath,
  }
}

function createWorkerFile(fixture, source) {
  const worker = path.join(fixture.root, "worker.mjs")
  fs.writeFileSync(worker, source, "utf8")
  return worker
}

function buildSuccessfulWorkerSource() {
  return `
import fs from "node:fs"
import path from "node:path"

let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  input += chunk
})
process.stdin.on("end", () => {
  const payload = JSON.parse(input)
  const outputDirectory = process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR
  fs.mkdirSync(outputDirectory, { recursive: true })
  fs.writeFileSync(path.join(outputDirectory, payload.outputFileName), "test-bitmap-bytes")
  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName: payload.outputFileName,
    imageFormat: "png",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true
  }))
})
`
}

function buildRequestBody() {
  return {
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
    },
    promptPackage: {
      packageId: "runner-boundary-test-prompt-package",
      worldId: "runner-boundary-test-world",
      tick: 1,
      canShowToPlayer: false,
    },
    controlSketch: {
      controlSketchId: "runner-boundary-test-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
    },
    responseContract: {
      requiredFields: REQUIRED_RESPONSE_FIELDS,
      allowedImageFormats: ["png", "webp", "jpg"],
      allowedLicenses: ["self_owned", "cc0", "commercial_license"],
      minimumWidth: 512,
      minimumHeight: 512,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPersistOnlyAsHiddenCandidate: true,
      mustPassVisualJudge: true,
    },
    visualFixHints: [],
    metadata: {
      worldId: "runner-boundary-test-world",
      tick: 1,
      promptPackageId: "runner-boundary-test-prompt-package",
      sourceFactIds: ["runner-boundary-test-world"],
      canShowToPlayer: false,
      cannotApprove: true,
    },
    imageFormat: "png",
    width: 1536,
    height: 1024,
  }
}

function buildValidManifest() {
  return {
    schemaVersion: REAL_MODEL_MANIFEST_SCHEMA_VERSION,
    modelName: "ai-pet-world-runner-boundary-test-model",
    modelVersion: "0.0.1",
    license: "self_owned",
    dataSourceType: "self_owned",
    commercialUseAllowed: true,
    originalityConfirmed: true,
    unlicensedThirdPartyArtworkAllowed: false,
    outputCapabilities: {
      supportedImageFormats: ["png", "webp", "jpg"],
      minimumWidth: 512,
      minimumHeight: 512,
      canReturnPlaceholder: false,
      canReturnSvg: false,
      canReturnHtml: false,
      canReturnJsonDebugImage: false,
      canReturnProgrammaticRenderer: false,
    },
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
