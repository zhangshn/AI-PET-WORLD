import assert from "node:assert/strict"

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

const VALID_REQUEST_AUDIT = {
  requestContractValid: true,
  understandsModelTask: true,
  understandsPromptPackage: true,
  understandsControlSketch: true,
  understandsResponseContract: true,
  understandsVisualFixHints: true,
  understandsWorldFactsLocked: true,
}

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
  promptPackage: {
    packageId: "adapter-boundary-test-prompt-package",
  },
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

  console.log("")
  console.log("RESULT: local image model adapter boundary test passed.")
}

function testAdapterHealthDefaultBlocked() {
  const health = readRealImageGenerationAdapterHealth({
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_generation_adapter_not_connected")
  assert.equal(health.adapterConnected, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)
  assert.ok(health.tags.includes("fake_image_forbidden"))

  printCheck("adapter health default blocked")
}

async function testAdapterDryRunDefaultBlocked() {
  const result = await runRealImageGenerationAdapterDryRun({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_generation_adapter_not_connected")
  assert.equal(result.adapterConnected, false)
  assert.equal(result.willReturnImageUrl, false)
  assert.equal(result.willReturnOriginalityConfirmed, false)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("fake_image_forbidden"))

  printCheck("adapter dry-run default blocked")
}

async function testAdapterGenerateDefaultBlocked() {
  const result = await generateRealImageWithAdapter({
    requestBody: VALID_REQUEST_BODY,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_generation_adapter_not_connected")
  assert.equal(result.adapterConnected, false)
  assert.equal(Object.hasOwn(result, "imageUrl"), false)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("fake_image_forbidden"))

  printCheck("adapter generate default blocked")
}

function testImplementationHealthWrapsAdapter() {
  const health = readLocalImageModelImplementationHealth({
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "local_image_model_implementation_not_connected")
  assert.equal(health.implementationConnected, false)
  assert.equal(health.adapter.status, "real_image_generation_adapter_not_connected")
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
  assert.equal(result.adapter.status, "real_image_generation_adapter_not_connected")
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
  assert.equal(result.adapter.status, "real_image_generation_adapter_not_connected")
  assert.equal(result.adapter.adapterConnected, false)
  assert.equal(Object.hasOwn(result, "imageUrl"), false)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("fake_image_forbidden"))

  printCheck("implementation generate wraps adapter")
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