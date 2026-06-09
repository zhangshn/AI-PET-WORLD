import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

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
  assert.equal(health.status, "real_image_runner_implementation_not_connected")
  assert.equal(health.implementationConnected, false)
  assert.equal(health.canRunInference, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canWriteOutputFile, false)
  assert.equal(health.canShowToPlayer, false)
  assert.ok(health.tags.includes("fake_image_forbidden"))

  printCheck("implementation health default blocked")
}

async function testImplementationDryRunDefaultBlocked() {
  const dryRun = await runRealImageRunnerImplementationDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_runner_implementation_not_connected")
  assert.equal(dryRun.implementationConnected, false)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnImageFormat, false)
  assert.equal(dryRun.willReturnWidth, false)
  assert.equal(dryRun.willReturnHeight, false)
  assert.equal(dryRun.willReturnLicense, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.willWriteOutputFile, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("implementation dry-run default blocked")
}

async function testImplementationGenerateNeverReturnsFakeImage() {
  const generate = await generateRealImageWithRunnerImplementation()

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_runner_implementation_not_connected")
  assert.equal(generate.implementationConnected, false)
  assert.equal(generate.canGenerateRealBitmap, false)
  assert.equal(generate.canWriteOutputFile, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)
  assert.equal(Object.hasOwn(generate, "imageFormat"), false)
  assert.equal(Object.hasOwn(generate, "width"), false)
  assert.equal(Object.hasOwn(generate, "height"), false)
  assert.equal(Object.hasOwn(generate, "license"), false)
  assert.equal(Object.hasOwn(generate, "originalityConfirmed"), false)
  assert.ok(generate.tags.includes("fake_image_forbidden"))

  printCheck("implementation generate never returns fake image")
}

function testRunnerHealthExposesImplementationEntry() {
  const health = readRealImageRunnerHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_runner_not_connected")
  assert.equal(health.version, "runner-not-connected-2")
  assert.equal(health.implementation.status, "real_image_runner_implementation_not_connected")
  assert.equal(health.implementation.implementationConnected, false)
  assert.equal(health.implementation.canWriteOutputFile, false)
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
  assert.equal(health.implementation.status, "real_image_runner_implementation_not_connected")
  assert.equal(health.implementation.canRunInference, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("runner readiness ready still blocks implementation")
}

async function testRunnerDryRunExposesImplementationEntry() {
  const dryRun = await runRealImageRunnerDryRun()

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_runner_not_connected")
  assert.equal(dryRun.implementation.status, "real_image_runner_implementation_not_connected")
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("runner dry-run exposes implementation entry")
}

async function testRunnerGenerateExposesImplementationEntry() {
  const generate = await generateRealImageWithRunner()

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_generation_runner_not_connected")
  assert.equal(generate.implementation.status, "real_image_runner_implementation_not_connected")
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