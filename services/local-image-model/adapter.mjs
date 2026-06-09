// 当前文件作用：定义 AI-PET-WORLD 自研真实出图 adapter 边界；默认未连接真实图像生成能力，不生成图片、不返回假图。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import {
  generateRealImageWithRunner,
  readRealImageRunnerHealth,
  runRealImageRunnerDryRun,
} from "./real-image-runner.mjs"

const ADAPTER_NAME = "ai-pet-world-real-image-generation-adapter"
const ADAPTER_VERSION = "adapter-not-connected-3"

export function readRealImageGenerationAdapterHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = readRealImageRunnerHealth({
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requiredResponseFields,
  })

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
    readiness: runner.readiness,
    runner,
    message:
      "真实出图 adapter 已连接 runner 边界，但 runner 尚未连接自研推理实现。当前不能生成图片，也不会返回假图。",
    messageEn:
      "The real image generation adapter is connected to the runner boundary, but the runner has not connected the in-house inference implementation. It cannot generate images and will not return fake images.",
    nextStep: {
      zh: "下一步接入真实自研图像生成 runner implementation；接入前即使模型资产门禁通过，也不得返回假图、占位图或程序绘图结果。",
      en: "Next connect the real in-house image generation runner implementation. Before that, even if the model asset gate passes, it must not return fake images, placeholders, or programmatic render results.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      ...runner.tags,
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageGenerationAdapterDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = await runRealImageRunnerDryRun({
    requestAudit: input.requestAudit,
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requiredResponseFields,
  })

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
    readiness: runner.readiness,
    runner,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实出图 adapter 已连接 runner 边界，但 runner 尚未接入推理实现，因此 dry-run 不能声明会返回 6 个图片字段。",
    messageEn:
      "The real image generation adapter is connected to the runner boundary, but the runner has not connected inference yet, so dry-run cannot declare the six image fields.",
    nextStep: {
      zh: "接入真实自研图像生成 runner implementation 后，dry-run 才能返回 ok=true。",
      en: "After connecting the real in-house image generation runner implementation, dry-run may return ok=true.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      "dry_run_blocked",
      ...runner.tags,
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateRealImageWithAdapter(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = await generateRealImageWithRunner({
    requestAudit: input.requestAudit,
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requiredResponseFields,
  })

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
    readiness: runner.readiness,
    runner,
    message:
      "真实出图 adapter 已连接 runner 边界，但 runner 尚未接入推理实现。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real image generation adapter is connected to the runner boundary, but the runner has not connected inference yet. It will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实自研出图 runner implementation，使它写入图片文件并返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect the real in-house runner implementation so it writes image files and returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      "adapter_not_connected",
      "generate_blocked",
      ...runner.tags,
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
    mustUseRunnerBoundary: true,
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