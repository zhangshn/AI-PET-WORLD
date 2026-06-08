// 当前文件作用：定义 AI-PET-WORLD 自研真实出图 adapter 边界；默认未连接真实图像生成能力，不生成图片、不返回假图。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"

const ADAPTER_NAME = "ai-pet-world-real-image-generation-adapter"
const ADAPTER_VERSION = "adapter-not-connected-1"

export function readRealImageGenerationAdapterHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "real_image_generation_adapter_not_connected",
    adapter: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    adapterConnected: false,
    canGenerateRealBitmap: false,
    acceptsPromptPackage: true,
    acceptsControlSketch: true,
    acceptsVisualFixHints: true,
    acceptsWorldFactLockedRequest: true,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildAdapterInputContract(requiredResponseFields),
    outputContract: buildAdapterOutputContract(requiredResponseFields),
    message: "真实出图 adapter 尚未连接自研图像生成能力。",
    messageEn:
      "The real image generation adapter has not connected an in-house image generation capability yet.",
    nextStep: {
      zh: "下一步在 adapter 中接入真实自研图像生成实现；接入前不得返回假图、占位图或程序绘图结果。",
      en: "Next connect a real in-house image generation implementation inside the adapter. Before that, it must not return fake images, placeholders, or programmatic render results.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageGenerationAdapterDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "real_image_generation_adapter_not_connected",
    adapter: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    adapterConnected: false,
    canGenerateRealBitmap: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildAdapterInputContract(requiredResponseFields),
    outputContract: buildAdapterOutputContract(requiredResponseFields),
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实出图 adapter 尚未连接自研图像生成能力，因此 dry-run 不能声明会返回 6 个图片字段。",
    messageEn:
      "The real image generation adapter has not connected an in-house image generation capability, so dry-run cannot declare the six image fields yet.",
    nextStep: {
      zh: "接入真实自研图像生成实现后，dry-run 必须返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting the real in-house image generation implementation, dry-run must return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      "dry_run_blocked",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateRealImageWithAdapter(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: false,
    status: "real_image_generation_adapter_not_connected",
    adapter: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    adapterConnected: false,
    canGenerateRealBitmap: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildAdapterInputContract(requiredResponseFields),
    outputContract: buildAdapterOutputContract(requiredResponseFields),
    message:
      "真实出图 adapter 尚未连接自研图像生成能力。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real image generation adapter has not connected an in-house image generation capability. It will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步在 adapter 内接入真实自研出图实现，使它返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect the real in-house image generation implementation inside the adapter so it returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      "generate_blocked",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildAdapterInputContract(requiredResponseFields) {
  return {
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustNotRewriteWorldFacts: true,
    mustNotDisplayDirectly: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    requiredResponseFields,
  }
}

function buildAdapterOutputContract(requiredResponseFields) {
  return {
    requiredFields: requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    mustReturnBitmap: true,
    mustReturnHttpHttpsOrDataImageUrl: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}