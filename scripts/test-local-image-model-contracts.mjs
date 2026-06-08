import assert from "node:assert/strict"

import {
  buildSuccessfulDryRunResponse,
  buildSuccessfulGenerateResponse,
  REQUIRED_RESPONSE_FIELDS,
  validateRealImageGenerationResult,
} from "../services/local-image-model/contracts.mjs"

const VALID_REQUEST_AUDIT = {
  requestContractValid: true,
  understandsModelTask: true,
  understandsPromptPackage: true,
  understandsControlSketch: true,
  understandsResponseContract: true,
  understandsVisualFixHints: true,
  understandsWorldFactsLocked: true,
}

const VALID_REAL_IMAGE_RESULT = {
  imageUrl: "https://example.com/ai-pet-world-contract-test.png",
  imageFormat: "png",
  width: 1536,
  height: 1024,
  license: "self_owned",
  originalityConfirmed: true,
  canShowToPlayer: false,
}

main()

function main() {
  printTitle("AI-PET-WORLD local image model contracts test")

  testValidRealImageResult()
  testInvalidPayloadsAreRejected()
  testSuccessfulDryRunResponse()
  testSuccessfulGenerateResponse()
  testInvalidGenerateResponseIsRejected()

  console.log("")
  console.log("RESULT: local image model contracts test passed.")
}

function testValidRealImageResult() {
  const result = validateRealImageGenerationResult({
    payload: VALID_REAL_IMAGE_RESULT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, true)
  assert.equal(result.imageUrl, VALID_REAL_IMAGE_RESULT.imageUrl)
  assert.equal(result.imageFormat, "png")
  assert.equal(result.width, 1536)
  assert.equal(result.height, 1024)
  assert.equal(result.license, "self_owned")
  assert.equal(result.originalityConfirmed, true)
  assert.equal(result.canShowToPlayer, false)
  assert.ok(result.tags.includes("response_contract_passed"))

  printCheck("valid real image result")
}

function testInvalidPayloadsAreRejected() {
  expectValidationFailure({
    name: "payload must be object",
    payload: null,
    expectedTag: "payload_not_object",
  })

  expectValidationFailure({
    name: "missing required fields",
    payload: {
      imageUrl: VALID_REAL_IMAGE_RESULT.imageUrl,
    },
    expectedTag: "missing_required_fields",
  })

  expectValidationFailure({
    name: "empty imageUrl",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      imageUrl: "",
    },
    expectedTag: "empty_image_url",
  })

  expectValidationFailure({
    name: "svg data image forbidden",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      imageUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    },
    expectedTag: "svg_forbidden",
  })

  expectValidationFailure({
    name: "local file path forbidden",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      imageUrl: "file:///F:/ai-pet-world/generated/test.png",
    },
    expectedTag: "invalid_image_url_protocol",
  })

  expectValidationFailure({
    name: "invalid image format",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      imageFormat: "gif",
    },
    expectedTag: "invalid_image_format",
  })

  expectValidationFailure({
    name: "invalid width",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      width: 128,
    },
    expectedTag: "invalid_width",
  })

  expectValidationFailure({
    name: "invalid height",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      height: 128,
    },
    expectedTag: "invalid_height",
  })

  expectValidationFailure({
    name: "invalid license",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      license: "unknown_license",
    },
    expectedTag: "invalid_license",
  })

  expectValidationFailure({
    name: "originality not confirmed",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      originalityConfirmed: false,
    },
    expectedTag: "originality_not_confirmed",
  })

  expectValidationFailure({
    name: "unsafe display gate",
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      canShowToPlayer: true,
    },
    expectedTag: "unsafe_display_gate",
  })

  printCheck("invalid payload rejection")
}

function testSuccessfulDryRunResponse() {
  const response = buildSuccessfulDryRunResponse({
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(response.ok, true)
  assert.equal(response.status, "local_image_model_dry_run_passed")
  assert.equal(response.implementationConnected, true)
  assert.equal(response.willReturnImageUrl, true)
  assert.equal(response.willReturnImageFormat, true)
  assert.equal(response.willReturnWidth, true)
  assert.equal(response.willReturnHeight, true)
  assert.equal(response.willReturnLicense, true)
  assert.equal(response.willReturnOriginalityConfirmed, true)
  assert.equal(response.willPersistOnlyAsHiddenCandidate, true)
  assert.equal(response.canShowToPlayer, false)

  printCheck("successful dry-run response")
}

function testSuccessfulGenerateResponse() {
  const response = buildSuccessfulGenerateResponse({
    payload: VALID_REAL_IMAGE_RESULT,
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(response.ok, true)
  assert.equal(response.status, "local_image_model_generate_passed")
  assert.equal(response.imageUrl, VALID_REAL_IMAGE_RESULT.imageUrl)
  assert.equal(response.imageFormat, "png")
  assert.equal(response.width, 1536)
  assert.equal(response.height, 1024)
  assert.equal(response.license, "self_owned")
  assert.equal(response.originalityConfirmed, true)
  assert.equal(response.canShowToPlayer, false)
  assert.ok(response.tags.includes("response_contract_passed"))

  printCheck("successful generate response")
}

function testInvalidGenerateResponseIsRejected() {
  const response = buildSuccessfulGenerateResponse({
    payload: {
      ...VALID_REAL_IMAGE_RESULT,
      license: "unknown_license",
    },
    requestAudit: VALID_REQUEST_AUDIT,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(response.ok, false)
  assert.equal(response.status, "local_image_model_real_output_invalid")
  assert.equal(response.canShowToPlayer, false)
  assert.ok(response.tags.includes("invalid_license"))

  printCheck("invalid generate response rejection")
}

function expectValidationFailure(input) {
  const result = validateRealImageGenerationResult({
    payload: input.payload,
    requiredResponseFields: REQUIRED_RESPONSE_FIELDS,
  })

  assert.equal(result.ok, false, input.name)
  assert.ok(
    result.tags.includes(input.expectedTag),
    `${input.name} should include tag ${input.expectedTag}`
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