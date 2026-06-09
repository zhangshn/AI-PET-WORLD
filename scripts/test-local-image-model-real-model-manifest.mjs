import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  REAL_MODEL_MANIFEST_SCHEMA_VERSION,
  readAndValidateRealModelManifest,
  validateRealModelManifest,
} from "../services/local-image-model/real-model-manifest.mjs"
import { readRealImageModelReadiness } from "../services/local-image-model/real-model-readiness.mjs"

main()

function main() {
  printTitle("AI-PET-WORLD real model manifest contract test")

  testValidManifest()
  testInvalidSchemaVersionBlocked()
  testUnlicensedThirdPartyArtworkBlocked()
  testPlaceholderOutputBlocked()
  testManifestReadinessIntegration()
  testManifestLicenseMismatchBlocked()

  console.log("")
  console.log("RESULT: real model manifest contract test passed.")
}

function testValidManifest() {
  const result = validateRealModelManifest(buildValidManifest())

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_model_manifest_valid")
  assert.equal(result.license, "self_owned")
  assert.equal(result.originalityConfirmed, true)
  assert.equal(result.commercialUseAllowed, true)
  assert.equal(result.unlicensedThirdPartyArtworkAllowed, false)
  assert.equal(result.outputCapabilities.minimumWidth, 512)
  assert.equal(result.outputCapabilities.minimumHeight, 512)
  assert.equal(result.canShowToPlayer, false)

  printCheck("valid manifest")
}

function testInvalidSchemaVersionBlocked() {
  const manifest = {
    ...buildValidManifest(),
    schemaVersion: "wrong-version",
  }

  const result = validateRealModelManifest(manifest)

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_model_manifest_schema_version_invalid")
  assert.ok(result.tags.includes("schema_version_invalid"))

  printCheck("invalid schema version blocked")
}

function testUnlicensedThirdPartyArtworkBlocked() {
  const manifest = {
    ...buildValidManifest(),
    unlicensedThirdPartyArtworkAllowed: true,
  }

  const result = validateRealModelManifest(manifest)

  assert.equal(result.ok, false)
  assert.equal(
    result.status,
    "real_model_manifest_unlicensed_third_party_not_blocked"
  )

  printCheck("unlicensed third-party artwork blocked")
}

function testPlaceholderOutputBlocked() {
  const manifest = {
    ...buildValidManifest(),
    outputCapabilities: {
      ...buildValidManifest().outputCapabilities,
      canReturnPlaceholder: true,
    },
  }

  const result = validateRealModelManifest(manifest)

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_model_manifest_placeholder_not_blocked")

  printCheck("placeholder output blocked")
}

function testManifestReadinessIntegration() {
  const fixture = createManifestFixture(buildValidManifest())

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
  assert.equal(readiness.canShowToPlayer, false)

  const readResult = readAndValidateRealModelManifest(fixture.manifestPath)

  assert.equal(readResult.ok, true)
  assert.equal(readResult.status, "real_model_manifest_valid")

  printCheck("manifest readiness integration")
}

function testManifestLicenseMismatchBlocked() {
  const fixture = createManifestFixture(buildValidManifest())

  const readiness = readRealImageModelReadiness({
    enabled: true,
    assetDirectory: fixture.assetDirectory,
    manifestPath: fixture.manifestPath,
    license: "cc0",
    originalityConfirmed: true,
  })

  assert.equal(readiness.ok, false)
  assert.equal(readiness.status, "real_image_model_manifest_license_mismatch")
  assert.equal(readiness.manifest.status, "real_model_manifest_valid")

  printCheck("manifest license mismatch blocked")
}

function buildValidManifest() {
  return {
    schemaVersion: REAL_MODEL_MANIFEST_SCHEMA_VERSION,
    modelName: "ai-pet-world-local-test-model",
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

function createManifestFixture(manifest) {
  const assetDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-real-model-manifest-")
  )
  const manifestPath = path.join(assetDirectory, "model-manifest.json")

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8")

  return {
    assetDirectory,
    manifestPath,
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