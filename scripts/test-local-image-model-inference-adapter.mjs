import assert from "node:assert/strict"

import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import {
  REAL_IMAGE_INFERENCE_REQUEST_SCHEMA_VERSION,
  buildRealImageInferenceCommandRequest,
  readRealImageInferenceAdapterHealth,
  validateRealImageInferenceStdout,
} from "../services/local-image-model/real-image-inference-adapter.mjs"

main()

function main() {
  printTitle("AI-PET-WORLD real image inference adapter test")

  testHealthReady()
  testBuildsInferenceRequest()
  testRejectsUnsafeOutputFileName()
  testRejectsVisibleModelTask()
  testValidatesInferenceStdout()
  testRejectsInferenceStdoutFileNameMismatch()

  console.log("")
  console.log("RESULT: real image inference adapter test passed.")
}

function testHealthReady() {
  const health = readRealImageInferenceAdapterHealth()

  assert.equal(health.ok, true)
  assert.equal(health.status, "real_image_inference_adapter_ready")
  assert.equal(health.canBuildInferenceRequest, true)
  assert.equal(health.canValidateInferenceStdout, true)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("inference adapter health ready")
}

function testBuildsInferenceRequest() {
  const result = buildRealImageInferenceCommandRequest({
    workerPayload: buildWorkerPayload(),
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_image_inference_request_ready")
  assert.equal(result.request.schemaVersion, REAL_IMAGE_INFERENCE_REQUEST_SCHEMA_VERSION)
  assert.equal(result.request.taskKind, "generate_hidden_world_bitmap_candidate")
  assert.equal(result.request.outputPurpose, "hidden_ai_image_candidate")
  assert.equal(result.request.outputFileName, "adapter-output.png")
  assert.equal(result.request.imageFormat, "png")
  assert.equal(result.request.width, 1536)
  assert.equal(result.request.height, 1024)
  assert.equal(result.request.promptPackage.packageId, "inference-adapter-test-prompt")
  assert.equal(result.request.constraints.mustWriteOutputFile, true)
  assert.equal(result.request.constraints.mustNotReturnPlaceholder, true)
  assert.equal(result.request.canShowToPlayer, false)
  assert.equal(result.canShowToPlayer, false)

  printCheck("inference adapter builds request")
}

function testRejectsUnsafeOutputFileName() {
  const result = buildRealImageInferenceCommandRequest({
    workerPayload: {
      ...buildWorkerPayload(),
      outputFileName: "../bad.png",
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_inference_request_output_file_name_invalid")
  assert.equal(result.canShowToPlayer, false)

  printCheck("inference adapter rejects unsafe output file name")
}

function testRejectsVisibleModelTask() {
  const workerPayload = buildWorkerPayload()
  workerPayload.modelTask = {
    ...workerPayload.modelTask,
    canShowToPlayer: true,
  }
  const result = buildRealImageInferenceCommandRequest({ workerPayload })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_inference_request_model_task_visibility_invalid")

  printCheck("inference adapter rejects visible model task")
}

function testValidatesInferenceStdout() {
  const result = validateRealImageInferenceStdout({
    expectedOutputFileName: "adapter-output.png",
    stdoutPayload: {
      ok: true,
      status: "real_image_generated",
      imageFileName: "adapter-output.png",
      imageFormat: "png",
      width: 1536,
      height: 1024,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_image_inference_stdout_valid")
  assert.equal(result.imageFileName, "adapter-output.png")
  assert.equal(result.imageFormat, "png")
  assert.equal(result.width, 1536)
  assert.equal(result.height, 1024)
  assert.equal(result.license, "self_owned")
  assert.equal(result.originalityConfirmed, true)
  assert.equal(result.canShowToPlayer, false)

  printCheck("inference adapter validates stdout")
}

function testRejectsInferenceStdoutFileNameMismatch() {
  const result = validateRealImageInferenceStdout({
    expectedOutputFileName: "adapter-output.png",
    stdoutPayload: {
      ok: true,
      status: "real_image_generated",
      imageFileName: "other.png",
      imageFormat: "png",
      width: 1536,
      height: 1024,
      license: "self_owned",
      originalityConfirmed: true,
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_inference_stdout_output_file_name_mismatch")
  assert.equal(result.canShowToPlayer, false)

  printCheck("inference adapter rejects stdout file name mismatch")
}

function buildWorkerPayload() {
  return {
    outputFileName: "adapter-output.png",
    imageFormat: "png",
    width: 1536,
    height: 1024,
    modelTask: {
      taskKind: "generate_hidden_world_bitmap_candidate",
      canShowToPlayer: false,
    },
    promptPackage: {
      packageId: "inference-adapter-test-prompt",
      positivePrompt: "bright healing top-down pixel world",
    },
    responseContract: {
      requiredFields: REQUIRED_RESPONSE_FIELDS,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPassVisualJudge: true,
    },
    controlSketch: {
      controlSketchId: "inference-adapter-test-control-sketch",
      canShowToPlayer: false,
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["inference-adapter-test-world"],
      canShowToPlayer: false,
    },
    readiness: {
      ok: true,
      status: "real_image_model_assets_ready",
      license: "self_owned",
      originalityConfirmed: true,
      manifestConfigured: true,
    },
    outputStorage: {
      ok: true,
      status: "local_image_output_storage_ready",
      publicBaseUrl: "http://127.0.0.1:7001",
    },
    audit: {
      requestId: "inference-adapter-test-request",
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
