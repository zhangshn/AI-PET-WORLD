import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const REQUIRED_RESPONSE_FIELDS = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

const ALLOWED_IMAGE_FORMATS = ["png", "webp", "jpg"]
const ALLOWED_LICENSES = ["self_owned", "cc0", "commercial_license"]

const env = loadLocalEnvFile(".env.local")

const providerKind = readEnv("AI_PET_WORLD_IMAGE_PROVIDER")
const generateEndpoint = readEnv("AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT")
const healthEndpoint =
  readEnv("AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT") ||
  deriveSiblingEndpoint(generateEndpoint, "health")
const dryRunEndpoint =
  readEnv("AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT") ||
  deriveSiblingEndpoint(generateEndpoint, "dry-run")

main().catch((error) => {
  console.error("[verify-local-image-model-contract] failed")
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

async function main() {
  printTitle("AI-PET-WORLD local image model contract verification")

  assert(
    providerKind === "local_model",
    "AI_PET_WORLD_IMAGE_PROVIDER must be local_model."
  )

  assert(
    Boolean(generateEndpoint),
    "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT is missing."
  )

  assertValidUrl(generateEndpoint, "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT")
  assertValidUrl(healthEndpoint, "AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT")
  assertValidUrl(dryRunEndpoint, "AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT")

  console.log("provider:", providerKind)
  console.log("health:", healthEndpoint)
  console.log("dry-run:", dryRunEndpoint)
  console.log("generate:", generateEndpoint)
  console.log("required response fields:", REQUIRED_RESPONSE_FIELDS.join(", "))

  const health = await checkHealth(healthEndpoint)
  printCheck("health", health)

  const dryRun = await checkDryRun(dryRunEndpoint)
  printCheck("dry-run", dryRun)

  const generate = await checkGenerate(generateEndpoint)
  printCheck("generate", generate)

  console.log("")
  console.log("RESULT: local image model contract passed.")
  console.log(
    "Next: call POST /api/world/visual/generate, then POST /api/world/visual/judge."
  )
}

async function checkHealth(endpoint) {
  const payload = await fetchJson(endpoint, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  })

  const checks = {
    ok: payload.ok === true,
    supportsWorldVisualPainter: payload.supportsWorldVisualPainter === true,
    supportsResponseContract: payload.supportsResponseContract === true,
    supportsHiddenCandidateOutput:
      payload.supportsHiddenCandidateOutput === true,
    supportsBitmap:
      payload.supportsPng === true ||
      payload.supportsWebp === true ||
      payload.supportsJpg === true,
    canShowToPlayer: payload.canShowToPlayer === false,
  }

  assertAll(checks, "health response does not satisfy local model health contract.")

  return {
    status: "passed",
    checks,
    payload,
  }
}

async function checkDryRun(endpoint) {
  const requestBody = buildDryRunRequestBody()
  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dryRun: true,
      requestBody,
    }),
  })

  const checks = {
    ok: payload.ok === true,
    requestContractValid: payload.requestContractValid === true,
    understandsModelTask: payload.understandsModelTask === true,
    understandsPromptPackage: payload.understandsPromptPackage === true,
    understandsControlSketch: payload.understandsControlSketch === true,
    understandsResponseContract: payload.understandsResponseContract === true,
    understandsVisualFixHints: payload.understandsVisualFixHints === true,
    understandsWorldFactsLocked: payload.understandsWorldFactsLocked === true,
    willReturnImageUrl: payload.willReturnImageUrl === true,
    willReturnImageFormat: payload.willReturnImageFormat === true,
    willReturnWidth: payload.willReturnWidth === true,
    willReturnHeight: payload.willReturnHeight === true,
    willReturnLicense: payload.willReturnLicense === true,
    willReturnOriginalityConfirmed:
      payload.willReturnOriginalityConfirmed === true,
    willPersistOnlyAsHiddenCandidate:
      payload.willPersistOnlyAsHiddenCandidate === true,
    canShowToPlayer: payload.canShowToPlayer === false,
  }

  assertAll(checks, "dry-run response does not satisfy local model dry-run contract.")

  return {
    status: "passed",
    checks,
    payload,
  }
}

