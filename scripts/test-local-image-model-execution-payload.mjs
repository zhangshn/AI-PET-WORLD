import assert from "node:assert/strict"

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "../services/local-image-model/contracts.mjs"
import {
  FORMAL_VISUAL_CHAIN_FOR_EXECUTOR_PAYLOAD,
  REQUIRED_REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_FIELDS,
  REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION,
  buildRealImageExecutorStdinPayload,
  validateRealImageExecutorStdinPayload,
} from "../services/local-image-model/real-image-execution-payload.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"

main()

function main() {
  printTitle("AI-PET-WORLD real image execution stdin payload test")

  testBuildValidExecutorStdinPayload()
  testUnsafeOutputFileNameRejected()
  testWorldFactsMustStayLocked()
  testCanShowToPlayerMustStayFalse()
  testPayloadMustNotExposeLocalPathOrFileUrl()

  console.log("")
  console.log("RESULT: real image execution stdin payload test passed.")
}

function testBuildValidExecutorStdinPayload() {
  const result = buildRealImageExecutorStdinPayload({
    requestId: "payload-test-001",
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
    audit: {
      source: "unit-test",
      createdAt: "2026-06-10T00:00:00.000Z",
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_image_executor_stdin_payload_ready")
  assert.equal(result.canExecuteCommand, false)
  assert.equal(result.willExecuteCommand, false)
  assert.equal(result.willGenerateImage, false)
  assert.equal(result.canShowToPlayer, false)
  assert.equal(result.outputFileName, "payload-test-001-executor-stdin.png")
  assert.equal(result.validation.ok, true)
  assert.equal(result.executionRequestValidation.ok, true)

  const payload = result.payload

  assert.equal(payload.schemaVersion, REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION)
  assert.equal(payload.payloadKind, "future_executor_stdin_json_only")
  assert.equal(payload.requestId, "payload-test-001")
  assert.equal(payload.canShowToPlayer, false)

  for (const field of REQUIRED_REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_FIELDS) {
    assert.equal(
      Object.hasOwn(payload, field),
      true,
      `payload should contain ${field}`
    )
  }

  assert.equal(payload.modelTask.canShowToPlayer, false)
  assert.equal(payload.modelTask.mustNotDisplayDirectly, true)
  assert.equal(payload.modelTask.mustNotRewriteWorldFacts, true)
  assert.equal(payload.promptPackage.canShowToPlayer, false)
  assert.equal(payload.promptPackage.worldFactsLocked, true)
  assert.equal(payload.outputStorage.outputFileName, payload.outputFileName)
  assert.equal(payload.outputStorage.imageFormat, "png")
  assert.equal(payload.outputStorage.canShowToPlayer, false)
  assert.equal(Object.hasOwn(payload.outputStorage, "internalFilePath"), false)
  assert.equal(Object.hasOwn(payload.outputStorage, "outputDirectory"), false)
  assert.equal(Object.hasOwn(payload.outputStorage, "localFilePath"), false)
  assert.equal(payload.manifest.canShowToPlayer, false)
  assert.equal(payload.responseContract.canShowToPlayer, false)
  assert.deepEqual(payload.responseContract.requiredFields, REQUIRED_RESPONSE_FIELDS)
  assert.deepEqual(payload.responseContract.allowedImageFormats, ALLOWED_IMAGE_FORMATS)
  assert.deepEqual(payload.responseContract.allowedLicenses, ALLOWED_LICENSES)
  assert.equal(payload.responseContract.minimumWidth, MINIMUM_IMAGE_WIDTH)
  assert.equal(payload.responseContract.minimumHeight, MINIMUM_IMAGE_HEIGHT)
  assert.equal(payload.responseContract.mustPersistOnlyAsHiddenCandidate, true)
  assert.equal(payload.responseContract.mustPassVisualJudge, true)
  assert.equal(payload.controlSketch.canShowToPlayer, false)
  assert.equal(payload.controlSketch.cannotApprove, true)
  assert.deepEqual(payload.visualFixHints, [])
  assert.equal(payload.worldFactMetadata.locked, true)
  assert.equal(payload.worldFactMetadata.mustNotRewriteWorldFacts, true)
  assert.equal(payload.audit.willExecuteCommand, false)
  assert.equal(payload.audit.didExecuteCommand, false)
  assert.equal(payload.audit.willGenerateImage, false)
  assert.equal(payload.constraints.localImageModelOnly, true)
  assert.equal(payload.constraints.thirdPartyProviderForbidden, true)
  assert.equal(payload.constraints.worldFactsLocked, true)
  assert.equal(payload.constraints.mustPersistOnlyAsHiddenCandidate, true)
  assert.equal(payload.constraints.mustPassVisualJudge, true)
  assert.equal(payload.constraints.mustCreateApprovedFrameBeforePlayerView, true)
  assert.deepEqual(
    payload.constraints.formalVisualChain,
    FORMAL_VISUAL_CHAIN_FOR_EXECUTOR_PAYLOAD
  )
  assert.equal(Object.hasOwn(payload, "imageUrl"), false)

  printCheck("valid executor stdin payload")
}

function testUnsafeOutputFileNameRejected() {
  const result = buildRealImageExecutorStdinPayload({
    requestId: "payload-test-unsafe",
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
    outputFileName: "../bad.png",
  })

  assert.equal(result.ok, false)
  assert.equal(
    result.status,
    "real_image_executor_stdin_payload_output_file_name_invalid"
  )
  assert.equal(result.willExecuteCommand, false)
  assert.equal(result.willGenerateImage, false)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("path_segment_forbidden"))

  printCheck("unsafe output file name rejected")
}

function testWorldFactsMustStayLocked() {
  const result = buildRealImageExecutorStdinPayload({
    requestId: "payload-test-lock",
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
  })

  assert.equal(result.ok, true)

  const invalidPayload = {
    ...result.payload,
    worldFactMetadata: {
      ...result.payload.worldFactMetadata,
      locked: false,
    },
  }
  const validation = validateRealImageExecutorStdinPayload(invalidPayload)

  assert.equal(validation.ok, false)
  assert.equal(
    validation.status,
    "real_image_executor_stdin_payload_world_facts_not_locked"
  )
  assert.ok(validation.tags.includes("world_facts_not_locked"))

  printCheck("world facts must stay locked")
}

function testCanShowToPlayerMustStayFalse() {
  const result = buildRealImageExecutorStdinPayload({
    requestId: "payload-test-display-gate",
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
  })

  assert.equal(result.ok, true)

  const invalidPayload = {
    ...result.payload,
    canShowToPlayer: true,
  }
  const validation = validateRealImageExecutorStdinPayload(invalidPayload)

  assert.equal(validation.ok, false)
  assert.equal(
    validation.status,
    "real_image_executor_stdin_payload_display_gate_invalid"
  )
  assert.ok(validation.tags.includes("display_gate_invalid"))

  printCheck("canShowToPlayer must stay false")
}

function testPayloadMustNotExposeLocalPathOrFileUrl() {
  const result = buildRealImageExecutorStdinPayload({
    requestId: "payload-test-local-path",
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
  })

  assert.equal(result.ok, true)

  const invalidLocalPathPayload = {
    ...result.payload,
    outputStorage: {
      ...result.payload.outputStorage,
      outputDirectory: "F:\\ai-pet-world\\data\\local-image-model\\generated",
    },
  }
  const localPathValidation = validateRealImageExecutorStdinPayload(
    invalidLocalPathPayload
  )

  assert.equal(localPathValidation.ok, false)
  assert.equal(
    localPathValidation.status,
    "real_image_executor_stdin_payload_local_path_forbidden"
  )

  const invalidFileUrlPayload = {
    ...result.payload,
    audit: {
      ...result.payload.audit,
      leakedUrl: "file:///tmp/fake.png",
    },
  }
  const fileUrlValidation = validateRealImageExecutorStdinPayload(
    invalidFileUrlPayload
  )

  assert.equal(fileUrlValidation.ok, false)
  assert.equal(
    fileUrlValidation.status,
    "real_image_executor_stdin_payload_file_url_forbidden"
  )

  printCheck("payload must not expose local path or file URL")
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
      tags: [
        "ai_image_generation_model",
        "hidden_candidate_only",
        "response_contract_required",
      ],
    },
    positivePrompt:
      "top-down pixel world frame, small cozy world clearing, natural boundary, empty land, bright healing game scene",
    negativePrompt:
      "text, watermark, logo, ui card, placeholder, debug image, svg, html, blurry, low quality, copied character, copyrighted character",
    width: 1536,
    height: 1024,
    imageFormat: "png",
    promptPackage: {
      packageId: "payload-test-prompt-package",
      worldId: "payload-test-world",
      tick: 0,
      canShowToPlayer: false,
      summary:
        "Payload test prompt package. This request is only for executor stdin JSON contract verification.",
    },
    controlSketch: {
      controlSketchId: "payload-test-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
    },
    outputSize: {
      width: 1536,
      height: 1024,
      imageFormat: "png",
    },
    responseContract: {
      requiredFields: REQUIRED_RESPONSE_FIELDS,
      allowedImageFormats: ALLOWED_IMAGE_FORMATS,
      allowedLicenses: ALLOWED_LICENSES,
      minimumWidth: 512,
      minimumHeight: 512,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPassVisualJudge: true,
    },
    visualFixHints: [],
    metadata: {
      worldId: "payload-test-world",
      tick: 0,
      promptPackageId: "payload-test-prompt-package",
      sourceFactIds: [
        "payload-test-world",
        "payload-test-visual-fact",
        "payload-test-runtime-event",
      ],
      controlSketchId: "payload-test-control-sketch",
      visualFixPlanId: null,
      canShowToPlayer: false,
      cannotApprove: true,
    },
  }
}

function buildReadyReadinessGate() {
  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: true,
    manifestConfigured: true,
    license: "self_owned",
    originalityConfirmed: true,
    manifest: buildValidManifest(),
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

function buildValidManifest() {
  return {
    ok: true,
    status: "real_model_manifest_valid",
    schemaVersion: REAL_MODEL_MANIFEST_SCHEMA_VERSION,
    modelName: "ai-pet-world-executor-payload-test-model",
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
    canShowToPlayer: false,
    tags: [
      "real_model_manifest",
      "manifest_valid",
      "license_allowed",
      "originality_confirmed",
      "commercial_use_allowed",
      "unlicensed_third_party_blocked",
      "not_player_visible",
    ],
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