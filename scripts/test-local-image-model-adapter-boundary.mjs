import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  generateLocalImageCandidate,
  readLocalImageModelImplementationHealth,
  runLocalImageModelImplementationDryRun,
} from "../services/local-image-model/implementation.mjs"
import {
  generateRealImageWithAdapter,
  readRealImageGenerationAdapterHealth,
  runRealImageGenerationAdapterDryRun,
} from "../services/local-image-model/adapter.mjs"
import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"

const VALID_REQUEST_AUDIT = { requestContractValid: true }

const VALID_REQUEST_BODY = {
  modelTask: {
    taskKind: "generate_hidden_world_bitmap_candidate",
    outputPurpose: "hidden_ai_image_candidate",
    mustReturnResponseContract: true,
    mustNotDisplayDirectly: true,
    mustNotRewriteWorldFacts: true,
    mustNotUseProgrammaticRenderer: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    canShowToPlayer: false,
  },
  promptPackage: { packageId: "adapter-boundary-test-prompt-package" },
  controlSketch: {
    controlSketchId: "adapter-boundary-test-control-sketch",
    canShowToPlayer: false,
    cannotApprove: true,
  },
  responseContract: {
    requiredFields: REQUIRED_RESPONSE_FIELDS,
    canShowToPlayer: false,
    mustPersistAsAiImageCandidate: true,
    mustPassVisualJudge: true,
  },
  visualFixHints: [],
  metadata: {
    sourceFactIds: ["adapter-boundary-test-world"],
    canShowToPlayer: false,
    cannotApprove: true,
  },
  imageFormat: "png",
}

await main()

async function main() {
  printTitle("AI-PET-WORLD local image model adapter boundary test")

  testAdapterHealthDefaultBlocked()
  await testAdapterDryRunDefaultBlocked()
  await testAdapterGenerateDefaultBlocked()
  testImplementationHealthWrapsAdapter()
  await testImplementationDryRunWrapsAdapter()
  await testImplementationGenerateWrapsAdapter()
  testImplementationHealthUsesRuntimeConfig()
  await testImplementationDryRunUsesRuntimeConfig()
  await testImplementationGenerateUsesRuntimeConfig()
  await testImplementationGenerateUsesDefaultWorkerExecutor()

  console.log("")
  console.log("RESULT: local image model adapter boundary test passed.")
}

