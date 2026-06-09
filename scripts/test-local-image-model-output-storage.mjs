import assert from "node:assert/strict"
import path from "node:path"

import {
  buildLocalImageOutputReference,
  createSafeLocalImageOutputFileName,
  DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY,
  DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL,
  LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX,
  readLocalImageOutputStorageStatus,
  validateLocalImageOutputFileName,
} from "../services/local-image-model/output-storage.mjs"

main()

function main() {
  printTitle("AI-PET-WORLD local image model output storage test")

  testStorageStatus()
  testSafeFileNameValidation()
  testUnsafeFileNameRejection()
  testSafeFileNameCreation()
  testOutputReference()

  console.log("")
  console.log("RESULT: local image model output storage test passed.")
}

function testStorageStatus() {
  const status = readLocalImageOutputStorageStatus()

  assert.equal(status.ok, true)
  assert.equal(status.status, "local_image_output_storage_rules_ready")
  assert.equal(status.outputDirectory, DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY)
  assert.equal(status.publicBaseUrl, DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL)
  assert.equal(status.publicRoutePrefix, LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX)
  assert.equal(status.mustReturnPublicHttpUrl, true)
  assert.equal(status.mustNotReturnLocalFilePath, true)
  assert.equal(status.mustNotReturnFileUrl, true)
  assert.equal(status.canShowToPlayer, false)

  printCheck("storage status exposes safe rules")
}

function testSafeFileNameValidation() {
  const result = validateLocalImageOutputFileName({
    fileName: "candidate-test_001.png",
    imageFormat: "png",
  })

  assert.equal(result.ok, true)
  assert.equal(result.fileName, "candidate-test_001.png")
  assert.equal(result.imageFormat, "png")
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("safe_output_file_name"))

  printCheck("safe output file name validation")
}

function testUnsafeFileNameRejection() {
  expectFileNameRejection("../secret.png", "path_segment_forbidden")
  expectFileNameRejection("folder/secret.png", "path_segment_forbidden")
  expectFileNameRejection("folder\\secret.png", "path_segment_forbidden")
  expectFileNameRejection("C:\\secret.png", "path_segment_forbidden")
  expectFileNameRejection("candidate.svg", "unsafe_output_file_name")
  expectFileNameRejection("candidate.json", "unsafe_output_file_name")
  expectFileNameRejection("candidate", "unsafe_output_file_name")
  expectFileNameRejection("con.png", "reserved_output_file_name")

  const mismatch = validateLocalImageOutputFileName({
    fileName: "candidate-test.png",
    imageFormat: "webp",
  })

  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.tags.includes("output_extension_format_mismatch"))

  printCheck("unsafe output file names rejected")
}

function testSafeFileNameCreation() {
  const result = createSafeLocalImageOutputFileName({
    seed: "AI PET World Candidate",
    uniqueSuffix: "unit-test",
    imageFormat: "webp",
  })

  assert.equal(result.ok, true)
  assert.equal(result.fileName, "ai-pet-world-candidate-unit-test.webp")
  assert.equal(result.imageFormat, "webp")

  printCheck("safe output file name creation")
}

function testOutputReference() {
  const result = buildLocalImageOutputReference({
    fileName: "candidate-test.png",
    imageFormat: "png",
  })

  assert.equal(result.ok, true)
  assert.equal(result.fileName, "candidate-test.png")
  assert.equal(result.imageFormat, "png")
  assert.equal(
    result.internalFilePath,
    path.resolve(DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY, "candidate-test.png")
  )
  assert.equal(result.imageUrl, "http://localhost:7001/generated/candidate-test.png")
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("public_http_url_ready"))

  assert.equal(result.imageUrl.startsWith("file:"), false)
  assert.equal(result.imageUrl.includes(DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY), false)

  printCheck("output reference returns public URL only")
}

function expectFileNameRejection(fileName, expectedTag) {
  const result = validateLocalImageOutputFileName({
    fileName,
  })

  assert.equal(result.ok, false, fileName)
  assert.ok(
    result.tags.includes(expectedTag),
    `${fileName} should include ${expectedTag}`
  )
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