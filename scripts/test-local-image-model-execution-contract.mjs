import assert from "node:assert/strict"

import {
  buildRealImageExecutionContract,
  DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  REAL_IMAGE_EXECUTION_CONTRACT_VERSION,
  validateRealImageExecutionRequest,
  validateRealImageExecutionStdoutPayload,
} from "../services/local-image-model/real-image-execution-contract.mjs"
import { readLocalImageOutputStorageStatus } from "../services/local-image-model/output-storage.mjs"
import { readRealImageRunnerImplementationHealth } from "../services/local-image-model/real-image-runner-implementation.mjs"

main()

function main() {
  printTitle("AI-PET-WORLD real image execution contract test")

  testExecutionContractReady()
  testExecutionRequestBlockedWithoutReadiness()
  testExecutionRequestValidButStillDoesNotExecute()
  testValidStdoutPayload()
  testStdoutRejectsUnsafeFileName()
  testStdoutRejectsWrongFormat()
  testRunnerImplementationExposesExecutionContract()

  console.log("")
  console.log("RESULT: real image execution contract test passed.")
}

function testExecutionContractReady() {
  const contract = buildRealImageExecutionContract()

  assert.equal(contract.ok, true)
  assert.equal(contract.status, "real_image_execution_contract_ready")
  assert.equal(contract.contractVersion, REAL_IMAGE_EXECUTION_CONTRACT_VERSION)
  assert.equal(contract.timeout.timeoutMs, DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS)
  assert.equal(contract.timeout.isDefault, true)
  assert.equal(contract.stdoutContract.mustBeJsonObject, true)
  assert.equal(contract.stdoutContract.mustNotReturnLocalFilePath, true)
  assert.equal(contract.outputContract.mustWriteFileUnderOutputStorage, true)
  assert.equal(contract.canShowToPlayer, false)

  printCheck("execution contract ready")
}

function testExecutionRequestBlockedWithoutReadiness() {
  const result = validateRealImageExecutionRequest({})

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_execution_readiness_not_ready")
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("fake_image_forbidden"))

  printCheck("execution request blocked without readiness")
}

function testExecutionRequestValidButStillDoesNotExecute() {
  const result = validateRealImageExecutionRequest({
    readiness: {
      ok: true,
    },
    outputStorage: readLocalImageOutputStorageStatus(),
    modelTask: {
      id: "test-task",
    },
    promptPackage: {
      prompt: "test prompt",
    },
    responseContract: {
      requiredFields: [
        "imageUrl",
        "imageFormat",
        "width",
        "height",
        "license",
        "originalityConfirmed",
      ],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_image_execution_request_valid")
  assert.equal(result.canExecute, false)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("does_not_execute"))

  printCheck("execution request valid but still does not execute")
}

function testValidStdoutPayload() {
  const result = validateRealImageExecutionStdoutPayload({
    ok: true,
    status: "real_image_generated",
    imageFileName: "candidate-001.png",
    imageFormat: "png",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true,
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, "real_image_execution_stdout_valid")
  assert.equal(result.imageFileName, "candidate-001.png")
  assert.equal(result.imageFormat, "png")
  assert.equal(result.width, 1024)
  assert.equal(result.height, 1024)
  assert.equal(result.license, "self_owned")
  assert.equal(result.originalityConfirmed, true)
  assert.equal(result.canShowToPlayer, false)

  printCheck("valid stdout payload")
}

function testStdoutRejectsUnsafeFileName() {
  const result = validateRealImageExecutionStdoutPayload({
    ok: true,
    status: "real_image_generated",
    imageFileName: "../secret.png",
    imageFormat: "png",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true,
  })

  assert.equal(result.ok, false)
  assert.equal(
    result.status,
    "real_image_execution_stdout_file_name_path_forbidden"
  )
  assert.equal(result.canShowToPlayer, false)

  printCheck("stdout rejects unsafe file name")
}

function testStdoutRejectsWrongFormat() {
  const result = validateRealImageExecutionStdoutPayload({
    ok: true,
    status: "real_image_generated",
    imageFileName: "candidate-001.svg",
    imageFormat: "svg",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true,
  })

  assert.equal(result.ok, false)
  assert.equal(result.status, "real_image_execution_stdout_image_format_invalid")
  assert.equal(result.canShowToPlayer, false)

  printCheck("stdout rejects wrong format")
}

function testRunnerImplementationExposesExecutionContract() {
  const health = readRealImageRunnerImplementationHealth()

  assert.equal(health.ok, false)
  assert.equal(health.version, "implementation-not-connected-3")
  assert.equal(health.executorShell.status, "real_image_executor_shell_disabled")
  assert.equal(health.executionContract.ok, true)
  assert.equal(
    health.executionContract.status,
    "real_image_execution_contract_ready"
  )
  assert.equal(health.canRunInference, false)
  assert.equal(health.canShowToPlayer, false)
  assert.ok(health.tags.includes("execution_contract_ready"))

  printCheck("runner implementation exposes execution contract")
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