async function checkGenerate(endpoint) {
  const requestBody = buildGenerateRequestBody()
  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  const checks = {
    hasImageUrl: typeof payload.imageUrl === "string" && payload.imageUrl.length > 0,
    allowedImageUrl: isAllowedImageUrl(payload.imageUrl),
    allowedImageFormat: ALLOWED_IMAGE_FORMATS.includes(payload.imageFormat),
    validWidth: Number.isInteger(payload.width) && payload.width > 0,
    validHeight: Number.isInteger(payload.height) && payload.height > 0,
    allowedLicense: ALLOWED_LICENSES.includes(payload.license),
    originalityConfirmed: payload.originalityConfirmed === true,
    hasOnlyAllowedDisplayGate: payload.canShowToPlayer !== true,
  }

  assertAll(checks, "generate response does not satisfy required six-field contract.")

  return {
    status: "passed",
    checks,
    responseSummary: {
      imageUrl: summarizeImageUrl(payload.imageUrl),
      imageFormat: payload.imageFormat,
      width: payload.width,
      height: payload.height,
      license: payload.license,
      originalityConfirmed: payload.originalityConfirmed,
      canShowToPlayer: payload.canShowToPlayer ?? null,
    },
  }
}

function buildDryRunRequestBody() {
  return buildGenerateRequestBody()
}

function buildGenerateRequestBody() {
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
      packageId: "contract-test-prompt-package",
      worldId: "contract-test-world",
      tick: 0,
      canShowToPlayer: false,
      summary:
        "Contract test prompt package. This request is only for local model contract verification.",
    },
    controlSketch: {
      controlSketchId: "contract-test-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
    },
    outputSize: {
      width: 1536,
      height: 1024,
      imageFormat: "png",
    },
    imageStyle: {
      styleTarget: "static_top_down_pixel_world_frame",
      mustBeBitmap: true,
      mustNotBeProgrammaticRenderer: true,
    },
    safety: {
      canShowToPlayer: false,
      mustNotUseUnlicensedThirdPartyWorks: true,
      mustNotCopyIpCharacters: true,
      mustNotIncludeWatermark: true,
      mustNotIncludeLogo: true,
      mustNotIncludeUiCard: true,
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
      tags: [
        "image_url_required",
        "bitmap_required",
        "license_required",
        "originality_required",
      ],
    },
    visualFixHints: [],
    metadata: {
      worldId: "contract-test-world",
      tick: 0,
      promptPackageId: "contract-test-prompt-package",
      sourceFactIds: [
        "contract-test-world",
        "contract-test-visual-fact",
        "contract-test-runtime-event",
      ],
      controlSketchId: "contract-test-control-sketch",
      visualFixPlanId: null,
      canShowToPlayer: false,
      cannotApprove: true,
    },
  }
}

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options)
  const contentType = response.headers.get("content-type") || ""
  const rawText = await response.text()

  let payload = null

  if (contentType.includes("application/json")) {
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      throw new Error(`${endpoint} returned invalid JSON.`)
    }
  }

  if (!response.ok) {
    throw new Error(
      `${endpoint} returned HTTP ${response.status}: ${rawText.slice(0, 600)}`
    )
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${endpoint} did not return a JSON object.`)
  }

  return payload
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertAll(checks, message) {
  const failed = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name)

  if (failed.length > 0) {
    throw new Error(`${message} Failed checks: ${failed.join(", ")}`)
  }
}

function isAllowedImageUrl(imageUrl) {
  if (typeof imageUrl !== "string") return false
  if (imageUrl.startsWith("data:image/")) return true

  try {
    const url = new URL(imageUrl)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function summarizeImageUrl(imageUrl) {
  if (typeof imageUrl !== "string") return null
  if (imageUrl.startsWith("data:image/")) {
    return `data:image/... length=${imageUrl.length}`
  }

  return imageUrl
}

function readEnv(name) {
  const fromProcess = process.env[name]?.trim()
  if (fromProcess) return fromProcess

  const fromFile = env[name]?.trim()
  return fromFile || null
}

function loadLocalEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName)

  try {
    const content = readFileSync(filePath, "utf8")
    return parseDotEnv(content)
  } catch {
    return {}
  }
}

function parseDotEnv(content) {
  const result = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex <= 0) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

function deriveSiblingEndpoint(endpoint, siblingName) {
  if (!endpoint) return null

  try {
    const url = new URL(endpoint)
    url.pathname = `${url.pathname.replace(/\/+$/, "").replace(/\/generate$/, "")}/${siblingName}`
    return url.toString()
  } catch {
    return null
  }
}

function printTitle(title) {
  console.log("")
  console.log("=".repeat(title.length))
  console.log(title)
  console.log("=".repeat(title.length))
}

function printCheck(name, result) {
  console.log("")
  console.log(`[${name}] ${result.status}`)
}