function testAdapterHealthDefaultBlocked() {
  const health = readRealImageGenerationAdapterHealth({
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_adapter_blocked")
  assert.equal(health.adapterConnected, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("adapter health default blocked")
}

async function testAdapterDryRunDefaultBlocked() {
  const result = await runRealImageGenerationAdapterDryRun({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_generation_adapter_blocked")
  assert.equal(result.adapterConnected, false)
  assert.equal(result.willReturnImageUrl, false)
  assert.equal(result.willReturnOriginalityConfirmed, false)
  assert.equal(result.canShowToPlayer, false)

  printCheck("adapter dry-run default blocked")
}

async function testAdapterGenerateDefaultBlocked() {
  const result = await generateRealImageWithAdapter({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_generation_adapter_blocked")
  assert.equal(result.adapterConnected, false)
  assert.equal(Object.hasOwn(result, "imageUrl"), false)
  assert.equal(result.canShowToPlayer, false)

  printCheck("adapter generate default blocked")
}

function testImplementationHealthWrapsAdapter() {
  const health = readLocalImageModelImplementationHealth({
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "local_image_model_implementation_not_connected")
  assert.equal(health.implementationConnected, false)
  assert.equal(health.adapter.status, "real_image_generation_adapter_blocked")
  assert.equal(health.adapter.adapterConnected, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("implementation health wraps adapter")
}

async function testImplementationDryRunWrapsAdapter() {
  const result = await runLocalImageModelImplementationDryRun({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "local_image_model_implementation_not_connected")
  assert.equal(result.implementationConnected, false)
  assert.equal(result.adapter.status, "real_image_generation_adapter_blocked")
  assert.equal(result.adapter.adapterConnected, false)
  assert.equal(result.willReturnImageUrl, false)
  assert.equal(result.willReturnOriginalityConfirmed, false)
  assert.equal(result.canShowToPlayer, false)

  printCheck("implementation dry-run wraps adapter")
}

async function testImplementationGenerateWrapsAdapter() {
  const result = await generateLocalImageCandidate({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "local_image_model_implementation_not_connected")
  assert.equal(result.implementationConnected, false)
  assert.equal(result.adapter.status, "real_image_generation_adapter_blocked")
  assert.equal(result.adapter.adapterConnected, false)
  assert.equal(Object.hasOwn(result, "imageUrl"), false)
  assert.equal(result.canShowToPlayer, false)

  printCheck("implementation generate wraps adapter")
}

function testImplementationHealthUsesRuntimeConfig() {
  const fixture = createRuntimeFixture("implementation-health-runtime-config")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const health = readLocalImageModelImplementationHealth(
    buildRuntimeConfigInput({ fixture, worker })
  )

  assert.equal(health.ok, true)
  assert.equal(health.status, "local_image_model_implementation_connected")
  assert.equal(health.implementationConnected, true)
  assert.equal(health.adapter.adapterConnected, true)
  assert.equal(health.canShowToPlayer, false)

  printCheck("implementation health uses runtime config")
}

async function testImplementationDryRunUsesRuntimeConfig() {
  const fixture = createRuntimeFixture("implementation-dry-run-runtime-config")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const dryRun = await runLocalImageModelImplementationDryRun(
    buildRuntimeConfigInput({ fixture, worker })
  )

  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.willReturnImageUrl, true)
  assert.equal(dryRun.willReturnOriginalityConfirmed, true)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("implementation dry-run uses runtime config")
}

async function testImplementationGenerateUsesRuntimeConfig() {
  const fixture = createRuntimeFixture("implementation-generate-runtime-config")
  const worker = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const result = await generateLocalImageCandidate(
    buildRuntimeConfigInput({ fixture, worker })
  )

  assertSuccessfulGenerateResult(result)
  printCheck("implementation generate uses runtime config")
}

async function testImplementationGenerateUsesDefaultWorkerExecutor() {
  const fixture = createRuntimeFixture("implementation-default-worker")
  const inference = createWorkerFile(fixture, buildSuccessfulWorkerSource())
  const result = await generateLocalImageCandidate(
    buildRuntimeConfigInput({
      fixture,
      worker: null,
      inference,
      useDefaultWorkerExecutor: true,
    })
  )

  assertSuccessfulGenerateResult(result)
  assert.equal(result.worker.ok, true)
  assert.equal(result.worker.status, "real_image_model_worker_ready")
  assert.equal(result.adapter.executorShell.commandConfigured, true)

  printCheck("implementation generate uses default worker executor")
}

function assertSuccessfulGenerateResult(result) {
  assert.equal(result.ok, true)
  assert.equal(result.imageUrl.endsWith(".png"), true)
  assert.equal(result.imageFormat, "png")
  assert.equal(result.width, 1024)
  assert.equal(result.height, 1024)
  assert.equal(result.license, "self_owned")
  assert.equal(result.originalityConfirmed, true)
  assert.equal(result.canShowToPlayer, false)
}

function buildRuntimeConfigInput(input) {
  const config = {
    enabled: true,
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
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
  }

  if (input.useDefaultWorkerExecutor) {
    config.worker = {
      command: process.execPath,
      argsJson: JSON.stringify([input.inference]),
    }
    return config
  }

  return {
    ...config,
    command: process.execPath,
    argsJson: JSON.stringify([input.worker]),
  }
}

function createRuntimeFixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ai-pet-world-${name}-`))
  const outputDirectory = path.join(root, "generated")
  const manifestPath = path.join(root, "model-manifest.json")
  fs.mkdirSync(outputDirectory, { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(buildValidManifest(), null, 2), "utf8")

  return { root, outputDirectory, manifestPath }
}

function createWorkerFile(fixture, source) {
  const worker = path.join(fixture.root, `worker-${cryptoSafeSuffix()}.mjs`)
  fs.writeFileSync(worker, source, "utf8")
  return worker
}

function cryptoSafeSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function buildValidManifest() {
  return {
    schemaVersion: REAL_MODEL_MANIFEST_SCHEMA_VERSION,
    modelName: "ai-pet-world-adapter-boundary-test-model",
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
