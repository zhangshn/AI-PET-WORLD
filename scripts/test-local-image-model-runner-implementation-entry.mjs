import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"
import {
  generateRealImageWithRunnerImplementation,
  readRealImageRunnerImplementationHealth,
  runRealImageRunnerImplementationDryRun,
} from "../services/local-image-model/real-image-runner-implementation.mjs"

main()

async function main() {
  printTitle("AI-PET-WORLD runner implementation entry test")

  testImplementationHealthDefaultBlocked()
  await testImplementationDryRunDefaultBlocked()
  await testImplementationGenerateDefaultBlocked()
  testImplementationHealthReadyWithExecutorConfig()
  await testImplementationDryRunReadyWithExecutorConfig()
  await testImplementationGenerateReturnsSixFieldsWhenExecutorSucceeds()

  console.log("")
  console.log("RESULT: runner implementation entry test passed.")
}

function testImplementationHealthDefaultBlocked() {
  const health = readRealImageRunnerImplementationHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_runner_implementation_blocked")
  assert.equal(health.implementationConnected, false)
  assert.equal(health.executorStdinPayloadConnected, true)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)
  assert.ok(health.tags.includes("not_player_visible"))

  printCheck("implementation health default blocked")
}

async function testImplementationDryRunDefaultBlocked() {
  const dryRun = await runRealImageRunnerImplementationDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_runner_implementation_blocked")
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("implementation dry-run default blocked")
}

async function testImplementationGenerateDefaultBlocked() {
  const generate = await generateRealImageWithRunnerImplementation()

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_runner_implementation_blocked")
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("implementation generate default blocked")
}

function testImplementationHealthReadyWithExecutorConfig() {
  const fixture = createFixture("implementation-health-ready")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const health = readRealImageRunnerImplementationHealth(
    buildReadyImplementationInput({
      fixture,
      worker,
      requestId: "implementation-health-ready",
    })
  )

  assert.equal(health.ok, true)
  assert.equal(health.status, "real_image_runner_implementation_ready")
  assert.equal(health.implementationConnected, true)
  assert.equal(health.executorShell.ok, true)
  assert.equal(health.canShowToPlayer, false)

  printCheck("implementation health ready with executor config")
}

async function testImplementationDryRunReadyWithExecutorConfig() {
  const fixture = createFixture("implementation-dry-run-ready")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const dryRun = await runRealImageRunnerImplementationDryRun(
    buildReadyImplementationInput({
      fixture,
      worker,
      requestId: "implementation-dry-run-ready",
    })
  )

  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.status, "real_image_runner_implementation_dry_run_passed")
  assert.equal(dryRun.willReturnImageUrl, true)
  assert.equal(dryRun.willReturnOriginalityConfirmed, true)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("implementation dry-run ready with executor config")
}

async function testImplementationGenerateReturnsSixFieldsWhenExecutorSucceeds() {
  const fixture = createFixture("implementation-generate-six-fields")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const generate = await generateRealImageWithRunnerImplementation(
    buildReadyImplementationInput({
      fixture,
      worker,
      requestId: "implementation-generate-six-fields",
    })
  )

  assert.equal(generate.ok, true)
  assert.equal(generate.status, "real_image_runner_implementation_generate_passed")
  assert.equal(generate.imageUrl.endsWith(".png"), true)
  assert.equal(generate.imageFormat, "png")
  assert.equal(generate.width, 1024)
  assert.equal(generate.height, 1024)
  assert.equal(generate.license, "self_owned")
  assert.equal(generate.originalityConfirmed, true)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(generate.executorShell.ok, true)

  printCheck("implementation generate returns six fields when executor succeeds")
}

function buildReadyImplementationInput(input) {
  return {
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([input.worker]),
    requestAudit: {
      requestId: input.requestId,
    },
    readiness: createReadyReadinessGate(),
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
  fs.mkdirSync(outputDirectory, { recursive: true })

  return {
    root,
    outputDirectory,
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

function createReadyReadinessGate() {
  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: true,
    manifestConfigured: true,
    license: "self_owned",
    originalityConfirmed: true,
    manifest: {
      ok: true,
      status: "real_model_manifest_valid",
      ...buildValidManifest(),
      canShowToPlayer: false,
    },
    canRunInference: false,
    canShowToPlayer: false,
    tags: ["real_image_model_readiness", "assets_ready", "manifest_valid"],
  }
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
      packageId: "runner-implementation-test-prompt-package",
      worldId: "runner-implementation-test-world",
      tick: 1,
      canShowToPlayer: false,
    },
    controlSketch: {
      controlSketchId: "runner-implementation-test-control-sketch",
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
      worldId: "runner-implementation-test-world",
      tick: 1,
      promptPackageId: "runner-implementation-test-prompt-package",
      sourceFactIds: ["runner-implementation-test-world"],
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
    modelName: "ai-pet-world-runner-implementation-test-model",
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
