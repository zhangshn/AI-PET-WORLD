import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import { REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION } from "../services/local-image-model/real-image-execution-payload.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"
import {
  generateRealImageWithRunner,
  readRealImageRunnerHealth,
  runRealImageRunnerDryRun,
} from "../services/local-image-model/real-image-runner.mjs"
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
  await testImplementationGenerateNeverReturnsFakeImage()
  testImplementationBuildsExecutorStdinPayload()
  await testImplementationDryRunBuildsExecutorStdinPayload()
  await testImplementationGenerateBuildsExecutorStdinPayloadButDoesNotExecute()
  testRunnerHealthExposesImplementationEntry()
  testRunnerHealthReadinessReadyStillBlocksImplementation()
  await testRunnerDryRunExposesImplementationEntry()
  await testRunnerGenerateExposesImplementationEntry()

  console.log("")
  console.log("RESULT: runner implementation entry test passed.")
}

function testImplementationHealthDefaultBlocked() {
  const health = readRealImageRunnerImplementationHealth()

  assert.equal(health.ok, false)
  assert.equal(
    health.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(health.implementationConnected, false)
  assert.equal(health.executorStdinPayloadConnected, true)
  assert.equal(health.canRunInference, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canWriteOutputFile, false)
  assert.equal(health.canShowToPlayer, false)
  assert.equal(health.inputContract.mustBuildExecutorStdinPayload, true)
  assert.equal(health.executorStdinPayload.canExecuteCommand, false)
  assert.equal(health.executorStdinPayload.willExecuteCommand, false)
  assert.equal(health.executorStdinPayload.willGenerateImage, false)
  assert.ok(health.tags.includes("executor_stdin_payload_ready"))
  assert.ok(health.tags.includes("fake_image_forbidden"))

  printCheck("implementation health default blocked")
}

async function testImplementationDryRunDefaultBlocked() {
  const dryRun = await runRealImageRunnerImplementationDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(
    dryRun.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(dryRun.implementationConnected, false)
  assert.equal(dryRun.executorStdinPayloadConnected, true)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnImageFormat, false)
  assert.equal(dryRun.willReturnWidth, false)
  assert.equal(dryRun.willReturnHeight, false)
  assert.equal(dryRun.willReturnLicense, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.willWriteOutputFile, false)
  assert.equal(dryRun.willExecuteCommand, false)
  assert.equal(dryRun.canShowToPlayer, false)
  assert.equal(dryRun.executorStdinPayload.canExecuteCommand, false)
  assert.equal(dryRun.executorStdinPayload.willExecuteCommand, false)
  assert.equal(dryRun.executorStdinPayload.willGenerateImage, false)

  printCheck("implementation dry-run default blocked")
}

async function testImplementationGenerateNeverReturnsFakeImage() {
  const generate = await generateRealImageWithRunnerImplementation()

  assert.equal(generate.ok, false)
  assert.equal(
    generate.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(generate.implementationConnected, false)
  assert.equal(generate.executorStdinPayloadConnected, true)
  assert.equal(generate.canGenerateRealBitmap, false)
  assert.equal(generate.canWriteOutputFile, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.equal(Object.hasOwn(generate, "imageFormat"), false)
  assert.equal(Object.hasOwn(generate, "width"), false)
  assert.equal(Object.hasOwn(generate, "height"), false)
  assert.equal(Object.hasOwn(generate, "license"), false)
  assert.equal(Object.hasOwn(generate, "originalityConfirmed"), false)
  assert.equal(generate.executorStdinPayload.canExecuteCommand, false)
  assert.equal(generate.executorStdinPayload.willExecuteCommand, false)
  assert.equal(generate.executorStdinPayload.willGenerateImage, false)
  assert.ok(generate.tags.includes("fake_image_forbidden"))

  printCheck("implementation generate never returns fake image")
}

function testImplementationBuildsExecutorStdinPayload() {
  const fixture = createReadinessFixture()
  const health = readRealImageRunnerImplementationHealth({
    requestAudit: {
      requestId: "runner-implementation-payload-health",
    },
    readiness: createReadyReadinessGate(),
    outputStorage: {
      outputDirectory: fixture.assetDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    requestBody: buildRequestBody(),
  })

  assert.equal(health.ok, false)
  assert.equal(health.executorStdinPayloadConnected, true)
  assert.equal(health.executorStdinPayload.ok, true)
  assert.equal(
    health.executorStdinPayload.payload.schemaVersion,
    REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION
  )
  assert.equal(
    health.executorStdinPayload.payload.requestId,
    "runner-implementation-payload-health"
  )
  assert.equal(
    health.executorStdinPayload.payload.outputFileName,
    "runner-implementation-payload-health-executor-stdin.png"
  )
  assert.equal(health.executorStdinPayload.payload.canShowToPlayer, false)
  assert.equal(
    health.executorStdinPayload.payload.worldFactMetadata.locked,
    true
  )
  assert.equal(
    health.executorStdinPayload.payload.worldFactMetadata
      .mustNotRewriteWorldFacts,
    true
  )
  assert.equal(
    health.executorStdinPayload.payload.constraints
      .mustPersistOnlyAsHiddenCandidate,
    true
  )
  assert.equal(
    health.executorStdinPayload.payload.constraints.mustPassVisualJudge,
    true
  )
  assert.equal(
    health.executorStdinPayload.payload.constraints
      .mustCreateApprovedFrameBeforePlayerView,
    true
  )
  assert.equal(health.executorStdinPayload.canExecuteCommand, false)
  assert.equal(health.executorStdinPayload.willExecuteCommand, false)
  assert.equal(health.executorStdinPayload.willGenerateImage, false)

  printCheck("implementation builds executor stdin payload")
}

async function testImplementationDryRunBuildsExecutorStdinPayload() {
  const fixture = createReadinessFixture()
  const dryRun = await runRealImageRunnerImplementationDryRun({
    requestAudit: {
      requestId: "runner-implementation-payload-dry-run",
    },
    readiness: createReadyReadinessGate(),
    outputStorage: {
      outputDirectory: fixture.assetDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    requestBody: buildRequestBody(),
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.executorStdinPayloadConnected, true)
  assert.equal(dryRun.executorStdinPayload.ok, true)
  assert.equal(dryRun.executorStdinPayload.payload.canShowToPlayer, false)
  assert.equal(dryRun.executorStdinPayload.willExecuteCommand, false)
  assert.equal(dryRun.executorStdinPayload.willGenerateImage, false)
  assert.equal(dryRun.willExecuteCommand, false)
  assert.equal(dryRun.willWriteOutputFile, false)

  printCheck("implementation dry-run builds executor stdin payload")
}

async function testImplementationGenerateBuildsExecutorStdinPayloadButDoesNotExecute() {
  const fixture = createReadinessFixture()
  const generate = await generateRealImageWithRunnerImplementation({
    requestAudit: {
      requestId: "runner-implementation-payload-generate",
    },
    readiness: createReadyReadinessGate(),
    outputStorage: {
      outputDirectory: fixture.assetDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    requestBody: buildRequestBody(),
  })

  assert.equal(generate.ok, false)
  assert.equal(
    generate.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(generate.executorStdinPayloadConnected, true)
  assert.equal(generate.executorStdinPayload.ok, true)
  assert.equal(generate.executorStdinPayload.payload.canShowToPlayer, false)
  assert.equal(generate.executorStdinPayload.willExecuteCommand, false)
  assert.equal(generate.executorStdinPayload.willGenerateImage, false)
  assert.equal(generate.executorShell.didExecuteCommand, false)
  assert.equal(generate.executorShell.didWriteOutputFile, false)
  assert.equal(generate.executorShell.didReturnStdoutJson, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)

  printCheck("implementation generate builds executor stdin payload but does not execute")
}

function testRunnerHealthExposesImplementationEntry() {
  const health = readRealImageRunnerHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_runner_not_connected")
  assert.equal(health.version, "runner-not-connected-2")
  assert.equal(
    health.implementation.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(health.implementation.implementationConnected, false)
  assert.equal(health.implementation.executorStdinPayloadConnected, true)
  assert.equal(health.implementation.canWriteOutputFile, false)
  assert.equal(health.implementation.executorStdinPayload.canExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner health exposes implementation entry")
}

function testRunnerHealthReadinessReadyStillBlocksImplementation() {
  const fixture = createReadinessFixture()

  const health = readRealImageRunnerHealth({
    realModelReadiness: {
      enabled: true,
      assetDirectory: fixture.assetDirectory,
      manifestPath: fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(health.ok, false)
  assert.equal(health.readiness.ok, true)
  assert.equal(health.readiness.status, "real_image_model_assets_ready")
  assert.equal(health.readiness.manifest.ok, true)
  assert.equal(
    health.implementation.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(health.implementation.canRunInference, false)
  assert.equal(health.implementation.executorStdinPayloadConnected, true)
  assert.equal(health.implementation.executorStdinPayload.canExecuteCommand, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner readiness ready still blocks implementation")
}

async function testRunnerDryRunExposesImplementationEntry() {
  const dryRun = await runRealImageRunnerDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_runner_not_connected")
  assert.equal(
    dryRun.implementation.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(dryRun.implementation.executorStdinPayloadConnected, true)
  assert.equal(dryRun.implementation.executorStdinPayload.canExecuteCommand, false)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("runner dry-run exposes implementation entry")
}

async function testRunnerGenerateExposesImplementationEntry() {
  const generate = await generateRealImageWithRunner()

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_generation_runner_not_connected")
  assert.equal(
    generate.implementation.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(generate.implementation.executorStdinPayloadConnected, true)
  assert.equal(generate.canGenerateRealBitmap, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.ok(generate.tags.includes("fake_image_forbidden"))

  printCheck("runner generate exposes implementation entry")
}

function createReadinessFixture() {
  const assetDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-runner-implementation-")
  )
  const manifestPath = path.join(assetDirectory, "model-manifest.json")

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(buildValidManifest(), null, 2),
    "utf8"
  )

  return {
    assetDirectory,
    manifestPath,
  }
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
    tags: [
      "real_image_model_readiness",
      "assets_ready",
      "manifest_valid",
      "runner_not_connected",
      "does_not_generate",
      "not_player_visible",
    ],
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
      summary:
        "Runner implementation payload integration test. This is not an image and must not be displayed.",
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
      sourceFactIds: [
        "runner-implementation-test-world",
        "runner-implementation-test-fact",
      ],
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