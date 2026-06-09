import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  generateRealImageWithAdapter,
  readRealImageGenerationAdapterHealth,
  runRealImageGenerationAdapterDryRun,
} from "../services/local-image-model/adapter.mjs"
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
  testRunnerHealthReadinessReadyStillBlocked()
  await testRunnerDryRunReadinessReadyStillBlocked()
  await testRunnerGenerateNeverReturnsFakeImage()
  testAdapterHealthExposesRunnerBoundary()
  await testAdapterDryRunExposesRunnerBoundary()
  await testAdapterGenerateExposesRunnerBoundary()

  console.log("")
  console.log("RESULT: real image runner boundary test passed.")
}

function testRunnerHealthDefaultBlocked() {
  const health = readRealImageRunnerHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_runner_not_connected")
  assert.equal(health.runnerConnected, false)
  assert.equal(health.canRunInference, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)
  assert.equal(health.readiness.status, "real_image_model_disabled")
  assert.ok(health.tags.includes("fake_image_forbidden"))

  printCheck("runner health default blocked")
}

function testRunnerHealthReadinessReadyStillBlocked() {
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
  assert.equal(health.status, "real_image_generation_runner_not_connected")
  assert.equal(health.readiness.ok, true)
  assert.equal(health.readiness.status, "real_image_model_assets_ready")
  assert.equal(health.readiness.manifest.ok, true)
  assert.equal(health.runnerConnected, false)
  assert.equal(health.canRunInference, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner health readiness ready still blocked")
}

async function testRunnerDryRunReadinessReadyStillBlocked() {
  const fixture = createReadinessFixture()

  const dryRun = await runRealImageRunnerDryRun({
    realModelReadiness: {
      enabled: true,
      assetDirectory: fixture.assetDirectory,
      manifestPath: fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_runner_not_connected")
  assert.equal(dryRun.readiness.ok, true)
  assert.equal(dryRun.readiness.manifest.ok, true)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnImageFormat, false)
  assert.equal(dryRun.willReturnWidth, false)
  assert.equal(dryRun.willReturnHeight, false)
  assert.equal(dryRun.willReturnLicense, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.willWriteOutputFile, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("runner dry-run readiness ready still blocked")
}

async function testRunnerGenerateNeverReturnsFakeImage() {
  const fixture = createReadinessFixture()

  const generate = await generateRealImageWithRunner({
    realModelReadiness: {
      enabled: true,
      assetDirectory: fixture.assetDirectory,
      manifestPath: fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_generation_runner_not_connected")
  assert.equal(generate.readiness.ok, true)
  assert.equal(generate.readiness.manifest.ok, true)
  assert.equal(generate.canGenerateRealBitmap, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.equal(Object.hasOwn(generate, "imageFormat"), false)
  assert.equal(Object.hasOwn(generate, "width"), false)
  assert.equal(Object.hasOwn(generate, "height"), false)
  assert.equal(Object.hasOwn(generate, "license"), false)
  assert.equal(Object.hasOwn(generate, "originalityConfirmed"), false)
  assert.ok(generate.tags.includes("fake_image_forbidden"))

  printCheck("runner generate never returns fake image")
}

function testAdapterHealthExposesRunnerBoundary() {
  const health = readRealImageGenerationAdapterHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_adapter_not_connected")
  assert.equal(health.adapterConnected, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)
  assert.equal(health.runner.status, "real_image_generation_runner_not_connected")
  assert.equal(health.runner.runnerConnected, false)
  assert.equal(health.readiness.status, "real_image_model_disabled")

  printCheck("adapter health exposes runner boundary")
}

async function testAdapterDryRunExposesRunnerBoundary() {
  const dryRun = await runRealImageGenerationAdapterDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_adapter_not_connected")
  assert.equal(dryRun.runner.status, "real_image_generation_runner_not_connected")
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("adapter dry-run exposes runner boundary")
}

async function testAdapterGenerateExposesRunnerBoundary() {
  const generate = await generateRealImageWithAdapter()

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_generation_adapter_not_connected")
  assert.equal(generate.runner.status, "real_image_generation_runner_not_connected")
  assert.equal(generate.canGenerateRealBitmap, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.ok(generate.tags.includes("fake_image_forbidden"))

  printCheck("adapter generate exposes runner boundary")
}

function createReadinessFixture() {
  const assetDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-real-runner-")
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