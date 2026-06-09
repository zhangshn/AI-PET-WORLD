import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  readRealImageGenerationAdapterHealth,
  runRealImageGenerationAdapterDryRun,
} from "../services/local-image-model/adapter.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"
import { readRealImageModelReadiness } from "../services/local-image-model/real-model-readiness.mjs"

main()

async function main() {
  printTitle("AI-PET-WORLD real image model readiness test")

  testDefaultReadinessBlocked()
  testEnabledWithoutAssetDirectoryBlocked()
  testInvalidLicenseBlocked()
  testOriginalityNotConfirmedBlocked()
  testAssetsReadyButRunnerStillMissing()
  testAdapterStillBlocksWhenReadinessReady()
  await testAdapterDryRunStillBlocksWhenReadinessReady()

  console.log("")
  console.log("RESULT: real image model readiness test passed.")
}

function testDefaultReadinessBlocked() {
  const readiness = readRealImageModelReadiness()

  assert.equal(readiness.ok, false)
  assert.equal(readiness.status, "real_image_model_disabled")
  assert.equal(readiness.canRunInference, false)
  assert.equal(readiness.adapterConnected, false)
  assert.equal(readiness.canShowToPlayer, false)
  assert.ok(readiness.tags.includes("fake_image_forbidden"))

  printCheck("default readiness blocked")
}

function testEnabledWithoutAssetDirectoryBlocked() {
  const readiness = readRealImageModelReadiness({
    enabled: true,
  })

  assert.equal(readiness.ok, false)
  assert.equal(readiness.status, "real_image_model_asset_directory_missing")
  assert.equal(readiness.assetDirectoryConfigured, false)
  assert.equal(readiness.canRunInference, false)

  printCheck("enabled without asset directory blocked")
}

function testInvalidLicenseBlocked() {
  const fixture = createReadinessFixture()

  const readiness = readRealImageModelReadiness({
    enabled: true,
    assetDirectory: fixture.assetDirectory,
    manifestPath: fixture.manifestPath,
    license: "unknown_license",
    originalityConfirmed: true,
  })

  assert.equal(readiness.ok, false)
  assert.equal(readiness.status, "real_image_model_license_invalid")
  assert.equal(readiness.canRunInference, false)

  printCheck("invalid license blocked")
}

function testOriginalityNotConfirmedBlocked() {
  const fixture = createReadinessFixture()

  const readiness = readRealImageModelReadiness({
    enabled: true,
    assetDirectory: fixture.assetDirectory,
    manifestPath: fixture.manifestPath,
    license: "self_owned",
    originalityConfirmed: false,
  })

  assert.equal(readiness.ok, false)
  assert.equal(readiness.status, "real_image_model_originality_not_confirmed")
  assert.equal(readiness.originalityConfirmed, false)
  assert.equal(readiness.canRunInference, false)

  printCheck("originality not confirmed blocked")
}

function testAssetsReadyButRunnerStillMissing() {
  const fixture = createReadinessFixture()

  const readiness = readRealImageModelReadiness({
    enabled: true,
    assetDirectory: fixture.assetDirectory,
    manifestPath: fixture.manifestPath,
    license: "self_owned",
    originalityConfirmed: true,
  })

  assert.equal(readiness.ok, true)
  assert.equal(readiness.status, "real_image_model_assets_ready")
  assert.equal(readiness.manifest.ok, true)
  assert.equal(readiness.manifest.status, "real_model_manifest_valid")
  assert.equal(readiness.canRunInference, false)
  assert.equal(readiness.adapterConnected, false)
  assert.equal(readiness.canShowToPlayer, false)
  assert.ok(readiness.tags.includes("runner_not_connected"))

  printCheck("assets ready but runner still missing")
}

function testAdapterStillBlocksWhenReadinessReady() {
  const fixture = createReadinessFixture()

  const adapterHealth = readRealImageGenerationAdapterHealth({
    realModelReadiness: {
      enabled: true,
      assetDirectory: fixture.assetDirectory,
      manifestPath: fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(adapterHealth.ok, false)
  assert.equal(adapterHealth.status, "real_image_generation_adapter_not_connected")
  assert.equal(adapterHealth.adapterConnected, false)
  assert.equal(adapterHealth.readiness.ok, true)
  assert.equal(adapterHealth.readiness.status, "real_image_model_assets_ready")
  assert.equal(adapterHealth.readiness.manifest.ok, true)
  assert.equal(adapterHealth.canGenerateRealBitmap, false)
  assert.equal(adapterHealth.canShowToPlayer, false)

  printCheck("adapter still blocks when readiness ready")
}

async function testAdapterDryRunStillBlocksWhenReadinessReady() {
  const fixture = createReadinessFixture()

  const dryRun = await runRealImageGenerationAdapterDryRun({
    realModelReadiness: {
      enabled: true,
      assetDirectory: fixture.assetDirectory,
      manifestPath: fixture.manifestPath,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(dryRun.ok, false)
  assert.equal(dryRun.status, "real_image_generation_adapter_not_connected")
  assert.equal(dryRun.readiness.ok, true)
  assert.equal(dryRun.readiness.manifest.ok, true)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.willReturnOriginalityConfirmed, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("adapter dry-run still blocks when readiness ready")
}

function createReadinessFixture() {
  const assetDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-real-model-")
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
    modelName: "ai-pet-world-readiness-test-model",
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